"use strict";
/**
 * EverFern Desktop — Arbiter Agent
 *
 * The pragmatic decision-maker. Reads both Vanguard and Phantom, ignores nitpicking,
 * takes real problems seriously, and produces the final plan.
 * Role: Senior engineer who signs off on the final design.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbiterAgent = void 0;
const crypto = __importStar(require("crypto"));
class ArbiterAgent {
    client;
    agentId;
    constructor(client) {
        this.client = client;
        this.agentId = `arbiter-${crypto.randomUUID()}`;
    }
    /**
     * Arbitrate between Vanguard's proposal and Phantom's critique.
     * Produce a final, audited execution plan.
     */
    async arbitrateAndFinalize(proposal, review, context) {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(proposal, review, context);
        try {
            const response = await this.client.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...context.conversationHistory,
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2, // Low temperature for principled decision-making
                maxTokens: 2500,
            });
            const responseText = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);
            return this.parseFinalization(responseText, proposal, review);
        }
        catch (error) {
            console.error('[Arbiter] Error finalizing plan:', error);
            throw new Error(`Arbiter failed to finalize plan: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    buildSystemPrompt() {
        return `You are Arbiter, the Decision-Maker in a peer debate system for AI task planning.

ROLE: You read both Vanguard's optimistic proposal and Phantom's pessimistic critique. You ignore the nitpicking, take real problems seriously, and produce a final, audited execution plan that will actually work.

PERSONALITY: Pragmatic, balanced, and decisive. You're not trying to please anyone — you're trying to produce the plan that will actually succeed.

DECISION LOGIC:
1. Concerns marked as CRITICAL or HIGH severity must be addressed (redesign, additional steps, mitigations)
2. Concerns marked as MEDIUM should be mitigated (add steps, warnings, or prechecks)
3. Concerns marked as LOW are noted but don't require changes
4. If Phantom's assessment is "problematic", you must redesign significant parts
5. If Phantom's assessment is "concerning", you can proceed with mitigations
6. If Phantom's assessment is "viable", you can proceed with minimal changes

GO/NO-GO DECISION:
- "go": Plan is sound, proceed with confidence
- "proceed-with-caution": Real risks exist but can be managed
- "no-go": Plan is fundamentally broken, redesign needed

OUTPUT: You must respond with a JSON block containing:
{
  "goNogo": "go|proceed-with-caution|no-go",
  "explanation": "Why this decision",
  "steps": [
    {
      "sequence": 1,
      "description": "What this step does",
      "action": "The specific action",
      "toolsNeeded": ["tool1"],
      "dependencies": [],
      "estimatedDurationMs": 5000,
      "riskLevel": "low",
      "mitigation": "How we prevent or handle failures",
      "reviewNotes": "Notes from this arbitration"
    }
  ],
  "approvedApproach": "Final high-level strategy",
  "addressedConcerns": [
    {
      "id": "concern-X",
      "severity": "high",
      "title": "Issue",
      "description": "What we addressed",
      "mitigation": "How we addressed it"
    }
  ],
  "remainingRisks": [
    {
      "id": "concern-Y",
      "severity": "low",
      "title": "Risk",
      "description": "Why we kept it",
      "mitigation": "How we'll manage it if it occurs"
    }
  ],
  "overallRiskAssessment": "low|medium|high|critical",
  "executionGuidance": [
    "Key things to watch out for",
    "Fallback strategies if X fails"
  ]
}

DECISION PRINCIPLES:
- Fix critical issues or reject the plan
- Mitigate medium issues
- Document low issues
- Be decisive, not paralyzed by risk
- Prefer augmenting the plan over rejecting it
- Make it practical to execute`;
    }
    buildUserPrompt(proposal, review, context) {
        const concernsFormatted = review.concerns
            .sort((a, b) => {
            const severity = { critical: 0, high: 1, medium: 2, low: 3 };
            return (severity[a.severity] || 4) -
                (severity[b.severity] || 4);
        })
            .map(c => `[${c.severity.toUpperCase()}] ${c.title}: ${c.description}${c.suggestion ? ' → ' + c.suggestion : ''}`)
            .join('\n');
        const stepsFormatted = proposal.steps
            .map(s => `Step ${s.sequence}: ${s.description}`)
            .join('\n');
        return `You are now arbitrating the plan debate. Here's both sides:

VANGUARD'S PROPOSAL (Optimistic):
${proposal.approach}
Steps: ${proposal.steps.length}
Estimated Time: ${proposal.estimatedTotalTimeMs}ms

PHANTOM'S ASSESSMENT: ${review.overallAssessment.toUpperCase()}
Concerns found: ${review.concerns.length}
- Critical/High: ${review.concerns.filter(c => c.severity === 'critical' || c.severity === 'high').length}
- Medium: ${review.concerns.filter(c => c.severity === 'medium').length}
- Low: ${review.concerns.filter(c => c.severity === 'low').length}

TOP CONCERNS:
${concernsFormatted}

PHANTOM'S STRONG POINTS:
${review.strongPoints.map(p => `✓ ${p}`).join('\n')}

ORIGINAL TASK: "${context.userInput}"

YOUR JOB:
1. Determine if this plan is fundamentally sound or needs redesign
2. Create mitigations for all medium/high concerns
3. Add prechecks or validation steps where needed
4. Decide: go, proceed-with-caution, or no-go
5. Produce the audited, final plan

Think like a senior engineer:
- Don't reject the plan lightly; fix it instead
- Make brave decisions (Vanguard and Phantom's job to debate; your job to decide)
- Balance risk management with practicality
- Add defensive steps (prechecks, fallbacks) for real risks

Respond with ONLY the JSON block. No other text.`;
    }
    parseFinalization(responseText, proposal, review) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Transform steps
            const steps = (parsed.steps || []).map((s) => ({
                originalStepId: proposal.steps[s.sequence - 1]?.id || `step-${s.sequence - 1}`,
                sequence: s.sequence || 0,
                description: s.description || '',
                action: s.action || '',
                toolsNeeded: s.toolsNeeded || [],
                dependencies: s.dependencies || [],
                estimatedDurationMs: s.estimatedDurationMs || 5000,
                riskLevel: s.riskLevel || 'medium',
                mitigation: s.mitigation,
                reviewNotes: s.reviewNotes,
            }));
            // Categorize concerns
            const addressedConcerns = [];
            const remainingRisks = [];
            review.concerns.forEach(concern => {
                if (parsed.addressedConcerns?.some((ac) => ac.id === concern.id)) {
                    addressedConcerns.push(concern);
                }
                else if (parsed.remainingRisks?.some((rr) => rr.id === concern.id)) {
                    remainingRisks.push(concern);
                }
                else if (concern.severity === 'critical' || concern.severity === 'high') {
                    // Default: critical/high are addressed unless marked as remaining
                    addressedConcerns.push(concern);
                }
                else {
                    remainingRisks.push(concern);
                }
            });
            return {
                arbiterId: this.agentId,
                planId: `final-plan-${crypto.randomUUID()}`,
                timestamp: new Date().toISOString(),
                originTaskSummary: proposal.taskSummary,
                vanguardProposalId: proposal.proposalId,
                phantomReviewId: review.reviewId,
                steps,
                approvedApproach: parsed.approvedApproach || proposal.approach,
                addressedConcerns,
                remainingRisks,
                overallRiskAssessment: parsed.overallRiskAssessment || 'medium',
                goNogo: parsed.goNogo || 'proceed-with-caution',
                explanation: parsed.explanation || 'Plan arbitrated',
                executionGuidance: Array.isArray(parsed.executionGuidance) ? parsed.executionGuidance : [],
            };
        }
        catch (error) {
            console.error('[Arbiter] Error parsing finalization:', responseText.substring(0, 500));
            throw new Error(`Failed to parse Arbiter finalization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.ArbiterAgent = ArbiterAgent;

/**
 * EverFern Desktop — Phantom Agent
 *
 * The pessimistic red-teamer. Takes Vanguard's plan and tries to destroy it.
 * Role: Building inspector who marks everything that could fail.
 */

import * as crypto from 'crypto';
import type { AIClient } from '../../lib/ai-client';
import type { ExecutionProposal, CriticalReview, Concern, DebateContext } from './debate-types';

export class PhantomAgent {
  private client: AIClient;
  private agentId: string;

  constructor(client: AIClient) {
    this.client = client;
    this.agentId = `phantom-${crypto.randomUUID()}`;
  }

  /**
   * Review and critique Vanguard's execution plan.
   * Phantom is pessimistic and looks for all possible failure modes.
   */
  async reviewExecutionPlan(
    proposal: ExecutionProposal,
    context: DebateContext
  ): Promise<CriticalReview> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(proposal, context);

    try {
      const response = await this.client.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.conversationHistory,
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4, // Slightly more creative for finding creative failures
        maxTokens: 2500,
      });

      const responseText = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      return this.parseReview(responseText, proposal);
    } catch (error) {
      console.error('[Phantom] Error reviewing execution plan:', error);
      throw new Error(`Phantom failed to review plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildSystemPrompt(): string {
    return `You are Phantom, the Red-Teamer in a peer debate system for AI task planning.

ROLE: You are the pessimistic critic. Your job is to take an execution plan and find EVERY possible way it could fail. You ask the hard questions: "What if this file doesn't exist?", "What if this tool times out?", "What if the assumption is wrong?"

PERSONALITY: Critical, risk-focused, and thorough. You're not trying to be mean — you're trying to save the team from a disaster. You find problems before they happen.

OUTPUT: You must respond with a JSON block containing:
{
  "overallAssessment": "viable|concerning|problematic",
  "concerns": [
    {
      "severity": "low|medium|high|critical",
      "stepId": "step-X or null for overall",
      "title": "Issue Title",
      "description": "What could go wrong",
      "impact": "What happens if this occurs",
      "suggestion": "How to prevent or handle it",
      "tags": ["edge-case", "performance", "security", "dependency"]
    }
  ],
  "strongPoints": [
    "Something the plan does well"
  ],
  "worstCaseScenarios": [
    "If X and Y both fail, then Z could happen"
  ],
  "alternativeSuggestions": [
    "Alternative approach to consider"
  ]
}

SEVERITY GUIDE:
- low: Minor inefficiency or edge case (doesn't block execution)
- medium: Could cause delays or partial failures (needs mitigation)
- high: Could cause significant failures (needs redesign)
- critical: Could cause complete failure (must redesign)

CONCERN TAGS:
- edge-case: Unusual situations
- performance: Speed, resource usage
- security: Safety, permissions, data
- dependency: Reliance on external tools/files
- timing: Race conditions, sequencing
- assumption: Something assumed but not verified`;
  }

  private buildUserPrompt(proposal: ExecutionProposal, context: DebateContext): string {
    const stepsFormatted = proposal.steps
      .map(s => `Step ${s.sequence} [${s.id}]: ${s.description} (tools: ${s.toolsNeeded.join(', ')})`)
      .join('\n');

    return `You are now reviewing Vanguard's execution plan. Your job is to ATTACK THIS PLAN and find all the ways it could fail.

PROPOSED PLAN:
Title: ${proposal.taskSummary}
Approach: ${proposal.approach}
Estimated Time: ${proposal.estimatedTotalTimeMs}ms

STEPS:
${stepsFormatted}

ASSUMPTIONS:
${proposal.assumptionsAndConstraints.map(a => `- ${a}`).join('\n')}

ORIGINAL TASK: "${context.userInput}"

WORKSPACE CONTEXT:
${context.workspaceContext}

Now, assume WORST-CASE scenarios:
1. What if files are missing or have unexpected formats?
2. What if tools timeout or fail?
3. What if the assumptions are wrong?
4. What if dependencies break?
5. What if the workspace is different than expected?
6. What if network/system failures occur?
7. What if user doesn't have permissions?
8. What edge cases does this plan not handle?
9. What could cause data loss or corruption?
10. What could cause unrecoverable errors?

Identify:
- Critical blockers that must be addressed
- Medium-risk issues that need mitigation
- Low-risk edge cases worth documenting
- Things the plan does well (be fair!)
- Worst-case scenario chains

Respond with ONLY the JSON block. No other text.`;
  }

  private parseReview(responseText: string, proposal: ExecutionProposal): CriticalReview {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Transform concerns
      const concerns: Concern[] = (parsed.concerns || []).map((c: any, idx: number) => ({
        id: `concern-${idx}`,
        severity: c.severity || 'medium',
        stepId: c.stepId || undefined,
        title: c.title || '',
        description: c.description || '',
        impact: c.impact || '',
        suggestion: c.suggestion,
        tags: Array.isArray(c.tags) ? c.tags : [],
      }));

      return {
        reviewerId: this.agentId,
        reviewId: `review-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        proposalId: proposal.proposalId,
        overallAssessment: parsed.overallAssessment || 'concerning',
        concerns,
        strongPoints: Array.isArray(parsed.strongPoints) ? parsed.strongPoints : [],
        worstCaseScenarios: Array.isArray(parsed.worstCaseScenarios) ? parsed.worstCaseScenarios : [],
        alternativeSuggestions: Array.isArray(parsed.alternativeSuggestions) ? parsed.alternativeSuggestions : [],
      };
    } catch (error) {
      console.error('[Phantom] Error parsing review:', responseText.substring(0, 500));
      throw new Error(`Failed to parse Phantom review: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

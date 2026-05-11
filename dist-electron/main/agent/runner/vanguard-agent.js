"use strict";
/**
 * EverFern Desktop — Vanguard Agent
 *
 * The optimistic proposer. Analyzes the task and generates a detailed execution plan.
 * Role: Architect who draws the blueprints.
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
exports.VanguardAgent = void 0;
const crypto = __importStar(require("crypto"));
class VanguardAgent {
    client;
    agentId;
    constructor(client) {
        this.client = client;
        this.agentId = `vanguard-${crypto.randomUUID()}`;
    }
    /**
     * Propose a detailed execution plan for the given task.
     * Vanguard is optimistic and assumes best-case scenarios.
     */
    async proposeExecutionPlan(context) {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(context);
        try {
            const response = await this.client.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...context.conversationHistory,
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3, // Slightly creative but deterministic
                maxTokens: 2000,
            });
            const responseText = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);
            return this.parseProposal(responseText, context);
        }
        catch (error) {
            console.error('[Vanguard] Error proposing execution plan:', error);
            throw new Error(`Vanguard failed to propose plan: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    buildSystemPrompt() {
        return `You are Vanguard, the Proposer in a peer debate system for AI task planning.

ROLE: You are the optimistic architect. Your job is to analyze a complex task and propose a detailed, confident execution plan. You genuinely believe your plan will work because you've thought it through carefully.

PERSONALITY: Optimistic but not reckless. You propose the best forward path based on available tools and context. You don't worry about edge cases (that's Phantom's job) — you focus on the happy path.

OUTPUT: You must respond with a JSON block containing:
{
  "taskSummary": "One-line summary of what we're doing",
  "approach": "High-level strategy (2-3 sentences)",
  "rationale": "Why this approach is sound (1 paragraph)",
  "steps": [
    {
      "sequence": 1,
      "description": "What this step does",
      "action": "The specific action to take",
      "toolsNeeded": ["tool1", "tool2"],
      "dependencies": [],
      "estimatedDurationMs": 5000,
      "riskLevel": "low"
    }
    // ... more steps
  ],
  "parallelizable": false,
  "estimatedTotalTimeMs": 30000,
  "requiredTools": ["tool1", "tool2"],
  "assumptionsAndConstraints": [
    "All required files exist",
    "Network is available",
    "User has necessary permissions"
  ]
}

CONSTRAINTS:
- Each step must be actionable and clear
- Dependencies must reference earlier steps by sequence number
- Risk levels are: low (routine), medium (some complexity), high (significant risk)
- Dependencies should form a DAG (no circular dependencies)
- Estimate durations realistically
- Only use tools from the available tools list`;
    }
    buildUserPrompt(context) {
        const toolsList = context.availableTools.join(', ');
        const constraintsText = context.constraints?.length
            ? `Constraints: ${context.constraints.join('; ')}`
            : '';
        return `You are designing an execution plan for this task:

TASK: "${context.userInput}"

AVAILABLE TOOLS: ${toolsList}

WORKSPACE CONTEXT:
${context.workspaceContext}

${constraintsText}

CONVERSATION HISTORY (last few messages):
${context.conversationHistory.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Generate a detailed execution plan. Think step-by-step:
1. What is the core objective?
2. What are the main phases of work?
3. What tools do we need?
4. What order should steps happen in?
5. Which steps can run in parallel?

Respond with ONLY the JSON block. No other text.`;
    }
    parseProposal(responseText, context) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Transform steps to include IDs
            const steps = (parsed.steps || []).map((step, idx) => ({
                id: `step-${idx}`,
                sequence: step.sequence || idx + 1,
                description: step.description || '',
                action: step.action || '',
                toolsNeeded: step.toolsNeeded || [],
                dependencies: this.normalizeStepDependencies(step.dependencies || []),
                estimatedDurationMs: step.estimatedDurationMs || 5000,
                riskLevel: step.riskLevel || 'medium',
            }));
            return {
                proposerId: this.agentId,
                proposalId: `proposal-${crypto.randomUUID()}`,
                timestamp: new Date().toISOString(),
                taskSummary: parsed.taskSummary || 'Unnamed task',
                approach: parsed.approach || '',
                steps,
                parallelizable: parsed.parallelizable || false,
                estimatedTotalTimeMs: parsed.estimatedTotalTimeMs || 30000,
                requiredTools: parsed.requiredTools || [],
                assumptionsAndConstraints: parsed.assumptionsAndConstraints || [],
                rationale: parsed.rationale || '',
            };
        }
        catch (error) {
            console.error('[Vanguard] Error parsing proposal:', responseText.substring(0, 500));
            throw new Error(`Failed to parse Vanguard proposal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    normalizeStepDependencies(dependencies) {
        if (!Array.isArray(dependencies))
            return [];
        return dependencies.map(dep => {
            if (typeof dep === 'number') {
                return `step-${dep - 1}`; // Convert from sequence number to step ID
            }
            return String(dep);
        }).filter(Boolean);
    }
}
exports.VanguardAgent = VanguardAgent;

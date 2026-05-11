"use strict";
/**
 * EverFern Desktop — Debate Engine Example Integration
 *
 * This file shows a concrete example of how to integrate the Peer Agent Debate Engine
 * into the AgentRunner class. This is NOT part of the core engine — it's a reference
 * implementation showing how to wire it up.
 *
 * To use this, copy the relevant methods into your AgentRunner class.
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
exports.AgentRunnerDebateIntegration = void 0;
const crypto = __importStar(require("crypto"));
const debate_engine_1 = require("./debate-engine");
// ════════════════════════════════════════════════════════════════════════════
// 1. Add to AgentRunner constructor
// ════════════════════════════════════════════════════════════════════════════
class AgentRunnerDebateIntegration {
    debateEngine = null;
    lastDebateResult = null;
    client;
    tools = [];
    workspaceDir;
    projectId;
    /**
     * Initialize the Debate Engine in AgentRunner constructor.
     * Add this to your existing AgentRunner constructor:
     */
    initializeDebateEngine() {
        if (!this.client) {
            console.warn('[AgentRunner] Cannot initialize debate engine without AI client');
            return;
        }
        this.debateEngine = new debate_engine_1.PeerAgentDebateEngine(this.client, {
            enableDebate: true,
            complexityThreshold: 'moderate', // Debate for moderate+ complexity tasks
            timeoutMs: 60000, // 60 second hard limit for entire debate
            vanguardTimeoutMs: 15000,
            phantomTimeoutMs: 20000,
            arbiterTimeoutMs: 15000,
            verbose: true, // Log the debate transcript
        });
        console.log('[AgentRunner] ✅ Debate Engine initialized and ready');
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 2. Complexity Analysis
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Analyze task complexity to decide if debate is needed.
     * Call this after triage to determine complexity level.
     */
    async analyzeTaskComplexity(userInput) {
        if (!this.client)
            return 'moderate';
        const systemPrompt = `You are a task complexity analyzer. Classify the complexity of this task.

SIMPLE: Single operation, straightforward, no dependencies
- Example: "What's the weather?", "Write a hello world program"

MODERATE: Multiple steps, some coordination, manageable complexity
- Example: "Set up a Node.js project", "Add authentication to my app"

COMPLEX: Many interdependencies, careful planning required, high risk if wrong
- Example: "Refactor my entire codebase", "Set up a distributed system", "Implement a complex feature"

Respond with JSON: {"complexity":"simple"|"moderate"|"complex","confidence":0.0-1.0}`;
        try {
            const response = await this.client.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userInput }
                ],
                temperature: 0,
                maxTokens: 100,
            });
            const responseText = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);
            const match = responseText.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                return parsed.complexity || 'moderate';
            }
        }
        catch (error) {
            console.warn('[AgentRunner] Complexity analysis failed:', error);
        }
        return 'moderate';
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 3. Debate Activation
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Main method: Run debate if task is complex enough.
     * Call this before normal execution flow.
     *
     * Example usage:
     * ```
     * const debatePlan = await agentRunner.maybeActivateDebate(
     *   userInput,
     *   conversationHistory,
     *   complexity
     * );
     *
     * if (debatePlan) {
     *   // Use debate-approved plan
     *   await executeDebatePlan(debatePlan);
     * } else {
     *   // Use normal execution
     *   await normalExecution();
     * }
     * ```
     */
    async maybeActivateDebate(userInput, conversationHistory, complexity) {
        if (!this.debateEngine) {
            console.log('[AgentRunner] Debate engine not initialized');
            return null;
        }
        // Check if debate should run
        const shouldDebate = debate_engine_1.PeerAgentDebateEngine.shouldDebate(complexity, 'moderate' // threshold from config
        );
        if (!shouldDebate) {
            console.log(`[AgentRunner] Skipping debate for "${complexity}" task`);
            return null;
        }
        console.log(`[AgentRunner] 🎭 Task complexity is "${complexity}" — activating debate engine`);
        try {
            // Prepare debate context
            const context = {
                taskId: crypto.randomUUID(),
                userInput,
                conversationHistory,
                availableTools: this.tools.map(t => t.name),
                workspaceContext: this.buildWorkspaceContext(),
                constraints: this.buildTaskConstraints(),
            };
            // Run the debate
            const debateResult = await this.debateEngine.debate(context);
            // Store for audit trail
            this.lastDebateResult = debateResult;
            // Check if plan is executable
            if (debateResult.finalPlan.goNogo === 'no-go') {
                console.error('[AgentRunner] ❌ Debate concluded plan is not executable:', debateResult.finalPlan.explanation);
                throw new Error(`Debate Engine: Plan deemed not executable. ${debateResult.finalPlan.explanation}`);
            }
            console.log(`[AgentRunner] ✅ Debate approved plan: ${debateResult.finalPlan.goNogo.toUpperCase()}`);
            return debateResult.finalPlan;
        }
        catch (error) {
            console.error('[AgentRunner] Debate engine error:', error);
            // Fall back to normal execution
            console.log('[AgentRunner] Falling back to normal execution (debate failed)');
            return null;
        }
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 4. Context Builders
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Build workspace context for debate.
     * Provides the agents with current environment information.
     */
    buildWorkspaceContext() {
        return `
Project Environment:
- Workspace: ${this.workspaceDir || 'N/A'}
- Project ID: ${this.projectId || 'N/A'}
- Current Time: ${new Date().toISOString()}
- Tools Available: ${this.tools.length}
- Node Version: ${process.version}
- Platform: ${process.platform}
    `.trim();
    }
    /**
     * Build task constraints for debate.
     * Helps agents understand what NOT to do.
     */
    buildTaskConstraints() {
        return [
            'Cannot delete files without explicit user confirmation',
            'Cannot modify files outside workspace directory',
            'Must preserve existing functionality and tests',
            'Should not modify unrelated code',
            'Must work within 60-second timeout',
            'Cannot access user credentials or tokens',
        ];
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 5. Debate Plan Execution
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Convert debate plan to executable steps and run them.
     */
    async executeDebatePlan(finalPlan) {
        console.log(`\n[AgentRunner] 🚀 Executing Debate-Approved Plan`);
        console.log(`   Steps: ${finalPlan.steps.length}`);
        console.log(`   Risk: ${finalPlan.overallRiskAssessment}`);
        console.log(`   Status: ${finalPlan.goNogo}`);
        if (finalPlan.goNogo === 'proceed-with-caution') {
            console.log('\n⚠️  Key Things to Watch:');
            finalPlan.executionGuidance.forEach(guidance => {
                console.log(`   → ${guidance}`);
            });
        }
        const results = [];
        for (const step of finalPlan.steps) {
            console.log(`\n[Step ${step.sequence}] ${step.description}`);
            if (step.mitigation) {
                console.log(`   Mitigation: ${step.mitigation}`);
            }
            try {
                // Execute the step
                // This would call the actual tool execution logic
                // For now, we just log it
                const result = await this.executeStep(step);
                results.push(result);
                console.log(`   ✅ Complete`);
            }
            catch (error) {
                console.error(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
                throw error;
            }
        }
        return results.join('\n');
    }
    /**
     * Execute a single step from the debate plan.
     */
    async executeStep(step) {
        // This is a placeholder. In real implementation, this would:
        // 1. Parse the step.action
        // 2. Call appropriate tools
        // 3. Return result
        console.log(`   Action: ${step.action}`);
        console.log(`   Tools: ${step.toolsNeeded.join(', ')}`);
        return `Step ${step.sequence} executed`;
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 6. Audit Trail & Logging
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Get the last debate result for auditing.
     */
    getLastDebateResult() {
        return this.lastDebateResult;
    }
    /**
     * Export debate result as JSON for logging.
     */
    exportLastDebate() {
        if (!this.lastDebateResult) {
            return '{}';
        }
        return JSON.stringify(this.lastDebateResult, null, 2);
    }
    /**
     * Get human-readable debate summary.
     */
    getDebatetSummary() {
        if (!this.lastDebateResult || !this.debateEngine) {
            return 'No debate run yet';
        }
        return this.debateEngine.summarizeDebate(this.lastDebateResult);
    }
    // ════════════════════════════════════════════════════════════════════════════
    // 7. Integration Example
    // ════════════════════════════════════════════════════════════════════════════
    /**
     * Example: Complete integration into main execution flow.
     * This shows how all pieces fit together.
     */
    async exampleCompleteFlow(userInput, history) {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('AGENT EXECUTION WITH DEBATE ENGINE');
        console.log('═══════════════════════════════════════════════════════════\n');
        try {
            // Step 1: Analyze complexity
            console.log('📊 Step 1: Analyzing task complexity...');
            const complexity = await this.analyzeTaskComplexity(userInput);
            console.log(`   Complexity: ${complexity}`);
            // Step 2: Maybe run debate
            console.log('\n🎭 Step 2: Checking if debate is needed...');
            const debatePlan = await this.maybeActivateDebate(userInput, history, complexity);
            if (debatePlan) {
                // Step 3a: Execute debate plan
                console.log('\n✅ Step 3: Using debate-approved execution plan');
                const result = await this.executeDebatePlan(debatePlan);
                console.log('\n📝 Debate Summary:');
                console.log(this.getDebatetSummary());
                return result;
            }
            else {
                // Step 3b: Use normal execution
                console.log('\n✅ Step 3: Using standard execution path');
                console.log('(Normal agent execution would happen here)');
                return 'Execution completed via standard path';
            }
        }
        catch (error) {
            console.error('\n❌ Execution failed:', error);
            throw error;
        }
    }
}
exports.AgentRunnerDebateIntegration = AgentRunnerDebateIntegration;

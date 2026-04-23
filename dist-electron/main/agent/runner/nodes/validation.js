"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationNode = void 0;
const mission_integrator_1 = require("../mission-integrator");
const MAX_ITERATIONS = 50;
/**
 * Tools that are always safe and should never trigger HITL approval.
 * These are internal bookkeeping operations with no destructive side effects.
 */
const SAFE_TOOL_WHITELIST = new Set([
    'update_plan_step',
    'create_plan',
    'todo_write',
    'memory_save',
    'memory_search',
    'read_file',
    'view_file',
    'list_directory',
    'execution_plan',
]);
/**
 * AI-based tool risk assessment
 * Replaces keyword-based risk detection with semantic analysis
 */
async function assessToolRisk(toolCalls, client) {
    if (!toolCalls || toolCalls.length === 0)
        return false;
    // Whitelist check: if ALL pending tool calls are safe internal tools, skip risk assessment
    const allSafe = toolCalls.every(tc => SAFE_TOOL_WHITELIST.has(tc.name));
    if (allSafe) {
        return false;
    }
    if (!client) {
        // Fallback: conservative approach - assume high risk if no AI available
        return toolCalls.length > 0;
    }
    try {
        const toolSummary = toolCalls.map(tc => `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)})`).join(', ');
        const prompt = `Analyze these tool calls and determine if they pose high risk (destructive operations, system modifications, data loss potential).

Tool calls: ${toolSummary}

Consider high risk:
- Command execution that could modify system state
- File deletion or overwriting
- Database modifications
- Network operations that could expose data
- Any operation that could cause data loss

Consider low risk:
- Read-only operations
- File creation in safe locations
- Non-destructive queries
- Information retrieval

Respond with JSON:
{
  "isHighRisk": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 200
        });
        let responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Remove markdown code blocks if present
        responseContent = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const analysis = JSON.parse(responseContent);
        return analysis.isHighRisk && analysis.confidence > 0.7;
    }
    catch (err) {
        console.warn('[Validation] AI risk assessment failed:', err);
        // Fallback: conservative approach
        return true;
    }
}
/**
 * Evaluates whether the task objective has been achieved and the mission should complete.
 *
 * Uses AI-based semantic analysis instead of keyword matching to determine completion.
 *
 * @param state - Current graph state
 * @param client - AI client for semantic analysis
 * @returns true if task should complete (route to END), false if should continue iterating
 */
async function shouldCompleteTask(state, client) {
    // 1. Force completion at max iterations to prevent infinite loops
    if (state.iterations >= MAX_ITERATIONS) {
        return true;
    }
    // 2. Read-only tasks (questions, conversations) can complete without tools
    const isReadOnlyIntent = state.currentIntent === 'question' || state.currentIntent === 'conversation';
    if (isReadOnlyIntent) {
        return true;
    }
    // 3. Check if decomposed task exists and all steps are complete
    if (state.decomposedTask) {
        // For complex tasks with decomposition, use more conservative completion criteria
        const task = state.decomposedTask;
        const toolCallHistory = state.toolCallHistory || state.toolCallRecords || [];
        // Check if we have executed tools that correspond to the task steps
        const criticalSteps = task.steps.filter(s => s.priority === 'critical');
        const totalSteps = task.steps.length;
        // If we have critical steps, ensure we've made progress on them
        if (criticalSteps.length > 0) {
            // Check if we've executed tools for critical steps
            const criticalToolsNeeded = new Set(criticalSteps.map(s => s.tool).filter(t => t && t !== 'internal'));
            const toolsExecuted = new Set(toolCallHistory.map((tc) => tc.name || tc.tool));
            // Count how many critical tools have been executed
            let criticalToolsExecuted = 0;
            for (const tool of criticalToolsNeeded) {
                if (toolsExecuted.has(tool)) {
                    criticalToolsExecuted++;
                }
            }
            // If we haven't executed any critical tools yet, don't complete
            if (criticalToolsExecuted === 0 && criticalToolsNeeded.size > 0) {
                return false;
            }
        }
        // For complex tasks (many steps), require more evidence of completion
        if (totalSteps >= 5) {
            // Check if we've made sufficient tool calls relative to the number of steps
            const minToolCallsExpected = Math.ceil(totalSteps * 0.5); // At least 50% of steps should have tool calls
            if (toolCallHistory.length < minToolCallsExpected) {
                return false;
            }
        }
        // If we reach here with a decomposed task, use AI analysis to determine completion
        // Fall through to AI analysis below
    }
    // 4. Use AI to analyze last assistant message for completion
    const messages = state.messages || [];
    const lastAssistantMessage = [...messages].reverse().find(m => {
        // Handle both LangChain BaseMessage and plain message objects
        const role = m.role || m._getType?.();
        return role === 'assistant' || role === 'ai';
    });
    if (lastAssistantMessage && client) {
        const content = typeof lastAssistantMessage.content === 'string'
            ? lastAssistantMessage.content
            : lastAssistantMessage.content?.text || '';
        if (content && content.length > 10) {
            try {
                // Use AI to determine if the task is complete
                const analysisPrompt = `Analyze this assistant message and determine if it indicates task completion.

Message: "${content.substring(0, 500)}"

Does this message indicate that the task is complete? Consider:
- Explicit completion statements
- Final results being presented
- Task objectives being met
- No indication of pending work

Respond with JSON:
{
  "isComplete": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
                const response = await client.chat({
                    messages: [{ role: 'user', content: analysisPrompt }],
                    responseFormat: 'json',
                    temperature: 0.1,
                    maxTokens: 200
                });
                let responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                // Remove markdown code blocks if present
                responseContent = responseContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                const analysis = JSON.parse(responseContent);
                // Only consider complete if AI is confident (>0.7)
                if (analysis.isComplete && analysis.confidence > 0.7) {
                    return true;
                }
            }
            catch (err) {
                // If AI analysis fails, fall back to conservative approach
                console.warn('[Validation] AI completion analysis failed:', err);
            }
        }
    }
    // 5. Default: continue iterating (conservative approach)
    // Better to iterate unnecessarily than to complete prematurely
    return false;
}
const createValidationNode = (runner, missionTracker, shouldAbort) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal before processing
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        integrator.startNode('validation', 'Validating tool calls for safety');
        try {
            runner.telemetry.transition('validation');
            // Use AI to assess tool risk instead of keyword matching
            const isHighRisk = await assessToolRisk(state.pendingToolCalls || [], runner.client);
            // Evaluate whether task should complete or continue iterating
            const taskShouldComplete = await shouldCompleteTask(state, runner.client);
            const result = {
                taskPhase: 'validation',
                validationResult: {
                    isHighRisk,
                    reasoning: isHighRisk ? 'Dangerous tool detected' : 'Safe operation'
                },
                shouldContinueIteration: !taskShouldComplete
            };
            integrator.completeNode('validation', `Validation complete: ${result.validationResult.reasoning}`);
            return result;
        }
        catch (error) {
            integrator.failNode('validation', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createValidationNode = createValidationNode;

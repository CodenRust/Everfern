"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createValidationNode = void 0;
const mission_integrator_1 = require("../mission-integrator");
const MAX_ITERATIONS = 50;
/**
 * AI-based tool risk assessment
 * Replaces keyword-based risk detection with semantic analysis
 */
async function assessToolRisk(toolCalls, client) {
    if (!toolCalls || toolCalls.length === 0)
        return false;
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
        // If we have a task decomposition, check if all steps are marked complete
        // For now, we'll assume incomplete if we're here without tools
        // This is a conservative approach - better to iterate than complete prematurely
        return false;
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

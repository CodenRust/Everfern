"use strict";
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
exports.createDecomposerNode = void 0;
const mission_integrator_1 = require("../mission-integrator");
/**
 * AI-powered Task Decomposer Node
 *
 * Uses a specialized sub-agent to break down complex user requests
 * into dependency-aware, parallelizable execution steps.
 */
const createDecomposerNode = (runner, eventQueue, missionTracker, shouldAbort) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        integrator.startNode('decomposer', 'Intelligently decomposing task into execution steps');
        try {
            runner.telemetry.transition('decomposer');
            eventQueue?.push({ type: 'thought', content: '🧠 Decomposer: Analyzing task structure and dependencies...' });
            const intent = state.currentIntent || 'task';
            const lastUserMsg = state.messages.filter(m => {
                const msg = m;
                return msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human';
            }).pop();
            const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
            // Get available tools for the decomposer
            const toolDefs = runner._buildToolDefinitions();
            const toolsSummary = toolDefs.map((t) => `- ${t.name}: ${t.description}`).join('\n');
            const prompt = `You are the EverFern NEXUS Decomposer. 
Your goal is to break down the user's request into a structured execution plan.

USER REQUEST: "${content}"
INTENT: "${intent}"

AVAILABLE TOOLS:
${toolsSummary}

DECOMPOSITION RULES:
1. If the user mentions opening, launching, or interacting with a specific application (e.g., Spotify, Chrome, Discord, VS Code, Browser, etc), you MUST create EXACTLY ONE step using the "computer_use" tool.
2. For GUI/Automation tasks, the "task" argument to "computer_use" should be the user's original request.
3. For coding tasks, use: analyze -> edit -> verify.
4. For research tasks, use: search -> fetch -> summarize.
5. Identify parallelizable steps and assign "parallelGroup" (number).
6. Use "dependsOn" (array of step IDs) for sequential dependencies.
7. The first step ID MUST be "step_1".

Respond with JSON only:
{
  "title": "Short descriptive title",
  "steps": [
    {
      "id": "step_1",
      "description": "What to do",
      "tool": "tool_name",
      "dependsOn": [],
      "canParallelize": true/false,
      "priority": "low" | "normal" | "critical",
      "estimatedComplexity": "low" | "medium" | "high",
      "parallelGroup": 1
    }
  ],
  "canParallelize": true/false,
  "executionMode": "sequential" | "parallel" | "hybrid"
}`;
            const startTime = Date.now();
            const response = await runner.client.chat({
                messages: [{ role: 'user', content: prompt }],
                responseFormat: 'json',
                temperature: 0.1,
                maxTokens: 1000
            });
            const duration = Date.now() - startTime;
            runner.telemetry.info(`[Decomposer] AI decomposition completed in ${duration}ms`);
            let jsonContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
            jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            const decomposed = JSON.parse(jsonContent);
            // Ensure totalSteps is set
            decomposed.totalSteps = decomposed.steps.length;
            decomposed.id = `task_${Date.now()}`;
            runner.telemetry.info(`[Decomposer] Task split into ${decomposed.totalSteps} steps (${decomposed.executionMode})`);
            eventQueue?.push({
                type: 'task_analyzed',
                analysis: {
                    complexity: decomposed.totalSteps > 5 ? 'complex' : 'simple',
                    canParallelize: decomposed.canParallelize,
                    suggestedApproach: decomposed.executionMode
                }
            });
            // Emit plan created event for UI
            eventQueue?.push({
                type: 'plan_created',
                plan: {
                    id: decomposed.id,
                    title: decomposed.title,
                    steps: decomposed.steps.map(s => ({
                        id: s.id,
                        description: s.description,
                        tool: s.tool
                    }))
                }
            });
            const result = {
                decomposedTask: decomposed,
                taskPhase: 'planning',
            };
            integrator.completeNode('decomposer', `Decomposed into ${decomposed.totalSteps} steps`);
            return result;
        }
        catch (error) {
            runner.telemetry.warn(`[Decomposer] AI decomposition failed: ${error instanceof Error ? error.message : String(error)}. Falling back to heuristic.`);
            // Fallback to the old heuristic if AI fails
            const { decomposeTask } = await Promise.resolve().then(() => __importStar(require('../task-decomposer')));
            const lastUserMsg = state.messages.filter(m => m.role === 'user' || m.type === 'human').pop();
            const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
            const decomposed = decomposeTask(content, []);
            integrator.completeNode('decomposer', 'Decomposed using fallback heuristic');
            return {
                decomposedTask: decomposed,
                taskPhase: 'planning',
            };
        }
    };
};
exports.createDecomposerNode = createDecomposerNode;

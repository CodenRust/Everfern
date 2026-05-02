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
            const lastUserMsg = state.messages.filter(m => {
                const msg = m;
                return msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human';
            }).pop();
            const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
            const isPlanApproval = content.includes('[PLAN_APPROVED]');
            // Check if plan already exists and has progress or is approved to prevent re-decomposition glitches
            if (state.decomposedTask && (isPlanApproval || (state.completedSteps && state.completedSteps.length > 0))) {
                console.log(`[Decomposer] Skipping decomposition: existing plan found. Approval: ${isPlanApproval}, Completed: ${state.completedSteps?.length || 0}`);
                return { taskPhase: 'planning' };
            }
            runner.telemetry.transition('decomposer');
            eventQueue?.push({ type: 'thought', content: '🧠 Decomposer: Analyzing task structure using AI classification...' });
            const startTime = Date.now();
            // Use AI-powered decomposition when a client is available, regex fallback otherwise
            const { decomposeTaskWithAI } = await Promise.resolve().then(() => __importStar(require('../task-decomposer')));
            const toolDefs = runner._buildToolDefinitions?.() || [];
            const toolNames = toolDefs.map((t) => t.name);
            const decomposed = await decomposeTaskWithAI(content, toolNames || [], runner.client ?? undefined);
            // Ensure totalSteps and unique ID are set
            decomposed.totalSteps = decomposed.steps.length;
            decomposed.id = `task_${Date.now()}`;
            const duration = Date.now() - startTime;
            runner.telemetry.info(`[Decomposer] Task split into ${decomposed.totalSteps} steps in ${duration}ms (${decomposed.executionMode}) via AI classification`);
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
            integrator.completeNode('decomposer', `Decomposed into ${decomposed.totalSteps} steps (Fast Heuristic)`);
            return result;
        }
        catch (error) {
            runner.telemetry.warn(`[Decomposer] Fast decomposition failed: ${error instanceof Error ? error.message : String(error)}`);
            integrator.completeNode('decomposer', 'Decomposition failed');
            throw error;
        }
    };
};
exports.createDecomposerNode = createDecomposerNode;

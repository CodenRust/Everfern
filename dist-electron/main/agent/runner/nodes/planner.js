"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlannerNode = void 0;
const task_decomposer_1 = require("../task-decomposer");
const node_utils_1 = require("../services/node-utils");
const messages_1 = require("@langchain/core/messages");
const mission_integrator_1 = require("../mission-integrator");
const createPlannerNode = (runner, eventQueue, missionTracker) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        integrator.startNode('planner', 'Compiling execution pipeline');
        try {
            const logger = (0, node_utils_1.nodeLifecycle)(runner, 'planner');
            logger.info('Compiling execution pipeline and integrating context hints...');
            if (!state.decomposedTask) {
                logger.warn('Execution plan missing. Proceeding with direct model-driven logic.');
                integrator.completeNode('planner', 'No task decomposition needed');
                return { taskPhase: 'executing' };
            }
            const isReadOnly = ['conversation', 'question'].includes(state.currentIntent || '');
            if (isReadOnly) {
                logger.info('Read-only task detected. Skipping execution pipeline compilation.');
                integrator.completeNode('planner', 'Read-only task identified');
                return {
                    taskPhase: 'executing',
                    messages: [new messages_1.SystemMessage("Proceed with responding to the user's request directly.")]
                };
            }
            const planText = (0, task_decomposer_1.generatePlanText)(state.decomposedTask);
            let agiHints = state.agiHints || '';
            eventQueue?.push({
                type: 'plan_created',
                plan: {
                    id: state.decomposedTask.id,
                    title: state.decomposedTask.title,
                    steps: state.decomposedTask.steps.map((s) => ({
                        id: s.id,
                        description: s.description,
                        tool: s.tool
                    }))
                }
            });
            eventQueue?.push({ type: 'thought', content: `Compiling execution pipeline for: ${state.decomposedTask.title}` });
            const systemMessage = `AS AN AGI ORCHESTRATOR, follow this task decomposition plan strictly:\n\n${planText}\n\n${agiHints}\nIMPORTANT: Execute parallel groups using your execution tools concurrently if applicable. Don't ask for permission to proceed with the plan, just execute it step by step.`;
            logger.info(`Execution pipeline finalized. System ready for task processing.`);
            const result = {
                taskPhase: 'executing',
                messages: [
                    new messages_1.SystemMessage(systemMessage)
                ]
            };
            integrator.completeNode('planner', 'Execution pipeline compiled');
            return result;
        }
        catch (error) {
            integrator.failNode('planner', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createPlannerNode = createPlannerNode;

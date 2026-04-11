"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlannerNode = void 0;
const task_decomposer_1 = require("../task-decomposer");
const langgraph_1 = require("@langchain/langgraph");
const node_utils_1 = require("../services/node-utils");
const messages_1 = require("@langchain/core/messages");
const createPlannerNode = (runner, eventQueue) => {
    return async (state) => {
        const logger = (0, node_utils_1.nodeLifecycle)(runner, 'planner');
        logger.info('Compiling execution pipeline and integrating context hints...');
        if (!state.decomposedTask) {
            logger.warn('Execution plan missing. Proceeding with direct model-driven logic.');
            return { taskPhase: 'executing' };
        }
        const isReadOnly = ['conversation', 'question'].includes(state.currentIntent || '');
        if (isReadOnly) {
            logger.info('Read-only task detected. Skipping execution pipeline compilation.');
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
                steps: state.decomposedTask.steps.map(s => ({
                    id: s.id,
                    description: s.description,
                    tool: s.tool
                }))
            }
        });
        eventQueue?.push({ type: 'thought', content: `Compiling execution pipeline for: ${state.decomposedTask.title}` });
        const feedback = (0, node_utils_1.handleApproval)(state, state.decomposedTask, langgraph_1.interrupt);
        logger.info(`Plan review feedback received: ${typeof feedback === 'string' ? feedback.substring(0, 50) : '...'}...`);
        if (typeof feedback === 'string' && feedback.toLowerCase().includes('reject')) {
            logger.warn('Plan rejected by human.');
            return {
                taskPhase: 'evaluating',
                messages: [new messages_1.SystemMessage(`The user rejected the plan with feedback: ${feedback}`)],
            };
        }
        const systemMessage = `AS AN AGI ORCHESTRATOR, follow this task decomposition plan strictly:\n\n${planText}\n\n${agiHints}\nIMPORTANT: Execute parallel groups using your execution tools concurrently if applicable. Don't ask for permission to proceed with the plan, just execute it step by step.`;
        logger.info(`Execution pipeline finalized. System ready for task processing.`);
        return {
            taskPhase: 'executing',
            messages: [
                new messages_1.SystemMessage(systemMessage)
            ]
        };
    };
};
exports.createPlannerNode = createPlannerNode;

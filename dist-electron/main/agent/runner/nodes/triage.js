"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTriageNode = void 0;
const triage_1 = require("../triage");
const createTriageNode = (runner, eventQueue) => {
    return async (state) => {
        runner.telemetry.transition('triage');
        runner.telemetry.info('Analyzing user intent and decomposing task requirements...');
        eventQueue?.push({ type: 'thought', content: '🤖 Triage in progress: Analyzing intent and conversation context...' });
        const lastUserMsg = state.messages.filter(m => m.role === 'user').pop();
        const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
        // Pass entire state.messages for context-aware classification
        const classification = await (0, triage_1.classifyIntent)(content, runner.client, state.messages);
        runner.telemetry.info(`Intent identified: ${classification.intent.toUpperCase()} (${Math.round(classification.confidence * 100)}% confidence)`);
        if (classification.reasoning) {
            runner.telemetry.info(`Classification logic: ${classification.reasoning}`);
            eventQueue?.push({ type: 'thought', content: `Intent Classification: ${classification.reasoning}` });
        }
        eventQueue?.push({
            type: 'intent_classified',
            intent: classification.intent,
            confidence: classification.confidence,
            phase: 'triage'
        });
        const { decomposeTask, getAGIHints } = require('../task-decomposer');
        const decomposed = decomposeTask(content, []);
        const agiHints = getAGIHints(content);
        runner.telemetry.info(`Graph expansion: ${decomposed.totalSteps} steps (Decomposition Mode: ${decomposed.executionMode})`);
        eventQueue?.push({
            type: 'task_analyzed',
            analysis: {
                complexity: decomposed.totalSteps > 5 ? 'complex' : 'simple',
                canParallelize: decomposed.canParallelize,
                suggestedApproach: decomposed.executionMode
            }
        });
        return {
            currentIntent: classification.intent,
            intentConfidence: classification.confidence,
            taskPhase: 'planning',
            decomposedTask: decomposed,
            agiHints: agiHints,
        };
    };
};
exports.createTriageNode = createTriageNode;

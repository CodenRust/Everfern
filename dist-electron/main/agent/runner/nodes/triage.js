"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTriageNode = void 0;
const triage_1 = require("../triage");
const mission_integrator_1 = require("../mission-integrator");
const task_decomposer_1 = require("../task-decomposer");
const createTriageNode = (runner, eventQueue, missionTracker, shouldAbort) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        integrator.startNode('triage', 'Analyzing user intent and decomposing task');
        // Emit phase change event for triage phase
        if (missionTracker) {
            missionTracker.setPhase('triage');
        }
        try {
            runner.telemetry.transition('triage');
            runner.telemetry.info('Analyzing user intent and decomposing task requirements...');
            eventQueue?.push({ type: 'thought', content: '🤖 Triage in progress: Analyzing intent and conversation context...' });
            const lastUserMsg = state.messages.filter(m => {
                const msg = m;
                return msg.role === 'user' || msg.type === 'human' || msg._getType?.() === 'human';
            }).pop();
            const content = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content)) : '';
            // Pass entire state.messages for context-aware classification
            let classification;
            try {
                classification = await (0, triage_1.classifyIntent)(content, runner.client, state.messages);
            }
            catch (connErr) {
                const msg = connErr instanceof Error ? connErr.message : String(connErr);
                const isConnectionError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND');
                if (isConnectionError) {
                    console.warn('[Triage] AI provider unreachable, using fallback classification:', msg);
                    classification = (0, triage_1.classifyIntentFallback)(content, state.messages);
                }
                else {
                    throw connErr;
                }
            }
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
            const decomposed = (0, task_decomposer_1.decomposeTask)(content, []);
            const agiHints = (0, task_decomposer_1.getAGIHints)(content);
            runner.telemetry.info(`Graph expansion: ${decomposed.totalSteps} steps (Decomposition Mode: ${decomposed.executionMode})`);
            eventQueue?.push({
                type: 'task_analyzed',
                analysis: {
                    complexity: decomposed.totalSteps > 5 ? 'complex' : 'simple',
                    canParallelize: decomposed.canParallelize,
                    suggestedApproach: decomposed.executionMode
                }
            });
            const result = {
                currentIntent: classification.intent,
                intentConfidence: classification.confidence,
                taskPhase: 'planning',
                decomposedTask: decomposed,
                agiHints: agiHints,
            };
            integrator.completeNode('triage', `Intent classified as: ${classification.intent}`);
            return result;
        }
        catch (error) {
            integrator.failNode('triage', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createTriageNode = createTriageNode;

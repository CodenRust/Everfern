"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDebateChamberNode = void 0;
const debate_engine_1 = require("../debate-engine");
const debate_event_emitter_1 = require("../debate-event-emitter");
const mission_integrator_1 = require("../mission-integrator");
console.log('[DebateChamber] 📦 Module loaded');
const createDebateChamberNode = (runner, eventQueue, missionTracker, shouldAbort, sendIPC) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    const emitDebateEvent = (type, debateId, data, error) => {
        const debateEvent = { type, timestamp: new Date().toISOString(), debateId, data, error };
        eventQueue?.push({
            type: 'debate_event',
            debateEvent,
        });
        // Send directly via IPC as well (bypasses event queue → runner → agent.ts chain)
        if (sendIPC) {
            console.log('[DebateChamber] Sending IPC directly:', type, debateId);
            sendIPC('debate:stream', debateEvent);
        }
    };
    return async (state) => {
        console.log('[DebateChamber] 🔥 NODE INVOKED');
        console.log(`[DebateChamber] decomposedTask:`, state.decomposedTask ? 'EXISTS' : 'null');
        if (state.decomposedTask) {
            const plan = state.decomposedTask;
            console.log(`[DebateChamber] Steps: ${plan.steps?.length}, Title: ${plan.title}`);
        }
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        const plan = state.decomposedTask;
        if (!plan) {
            console.log('[DebateChamber] No plan to debate — skipping');
            return { debateResult: null };
        }
        const stepCount = plan.steps?.length || 0;
        const estimatedModerate = stepCount >= 2 && stepCount <= 4;
        const estimatedComplex = stepCount > 4;
        const complexity = estimatedComplex ? 'complex' : estimatedModerate ? 'moderate' : 'simple';
        if (!debate_engine_1.PeerAgentDebateEngine.shouldDebate(complexity, 'moderate')) {
            console.log(`[DebateChamber] Task complexity "${complexity}" (${stepCount} steps) below threshold — skipping debate`);
            return { debateResult: null };
        }
        if (!runner.client) {
            console.warn('[DebateChamber] No AI client available — skipping debate');
            return { debateResult: null };
        }
        runner.telemetry.info(`[DebateChamber] 🎭 STARTING debate for ${complexity} task (${stepCount} steps)`);
        eventQueue?.push({ type: 'thought', content: '\n🎭 Peer Agent Debate: Evaluating plan...' });
        const lastUserMsg = state.messages.filter((m) => {
            const role = m.role || m._getType?.();
            return role === 'user' || role === 'human';
        }).pop();
        const userInput = lastUserMsg
            ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content))
            : '';
        const availableTools = plan.steps.map((s) => s.tool).filter(Boolean);
        const context = {
            taskId: plan.id || `task_${Date.now()}`,
            userInput: userInput.slice(0, 2000),
            conversationHistory: state.messages.slice(-6).map((m) => ({
                role: (m.role || 'user'),
                content: typeof m.content === 'string' ? m.content.slice(0, 500) : JSON.stringify(m.content).slice(0, 500),
            })),
            availableTools: [...new Set(availableTools)],
            workspaceContext: `Task: ${plan.title}\nSteps: ${stepCount}\nMode: ${plan.executionMode || 'sequential'}`,
        };
        const debateId = `debate-${Date.now()}`;
        emitDebateEvent('debate_start', debateId);
        const engine = new debate_engine_1.PeerAgentDebateEngine(runner.client, {
            verbose: true,
            complexityThreshold: 'moderate',
            timeoutMs: 120000,
            vanguardTimeoutMs: 45000,
            phantomTimeoutMs: 45000,
            arbiterTimeoutMs: 30000,
        });
        try {
            const debateResult = await engine.debate(context);
            const frontendData = debate_event_emitter_1.DebateEventEmitter.formatDebateResultForFrontend(debateResult);
            emitDebateEvent('debate_complete', debateResult.debateId, frontendData);
            eventQueue?.push({
                type: 'thought',
                content: `\n⚖️  Arbiter decision: ${debateResult.finalPlan.goNogo.toUpperCase()} — ${debateResult.finalPlan.explanation.slice(0, 200)}`,
            });
            const isNoGo = debateResult.finalPlan.goNogo === 'no-go';
            if (isNoGo) {
                runner.telemetry.warn('[DebateChamber] Arbiter voted NO-GO — task will not proceed');
                eventQueue?.push({
                    type: 'thought',
                    content: `\n❌ Debate result: NO-GO — ${debateResult.finalPlan.explanation.slice(0, 300)}`,
                });
            }
            return {
                debateResult: {
                    debateId: debateResult.debateId,
                    timestamp: debateResult.timestamp,
                    goNogo: debateResult.finalPlan.goNogo,
                    riskAssessment: debateResult.finalPlan.overallRiskAssessment,
                    explanation: debateResult.finalPlan.explanation,
                    guidance: debateResult.finalPlan.executionGuidance,
                    allData: debateResult,
                },
                completionSignal: isNoGo
                    ? { reason: 'cannot_proceed', explanation: `Debate chamber voted NO-GO: ${debateResult.finalPlan.explanation.slice(0, 200)}` }
                    : null,
                shouldContinueIteration: isNoGo ? false : undefined,
            };
        }
        catch (err) {
            console.error(`[DebateChamber] Debate failed: ${err.message}`);
            emitDebateEvent('debate_error', debateId, undefined, err.message.slice(0, 200));
            eventQueue?.push({
                type: 'thought',
                content: `\n⚠️ Debate chamber failed: ${err.message.slice(0, 200)} — proceeding without debate`,
            });
            return { debateResult: null };
        }
    };
};
exports.createDebateChamberNode = createDebateChamberNode;

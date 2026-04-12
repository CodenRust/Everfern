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
exports.createExecuteToolsNode = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const parallel_executor_1 = require("../parallel-executor");
const utils_1 = require("../utils");
const tool_policy_1 = require("../tool-policy");
const loop_detection_1 = require("../loop-detection");
const langgraph_1 = require("@langchain/langgraph");
const mission_integrator_1 = require("../mission-integrator");
/**
 * Determine if an error should trigger automatic retry with correction
 */
function shouldRetryWithCorrection(error, toolName) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Critical errors that benefit from automatic retry
    const criticalErrors = [
        'Cannot read properties of undefined',
        'TypeError',
        'ReferenceError',
        'Invalid arguments',
        'Tool not found',
        'Validation failed'
    ];
    // Check if error message contains any critical error patterns
    const isCriticalError = criticalErrors.some(pattern => errorMsg.toLowerCase().includes(pattern.toLowerCase()));
    // Always retry for ask_user_question tool (our fixed tool)
    const isFixedTool = toolName === 'ask_user_question';
    return isCriticalError || isFixedTool;
}
/**
 * AI-based approval detection
 * Replaces keyword-based approval checking with semantic analysis
 */
async function isApprovalResponse(feedback, client) {
    if (!client) {
        // Fallback: keyword-based check
        return feedback.toLowerCase().includes('approve');
    }
    try {
        const prompt = `Determine if this user feedback represents approval or rejection.

Feedback: "${feedback}"

Approval indicators:
- "approve", "yes", "ok", "proceed", "go ahead"
- Affirmative responses
- Permission granted

Rejection indicators:
- "reject", "no", "deny", "cancel", "stop"
- Negative responses
- Permission denied

Respond with JSON:
{
  "isApproval": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 150
        });
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const analysis = JSON.parse(content);
        return analysis.isApproval && analysis.confidence > 0.7;
    }
    catch (err) {
        console.warn('[ExecuteTools] AI approval detection failed:', err);
        return feedback.toLowerCase().includes('approve');
    }
}
/**
 * AI-based command completion detection
 * Replaces keyword-based prompt detection with semantic analysis
 */
async function isCommandComplete(output, client) {
    if (!client) {
        // Fallback: keyword-based check
        const lastLines = output.split('\n').slice(-3).join('\n');
        return lastLines.includes('> ') || lastLines.includes('$ ') ||
            output.includes('Status: DONE') || output.includes('Exit code:');
    }
    try {
        const lastLines = output.split('\n').slice(-5).join('\n');
        const prompt = `Determine if this command output indicates completion (has shell prompt or exit status).

Last lines of output:
${lastLines}

Complete indicators:
- Shell prompts (>, $, #)
- Exit codes or status messages
- "DONE", "completed", "finished"

Incomplete indicators:
- Still running
- Waiting for input
- No prompt or status

Respond with JSON:
{
  "isComplete": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.1,
            maxTokens: 150
        });
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Remove markdown code blocks if present
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const analysis = JSON.parse(content);
        return analysis.isComplete && analysis.confidence > 0.7;
    }
    catch (err) {
        console.warn('[ExecuteTools] AI completion detection failed:', err);
        const lastLines = output.split('\n').slice(-3).join('\n');
        return lastLines.includes('> ') || lastLines.includes('$ ') ||
            output.includes('Status: DONE') || output.includes('Exit code:');
    }
}
const createExecuteToolsNode = (runner, tools, config, eventQueue, conversationId, missionTracker, shouldAbort, aiClient) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        const nodeIntegrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
        nodeIntegrator.startNode('execute_tools', `Executing ${state.pendingToolCalls?.length || 0} tool calls`);
        try {
            runner.telemetry.transition('execute_tools');
            const calls = state.pendingToolCalls;
            if (!calls || calls.length === 0) {
                runner.telemetry.warn('Execute tools node reached but no pending calls found.');
                return { pendingToolCalls: [], iterations: (state.iterations || 0) + 1 };
            }
            runner.telemetry.info(`Orchestrating ${calls.length} system operations...`);
            const newMessages = [];
            const newRecords = [];
            let pauseGenFlag = false;
            // AGI: Parallel Execution Strategy
            const analysis = (0, parallel_executor_1.analyzeToolDependencies)(state.pendingToolCalls.map(tc => ({
                name: tc.name,
                args: tc.arguments,
                id: tc.id
            })));
            const parallelGroups = (0, parallel_executor_1.groupParallelTools)(analysis);
            // [A2UI] Emit a progress surface if we have multiple operations
            if (calls.length > 1) {
                eventQueue?.push({
                    type: 'surface_action',
                    action: 'create',
                    surfaceId: 'mission-progress',
                    components: [
                        {
                            id: 'progress-bar',
                            type: 'progress',
                            props: {
                                label: 'Mission Execution',
                                value: 0
                            }
                        },
                        {
                            id: 'status-card',
                            type: 'card',
                            props: {
                                title: 'Executing Sequence',
                                description: `Running ${calls.length} operations across ${parallelGroups.length} stages.`
                            }
                        }
                    ]
                });
            }
            for (let g = 0; g < parallelGroups.length; g++) {
                const group = parallelGroups[g];
                runner.telemetry.info(`Executing group ${g + 1}/${parallelGroups.length} (${group.length} concurrent operations)`);
                // Log what tools are in this group
                const toolNames = group.map(a => a.name).join(', ');
                runner.telemetry.info(`Group ${g + 1} tools: ${toolNames}`);
                const groupTools = group.map(a => ({
                    name: a.name,
                    args: a.args,
                    id: a.id
                }));
                // Pre-execution validation for the group
                let groupValidationError = null;
                const validatedGroup = groupTools.map(tc => {
                    const correctedArgs = (0, utils_1.validateAndCorrectToolArgs)(tc.name, tc.args, os.homedir(), conversationId || 'default');
                    // Block unresolved paths / invalid parallel steps
                    const readTools = ['read', 'read_file', 'view_file', 'edit', 'replace'];
                    if (readTools.includes(tc.name) && typeof correctedArgs.path === 'string') {
                        const p = correctedArgs.path;
                        if (p.startsWith('http') || p.startsWith('//') || p.startsWith('www.')) {
                            groupValidationError = `Invalid local path for ${tc.name}: "${p}" looks like a URL.`;
                        }
                        else if (!fs.existsSync(p)) {
                            groupValidationError = `Local path does not exist for ${tc.name}: "${p}"`;
                        }
                    }
                    return { ...tc, arguments: correctedArgs };
                });
                if (groupValidationError) {
                    runner.telemetry.warn(`Group validation failed: ${groupValidationError}`);
                    const failedRecords = groupTools.map(tc => {
                        const record = {
                            toolName: tc.name,
                            args: tc.args,
                            result: { success: false, output: `Validation failed: ${groupValidationError}`, error: 'validation_error' },
                            timestamp: new Date().toISOString()
                        };
                        eventQueue?.push({ type: 'tool_call', toolCall: record });
                        return record;
                    });
                    newRecords.push(...failedRecords);
                    failedRecords.forEach(r => {
                        newMessages.push({
                            role: 'tool',
                            tool_call_id: groupTools.find(t => t.name === r.toolName).id,
                            tool_name: r.toolName,
                            content: r.result.output,
                        });
                    });
                    break; // Stop executing further groups
                }
                const groupPromises = validatedGroup.map(async (tc) => {
                    const correctedToolCall = tc;
                    runner.telemetry.action(correctedToolCall.name, correctedToolCall.arguments);
                    // Log detailed tool information
                    const argsSummary = JSON.stringify(correctedToolCall.arguments).substring(0, 150);
                    runner.telemetry.info(`Starting ${correctedToolCall.name} with args: ${argsSummary}${argsSummary.length >= 150 ? '...' : ''}`);
                    eventQueue?.push({ type: 'tool_start', toolName: correctedToolCall.name, toolArgs: correctedToolCall.arguments });
                    const startMs = Date.now();
                    const tool = tools.find(t => t.name === correctedToolCall.name);
                    let result;
                    // ── Handle Synthetic System Tools ────────────────────────────────────
                    if (correctedToolCall.name === 'system_verify_intent') {
                        result = { success: true, output: 'Intent verified. Proceeding with execution.', verified: true };
                    }
                    // ── Security & Policy Check ───────────────────────────────────────────
                    runner.telemetry.info(`Checking policy for ${correctedToolCall.name}...`);
                    const toolPolicy = (0, tool_policy_1.getDefaultToolPolicyPipeline)();
                    const policyResult = await toolPolicy.check({
                        toolName: correctedToolCall.name,
                        args: correctedToolCall.arguments,
                        sessionKey: conversationId || 'default',
                        model: runner.client.model
                    });
                    if (policyResult === 'deny') {
                        runner.telemetry.warn(`Policy DENIED operation: ${correctedToolCall.name}`);
                        result = { success: false, output: `Tool "${correctedToolCall.name}" is not allowed by policy.`, error: 'tool_policy_denied' };
                    }
                    else if (policyResult === 'owner_only') {
                        runner.telemetry.warn(`Policy requires HUMAN APPROVAL for: ${correctedToolCall.name}`);
                        eventQueue?.push({
                            type: 'human_approval_required',
                            toolCall: { toolName: correctedToolCall.name, args: correctedToolCall.arguments, result: { success: true, output: '' } },
                            reason: `Tool "${correctedToolCall.name}" requires explicit approval`
                        });
                        const feedback = (0, langgraph_1.interrupt)({
                            question: `Approval required for tool: ${correctedToolCall.name}`,
                            toolCall: correctedToolCall
                        });
                        const approved = await isApprovalResponse(String(feedback), aiClient);
                        if (approved) {
                            runner.telemetry.info(`Tool ${correctedToolCall.name} approved by user.`);
                            result = null; // proceed to execution
                        }
                        else {
                            result = { success: false, output: `Tool rejected by user: ${feedback}`, error: 'owner_approval_required' };
                        }
                    }
                    else {
                        runner.telemetry.info(`Policy check passed for ${correctedToolCall.name} (${policyResult})`);
                    }
                    if (!tool && !result) {
                        runner.telemetry.warn(`Tool definition missing: ${correctedToolCall.name}`);
                        result = { success: false, output: `Unknown tool: "${correctedToolCall.name}"`, error: 'Tool not found' };
                    }
                    else if (!result) { // Proceed if not already denied by policy or handled by synthetic logic
                        const mutatingTools = new Set(['write', 'edit', 'bash', 'exec', 'apply_patch', 'system_files', 'run_command', 'send_command_input']);
                        if (mutatingTools.has(correctedToolCall.name)) {
                            const granted = config.checkPermission ? config.checkPermission() : true;
                            if (!granted && config.requestPermission) {
                                const permitted = await config.requestPermission();
                                if (!permitted) {
                                    runner.telemetry.warn(`Permission DENIED by endpoint for: ${correctedToolCall.name}`);
                                    result = { success: false, output: `Permission denied for "${correctedToolCall.name}".`, error: 'system_files_permission_denied' };
                                }
                            }
                        }
                        if (!result) {
                            const loopHistory = [...(state.toolCallHistory ?? [])];
                            const loopResult = (0, loop_detection_1.detectToolCallLoop)(loopHistory, correctedToolCall.name, correctedToolCall.arguments);
                            if (loopResult.stuck && loopResult.level === 'critical') {
                                runner.telemetry.warn(`Infinite recursion detected in ${correctedToolCall.name}. Level: CRITICAL.`);
                                result = { success: false, output: loopResult.message, error: `Loop detected: ${loopResult.detector}` };
                            }
                            else {
                                (0, loop_detection_1.recordToolCall)(loopHistory, correctedToolCall.name, correctedToolCall.arguments);
                                try {
                                    if (!tool)
                                        throw new Error(`Tool definition for "${correctedToolCall.name}" disappeared unexpectedly.`);
                                    runner.telemetry.info(`Executing ${correctedToolCall.name}...`);
                                    result = await tool.execute(correctedToolCall.arguments, (update) => {
                                        eventQueue?.push({ type: 'tool_update', toolName: correctedToolCall.name, update });
                                    });
                                    (0, loop_detection_1.recordToolOutcome)(loopHistory, correctedToolCall.name, correctedToolCall.arguments, result, undefined);
                                    runner.telemetry.info(`Operation ${correctedToolCall.name} executed successfully.`);
                                }
                                catch (err) {
                                    const errMsg = err instanceof Error ? err.message : String(err);
                                    runner.telemetry.warn(`Operation ${correctedToolCall.name} execution failed: ${errMsg}`);
                                    // Attempt automatic retry with argument correction for critical errors
                                    let retrySuccessful = false;
                                    if (shouldRetryWithCorrection(err, correctedToolCall.name)) {
                                        runner.telemetry.info(`🔄 Critical error detected, attempting automatic retry with corrected arguments...`);
                                        try {
                                            // For ask_user_question tool, apply the fix we implemented
                                            if (correctedToolCall.name === 'ask_user_question' && tool) {
                                                runner.telemetry.info(`🔄 Applying ask_user_question argument correction...`);
                                                // The tool itself now handles both formats, so just retry
                                                result = await tool.execute(correctedToolCall.arguments, (update) => {
                                                    eventQueue?.push({ type: 'tool_update', toolName: correctedToolCall.name, update });
                                                });
                                                retrySuccessful = result.success;
                                                runner.telemetry.info(`🔄 Retry ${retrySuccessful ? 'successful' : 'failed'} for ${correctedToolCall.name}`);
                                            }
                                        }
                                        catch (retryErr) {
                                            runner.telemetry.warn(`🔄 Retry failed: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
                                        }
                                    }
                                    if (!retrySuccessful) {
                                        result = { success: false, output: `Error: ${errMsg}`, error: String(err) };
                                        (0, loop_detection_1.recordToolOutcome)(loopHistory, correctedToolCall.name, correctedToolCall.arguments, undefined, err);
                                    }
                                    else {
                                        (0, loop_detection_1.recordToolOutcome)(loopHistory, correctedToolCall.name, correctedToolCall.arguments, result, undefined);
                                    }
                                }
                            }
                        }
                    }
                    const durationMs = Date.now() - startMs;
                    runner.telemetry.info(`Tool ${correctedToolCall.name} completed in ${durationMs}ms`);
                    const record = {
                        toolName: correctedToolCall.name,
                        args: correctedToolCall.arguments,
                        result,
                        timestamp: new Date().toISOString(),
                    };
                    // Debug logging for ask_user_question
                    if (correctedToolCall.name === 'ask_user_question') {
                        console.log('[ExecuteTools] ask_user_question result:', JSON.stringify(result, null, 2));
                        console.log('[ExecuteTools] Pushing tool_call event with record:', JSON.stringify(record, null, 2));
                    }
                    eventQueue?.push({ type: 'tool_call', toolCall: record });
                    // Artifact handling
                    if ((correctedToolCall.name === 'write' || correctedToolCall.name === 'present_files') && result.success) {
                        const pathsToCheck = correctedToolCall.name === 'write'
                            ? [String(correctedToolCall.arguments.path || '')]
                            : (correctedToolCall.arguments.files || []).map((f) => String(f.path || ''));
                        for (const writtenPath of pathsToCheck) {
                            if (writtenPath.match(/\.html?$/i)) {
                                const cId = conversationId || 'default';
                                const artifactDir = path.join(os.homedir(), '.everfern', 'artifacts', cId);
                                fs.mkdirSync(artifactDir, { recursive: true });
                                const fileName = path.basename(writtenPath);
                                const targetPath = path.join(artifactDir, fileName);
                                if (fs.existsSync(writtenPath) && path.resolve(writtenPath) !== path.resolve(targetPath)) {
                                    fs.copyFileSync(writtenPath, targetPath);
                                }
                                eventQueue?.push({ type: 'show_artifact', name: fileName });
                            }
                        }
                    }
                    newMessages.push({
                        role: 'tool',
                        tool_call_id: correctedToolCall.id,
                        tool_name: correctedToolCall.name,
                        content: result.base64Image
                            ? [{ type: 'text', text: result.output }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${result.base64Image}` } }]
                            : result.output,
                    });
                    // Serialization safety for records
                    try {
                        const serializableRecord = JSON.parse(JSON.stringify(record, (key, value) => {
                            if (value instanceof Error)
                                return { message: value.message, stack: value.stack };
                            if (value instanceof Set)
                                return Array.from(value);
                            if (value instanceof Map)
                                return Object.fromEntries(value);
                            return value;
                        }));
                        return serializableRecord;
                    }
                    catch (e) {
                        return { ...record, result: { success: false, error: 'Serialization failed', output: String(record.result?.output || '') } };
                    }
                });
                const groupResults = await Promise.all(groupPromises);
                newRecords.push(...groupResults);
            }
            const nextPendingTools = [];
            for (const rec of newRecords) {
                if ((rec.toolName === 'run_command' || rec.toolName === 'command_status') && rec.result?.success) {
                    const out = typeof rec.result.output === 'string' ? rec.result.output : JSON.stringify(rec.result.output);
                    // Use AI to determine if command is complete
                    const isComplete = await isCommandComplete(out, aiClient);
                    if (!isComplete) {
                        nextPendingTools.push({
                            id: 'poll_' + Math.random().toString(36).slice(2, 6),
                            name: 'command_status',
                            arguments: {
                                CommandId: rec.toolName === 'command_status' ? rec.args.CommandId : 'agent-terminal',
                                WaitDurationSeconds: 2,
                                OutputCharacterCount: 2000
                            }
                        });
                    }
                }
            }
            if (calls.length > 1) {
                eventQueue?.push({
                    type: 'surface_action',
                    action: 'delete',
                    surfaceId: 'mission-progress'
                });
            }
            const result = {
                messages: newMessages,
                toolCallRecords: [...(state.toolCallRecords ?? []), ...newRecords],
                pendingToolCalls: nextPendingTools,
                pauseGeneration: pauseGenFlag,
                userConfirmation: undefined,
                toolCallHistory: [...(state.toolCallHistory ?? [])],
            };
            nodeIntegrator.completeNode('execute_tools', `Completed ${calls.length} tool calls`);
            return result;
        }
        catch (error) {
            nodeIntegrator.failNode('execute_tools', error instanceof Error ? error.message : String(error));
            throw error;
        }
    };
};
exports.createExecuteToolsNode = createExecuteToolsNode;

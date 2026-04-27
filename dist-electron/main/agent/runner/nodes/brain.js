"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrainNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const prompt_sync_1 = require("../../../lib/prompt-sync");
/**
 * After the brain produces a response with no tool calls, ask it to self-assess
 * why it's done and produce a structured completion signal for the judge.
 *
 * This replaces regex pattern matching in the judge with a first-class signal
 * from the brain itself.
 */
async function buildCompletionSignal(runner, responseContent, originalRequest) {
    if (!runner.client) {
        console.warn('[Brain] No client available for completion signal');
        return null;
    }
    try {
        const prompt = `You just produced a response to a user request. Classify why you are done for this turn.

USER REQUEST: "${originalRequest.slice(0, 300)}"
YOUR RESPONSE: "${responseContent.slice(0, 500)}"

Choose exactly one reason:
- "task_complete"        — You fully completed the requested task with substantive output
- "waiting_for_user_input" — You need the user to provide information, make a selection, or upload a file before you can proceed
- "needs_hitl"           — A high-risk or irreversible action requires explicit human approval before execution
- "cannot_proceed"       — You are blocked and cannot make progress (missing permissions, unsupported request, etc.)

Respond with JSON only:
{
  "reason": "task_complete" | "waiting_for_user_input" | "needs_hitl" | "cannot_proceed",
  "explanation": "one sentence explaining why"
}`;
        console.log('[Brain] Building completion signal...');
        const startTime = Date.now();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('completion signal timed out')), 10000));
        const response = await Promise.race([
            runner.client.chat({
                messages: [{ role: 'user', content: prompt }],
                responseFormat: 'json',
                temperature: 0.1,
                maxTokens: 120,
            }),
            timeoutPromise,
        ]);
        const duration = Date.now() - startTime;
        console.log(`[Brain] Completion signal response received in ${duration}ms`);
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        let signal;
        try {
            signal = JSON.parse(content);
        }
        catch (parseError) {
            console.warn('[Brain] Failed to parse completion signal JSON:', content);
            return null;
        }
        const validReasons = ['task_complete', 'waiting_for_user_input', 'needs_hitl', 'cannot_proceed'];
        if (!validReasons.includes(signal.reason)) {
            console.warn('[Brain] Invalid completion signal reason:', signal.reason);
            return null;
        }
        console.log(`[Brain] Completion signal built successfully in ${duration}ms: ${signal.reason}`);
        return { reason: signal.reason, explanation: String(signal.explanation || '') };
    }
    catch (error) {
        // Log the specific error for debugging
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('[Brain] Completion signal failed:', errorMessage);
        return null;
    }
}
/**
 * Determine if the brain should route to a specialized agent
 */
async function determineRouting(runner, state, responseContent, eventQueue) {
    if (!runner.client) {
        console.warn('[Brain] No client available for routing decision');
        return null;
    }
    try {
        // Extract user request from the last user message
        const lastUserMsg = state.messages?.filter((m) => {
            const role = m.role || m._getType?.();
            return role === 'user' || role === 'human';
        }).pop();
        const userRequest = lastUserMsg
            ? (typeof lastUserMsg.content === 'string'
                ? lastUserMsg.content
                : JSON.stringify(lastUserMsg.content))
            : '';
        const conversationHistory = state.messages?.slice(-3) || []; // Last 3 messages for context
        // Deterministic pre-check: force route_web_explorer for web-research tasks
        // Skip if web explorer has already completed its work
        const WEB_RESEARCH_PRE_CHECK = /\[RESEARCH TASK\]|\b(search|find|look up|research|browse|fetch|crawl)\b.*\b(online|web|internet|google|news|articles?|bots?|tools?|products?)\b|\b(compile.*list|top \d+|find the best|comprehensive list|compare.*options)\b/i;
        if (!state.webExplorerComplete && (WEB_RESEARCH_PRE_CHECK.test(userRequest) || WEB_RESEARCH_PRE_CHECK.test(responseContent))) {
            if (!state.currentIntent || state.currentIntent === 'research' || state.currentIntent === 'task') {
                console.log('[Brain] Deterministic pre-check: web-research keywords detected → route_web_explorer');
                return { decision: 'route_web_explorer', explanation: 'Deterministic pre-check: task contains web-research keywords' };
            }
        }
        // Emit analysis phase
        eventQueue?.push({
            type: 'thought',
            content: '\n🔍 Brain: Analyzing task requirements and available agents...'
        });
        const intentConstraint = state.currentIntent
            ? `\nTRIAGE INTENT (HARD CONSTRAINT): "${state.currentIntent}"\n` +
                (state.currentIntent === 'research'
                    ? `Because the triage intent is "research", the ONLY valid routing decisions are: "route_web_explorer", "continue_brain", or "complete_task". You MUST NOT route to "route_computer_use".\n`
                    : '')
            : '';
        const prompt = `You are the EverFern Brain - the central orchestrator. Analyze the user request and current state to determine the best routing decision.
${intentConstraint}
USER REQUEST: "${userRequest.slice(0, 400)}"
YOUR CURRENT RESPONSE: "${responseContent.slice(0, 300)}"
CONVERSATION CONTEXT: ${JSON.stringify(conversationHistory).slice(0, 200)}

Available routing options:
- "continue_brain"     — Continue handling this yourself with general capabilities (conversation, simple tasks)
- "route_coding"       — Route to Coding Specialist for software development, code writing, debugging
- "route_data_analyst" — Route to Data Analyst for data processing, CSV/Excel analysis, charts
- "route_computer_use" — Route to Computer Use agent ONLY for GUI automation (clicking UI elements, desktop apps, filling forms on screen). NEVER use for web research or searching the internet.
- "route_web_explorer" — Route to Web Explorer for ANY web research, searching the internet, finding information online, fetching URLs, looking up facts, news, products, bots, tools, etc.
- "complete_task"      — Task is complete, no further routing needed

CRITICAL ROUTING RULES:
1. If the task involves searching the web, finding information, researching topics, looking up news, finding tools/bots/products → ALWAYS use "route_web_explorer". NEVER use "route_computer_use" for web research.
2. "route_computer_use" is ONLY for tasks that require clicking on desktop GUI elements, interacting with native apps, or automating screen interactions. It is NOT for web browsing or research.
3. If web_search AND browser_use tools were already called successfully and returned comprehensive results, THEN consider "complete_task".
4. Do NOT re-route to web_explorer if both web_search and browser_use have already completed successfully.
5. NEVER run web_search yourself and then claim the task is complete — the web_explorer must fetch the actual page content from the URLs found.
6. For ANY web research task (searching, finding information online, looking up websites), use "route_web_explorer" NOT "route_computer_use".

Respond with JSON only:
{
  "decision": "continue_brain" | "route_coding" | "route_data_analyst" | "route_computer_use" | "route_web_explorer" | "complete_task",
  "explanation": "one sentence explaining the routing decision"
}`;
        console.log('[Brain] Determining routing decision...');
        const startTime = Date.now();
        const response = await runner.client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0.2,
            maxTokens: 150,
        });
        const duration = Date.now() - startTime;
        console.log(`[Brain] Routing decision response received in ${duration}ms`);
        // Emit decision analysis
        eventQueue?.push({
            type: 'thought',
            content: `\n⏱️ Brain: Routing analysis completed in ${duration}ms`
        });
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        let routing;
        try {
            routing = JSON.parse(content);
        }
        catch (parseError) {
            console.warn('[Brain] Failed to parse routing decision JSON:', content);
            return null;
        }
        const validDecisions = [
            'continue_brain', 'route_coding', 'route_data_analyst',
            'route_computer_use', 'route_web_explorer', 'complete_task'
        ];
        if (!validDecisions.includes(routing.decision)) {
            console.warn('[Brain] Invalid routing decision:', routing.decision);
            return null;
        }
        console.log(`[Brain] Routing decision made in ${duration}ms: ${routing.decision}`);
        return { decision: routing.decision, explanation: String(routing.explanation || '') };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('[Brain] Routing decision failed:', errorMessage);
        return null;
    }
}
/**
 * Detect if the last tool result in messages is from web_search.
 */
function lastToolResultIsWebSearch(messages) {
    if (!messages || messages.length === 0)
        return false;
    // Walk backwards to find the most recent tool result message
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const role = msg.role || msg._getType?.();
        if (role === 'tool' || role === 'function') {
            // Check if the tool name is web_search
            const name = msg.name || msg.tool_name || msg.toolName || '';
            return name === 'web_search';
        }
        // Stop at assistant messages (tool results come right after assistant tool calls)
        if (role === 'assistant' || role === 'ai')
            break;
    }
    return false;
}
/**
 * Extract URLs from a web_search tool result content string.
 */
function extractUrlsFromSearchResult(content) {
    const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
    const matches = content.match(urlRegex) || [];
    // Deduplicate and limit to first 3 URLs
    return [...new Set(matches)].slice(0, 3);
}
/**
 * Central Brain Node - The Main Orchestrator and Router
 *
 * The Brain node now serves as the central decision maker that:
 * 1. Uses the main SYSTEM_PROMPT.md for comprehensive capabilities
 * 2. Makes intelligent routing decisions to specialized agents
 * 3. Handles general tasks that don't require specialization
 * 4. Provides completion signals for the judge
 */
const createBrainNode = (runner, eventQueue, missionTracker, toolDefs, shouldAbort, systemPromptOverride) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        // Check for abort signal before processing
        if (shouldAbort?.()) {
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        const allTools = toolDefs || runner._buildToolDefinitions();
        // Filter out web research tools from brain - these should only be available to web_explorer
        const WEB_RESEARCH_TOOLS = new Set(['web_search', 'remote_web_search', 'browser_use', 'browser_use', 'website_crawl']);
        const tools = allTools.filter((tool) => !WEB_RESEARCH_TOOLS.has(tool.name));
        // Debug logging
        console.log(`[Brain] Current intent: ${state.currentIntent}`);
        console.log(`[Brain] Available tools: ${allTools.map((t) => t.name).join(', ')}`);
        console.log(`[Brain] Filtered tools: ${tools.map((t) => t.name).join(', ')}`);
        // Emit phase change event for execution phase (only on first brain call)
        if (missionTracker && state.iterations === 0) {
            missionTracker.setPhase('execution');
        }
        // Emit initial brain activation message
        eventQueue?.push({
            type: 'thought',
            content: '\n🧠 Brain Node: Analyzing task and determining optimal routing...'
        });
        // Load the main system prompt from synchronized location
        let systemPrompt = systemPromptOverride;
        if (!systemPrompt) {
            const mainSystemPrompt = (0, prompt_sync_1.loadPrompt)('SYSTEM_PROMPT.md');
            if (mainSystemPrompt) {
                systemPrompt = mainSystemPrompt;
                console.log('[Brain] 📖 Using main SYSTEM_PROMPT.md from ~/.everfern/prompts/');
            }
            else {
                console.warn('[Brain] ⚠️  Could not load SYSTEM_PROMPT.md, using default');
            }
        }
        // Get original user request for context
        const allMessages = state.messages || [];
        const firstUserMsg = allMessages.find((m) => {
            const role = m.role || m._getType?.();
            return role === 'user' || role === 'human';
        });
        const originalRequest = firstUserMsg
            ? (typeof firstUserMsg.content === 'string'
                ? firstUserMsg.content
                : JSON.stringify(firstUserMsg.content))
            : '';
        // Bug 7: Narrower regex for web research early pre-check
        // Requires explicit web intent alongside broad nouns to avoid false positives in coding tasks
        const WEB_RESEARCH_EARLY_CHECK = /\[RESEARCH TASK\]|\b(search|find|look up|research|browse|fetch|crawl)\b.*\b(online|web|internet|google|news|articles?|bots?|tools?|products?)\b|\b(compile.*list|top \d+|find the best|comprehensive list|compare.*options)\b/i;
        const isResearchIntent = !state.currentIntent || state.currentIntent === 'research' || state.currentIntent === 'task';
        // Bug 1, 6, 10: Early deterministic short-circuit logic
        // Skip if: not research intent OR iterations > 0 OR returning from tool call OR returning from specialist
        const isFirstEntry = (state.iterations === 0 || !state.iterations) && !state.brainToolsInFlight && !state.returningFromSpecialist;
        // Strict Routing: If we just returned from a specialist, we MUST evaluate if they should continue
        // This prevents the brain from taking over and looping on tools itself.
        if (state.returningFromSpecialist) {
            console.log(`[Brain] Returning from specialist: ${state.returningFromSpecialist} — evaluating continuation`);
            // If returning from web_explorer and it's not complete, route back immediately
            if (state.returningFromSpecialist === 'web_explorer' && !state.webExplorerComplete) {
                console.log('[Brain] Web explorer not complete → routing back');
                return {
                    routingDecision: { decision: 'route_web_explorer', explanation: 'Continuation: Web explorer has more work to do' },
                    taskPhase: 'specialized_agent',
                    brainToolsInFlight: false,
                    returningFromSpecialist: null
                };
            }
        }
        if (isFirstEntry && isResearchIntent && WEB_RESEARCH_EARLY_CHECK.test(originalRequest)) {
            console.log('[Brain] Early pre-check: web-research keywords in user request → route_web_explorer immediately');
            eventQueue?.push({ type: 'thought', content: '🧭 BRAIN: Routing to web explorer (research task detected)' });
            return {
                messages: state.messages,
                routingDecision: { decision: 'route_web_explorer', explanation: 'Early pre-check: research task detected before LLM call' },
                completionSignal: null,
                taskPhase: 'specialized_agent',
                brainToolsInFlight: false,
                returningFromSpecialist: null
            };
        }
        const result = await integrator.wrapNode('brain', () => (0, agent_runtime_1.runAgentStep)(state, {
            runner,
            toolDefs: tools,
            eventQueue,
            nodeName: 'brain',
            systemPromptOverride: systemPrompt
        }), 'Processing request with Brain orchestrator');
        // Extract the brain's response text for analysis
        const messages = result.messages;
        const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
        const responseContent = lastMsg
            ? (typeof lastMsg.content === 'string' ? lastMsg.content : (lastMsg.content?.text || ''))
            : '';
        // Emit analysis of pending tools
        if (result.pendingToolCalls && result.pendingToolCalls.length > 0) {
            const toolNames = result.pendingToolCalls.map((tc) => tc.name).join(', ');
            eventQueue?.push({
                type: 'thought',
                content: `\n🔧 Brain: Executing tools — ${toolNames}`
            });
        }
        // If there are pending tool calls, continue with brain execution
        const hasPendingTools = result.pendingToolCalls && result.pendingToolCalls.length > 0;
        if (hasPendingTools) {
            return {
                ...result,
                completionSignal: null,
                routingDecision: null,
                brainToolsInFlight: true,
                returningFromSpecialist: null
            };
        }
        // Determine routing decision
        const routingDecision = await determineRouting(runner, state, responseContent, eventQueue);
        if (routingDecision) {
            runner.telemetry.info(`Brain routing decision: ${routingDecision.decision} — ${routingDecision.explanation}`);
            console.log(`[Brain] Routing decision: ${routingDecision.decision} for intent: ${state.currentIntent}`);
            eventQueue?.push({
                type: 'thought',
                content: `🧠 Brain Router: ${routingDecision.decision} — ${routingDecision.explanation}`
            });
        }
        // If routing to a specialized agent, set the routing decision
        if (routingDecision && routingDecision.decision.startsWith('route_')) {
            return {
                ...result,
                routingDecision: routingDecision,
                completionSignal: null,
                // Set task phase to route to specialized agents
                taskPhase: 'specialized_agent',
                brainToolsInFlight: false,
                returningFromSpecialist: null
            };
        }
        // If continuing with brain or completing task, build completion signal
        const signal = await buildCompletionSignal(runner, responseContent, originalRequest);
        if (signal) {
            runner.telemetry.info(`Brain completion signal: ${signal.reason} — ${signal.explanation}`);
            eventQueue?.push({ type: 'thought', content: `🧠 Brain: ${signal.reason} — ${signal.explanation}` });
        }
        else {
            runner.telemetry.warn('Brain completion signal failed — judge will use fallback');
            eventQueue?.push({ type: 'thought', content: '🧠 Brain: completion signal failed, judge will evaluate' });
        }
        return {
            ...result,
            completionSignal: signal,
            routingDecision: routingDecision,
            brainToolsInFlight: false,
            returningFromSpecialist: null
        };
    };
};
exports.createBrainNode = createBrainNode;

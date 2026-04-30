"use strict";
/**
 * Navis — Orchestrator
 *
 * Main AI-driven loop: capture state → call LLM → parse decision → execute actions → repeat.
 * Handles JSON schema enforcement, retry logic, and graceful failure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavisOrchestrator = exports.NAVIS_DECISION_SCHEMA = void 0;
const session_1 = require("./session");
const element_capture_1 = require("./element-capture");
const actions_1 = require("./actions");
const prompt_sync_1 = require("../../../lib/prompt-sync");
const logger_1 = require("./logger");
// ─────────────────────────────────────────────────────────────────────────────
// JSON Schema for Navis decision output (strict validation)
// ─────────────────────────────────────────────────────────────────────────────
exports.NAVIS_DECISION_SCHEMA = {
    $name: 'navis_decision',
    type: 'object',
    properties: {
        current_state: {
            type: 'object',
            properties: {
                evaluation_previous_goal: { type: 'string', enum: ['Success', 'Failed', 'Unknown'] },
                memory: { type: 'string' },
                next_goal: { type: 'string' },
            },
            required: ['evaluation_previous_goal', 'memory', 'next_goal'],
            additionalProperties: false,
        },
        action: {
            type: 'array',
            items: {
                type: 'object',
                oneOf: [
                    { properties: { go_to_url: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false } }, required: ['go_to_url'], additionalProperties: false },
                    { properties: { click_element: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'], additionalProperties: false } }, required: ['click_element'], additionalProperties: false },
                    { properties: { input_text: { type: 'object', properties: { ref: { type: 'string' }, text: { type: 'string' } }, required: ['ref', 'text'], additionalProperties: false } }, required: ['input_text'], additionalProperties: false },
                    { properties: { scroll_down: { type: 'object', additionalProperties: false } }, required: ['scroll_down'], additionalProperties: false },
                    { properties: { scroll_up: { type: 'object', additionalProperties: false } }, required: ['scroll_up'], additionalProperties: false },
                    { properties: { wait: { type: 'object', properties: { ms: { type: 'number' } }, additionalProperties: false } }, required: ['wait'], additionalProperties: false },
                    { properties: { extract_content: { type: 'object', properties: { goal: { type: 'string' } }, required: ['goal'], additionalProperties: false } }, required: ['extract_content'], additionalProperties: false },
                    { properties: { open_tab: { type: 'object', properties: { url: { type: 'string' } }, additionalProperties: false } }, required: ['open_tab'], additionalProperties: false },
                    { properties: { switch_tab: { type: 'object', properties: { index: { type: 'number' }, target: { type: 'string' } }, additionalProperties: false } }, required: ['switch_tab'], additionalProperties: false },
                    { properties: { close_tab: { type: 'object', additionalProperties: false } }, required: ['close_tab'], additionalProperties: false },
                    { properties: { done: { type: 'object', properties: { success: { type: 'boolean' }, text: { type: 'string' } }, required: ['success', 'text'], additionalProperties: false } }, required: ['done'], additionalProperties: false },
                ],
            },
            minItems: 1,
            maxItems: 3,
        },
    },
    required: ['current_state', 'action'],
    additionalProperties: false,
};
// ─────────────────────────────────────────────────────────────────────────────
// Prompt Loading
// ─────────────────────────────────────────────────────────────────────────────
function loadNavisPrompts() {
    const rawPrompt = (0, prompt_sync_1.loadPrompt)('NAVIS.md');
    if (!rawPrompt) {
        return {
            systemPrompt: FALLBACK_SYSTEM_PROMPT,
            nextStepPrompt: FALLBACK_NEXT_STEP_PROMPT,
        };
    }
    const systemMatch = rawPrompt.match(/SYSTEM_PROMPT = """\\?\s*([\s\S]*?)"""/);
    const nextMatch = rawPrompt.match(/NEXT_STEP_PROMPT = """\s*([\s\S]*?)"""/);
    let systemPrompt = systemMatch ? systemMatch[1].trim() : FALLBACK_SYSTEM_PROMPT;
    let nextStepPrompt = nextMatch ? nextMatch[1].trim() : FALLBACK_NEXT_STEP_PROMPT;
    nextStepPrompt = nextStepPrompt.replace(/browser_use/g, 'navis');
    return { systemPrompt, nextStepPrompt };
}
const { systemPrompt: NAVIS_SYSTEM_PROMPT, nextStepPrompt: NEXT_STEP_PROMPT } = loadNavisPrompts();
const FALLBACK_SYSTEM_PROMPT = `You are Navis, an AI agent designed to automate browser tasks.
Respond with valid JSON: {"current_state":{"evaluation_previous_goal":"Success|Failed|Unknown","memory":"track progress","next_goal":"immediate action"},"action":[{"action_name":{params}}]}
Actions: go_to_url, click_element, input_text, scroll_down, scroll_up, wait, extract_content, open_tab, switch_tab, close_tab, done.`;
const FALLBACK_NEXT_STEP_PROMPT = `What should I do next?
Current URL: {url_placeholder}
Tabs: {tabs_placeholder}
Interactive elements with [index].
Results: {results_placeholder}`;
// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────────────────────────────────────
class NavisOrchestrator {
    aiClient;
    model = 'minimax-m2.7:cloud';
    session;
    logger;
    constructor(aiClient, logger) {
        this.aiClient = aiClient;
        this.logger = logger || new logger_1.NavisLogger();
        this.session = new session_1.BrowserSession();
    }
    getEventLogger() { return this.logger; }
    async run(options) {
        const { task, maxSteps = 25, maxActionsPerStep = 8, headless = false, startUrl } = options;
        await this.session.launch({ headless, startUrl, logger: this.logger });
        await this.session.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
        let steps = 0;
        let history = [];
        let lastResult = '';
        let snapshot = null;
        let lastUrl = '';
        try {
            while (steps < maxSteps) {
                steps++;
                const page = this.session.page;
                const url = page.url();
                const title = await page.title().catch(() => 'Unknown');
                const tabs = await this.session.getTabs();
                const tabsStr = tabs.length > 1
                    ? tabs.map((t, i) => `  Tab ${i}: ${t.url} (${t.title})`).join('\n')
                    : `1 tab open: ${url}`;
                // Only re-capture if page changed or first step
                if (url !== lastUrl || !snapshot) {
                    snapshot = await (0, element_capture_1.captureInteractiveElements)(page);
                    lastUrl = url;
                }
                const elementsFormatted = (0, element_capture_1.formatElementsForPrompt)(snapshot.raw);
                // Compress history after 8 steps to keep context small
                const historyStr = history.length > 8
                    ? `[${history.length - 8} earlier steps]...` + history.slice(-8).join('\n')
                    : (history.length > 0 ? history.join('\n') : 'None');
                const inputContext = [
                    `Task: ${task}`,
                    `History: ${historyStr}`,
                    `Current Tab: #${tabs.findIndex(t => t.url === url)} — ${url} (${title})`,
                    `Open Tabs (${tabs.length}):\n${tabsStr}`,
                    `Elements:`,
                    elementsFormatted,
                    lastResult ? `Last: ${lastResult}` : '',
                ].filter(Boolean).join('\n');
                const systemPrompt = NAVIS_SYSTEM_PROMPT
                    .replace(/\{\{max_actions\}\}/g, String(maxActionsPerStep));
                const nextPrompt = NEXT_STEP_PROMPT
                    .replace(/\{url_placeholder\}/g, ` (${url})`)
                    .replace(/\{tabs_placeholder\}/g, ` (${tabs.length} tabs open)`)
                    .replace(/\{results_placeholder\}/g, lastResult ? ` (${lastResult})` : ' (None)')
                    .replace(/\{content_above_placeholder\}/g, '')
                    .replace(/\{content_below_placeholder\}/g, '');
                const decision = await this.callAI(systemPrompt, inputContext, nextPrompt);
                if (!decision) {
                    this.logger.error('AI returned no valid decision');
                    break;
                }
                this.logger.aiDecision(steps, maxSteps, decision.current_state?.next_goal);
                await this.session.setOverlayStatus(decision.current_state?.next_goal || 'Working...');
                const actions = (decision.action || []).slice(0, maxActionsPerStep);
                let stateChanged = false;
                for (const actionObj of actions) {
                    const actionName = Object.keys(actionObj)[0];
                    const actionArgs = actionObj[actionName];
                    const result = await (0, actions_1.executeAction)(actionName, actionArgs, this.session.page, this.session, this.logger, steps, maxSteps);
                    lastResult = result.message;
                    if (actionName === 'done') {
                        this.logger.taskComplete(result.success, steps, lastResult);
                        return {
                            success: (decision.action?.find((a) => a.done)?.done?.success) ?? result.success,
                            output: result.message,
                            steps,
                        };
                    }
                    if (result.stateChanged) {
                        stateChanged = true;
                        break;
                    }
                }
                if (stateChanged) {
                    const currentUrl = page.url();
                    if (currentUrl !== lastUrl) {
                        await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => { });
                    }
                    else {
                        await new Promise((r) => setTimeout(r, 100));
                    }
                }
                this.logger.stepComplete(steps, maxSteps, lastResult);
                history.push(`${decision.current_state?.next_goal} → ${lastResult}`);
            }
            return {
                success: false,
                output: `Reached maximum ${maxSteps} steps. Last result: ${lastResult}`,
                steps,
            };
        }
        catch (err) {
            this.logger.error(err.message);
            return { success: false, output: `Error: ${err.message}`, steps };
        }
        finally {
            await this.session.close();
        }
    }
    async callAI(systemPrompt, inputContext, nextStepPrompt) {
        try {
            const response = await this.aiClient.chat({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: inputContext + '\n\n' + nextStepPrompt },
                ],
                model: this.model,
                responseFormat: 'json',
                jsonSchema: exports.NAVIS_DECISION_SCHEMA,
                temperature: 0.1,
            });
            const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
            return this.extractJson(raw);
        }
        catch (err) {
            const msg = err.message || '';
            const isRetriable = msg.includes('ECONNREFUSED')
                || msg.includes('ETIMEDOUT')
                || msg.includes('timeout')
                || msg.includes('network')
                || msg.includes('fetch');
            if (!isRetriable) {
                this.logger.error(`AI call failed: ${msg}`);
                return null;
            }
            this.logger.error('Retrying AI call...');
        }
        try {
            const retryResponse = await this.aiClient.chat({
                messages: [
                    { role: 'system', content: 'Return ONLY valid JSON matching the schema. No other text.' },
                    { role: 'user', content: inputContext },
                ],
                model: this.model,
                responseFormat: 'json',
                jsonSchema: exports.NAVIS_DECISION_SCHEMA,
                temperature: 0.0,
            });
            const raw = typeof retryResponse.content === 'string' ? retryResponse.content : JSON.stringify(retryResponse.content);
            return this.extractJson(raw);
        }
        catch {
            return null;
        }
    }
    extractJson(raw) {
        let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const first = cleaned.indexOf('{');
            if (first === -1)
                throw new Error('No JSON found');
            // Find the first complete JSON object by tracking brace depth
            let depth = 0;
            let inString = false;
            let escapeNext = false;
            for (let i = first; i < cleaned.length; i++) {
                const ch = cleaned[i];
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                if (ch === '\\' && inString) {
                    escapeNext = true;
                    continue;
                }
                if (ch === '"') {
                    inString = !inString;
                    continue;
                }
                if (inString)
                    continue;
                if (ch === '{')
                    depth++;
                if (ch === '}') {
                    depth--;
                    if (depth === 0) {
                        return JSON.parse(cleaned.substring(first, i + 1));
                    }
                }
            }
            throw new Error('No complete JSON object found');
        }
    }
}
exports.NavisOrchestrator = NavisOrchestrator;

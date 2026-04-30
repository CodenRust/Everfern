"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebExplorerNode = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const prompt_sync_1 = require("../../../lib/prompt-sync");
const subagent_spawn_1 = require("../subagent-spawn");
const subagent_registry_1 = require("../subagent-registry");
const createWebExplorerNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    return async (state) => {
        const allTools = toolDefs || runner._buildToolDefinitions();
        const messages = state.messages || [];
        const lastMsg = messages[messages.length - 1];
        const isSearchComplete = messages.some((m) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
        const hasSpawnedSubagents = state.subagentSpawned && state.subagentSpawned.length > 0;
        // PHASE 1: Initial Search
        if (!isSearchComplete) {
            eventQueue?.push({ type: 'thought', content: '\n🌐 WEB EXPLORER: Searching for authoritative sources...' });
            const result = await integrator.wrapNode('web_explorer', () => (0, agent_runtime_1.runAgentStep)(state, {
                runner,
                toolDefs: allTools,
                eventQueue,
                nodeName: 'web_explorer',
                systemPromptOverride: ((0, prompt_sync_1.loadPrompt)('web-explorer.md') || '') +
                    '\n\nPHASE: SEARCH. Use web_search to find the top 3-5 most relevant and authoritative sources. ' +
                    'Prefer official sites, documentation, established review platforms, and recent content. ' +
                    'Return a structured list of URLs with brief descriptions.'
            }), 'Web Explorer: Initial Search');
            return {
                ...result,
                returningFromSpecialist: 'web_explorer'
            };
        }
        // PHASE 2: Spawn 2 focused deep-dive sub-agents
        if (isSearchComplete && !hasSpawnedSubagents) {
            const searchResult = messages.find((m) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
            if (!searchResult) {
                console.warn('[WebExplorer] Search complete but result not found.');
                return { webExplorerComplete: true, taskPhase: 'evaluating', returningFromSpecialist: 'web_explorer' };
            }
            const searchContent = typeof searchResult.content === 'string' ? searchResult.content : JSON.stringify(searchResult.content);
            const userTask = messages.find((m) => m.role === 'user')?.content || '';
            const taskText = typeof userTask === 'string' ? userTask : JSON.stringify(userTask);
            const candidates = extractTopCandidates(searchContent, taskText, 2);
            if (candidates.length === 0) {
                console.warn('[WebExplorer] No candidates found from search results.');
                return { webExplorerComplete: true, taskPhase: 'evaluating', returningFromSpecialist: 'web_explorer' };
            }
            eventQueue?.push({
                type: 'thought',
                content: `\n🎯 WEB EXPLORER: Launching ${candidates.length} focused investigators:\n${candidates.map((c, i) => `  ${i + 1}. ${c.url}`).join('\n')}`
            });
            const spawner = (0, subagent_spawn_1.getSubagentSpawner)();
            const spawned = [];
            for (const candidate of candidates) {
                const options = {
                    parentSessionId: runner.currentConversationId || 'default',
                    task: `Investigate this specific source for the research goal below.\n\nTARGET URL: ${candidate.url}\n\nMISSION:\n1. Visit the URL using navis\n2. Read the FULL page content\n3. Extract: features, pricing, pros/cons, technical details, publication date, credibility signals\n4. Return a structured report with specific facts and direct quotes`,
                    agentType: 'web-explorer',
                    context: `Research goal: ${taskText}`,
                    model: runner.client.model,
                    mode: 'run',
                    maxDepth: 2
                };
                console.log(`[WebExplorer] Dispatching investigator → ${candidate.url}`);
                const agent = await spawner.spawn(options);
                spawned.push(agent);
            }
            return {
                subagentSpawned: spawned,
                webExplorerComplete: false,
                taskPhase: 'specialized_agent',
                returningFromSpecialist: 'web_explorer'
            };
        }
        // PHASE 3: Wait and Synthesize
        if (hasSpawnedSubagents) {
            eventQueue?.push({ type: 'thought', content: '\n📊 WEB EXPLORER: Gathering findings from investigators...' });
            const registry = (0, subagent_registry_1.getSubagentRegistry)();
            const ids = state.subagentSpawned.map((s) => s.agentId || s.id);
            const timeout = subagent_spawn_1.AGENT_TIMEOUTS['web-explorer'];
            const startTime = Date.now();
            let completed = false;
            while (Date.now() - startTime < timeout) {
                const children = registry.getChildren(runner.currentConversationId || 'default');
                const allDone = ids.every((id) => {
                    const child = children.find(c => c.agentId === id);
                    return child && (child.status === 'completed' || child.status === 'failed' || child.status === 'aborted');
                });
                if (allDone) {
                    completed = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            const children = registry.getChildren(runner.currentConversationId || 'default');
            const results = [];
            const errors = [];
            for (const id of ids) {
                const child = children.find(c => c.agentId === id);
                if (child?.status === 'completed' && child.result) {
                    results.push(`## Source Investigation\n\n${child.result}`);
                }
                else if (child?.error) {
                    errors.push(`${id}: ${child.error}`);
                }
            }
            eventQueue?.push({ type: 'thought', content: '\n✅ WEB EXPLORER: All investigators finished. Compiling synthesis...' });
            const synthesisInput = results.join('\n\n---\n\n');
            const errorSummary = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
            return {
                messages: [
                    ...state.messages,
                    {
                        role: 'assistant',
                        content: `[RESEARCH SYNTHESIS INPUT]\n\n${synthesisInput}${errorSummary}\n\n---\n\nSTATUS: COMPLETE\nSources investigated: ${results.length}/${ids.length}\nMISSION_COMPLETE`
                    }
                ],
                webExplorerComplete: true,
                taskPhase: 'evaluating',
                returningFromSpecialist: 'web_explorer'
            };
        }
        return { webExplorerComplete: true, returningFromSpecialist: 'web_explorer' };
    };
};
exports.createWebExplorerNode = createWebExplorerNode;
function extractTopCandidates(searchContent, task, maxCount) {
    const candidates = [];
    const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
    const matches = searchContent.match(urlRegex) || [];
    const SEARCH_ENGINES = ['google.com', 'bing.com', 'duckduckgo.com', 'brave.com', 'yahoo.com'];
    const LOW_QUALITY = ['pinterest.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];
    const cleanUrls = [...new Set(matches)].filter(u => !SEARCH_ENGINES.some(se => u.includes(se)) &&
        !LOW_QUALITY.some(lq => u.includes(lq)));
    const taskLower = (task || '').toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);
    for (const url of cleanUrls) {
        const urlLower = url.toLowerCase();
        let score = 50;
        if (url.includes('.edu'))
            score += 20;
        if (url.includes('.org'))
            score += 15;
        if (url.includes('.gov'))
            score += 25;
        if (url.includes('github.com'))
            score += 15;
        if (url.includes('docs.') || url.includes('/docs/'))
            score += 15;
        if (url.includes('wiki'))
            score += 10;
        const urlKeywordMatches = taskWords.filter(w => urlLower.includes(w)).length;
        score += urlKeywordMatches * 12;
        if (url.includes('?') && url.split('?')[1].length > 50)
            score -= 10;
        if (url.length > 150)
            score -= 5;
        candidates.push({ url, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxCount);
}

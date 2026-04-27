"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebExplorerNode = exports.WebExplorerManager = void 0;
const agent_runtime_1 = require("../services/agent-runtime");
const mission_integrator_1 = require("../mission-integrator");
const prompt_sync_1 = require("../../../lib/prompt-sync");
const subagent_spawn_1 = require("../subagent-spawn");
const subagent_registry_1 = require("../subagent-registry");
const subagent_result_aggregator_1 = require("../subagent-result-aggregator");
/**
 * Multi-Agent Web Explorer (Manager)
 *
 * Instead of performing research itself, this node acts as a MANAGER that:
 * 1. Analyzes search results to find the TOP candidates.
 * 2. Spawns parallel WORKER sub-agents to investigate each candidate.
 * 3. Aggregates findings into a high-quality comparison.
 */
class WebExplorerManager {
    config;
    spawner = (0, subagent_spawn_1.getSubagentSpawner)();
    registry = (0, subagent_registry_1.getSubagentRegistry)();
    aggregator = (0, subagent_result_aggregator_1.getSubagentResultAggregator)();
    constructor(config = {}) {
        this.config = {
            enableSubagentSpawning: config.enableSubagentSpawning ?? true,
            maxConcurrentSubagents: config.maxConcurrentSubagents ?? 5,
            subagentTimeout: config.subagentTimeout ?? 120000,
        };
    }
    /**
     * Identifies the best candidates from a search result string with quality scoring.
     * Task-aware: scores URLs by relevance to the actual research goal, not just domain heuristics.
     */
    parseBestCandidates(searchContent, task) {
        const candidates = [];
        const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
        const matches = searchContent.match(urlRegex) || [];
        // Filter out search engine URLs and low-quality domains
        const SEARCH_ENGINES = ['google.com', 'bing.com', 'duckduckgo.com', 'brave.com', 'yahoo.com'];
        const LOW_QUALITY = ['pinterest.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];
        // URL patterns that indicate list/category pages — we want to drill THROUGH these, not stop at them
        const LIST_PAGE_PATTERNS = ['/tag/', '/category/', '/list/', '/search/', '/tags/', '/topics/', '/browse/'];
        const cleanUrls = [...new Set(matches)].filter(u => !SEARCH_ENGINES.some(se => u.includes(se)) &&
            !LOW_QUALITY.some(lq => u.includes(lq)));
        const taskLower = (task || '').toLowerCase();
        const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);
        // Score URLs based on quality signals
        for (const url of cleanUrls) {
            const urlLower = url.toLowerCase();
            let score = 50; // Base score
            // Boost authoritative domains
            if (url.includes('.edu'))
                score += 20;
            if (url.includes('.org'))
                score += 15;
            if (url.includes('.gov'))
                score += 25;
            if (url.includes('github.com'))
                score += 15;
            if (url.includes('stackoverflow.com'))
                score += 10;
            // Boost documentation and official sites
            if (url.includes('docs.') || url.includes('/docs/'))
                score += 15;
            if (url.includes('wiki'))
                score += 10;
            if (url.includes('official'))
                score += 10;
            // Task-keyword match in URL — strong signal this is a specific relevant page
            const urlKeywordMatches = taskWords.filter(w => urlLower.includes(w)).length;
            score += urlKeywordMatches * 12;
            // Penalize list/category pages — they're intermediate, not the final answer
            const isListPage = LIST_PAGE_PATTERNS.some(p => urlLower.includes(p));
            if (isListPage)
                score -= 20;
            // Penalize potential spam indicators
            if (url.includes('?') && url.split('?')[1].length > 50)
                score -= 10;
            if (url.length > 150)
                score -= 5;
            candidates.push({ title: 'Research Target', url, score });
        }
        // Sort by score (highest first) and take top candidates
        candidates.sort((a, b) => b.score - a.score);
        return candidates.slice(0, this.config.maxConcurrentSubagents);
    }
    /**
     * Spawns worker agents with unique identities and strict goals
     */
    async spawnWorkers(parentSessionId, candidates, runner, eventQueue) {
        const workerRoles = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
        eventQueue?.push({
            type: 'thought',
            content: `\n🚀 MANAGER: Dispatching ${candidates.length} specialist investigators to their targets...`
        });
        const spawnTasks = candidates.map(async (c, i) => {
            const role = `Investigator ${workerRoles[i] || i + 1}`;
            const task = `ROLE: ${role} — Deep Research Specialist
TARGET URL: ${c.url}
QUALITY SCORE: ${c.score ?? 'N/A'}

MISSION: Conduct an exhaustive investigation of your assigned target. You are an independent specialist — do NOT investigate other URLs.

MANDATORY STEPS:
1. Visit the target URL using browser_use
2. Read the FULL page content — do not skim
3. Navigate to sub-pages if needed (product pages, pricing, docs)
4. Extract ALL of the following if present:
   - Core features and capabilities (be specific, not vague)
   - Pricing tiers and exact costs
   - Pros and cons based on actual content
   - User reviews, ratings, or testimonials
   - Technical requirements or limitations
   - Last updated / publication date
   - Author or organization credibility signals

REPORTING FORMAT:
Return a structured report with:
## Source: [URL]
## Credibility: [High/Medium/Low — explain why]
## Key Findings:
[Detailed bullet points with specific facts]
## Pricing: [Exact details or "Not found"]
## Pros: [Based on actual page content]
## Cons: [Based on actual page content]
## Notable Quotes: [Direct quotes from the page]
## Recommendation Score: [1-10 with reasoning]

STRICT RULES:
- NEVER summarize based on URL alone — you MUST visit the page
- NEVER fabricate information — only report what you actually read
- If the page is inaccessible, report that clearly and try an alternative URL
- Be specific: "supports 50+ integrations" not "supports many integrations"`;
            const options = {
                parentSessionId,
                task,
                model: runner.client.model,
                mode: 'run',
                maxDepth: 3
            };
            console.log(`[WebExplorer] Dispatching ${role} → ${c.url} (score: ${c.score ?? 'N/A'})`);
            return this.spawner.spawn(options);
        });
        return Promise.all(spawnTasks);
    }
    async aggregateResults(parentSessionId, spawned) {
        const ids = spawned.map(s => s.agentId || s.id);
        return this.aggregator.aggregateResults(parentSessionId, ids, {
            timeoutMs: this.config.subagentTimeout,
            includeErrors: true
        });
    }
}
exports.WebExplorerManager = WebExplorerManager;
const createWebExplorerNode = (runner, eventQueue, missionTracker, toolDefs) => {
    const integrator = (0, mission_integrator_1.createMissionIntegrator)(missionTracker);
    const manager = new WebExplorerManager();
    return async (state) => {
        const allTools = toolDefs || runner._buildToolDefinitions();
        const messages = state.messages || [];
        // Track workflow progress
        const lastMsg = messages[messages.length - 1];
        const isSearchComplete = messages.some((m) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
        const hasWorkersSpawned = state.subagentSpawned && state.subagentSpawned.length > 0;
        // PHASE 1: Initial Search
        if (!isSearchComplete) {
            eventQueue?.push({ type: 'thought', content: '\n🌐 WEB EXPLORER: Initiating broad search to identify best sources...' });
            const result = await integrator.wrapNode('web_explorer', () => (0, agent_runtime_1.runAgentStep)(state, {
                runner,
                toolDefs: allTools,
                eventQueue,
                nodeName: 'web_explorer',
                systemPromptOverride: ((0, prompt_sync_1.loadPrompt)('web-explorer.md') || '') +
                    '\n\nPHASE: SEARCH. Use web_search to find the top 5-8 most relevant and authoritative sources. ' +
                    'Prefer official sites, documentation, established review platforms, and recent content. ' +
                    'Your search query should be specific and targeted.'
            }), 'Web Explorer: Initial Search');
            return {
                ...result,
                returningFromSpecialist: 'web_explorer'
            };
        }
        // PHASE 2: Spawn Workers (Parallel Deep-Dives)
        if (isSearchComplete && !hasWorkersSpawned) {
            const searchResult = messages.find((m) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
            if (!searchResult) {
                console.warn('[WebExplorer] Search complete but result not found in history.');
                return { webExplorerComplete: true, taskPhase: 'evaluating', returningFromSpecialist: 'web_explorer' };
            }
            const searchContent = typeof searchResult.content === 'string' ? searchResult.content : JSON.stringify(searchResult.content);
            // Extract the original user task for task-aware URL scoring
            const userTask = messages.find((m) => m.role === 'user')?.content || '';
            const taskText = typeof userTask === 'string' ? userTask : JSON.stringify(userTask);
            const candidates = manager.parseBestCandidates(searchContent, taskText);
            if (candidates.length === 0) {
                console.warn('[WebExplorer] No candidates found from search results.');
                return { webExplorerComplete: true, taskPhase: 'evaluating', returningFromSpecialist: 'web_explorer' };
            }
            eventQueue?.push({
                type: 'thought',
                content: `\n🎯 WEB EXPLORER: Selected ${candidates.length} high-quality sources to investigate:\n${candidates.map((c, i) => `  ${i + 1}. ${c.url} (score: ${c.score})`).join('\n')}`
            });
            const spawned = await manager.spawnWorkers(runner.currentConversationId || 'default', candidates, runner, eventQueue);
            return {
                subagentSpawned: spawned,
                webExplorerComplete: false,
                taskPhase: 'specialized_agent',
                returningFromSpecialist: 'web_explorer'
            };
        }
        // PHASE 3: Wait and Aggregate
        if (hasWorkersSpawned) {
            eventQueue?.push({ type: 'thought', content: '\n📊 MANAGER: Gathering findings from parallel workers...' });
            const aggregation = await manager.aggregateResults(runner.currentConversationId || 'default', state.subagentSpawned);
            if (aggregation.completedSubagents < state.subagentSpawned.length) {
                // Not all done, continue waiting
                return { webExplorerComplete: false, returningFromSpecialist: 'web_explorer' };
            }
            eventQueue?.push({ type: 'thought', content: '\n✅ MANAGER: All investigators finished. Synthesizing comprehensive research report...' });
            return {
                messages: [
                    ...state.messages,
                    {
                        role: 'assistant',
                        content: `[RESEARCH AGGREGATION COMPLETE]

The web explorer has finished its investigation. Here are the consolidated findings from ${state.subagentSpawned.length} parallel research agents:

${aggregation.summary}

---
Research Status: COMPLETE
Sources Investigated: ${aggregation.completedSubagents}
MISSION_COMPLETE`
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

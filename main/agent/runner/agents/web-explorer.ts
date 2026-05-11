import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import { loadPrompt } from '../../../lib/prompt-sync';
import { getSubagentSpawner, type SpawnOptions, AGENT_TIMEOUTS } from '../subagent-spawn';
import { getSubagentRegistry } from '../subagent-registry';
import { emitTool } from '../../infra/agent-events';

export const createWebExplorerNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);

  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const allTools = toolDefs || (runner as any)._buildToolDefinitions();
    const messages = state.messages || [];

    const lastMsg = messages[messages.length - 1];
    const isSearchComplete = messages.some((m: any) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
    const hasSpawnedSubagents = state.subagentSpawned && state.subagentSpawned.length > 0;
    const hasDirectNav = messages.some((m: any) => (m.role === 'tool' || m.type === 'tool') && m.name === 'navis');

    // DIRECT URL NAVIGATION: If the user provided a specific URL (skip research workflow)
    const directUrl = !isSearchComplete && !hasSpawnedSubagents && !hasDirectNav
        ? extractDirectUrl(messages)
        : null;

    if (directUrl) {
        eventQueue?.push({ type: 'thought', content: `\n🌐 WEB EXPLORER: Navigating directly to ${directUrl}...` });
        const result = await integrator.wrapNode('web_explorer', () => runAgentStep(state, {
            runner,
            toolDefs: allTools,
            eventQueue,
            nodeName: 'web_explorer',
            systemPromptOverride: (loadPrompt('web-explorer.md') || '') +
                `\n\nDIRECT URL NAVIGATION. The user wants you to go to: ${directUrl}` +
                '\nUse navis to navigate to this URL. Do NOT call web_search — the URL is already provided.' +
                '\nLook for login buttons, forms, or dashboard links and interact with them.' +
                '\nReport what you see and what actions are available on the page.'
        }), 'Web Explorer: Direct Navigation');
        return {
            ...result,
            webExplorerComplete: false,
            returningFromSpecialist: 'web_explorer'
        };
    }

    // PHASE 1: Initial Search
    if (!isSearchComplete && !hasDirectNav) {
        eventQueue?.push({ type: 'thought', content: '\n🌐 WEB EXPLORER: Searching for authoritative sources...' });
        const result = await integrator.wrapNode('web_explorer', () => runAgentStep(state, {
            runner,
            toolDefs: allTools,
            eventQueue,
            nodeName: 'web_explorer',
            systemPromptOverride: (loadPrompt('web-explorer.md') || '') +
                '\n\nPHASE: SEARCH. Use web_search to find the top 3-5 most relevant and authoritative sources. ' +
                'Prefer official sites, documentation, established review platforms, and recent content. ' +
                'Return a structured list of URLs with brief descriptions.' +
                '\n\nCRITICAL: Use web_search — NOT terminal_execute with curl. Curl cannot render JavaScript pages and will get blocked by captchas. web_search is the only allowed search tool.'
        }), 'Web Explorer: Initial Search');
        return {
            ...result,
            returningFromSpecialist: 'web_explorer'
        };
    }

    // PHASE 2: Spawn 2 focused deep-dive sub-agents
    if (isSearchComplete && !hasSpawnedSubagents) {
        const searchResult = messages.find((m: any) => (m.role === 'tool' || m.type === 'tool') && m.name === 'web_search');
        if (!searchResult) {
            console.warn('[WebExplorer] Search complete but result not found.');
            return { webExplorerComplete: true, taskPhase: 'evaluating' as const, returningFromSpecialist: 'web_explorer' };
        }

        const searchContent = typeof searchResult.content === 'string' ? searchResult.content : JSON.stringify(searchResult.content);
        const userTask = messages.find((m: any) => m.role === 'user')?.content || '';
        const taskText = typeof userTask === 'string' ? userTask : JSON.stringify(userTask);

        const candidates = extractTopCandidates(searchContent, taskText, 2);
        if (candidates.length === 0) {
            console.warn('[WebExplorer] No candidates found from search results.');
            return { webExplorerComplete: true, taskPhase: 'evaluating' as const, returningFromSpecialist: 'web_explorer' };
        }

        eventQueue?.push({
            type: 'thought',
            content: `\n🎯 WEB EXPLORER: Launching ${candidates.length} focused investigators:\n${candidates.map((c, i) => `  ${i + 1}. ${c.url}`).join('\n')}`
        });

        const spawner = getSubagentSpawner();
        const spawned: any[] = [];

        for (const candidate of candidates) {
            const investigatorToolCallId = `investigator_${candidate.url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}_${Date.now().toString(36)}`;
            
            // Emit pseudo tool_start for the timeline
            eventQueue?.push({
                type: 'tool_start',
                toolName: 'web_investigator',
                toolArgs: { url: candidate.url },
                toolCallId: investigatorToolCallId
            });

            const options: SpawnOptions = {
                parentSessionId: runner.currentConversationId || 'default',
                sponsorSessionKey: runner.currentAgentSessionKey,
                task: `Investigate this specific source for the research goal below.\n\nTARGET URL: ${candidate.url}\n\nMISSION:\n1. Use navis to navigate to the URL above\n2. Read the FULL page content using extract_content\n3. Extract: features, pricing, pros/cons, technical details, publication date, credibility signals\n4. Return a structured report with specific facts and direct quotes\n\nCRITICAL: You MUST use navis to visit the URL. DO NOT use terminal_execute with curl — curl cannot render JavaScript, will get blocked by captchas, and returns incomplete content. Only navis can properly load modern web pages.\n\nRESTRICTION: You are a single-task investigator. DO NOT spawn sub-agents or delegate to other agents. Investigate this URL yourself directly.`,
                agentType: 'generic',
                context: `Research goal: ${taskText}`,
                model: runner.client.model,
                mode: 'run',
                maxDepth: 1, // Investigator must not spawn further sub-agents
                runner: runner,
                toolCallId: investigatorToolCallId
            };

            console.log(`[WebExplorer] Dispatching investigator → ${candidate.url}`);
            const agent = await spawner.spawn(options);
            spawned.push({ 
                agentId: agent.agentId, 
                sessionKey: agent.sessionKey, 
                url: candidate.url,
                toolCallId: investigatorToolCallId
            });
        }

        return {
            subagentSpawned: spawned,
            webExplorerComplete: false,
            taskPhase: 'specialized_agent' as const,
            returningFromSpecialist: 'web_explorer'
        };
    }

    // PHASE 3: Wait and Synthesize
    if (hasSpawnedSubagents) {
        const registry = getSubagentRegistry();
        const ids = state.subagentSpawned.map((s: any) => s.agentId || s.id);
        const timeout = AGENT_TIMEOUTS['web-explorer'];
        const startTime = Date.now();
        let completed = false;

        let lastActiveCount = -1;

        while (Date.now() - startTime < timeout) {
            const children = registry.getChildren(runner.currentConversationId || 'default');
            const statusMap = ids.map((id: string) => {
                const child = children.find(c => c.agentId === id);
                return { id, status: child?.status || 'unknown' };
            });

            const allDone = statusMap.every((s: any) => s.status === 'completed' || s.status === 'failed' || s.status === 'aborted');
            if (allDone) { completed = true; break; }

            const activeCount = statusMap.filter((s: any) => s.status === 'running' || s.status === 'pending').length;
            
            // Emit update only when progress changes to avoid spamming
            if (activeCount !== lastActiveCount) {
                const finishedCount = ids.length - activeCount;
                eventQueue?.push({ 
                    type: 'thought', 
                    content: `\n📊 WEB EXPLORER: Investigating sources... (${finishedCount}/${ids.length} finished, ${activeCount} active)` 
                });
                lastActiveCount = activeCount;
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const children = registry.getChildren(runner.currentConversationId || 'default');
        const results: string[] = [];
        const errors: string[] = [];

        for (const id of ids) {
            const child = children.find(c => c.agentId === id);
            if (child?.status === 'completed' && child.result) {
                results.push(`## Source Investigation\n\n${child.result}`);
            } else if (child?.error) {
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
                } as any
            ],
            webExplorerComplete: true,
            taskPhase: 'evaluating' as const,
            returningFromSpecialist: 'web_explorer'
        };
    }

    return { webExplorerComplete: true, returningFromSpecialist: 'web_explorer' };
  };
};

function extractDirectUrl(messages: any[]): string | null {
    const userMsg = messages.find((m: any) => m.role === 'user' || m.type === 'human' || m._getType?.() === 'human');
    if (!userMsg) return null;
    const content = typeof userMsg.content === 'string' ? userMsg.content : '';
    if (!content) return null;

    const urlPattern = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|xyz|dev|app|ai|co|me|tv|edu|gov|info)\b(?:[^\s"'<>)]*)?/gi;
    const matches = content.match(urlPattern);
    if (!matches || matches.length === 0) return null;

    const url = matches[0].toLowerCase();

    return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
}

function extractTopCandidates(searchContent: string, task: string, maxCount: number): Array<{ url: string; score: number }> {
    const candidates: Array<{ url: string; score: number }> = [];
    const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
    const matches = searchContent.match(urlRegex) || [];

    const SEARCH_ENGINES = ['google.com', 'bing.com', 'duckduckgo.com', 'brave.com', 'yahoo.com'];
    const LOW_QUALITY = ['pinterest.com', 'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'];

    const cleanUrls = [...new Set(matches)].filter(u =>
        !SEARCH_ENGINES.some(se => u.includes(se)) &&
        !LOW_QUALITY.some(lq => u.includes(lq))
    );

    const taskLower = (task || '').toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);

    for (const url of cleanUrls) {
        const urlLower = url.toLowerCase();
        let score = 50;

        if (url.includes('.edu')) score += 20;
        if (url.includes('.org')) score += 15;
        if (url.includes('.gov')) score += 25;
        if (url.includes('github.com')) score += 15;
        if (url.includes('docs.') || url.includes('/docs/')) score += 15;
        if (url.includes('wiki')) score += 10;

        const urlKeywordMatches = taskWords.filter(w => urlLower.includes(w)).length;
        score += urlKeywordMatches * 12;

        if (url.includes('?') && url.split('?')[1].length > 50) score -= 10;
        if (url.length > 150) score -= 5;

        candidates.push({ url, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, maxCount);
}

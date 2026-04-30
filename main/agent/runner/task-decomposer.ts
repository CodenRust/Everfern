/**
 * EverFern Desktop — NEXUS Task Decomposer v3
 *
 * Intelligently decomposes complex tasks into dependency-aware, parallelizable subtasks.
 * Task type classification is performed by the AI model when a client is available,
 * with a lightweight regex fallback for synchronous / test contexts.
 */

import { DecomposedTask, TaskStep } from './state';
import type { AIClient } from '../../lib/ai-client';

export interface TaskAnalysis {
    complexity: 'simple' | 'moderate' | 'complex';
    taskType: 'coding' | 'research' | 'build' | 'fix' | 'analyze' | 'automate' | 'task' | 'conversation';
    canParallelize: boolean;
    suggestedApproach: 'sequential' | 'parallel' | 'hybrid';
    estimatedSteps: number;
    requiresExternalData: boolean;
    requiresFileOps: boolean;
    requiresCommandExecution: boolean;
}

// ── Parallelization Signals (kept — these are structural, not semantic) ────

const PARALLEL_SIGNALS = [
    /\b(multiple|several|each|all|every|batch)\b/i,
    /\b(files?|images?|documents?|records?|items?|entries?)\b.{0,20}\b(analyze|process|convert|read|check)\b/i,
    /\b(compare|contrast|benchmark|evaluate)\b.{0,30}\b(and|with|against|vs)\b/i,
    /\b(simultaneously|concurrently|in parallel|at the same time)\b/i,
];

const SEQUENTIAL_SIGNALS = [
    /\b(then|after|next|followed by|step by step|first.*then|once.*done)\b/i,
    /\b(depends? on|requires?|needs?|must.*before)\b/i,
    /\b(build|compile|deploy)\b.{0,20}\b(after|once|when)\b/i,
];

// ── Regex fallback (used when no AI client is available) ──────────────────

const TASK_TYPE_SIGNALS_FALLBACK: Record<string, RegExp> = {
    coding:   /\b(function|class|method|api|endpoint|component|module|library|algorithm|implement|refactor|write code)\b/i,
    build:    /\b(create|build|make|scaffold|new project|new app|generate|setup|initialize|bootstrap)\b/i,
    fix:      /\b(fix|debug|repair|error|bug|broken|failing|crash|not work|issue|exception|traceback)\b/i,
    analyze:  /\b(analyze|analyse|csv|xlsx|data|dataset|chart|graph|plot|dashboard|insights|statistics|metrics|trends)\b/i,
    automate: /\b(automate|schedule|cron|batch|pipeline|workflow|recurring|monitor|watch|trigger|open|launch|start|click|type|press|scroll|gui|desktop|screen|mouse|keyboard)\b/i,
    research: /\b(research|search|find|look up|investigate|what is|how does|explain|compare|review)\b/i,
    task:     /\b(run|execute|install|configure|move|copy|delete|download|upload|deploy|publish)\b/i,
};

function classifyTaskTypeSync(text: string): TaskAnalysis['taskType'] {
    let taskType: TaskAnalysis['taskType'] = 'task';
    let highestScore = 0;
    for (const [type, pattern] of Object.entries(TASK_TYPE_SIGNALS_FALLBACK)) {
        const matches = text.match(new RegExp(pattern.source, 'gi')) || [];
        if (matches.length > highestScore) {
            highestScore = matches.length;
            taskType = type as TaskAnalysis['taskType'];
        }
    }
    return taskType;
}

// ── AI-based task type classification ────────────────────────────────────

const VALID_TASK_TYPES: TaskAnalysis['taskType'][] = [
    'coding', 'research', 'build', 'fix', 'analyze', 'automate', 'task', 'conversation'
];

async function classifyTaskTypeWithAI(userInput: string, client: AIClient): Promise<TaskAnalysis['taskType']> {
    const prompt = `Classify the following user request into exactly one task type.

USER REQUEST: "${userInput.slice(0, 500)}"

Task types:
- "coding"       — writing, editing, or refactoring code (functions, classes, APIs, components)
- "research"     — searching the web, looking up information, investigating topics, answering questions
- "build"        — creating a new project, app, or scaffold from scratch
- "fix"          — debugging, repairing errors, fixing bugs or crashes
- "analyze"      — processing data, generating charts, CSV/Excel analysis, dashboards
- "automate"     — GUI automation, clicking UI elements, desktop app interaction, screen control
- "task"         — running commands, installing packages, file operations, deployments
- "conversation" — casual chat, greetings, opinions, no action required

Rules:
- "automate" is ONLY for tasks that require physically clicking/interacting with a desktop GUI or native app screen.
- "research" covers any web search, information lookup, or question answering — even if the query mentions product names like Discord, Spotify, Chrome.
- Respond with JSON only: {"taskType": "<one of the types above>"}`;

    try {
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0,
            maxTokens: 30,
        }) as any;

        let content = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const parsed = JSON.parse(content);
        if (VALID_TASK_TYPES.includes(parsed.taskType)) {
            return parsed.taskType as TaskAnalysis['taskType'];
        }
    } catch (err) {
        console.warn('[TaskDecomposer] AI classification failed, using regex fallback:', err instanceof Error ? err.message : String(err));
    }

    return classifyTaskTypeSync(userInput.toLowerCase());
}

// ── Tool Dependency Map ───────────────────────────────────────────────────

const TOOL_DEPENDENCY_MAP: Record<string, {
    dependsOn: string[];
    complexity: 'low' | 'medium' | 'high';
    canParallelize: boolean;
    avgDurationMs: number;
}> = {
    web_search:    { dependsOn: [],               complexity: 'low',    canParallelize: true,  avgDurationMs: 2000  },
    navis:         { dependsOn: ['web_search'],    complexity: 'medium', canParallelize: true,  avgDurationMs: 15000 },
    view_file:     { dependsOn: [],               complexity: 'low',    canParallelize: true,  avgDurationMs: 500   },

    read:          { dependsOn: [],               complexity: 'low',    canParallelize: true,  avgDurationMs: 500   },
    memory_search: { dependsOn: [],               complexity: 'low',    canParallelize: true,  avgDurationMs: 1000  },
    write:         { dependsOn: ['view_file'],     complexity: 'medium', canParallelize: false, avgDurationMs: 1000  },
    edit:          { dependsOn: ['view_file'],     complexity: 'medium', canParallelize: false, avgDurationMs: 1500  },
    run_command:   { dependsOn: ['write'],         complexity: 'high',   canParallelize: false, avgDurationMs: 5000  },
    bash:          { dependsOn: ['write'],         complexity: 'high',   canParallelize: false, avgDurationMs: 8000  },
    skill:         { dependsOn: [],               complexity: 'low',    canParallelize: false, avgDurationMs: 2000  },
    execution_plan:{ dependsOn: [],               complexity: 'low',    canParallelize: false, avgDurationMs: 500   },
    todo_write:    { dependsOn: [],               complexity: 'low',    canParallelize: false, avgDurationMs: 200   },
    present_files: { dependsOn: ['write'],         complexity: 'low',    canParallelize: false, avgDurationMs: 300   },
};

// ── Shared structural analysis (no AI needed) ─────────────────────────────

function analyzeStructure(userInput: string): Omit<TaskAnalysis, 'taskType'> {
    const text = userInput.toLowerCase();

    let parallelScore = 0;
    let sequentialScore = 0;
    for (const p of PARALLEL_SIGNALS)   if (p.test(text)) parallelScore++;
    for (const p of SEQUENTIAL_SIGNALS) if (p.test(text)) sequentialScore++;

    const actionVerbs = (text.match(
        /\b(analyze?|research|find|search|create?|generate|build|make|edit|modify|update|delete|run|execute|download|install|read|fetch|compare|test|verify|check|process|convert)\b/gi
    ) || []);
    const uniqueActions = new Set(actionVerbs.map(v => v.toLowerCase())).size;

    const wordCount = text.split(/\s+/).length;
    const complexity: TaskAnalysis['complexity'] =
        (wordCount > 80 || uniqueActions > 5) ? 'complex' :
        (wordCount > 25 || uniqueActions > 2) ? 'moderate' : 'simple';

    const canParallelize = parallelScore > sequentialScore && uniqueActions >= 2;
    const suggestedApproach: TaskAnalysis['suggestedApproach'] =
        canParallelize && uniqueActions > 3 ? 'hybrid' :
        canParallelize ? 'parallel' : 'sequential';

    const nonDataText = text.split('\n').filter(line => (line.match(/,/g) || []).length < 2).join('\n');
    const requiresExternalData      = /\b(search|fetch|download|web|url|http|api|scrape|lookup)\b/i.test(nonDataText);
    const requiresFileOps           = /\b(file|folder|directory|path|write|read|create|edit|save|csv|xlsx|pdf|docx)\b/i.test(nonDataText);
    const requiresCommandExecution  = /\b(run|execute|install|pip|npm|python|node|bash|shell|command|compile|build)\b/i.test(nonDataText);

    return {
        complexity,
        canParallelize,
        suggestedApproach,
        estimatedSteps: Math.max(2, Math.min(uniqueActions + 1, 12)),
        requiresExternalData,
        requiresFileOps,
        requiresCommandExecution,
    };
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Synchronous task analysis using regex signals.
 * Use this in tests or contexts where no AI client is available.
 */
export function analyzeTask(userInput: string): TaskAnalysis {
    return {
        taskType: classifyTaskTypeSync(userInput.toLowerCase()),
        ...analyzeStructure(userInput),
    };
}

/**
 * AI-powered task analysis. Uses the model to classify task type and falls
 * back to regex if the model call fails or no client is provided.
 */
export async function analyzeTaskWithAI(userInput: string, client?: AIClient): Promise<TaskAnalysis> {
    const taskType = client
        ? await classifyTaskTypeWithAI(userInput, client)
        : classifyTaskTypeSync(userInput.toLowerCase());

    return {
        taskType,
        ...analyzeStructure(userInput),
    };
}

// ── Decomposition ─────────────────────────────────────────────────────────

function buildSteps(userInput: string, analysis: TaskAnalysis): TaskStep[] {
    const steps: TaskStep[] = [];
    let stepId = 1;

    const mk = (
        desc: string,
        tool: string | undefined,
        dependsOn: string[],
        canParallelize: boolean,
        complexity: TaskStep['estimatedComplexity'],
        priority: TaskStep['priority'] = 'normal',
        parallelGroup?: number,
        agentPrompt?: string
    ): TaskStep => ({
        id: `step_${stepId++}`,
        description: desc,
        tool: tool || 'internal',
        dependsOn,
        canParallelize,
        estimatedComplexity: complexity,
        priority,
        parallelGroup,
        agentPrompt,
    });

    const nonDataLines = userInput.split('\n').filter(line => (line.match(/,/g) || []).length < 2).join('\n');
    const urls      = (nonDataLines.match(/https?:\/\/[^\s"',]+/g) || []);
    const filePaths = (nonDataLines.match(/[A-Za-z]:\\[\w\\.\-]+|~\/[\w\/.\-]+|\/[\w\/.\-]+\.\w+/g) || []);
    const topics    = (nonDataLines.match(/"([^"]+)"|'([^']+)'/g) || []).map(s => s.replace(/['"]/g, ''));

    // Phase 0: Skill reading
    if (['analyze', 'coding', 'build'].includes(analysis.taskType)) {
        steps.push(mk('Read relevant skill file(s)', 'skill', [], false, 'low', 'critical'));
    }

    // Phase 1: Parallel data gathering
    const gatherIds: string[] = [];

    if (analysis.requiresExternalData) {
        if (urls.length > 0) {
            for (const url of urls.slice(0, 3)) {
                const s = mk(`Browse and extract: ${url.slice(0, 60)}`, 'navis', [], true, 'medium', 'normal', 1);
                steps.push(s); gatherIds.push(s.id);
            }
        } else if (topics.length > 0) {

            for (const topic of topics.slice(0, 3)) {
                const s = mk(`Search: ${topic}`, 'web_search', [], true, 'low', 'normal', 1);
                steps.push(s); gatherIds.push(s.id);
            }
        } else {
            const s = mk('Web search for required information', 'web_search', [], true, 'low', 'normal', 1);
            steps.push(s); gatherIds.push(s.id);
        }
    }

    if (analysis.requiresFileOps && filePaths.length > 0) {
        for (const fp of filePaths.slice(0, 4)) {
            const s = mk(`Read: ${fp}`, 'view_file', [], true, 'low', 'normal', 1);
            steps.push(s); gatherIds.push(s.id);
        }
    }

    // Phase 2: Planning / discovery
    if (analysis.complexity !== 'simple') {
        steps.push(mk('Create execution plan', 'execution_plan', gatherIds, false, 'low', 'critical'));
        steps.push(mk('Create and run discovery/validation script', 'run_command', gatherIds, false, 'medium', 'critical'));
    }

    // Phase 3: Core execution
    const execDeps = steps.filter(s => s.priority === 'critical').map(s => s.id);

    switch (analysis.taskType) {
        case 'analyze':
            steps.push(mk('Write data analysis/visualization HTML artifact', 'write', execDeps, false, 'high'));
            steps.push(mk('Verify artifact rendering', 'run_command', [`step_${stepId - 1}`], false, 'low'));
            break;

        case 'build':
        case 'coding':
            steps.push(mk('Write primary source file(s)',    'write',       execDeps,                                         false, 'high'));
            steps.push(mk('Write supporting files / config', 'write',       execDeps,                                         false, 'medium'));
            steps.push(mk('Install dependencies',            'run_command', [`step_${stepId - 2}`],                           false, 'medium'));
            steps.push(mk('Build / run entry point',         'run_command', [`step_${stepId - 2}`, `step_${stepId - 1}`],    false, 'high'));
            break;

        case 'fix':
            steps.push(mk('Read failing file(s)', 'view_file',   execDeps,               true,  'low',    'critical', 2));
            steps.push(mk('Apply fix',             'edit',        [`step_${stepId - 1}`], false, 'medium', 'critical'));
            steps.push(mk('Verify fix',            'run_command', [`step_${stepId - 1}`], false, 'high',   'critical'));
            break;

        case 'research':
            steps.push(mk(
                'Compile and summarize findings',
                undefined,
                gatherIds.length > 0 ? gatherIds : execDeps,
                false,
                'low'
            ));
            break;

        case 'automate':
            steps.push(mk(`Execute GUI automation task: ${userInput}`, 'computer_use', execDeps, false, 'high', 'critical'));
            break;

        default:
            if (analysis.requiresCommandExecution) {
                steps.push(mk('Execute required command(s)', 'run_command', execDeps, false, 'high'));
            }
            if (analysis.requiresFileOps) {
                steps.push(mk('Write / update file(s)', 'write', execDeps, false, 'medium'));
            }
    }

    // Final: Present deliverables
    const lastExecIds = steps
        .filter(s => s.tool === 'run_command' || s.tool === 'write')
        .map(s => s.id);

    if (lastExecIds.length > 0) {
        steps.push(mk('Present deliverables to user', 'present_files', lastExecIds.slice(-2), false, 'low', 'critical'));
    }

    return steps.filter(s => s.description.trim().length > 0);
}

function assembleDecomposedTask(userInput: string, analysis: TaskAnalysis): DecomposedTask {
    const validSteps = buildSteps(userInput, analysis);
    const groups = new Set(
        validSteps.filter(s => s.parallelGroup !== undefined).map(s => s.parallelGroup)
    );
    const estimatedDurationMs = validSteps.reduce((acc, s) => {
        const toolInfo = s.tool ? TOOL_DEPENDENCY_MAP[s.tool] : null;
        return acc + (toolInfo?.avgDurationMs ?? 2000);
    }, 0);

    return {
        id: `task_${Date.now()}`,
        title: userInput.substring(0, 80) + (userInput.length > 80 ? '...' : ''),
        steps: validSteps,
        canParallelize: analysis.canParallelize,
        estimatedParallelGroups: groups.size,
        totalSteps: validSteps.length,
        executionMode: analysis.suggestedApproach,
        estimatedDurationMs,
    };
}

/**
 * Synchronous decomposition (regex-based task type classification).
 * Kept for backward compatibility with callers that cannot go async.
 */
export function decomposeTask(userInput: string, availableTools: string[]): DecomposedTask {
    const analysis = analyzeTask(userInput);
    return assembleDecomposedTask(userInput, analysis);
}

/**
 * AI-powered decomposition. Uses the model to classify task type before
 * building the execution plan. Falls back to regex if the client is absent.
 */
export async function decomposeTaskWithAI(
    userInput: string,
    availableTools: string[],
    client?: AIClient
): Promise<DecomposedTask> {
    const analysis = await analyzeTaskWithAI(userInput, client);
    return assembleDecomposedTask(userInput, analysis);
}

// ── Plan Text Generator ───────────────────────────────────────────────────

export function generatePlanText(decomposed: DecomposedTask): string {
    const lines: string[] = [];

    const duration = (decomposed.estimatedDurationMs || 0) < 60_000
        ? `~${Math.round((decomposed.estimatedDurationMs || 0) / 1000)}s`
        : `~${Math.round((decomposed.estimatedDurationMs || 0) / 60_000)}m`;

    lines.push(`# Execution Plan: ${decomposed.title}`);
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| Strategy | ${decomposed.executionMode.charAt(0).toUpperCase() + decomposed.executionMode.slice(1)} Execution |`);
    lines.push(`| Steps | ${decomposed.totalSteps} |`);
    if ((decomposed.estimatedParallelGroups || 0) > 0) {
        lines.push(`| Parallel Groups | ${decomposed.estimatedParallelGroups} |`);
    }
    lines.push(`| Est. Duration | ${duration} |`);
    lines.push('');
    lines.push('## Steps');
    lines.push('');

    const grouped = new Map<number | string, TaskStep[]>();
    for (const step of decomposed.steps) {
        const key: number | string = step.parallelGroup !== undefined
            ? step.parallelGroup
            : `seq_${step.id}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(step);
    }

    for (const [key, group] of grouped) {
        const isParallelGroup = typeof key === 'number';
        if (isParallelGroup && group.length > 1) {
            lines.push(`### ⚡ Parallel Group ${key}`);
            for (const step of group) {
                lines.push(`- **${step.id}** ${step.description} (\`${step.tool || 'internal'}\`)`);
            }
        } else {
            for (const step of group) {
                const badge = step.priority === 'critical' ? ' 🔴' : '';
                const deps  = (step.dependsOn || []).length > 0
                    ? ` → depends: ${(step.dependsOn || []).join(', ')}`
                    : '';
                lines.push(`### ${step.id}: ${step.description}${badge}`);
                lines.push(`**Tool:** \`${step.tool || 'none'}\` | **Complexity:** ${step.estimatedComplexity || 'moderate'}${deps}`);
                lines.push('');
            }
        }
        lines.push('');
    }

    return lines.join('\n');
}

export function getAGIHints(userInput: string): string {
    const analysis = analyzeTask(userInput);
    const hints: string[] = [];

    if (analysis.canParallelize) {
        hints.push('PARALLEL: This task can be decomposed into parallel subtasks.');
        hints.push(`Approach: ${analysis.suggestedApproach} (${analysis.estimatedSteps} estimated steps)`);
    }
    if (analysis.complexity === 'complex') {
        hints.push('COMPLEX: Break into independent subtasks that can be delegated to specialized agents.');
    }

    return hints.join(' ');
}

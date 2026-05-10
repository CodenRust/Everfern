"use strict";
/**
 * EverFern Desktop — NEXUS Task Decomposer v4 (Full AI Edition)
 *
 * Intelligently decomposes complex tasks into dependency-aware, parallelizable subtasks.
 * This version relies entirely on AI for classification, structural analysis, and step generation,
 * removing all regex-based heuristics and keyword signals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.decomposeTaskWithAI = decomposeTaskWithAI;
exports.decomposeTask = decomposeTask;
exports.analyzeTask = analyzeTask;
exports.generatePlanText = generatePlanText;
exports.getAGIHints = getAGIHints;
// ── AI-powered Task Analysis ────────────────────────────────────────────
async function analyzeTaskWithAI(userInput, client) {
    const prompt = `Analyze the following user request and determine its structural requirements for execution.

USER REQUEST: "${userInput.slice(0, 1000)}"

Respond with JSON only:
{
  "complexity": "simple" | "moderate" | "complex",
  "taskType": "coding" | "research" | "build" | "fix" | "analyze" | "automate" | "task" | "conversation",
  "entities": ["list", "of", "key", "subjects"],
  "canParallelize": boolean,
  "suggestedApproach": "sequential" | "parallel" | "hybrid",
  "estimatedSteps": number,
  "requiresExternalData": boolean (web search, URLs, APIs),
  "requiresFileOps": boolean (reading/writing files),
  "requiresCommandExecution": boolean (terminal/shell)
}`;
    let rawContent = '';
    try {
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0,
            maxTokens: 300,
        });
        rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Extract JSON block using regex to handle preambles/postambles
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
        return JSON.parse(jsonStr);
    }
    catch (err) {
        console.warn(`[TaskDecomposer] AI analysis failed. Raw content: "${rawContent.substring(0, 200)}"`, err);
        // Minimal fallback if AI fails
        return {
            complexity: 'moderate',
            taskType: 'task',
            entities: [],
            canParallelize: false,
            suggestedApproach: 'sequential',
            estimatedSteps: 3,
            requiresExternalData: true,
            requiresFileOps: true,
            requiresCommandExecution: true
        };
    }
}
// ── AI-powered Step Generation ──────────────────────────────────────────
async function generateStepsWithAI(userInput, analysis, availableTools, client) {
    const prompt = `Decompose the following task into a list of dependency-aware execution steps.

USER REQUEST: "${userInput.slice(0, 1000)}"
TASK TYPE: ${analysis.taskType}
APPROACH: ${analysis.suggestedApproach}
AVAILABLE TOOLS: ${availableTools.join(', ')}

RULES:
1. Each step must have a clear 'description' and a 'tool' from the available list.
2. Use 'dependsOn' array to list IDs of steps that must complete first.
3. Set 'canParallelize: true' if the step can run simultaneously with others in its level.
4. For research tasks with multiple entities, create parallel 'web_search' or 'navis' steps.
5. For coding, include 'view_file', 'write'/'edit', and 'run_command' for verification.
6. Use 'priority: "critical"' for foundational steps.

Respond with JSON only (an array of steps):
[
  {
    "id": "step_1",
    "description": "...",
    "tool": "...",
    "dependsOn": [],
    "canParallelize": true,
    "estimatedComplexity": "low" | "medium" | "high",
    "priority": "normal" | "critical",
    "parallelGroup": number (optional)
  },
  ...
]`;
    let rawContent = '';
    try {
        const response = await client.chat({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: 'json',
            temperature: 0,
            maxTokens: 1500,
        });
        rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Extract JSON array block using regex
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
        const steps = JSON.parse(jsonStr);
        if (!Array.isArray(steps))
            throw new Error('AI response is not a JSON array');
        return steps;
    }
    catch (err) {
        console.warn(`[TaskDecomposer] AI step generation failed. Raw content: "${rawContent.substring(0, 200)}"`, err);
        // Smarter fallback based on analysis
        const fallbackSteps = [];
        if (analysis.requiresExternalData) {
            fallbackSteps.push({ id: 'step_1', description: 'Search web for relevant information', tool: 'web_search', dependsOn: [], canParallelize: true, estimatedComplexity: 'low', priority: 'critical' });
        }
        fallbackSteps.push({
            id: `step_${fallbackSteps.length + 1}`,
            description: 'Analyze and execute user request',
            tool: analysis.taskType === 'coding' ? 'view_file' : 'internal',
            dependsOn: fallbackSteps.map(s => s.id),
            canParallelize: false,
            estimatedComplexity: 'medium',
            priority: 'normal'
        });
        return fallbackSteps;
    }
}
// ── Public API ────────────────────────────────────────────────────────────
/**
 * AI-powered decomposition. Uses the model to classify, analyze, and build
 * the execution plan. Removes all regex-based heuristics.
 */
async function decomposeTaskWithAI(userInput, availableTools, client) {
    if (!client) {
        throw new Error('TaskDecomposer v4 requires an AI client for decomposition.');
    }
    const analysis = await analyzeTaskWithAI(userInput, client);
    const steps = await generateStepsWithAI(userInput, analysis, availableTools, client);
    const groups = new Set(steps.filter(s => s.parallelGroup !== undefined).map(s => s.parallelGroup));
    // Calculate duration based on a simple heuristic (could also be AI-estimated)
    const estimatedDurationMs = steps.length * 5000;
    return {
        id: `task_${Date.now()}`,
        title: userInput.substring(0, 80) + (userInput.length > 80 ? '...' : ''),
        steps,
        canParallelize: analysis.canParallelize,
        estimatedParallelGroups: groups.size,
        totalSteps: steps.length,
        executionMode: analysis.suggestedApproach,
        estimatedDurationMs,
    };
}
/**
 * Synchronous fallback (DEPRECATED).
 * Now throws error as v4 is fully AI-driven.
 */
function decomposeTask(userInput, availableTools) {
    throw new Error('decomposeTask (sync) is deprecated. Use decomposeTaskWithAI.');
}
function analyzeTask(userInput) {
    throw new Error('analyzeTask (sync) is deprecated. Use analyzeTaskWithAI (async).');
}
// ── Plan Text Generator ───────────────────────────────────────────────────
function generatePlanText(decomposed) {
    const lines = [];
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
    const grouped = new Map();
    for (const step of decomposed.steps) {
        const key = step.parallelGroup !== undefined
            ? step.parallelGroup
            : `seq_${step.id}`;
        if (!grouped.has(key))
            grouped.set(key, []);
        grouped.get(key).push(step);
    }
    for (const [key, group] of grouped) {
        const isParallelGroup = typeof key === 'number';
        if (isParallelGroup && group.length > 1) {
            lines.push(`### ⚡ Parallel Group ${key}`);
            for (const step of group) {
                lines.push(`- **${step.id}** ${step.description} (\`${step.tool || 'internal'}\`)`);
            }
        }
        else {
            for (const step of group) {
                const badge = step.priority === 'critical' ? ' 🔴' : '';
                const deps = (step.dependsOn || []).length > 0
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
function getAGIHints(userInput) {
    return "AI-Optimized Execution Plan active.";
}

/**
 * EverFern Desktop — Parallel Tool Executor
 * 
 * Executes independent tools in parallel for faster AGI-like behavior.
 * Analyzes tool dependencies and runs parallelizable tools simultaneously.
 */

import type { AgentTool, ToolCallRecord, ToolResult } from './types';

export interface ToolDependency {
    toolName: string;
    dependsOn: string[];
}

export interface ParallelExecutionResult {
    results: ToolCallRecord[];
    parallelGroups: number;
    totalTimeMs: number;
}

export interface ToolAnalysis {
    name: string;
    args: Record<string, unknown>;
    id: string;
    readOnly: boolean;
    conflicts: string[];
}

/**
 * Analyzes tool calls to determine which can be executed in parallel.
 */
export function analyzeToolDependencies(
    tools: Array<{ name: string; args: Record<string, unknown>; id: string }>
): ToolAnalysis[] {
    const fileWriteTools = new Set(['write', 'write_file', 'edit', 'delete', 'bash', 'run_command', 'apply_patch']);
    const readOnlyTools = new Set(['read', 'read_file', 'web_search', 'web_fetch', 'memory_search', 'list_directory']);
    
    return tools.map(tool => {
        const isWrite = fileWriteTools.has(tool.name);
        const isGlobalLocking = ['run_command', 'bash', 'apply_patch'].includes(tool.name) && tool.args.safe_for_parallel !== true;
        const isReadOnly = readOnlyTools.has(tool.name) || (!isWrite && !isGlobalLocking);
        
        // Detect potential conflicts (same file path)
        const conflicts: string[] = [];
        const filePaths = extractFilePaths(tool.args);
        
        for (const other of tools) {
            if (other.id === tool.id) continue;

            const otherGlobalLocking = ['run_command', 'bash', 'apply_patch'].includes(other.name) && other.args.safe_for_parallel !== true;
            
            // Globally locking tools conflict with absolutely everything else
            if (isGlobalLocking || otherGlobalLocking) {
                conflicts.push(other.id);
                continue;
            }
            
            const otherPaths = extractFilePaths(other.args);
            const overlapping = filePaths.filter(p => otherPaths.includes(p));
            
            // Writes to same path conflict
            if (isWrite && overlapping.length > 0) {
                conflicts.push(other.id);
            }
        }
        
        return {
            name: tool.name,
            args: tool.args,
            id: tool.id,
            readOnly: isReadOnly,
            conflicts
        };
    });
}

/**
 * Extract file paths from tool arguments.
 */
function extractFilePaths(args: Record<string, unknown>): string[] {
    const paths: string[] = [];
    
    const pathKeys = ['path', 'file_path', 'root', 'dir', 'directory', 'from', 'to', 'src', 'dest'];
    
    for (const [key, value] of Object.entries(args)) {
        if (pathKeys.includes(key.toLowerCase()) && typeof value === 'string') {
            paths.push(value);
        }
    }
    
    return paths;
}

/**
 * Groups tools by execution phase (parallel groups).
 * Returns groups of tools that can run in parallel.
 */
export function groupParallelTools(tools: ToolAnalysis[]): ToolAnalysis[][] {
    if (tools.length === 0) return [];
    
    const remaining = [...tools];
    const groups: ToolAnalysis[][] = [];
    
    while (remaining.length > 0) {
        const currentGroup: ToolAnalysis[] = [];
        const usedIds = new Set<string>();
        
        for (let i = 0; i < remaining.length; i++) {
            const tool = remaining[i];
            
            // Skip if already in a group or has unresolved conflicts
            if (usedIds.has(tool.id)) continue;
            
            // Check if any conflict is still remaining in this group
            const hasConflict = tool.conflicts.some(cid => 
                remaining.some(t => t.id === cid) || usedIds.has(cid)
            );
            
            if (!hasConflict || tool.readOnly) {
                currentGroup.push(tool);
                usedIds.add(tool.id);
            }
        }
        
        if (currentGroup.length === 0) {
            // Deadlock: force-add one tool
            currentGroup.push(remaining.shift()!);
        } else {
            // Remove used tools from remaining
            for (const tool of currentGroup) {
                const idx = remaining.findIndex(t => t.id === tool.id);
                if (idx !== -1) remaining.splice(idx, 1);
            }
        }
        
        groups.push(currentGroup);
    }
    
    return groups;
}

/**
 * Execute a single tool.
 */
async function executeSingleTool(
    tool: AgentTool,
    args: Record<string, unknown>,
    toolCallId: string,
    onUpdate?: (update: string) => void
): Promise<ToolCallRecord> {
    const startMs = Date.now();
    
    try {
        const result = await tool.execute(args, onUpdate);
        return {
            toolName: tool.name,
            args,
            result,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        return {
            toolName: tool.name,
            args,
            result: {
                success: false,
                output: `Error: ${errMsg}`,
                error: errMsg
            },
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Execute tools in parallel groups for maximum throughput.
 */
export async function executeParallelTools(
    toolCalls: Array<{ name: string; args: Record<string, unknown>; id: string }>,
    tools: AgentTool[],
    onToolStart?: (toolName: string, args: Record<string, unknown>) => void,
    onToolComplete?: (record: ToolCallRecord) => void,
    onUpdate?: (update: string) => void
): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const allResults: ToolCallRecord[] = [];
    
    // Analyze dependencies
    const analysis = analyzeToolDependencies(toolCalls);
    
    // Group into parallel execution phases
    const groups = groupParallelTools(analysis);
    
    console.log(`[ParallelExecutor] ${toolCalls.length} tools → ${groups.length} parallel groups`);
    
    // Execute each group
    for (let g = 0; g < groups.length; g++) {
        const group = groups[g];
        console.log(`[ParallelExecutor] Group ${g + 1}/${groups.length}: ${group.map(t => t.name).join(', ')}`);
        
        // Start all tools in this group
        const promises = group.map(async (tool) => {
            const toolDef = tools.find(t => t.name === tool.name);
            if (!toolDef) {
                return {
                    toolName: tool.name,
                    args: tool.args,
                    result: { success: false, output: `Tool not found: ${tool.name}`, error: 'not_found' },
                    timestamp: new Date().toISOString(),
                    durationMs: 0
                } as ToolCallRecord;
            }
            
            onToolStart?.(tool.name, tool.args);
            
            const record = await executeSingleTool(toolDef, tool.args, tool.id, onUpdate);
            onToolComplete?.(record);
            
            return record;
        });
        
        // Wait for all tools in this group to complete
        const groupResults = await Promise.all(promises);
        allResults.push(...groupResults);
        
        const hasFatalError = groupResults.some(r => !r.result.success && r.result.error);
        if (hasFatalError) {
             console.log(`[ParallelExecutor] ⛔ Group failed fast. Aborting subsequent parallel execution groups.`);
             break;
        }
    }
    
    return {
        results: allResults,
        parallelGroups: groups.length,
        totalTimeMs: Date.now() - startTime
    };
}

/**
 * Quick check if any tool writes to a specific path.
 */
export function wouldWriteToPath(toolName: string): boolean {
    const writeTools = new Set(['write', 'write_file', 'edit', 'delete', 'bash', 'run_command', 'apply_patch', 'system_files']);
    return writeTools.has(toolName);
}

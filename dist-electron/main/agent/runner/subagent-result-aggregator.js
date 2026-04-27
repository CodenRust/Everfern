"use strict";
/**
 * EverFern Desktop — Subagent Result Aggregator
 *
 * Aggregates results from multiple spawned subagents with comprehensive
 * error handling, timeout management, and research summary generation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubagentResultAggregator = getSubagentResultAggregator;
const subagent_registry_1 = require("./subagent-registry");
const agent_events_1 = require("../infra/agent-events");
class SubagentResultAggregator {
    registry = (0, subagent_registry_1.getSubagentRegistry)();
    defaultTimeout = 60000; // 60 seconds
    maxRetries = 2;
    /**
     * Aggregate results from multiple subagents with comprehensive error handling
     */
    async aggregateResults(parentSessionId, subagentIds, options = {}) {
        const startTime = new Date().toISOString();
        const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
        const errors = [];
        const results = [];
        let completedCount = 0;
        let failedCount = 0;
        let timedOutCount = 0;
        try {
            // Wait for all subagents to complete with timeout
            const completedChildren = await this.waitForSubagentsWithTimeout(parentSessionId, subagentIds, timeoutMs, errors);
            // Process each completed subagent
            for (const child of completedChildren) {
                const resultEntry = {
                    subagentId: child.agentId,
                    status: child.status,
                    duration: (child.completedAt || Date.now()) - child.createdAt,
                };
                if (child.status === 'completed' && child.result) {
                    resultEntry.result = child.result;
                    resultEntry.resultLength = child.result.length;
                    completedCount++;
                }
                else if (child.status === 'failed' && child.error) {
                    resultEntry.error = child.error;
                    resultEntry.status = 'failed';
                    failedCount++;
                    if (options.includeErrors) {
                        errors.push({
                            type: 'execution_failure',
                            subagentId: child.agentId,
                            message: child.error,
                            timestamp: new Date().toISOString(),
                            recoverable: false,
                        });
                    }
                }
                else if (child.status === 'aborted') {
                    resultEntry.status = 'timeout';
                    timedOutCount++;
                    errors.push({
                        type: 'timeout',
                        subagentId: child.agentId,
                        message: `Subagent ${child.agentId} timed out after ${timeoutMs}ms`,
                        timestamp: new Date().toISOString(),
                        recoverable: true,
                    });
                }
                results.push(resultEntry);
            }
            // Generate comprehensive summary
            const summary = this.generateComprehensiveSummary(results, options.deduplicateResults ?? true, options.sortByRelevance ?? false);
            const endTime = new Date().toISOString();
            const totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime();
            const aggregationResult = {
                success: failedCount === 0 && timedOutCount === 0,
                totalSubagents: subagentIds.length,
                completedSubagents: completedCount,
                failedSubagents: failedCount,
                timedOutSubagents: timedOutCount,
                summary,
                results,
                errors,
                metadata: {
                    startTime,
                    endTime,
                    totalDuration,
                    aggregationMethod: 'parallel',
                },
            };
            // Emit aggregation complete event
            (0, agent_events_1.emitTool)(parentSessionId, 'subagent_aggregation_complete', {
                totalSubagents: subagentIds.length,
                completedSubagents: completedCount,
                failedSubagents: failedCount,
                timedOutSubagents: timedOutCount,
                duration: totalDuration,
            });
            return aggregationResult;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            errors.push({
                type: 'aggregation_failure',
                message: `Failed to aggregate subagent results: ${errorMsg}`,
                timestamp: new Date().toISOString(),
                recoverable: false,
            });
            (0, agent_events_1.emitTool)(parentSessionId, 'subagent_aggregation_failed', {
                error: errorMsg,
                completedSubagents: completedCount,
                failedSubagents: failedCount,
            });
            const endTime = new Date().toISOString();
            const totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime();
            return {
                success: false,
                totalSubagents: subagentIds.length,
                completedSubagents: completedCount,
                failedSubagents: failedCount,
                timedOutSubagents: timedOutCount,
                summary: `Aggregation failed: ${errorMsg}`,
                results,
                errors,
                metadata: {
                    startTime,
                    endTime,
                    totalDuration,
                    aggregationMethod: 'parallel',
                },
            };
        }
    }
    /**
     * Wait for subagents to complete with timeout management
     */
    async waitForSubagentsWithTimeout(parentSessionId, subagentIds, timeoutMs, errors) {
        const startTime = Date.now();
        const pollInterval = 100; // Poll every 100ms
        const completedSubagents = new Map();
        while (Date.now() - startTime < timeoutMs) {
            // Get all children of the parent
            const children = this.registry.getChildren(parentSessionId);
            // Check which subagents have completed
            for (const child of children) {
                if (subagentIds.includes(child.agentId) && !completedSubagents.has(child.agentId)) {
                    if (child.status === 'completed' || child.status === 'failed' || child.status === 'aborted') {
                        completedSubagents.set(child.agentId, child);
                    }
                }
            }
            // If all subagents have completed, return early
            if (completedSubagents.size === subagentIds.length) {
                return Array.from(completedSubagents.values());
            }
            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        // Timeout reached - collect whatever we have and mark remaining as timed out
        const timedOutSubagents = subagentIds.filter(id => !completedSubagents.has(id));
        for (const timedOutId of timedOutSubagents) {
            const entry = this.registry.get(timedOutId);
            if (entry) {
                // Mark as aborted due to timeout
                this.registry.abort(timedOutId);
                completedSubagents.set(timedOutId, {
                    ...entry,
                    status: 'aborted',
                    completedAt: Date.now(),
                });
                errors.push({
                    type: 'timeout',
                    subagentId: timedOutId,
                    message: `Subagent ${timedOutId} timed out after ${timeoutMs}ms`,
                    timestamp: new Date().toISOString(),
                    recoverable: true,
                });
            }
        }
        return Array.from(completedSubagents.values());
    }
    /**
     * Generate comprehensive research summary from aggregated results
     */
    generateComprehensiveSummary(results, deduplicate = true, sortByRelevance = false) {
        const completedResults = results.filter(r => r.status === 'completed' && r.result);
        const failedResults = results.filter(r => r.status === 'failed');
        const timedOutResults = results.filter(r => r.status === 'timeout');
        if (completedResults.length === 0) {
            let summary = '## Research Summary\n\n';
            summary += 'No successful research results were obtained from subagents.\n\n';
            if (failedResults.length > 0) {
                summary += `### Failed Subagents (${failedResults.length})\n`;
                for (const result of failedResults) {
                    summary += `- **${result.subagentId}**: ${result.error || 'Unknown error'}\n`;
                }
                summary += '\n';
            }
            if (timedOutResults.length > 0) {
                summary += `### Timed Out Subagents (${timedOutResults.length})\n`;
                for (const result of timedOutResults) {
                    summary += `- **${result.subagentId}**: Execution exceeded timeout limit\n`;
                }
                summary += '\n';
            }
            return summary;
        }
        // Deduplicate results if requested
        let uniqueResults = completedResults;
        if (deduplicate) {
            uniqueResults = this.deduplicateResults(completedResults);
        }
        // Build comprehensive summary
        let summary = '## Comprehensive Research Summary\n\n';
        summary += `Based on parallel research conducted by ${completedResults.length} subagent(s):\n\n`;
        // Add completed results
        for (let i = 0; i < uniqueResults.length; i++) {
            const result = uniqueResults[i];
            summary += `### Research Result ${i + 1}\n`;
            summary += `**Source**: ${result.subagentId}\n`;
            summary += `**Duration**: ${(result.duration / 1000).toFixed(2)}s\n`;
            summary += `**Content Length**: ${result.resultLength || 0} characters\n\n`;
            summary += `${result.result}\n\n`;
        }
        // Add error summary if there were failures
        if (failedResults.length > 0 || timedOutResults.length > 0) {
            summary += '---\n\n';
            summary += '### Execution Summary\n';
            summary += `- **Successful**: ${completedResults.length}/${results.length}\n`;
            if (failedResults.length > 0) {
                summary += `- **Failed**: ${failedResults.length}\n`;
                for (const result of failedResults) {
                    summary += `  - ${result.subagentId}: ${result.error || 'Unknown error'}\n`;
                }
            }
            if (timedOutResults.length > 0) {
                summary += `- **Timed Out**: ${timedOutResults.length}\n`;
                for (const result of timedOutResults) {
                    summary += `  - ${result.subagentId}: Exceeded timeout limit\n`;
                }
            }
        }
        return summary;
    }
    /**
     * Deduplicate results by removing similar content
     */
    deduplicateResults(results) {
        if (results.length <= 1) {
            return results;
        }
        const deduplicated = [];
        const seenContent = new Set();
        for (const result of results) {
            if (!result.result)
                continue;
            // Create a simple hash of the first 200 characters
            const contentHash = result.result.substring(0, 200).toLowerCase();
            // Check if we've seen similar content
            let isDuplicate = false;
            for (const seen of seenContent) {
                if (this.calculateSimilarity(contentHash, seen) > 0.8) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) {
                seenContent.add(contentHash);
                deduplicated.push(result);
            }
        }
        return deduplicated;
    }
    /**
     * Calculate similarity between two strings (simple Levenshtein-based approach)
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) {
            return 1.0;
        }
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    /**
     * Calculate Levenshtein distance between two strings
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    /**
     * Handle partial failures gracefully
     */
    async handlePartialFailure(parentSessionId, aggregationResult, fallbackTask) {
        const successRate = aggregationResult.completedSubagents / aggregationResult.totalSubagents;
        if (successRate >= 0.5) {
            // More than 50% success - use aggregated results
            return aggregationResult.summary;
        }
        else if (fallbackTask) {
            // Less than 50% success - suggest fallback
            return `
## Research Partial Failure

The parallel research encountered issues:
- Completed: ${aggregationResult.completedSubagents}/${aggregationResult.totalSubagents}
- Failed: ${aggregationResult.failedSubagents}
- Timed Out: ${aggregationResult.timedOutSubagents}

### Available Results
${aggregationResult.summary}

### Recommendation
Consider using single-agent research mode or adjusting the research parameters.
`;
        }
        else {
            return aggregationResult.summary;
        }
    }
}
// Singleton
let aggregatorInstance = null;
function getSubagentResultAggregator() {
    if (!aggregatorInstance) {
        aggregatorInstance = new SubagentResultAggregator();
    }
    return aggregatorInstance;
}

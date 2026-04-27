# Web Explorer Enhancement - Subagent Spawning Implementation

## Overview

This document describes the enhanced Web Explorer implementation that enables proper subagent spawning for parallel web research tasks. The enhancement addresses the issue where the Web Explorer opens but doesn't spawn subagents properly, enabling comprehensive research through parallel processing.

## Architecture

### Components

#### 1. WebExplorerConfig Interface
Configuration object for Web Explorer subagent spawning:
- `enableSubagentSpawning`: Enable/disable subagent spawning (default: true)
- `maxConcurrentSubagents`: Maximum number of concurrent subagents (default: 3)
- `subagentTimeout`: Timeout for subagent completion in milliseconds (default: 60000)
- `enableVisualGrounding`: Enable visual grounding fallback (default: true)

#### 2. WebExplorerSubagent Interface
Represents a spawned subagent for web research:
- `id`: Unique identifier for the subagent
- `type`: Type of subagent ('browser-use', 'computer-use', 'research')
- `task`: The research task assigned to the subagent
- `status`: Current status ('pending', 'running', 'completed', 'failed')
- `progressEvents`: Array of progress events from the subagent
- `result`: Final result from the subagent (optional)
- `error`: Error message if subagent failed (optional)

#### 3. SubAgentProgressEvent Interface
Represents a progress event from a subagent:
- `type`: Event type ('step', 'reasoning', 'action', 'screenshot', 'complete', 'abort')
- `toolCallId`: ID of the tool call that generated this event
- `timestamp`: ISO timestamp of the event
- `stepNumber`: Current step number (optional)
- `totalSteps`: Total number of steps (optional)
- `content`: Event content/message (optional)
- `action`: Action details including name and arguments (optional)
- `screenshot`: Base64-encoded screenshot data (optional)
- `metadata`: Additional metadata (optional)

#### 4. EnhancedWebExplorer Class
Main class implementing subagent spawning and management:

**Key Methods:**
- `spawnBrowserSubagent()`: Spawn a single browser subagent for a research task
- `spawnMultipleSubagents()`: Spawn multiple subagents in parallel (up to maxConcurrentSubagents)
- `aggregateSubagentResults()`: Wait for subagents to complete and aggregate results
- `emitTimelineBranch()`: Emit timeline branch events for UI visualization
- `getSubagents()`: Get all spawned subagents
- `clearSubagents()`: Clear all subagents (for cleanup)

## Implementation Details

### Context Inheritance

The Web Explorer properly inherits context from the parent agent:

1. **Parent Session ID**: Passed to SubagentSpawner to establish parent-child relationship
2. **Parent History**: Capped to 40 messages (20 turns) to prevent context window overflow
3. **Model Configuration**: Subagents use the same model as the parent agent
4. **Tool Access**: Subagents have access to the same tools as the parent

### Session Isolation

Each spawned subagent maintains proper session isolation:

1. **Unique Session Keys**: Each subagent gets a unique session key (`agent:agentId:randomUUID`)
2. **Separate Registries**: Subagents are tracked in the SubagentRegistry with parent-child relationships
3. **Independent Execution**: Each subagent runs independently with its own execution context
4. **Lifecycle Tracking**: Subagent lifecycle events are emitted for timeline visualization

### Workflow Phases

The Web Explorer operates in distinct phases:

1. **Search Phase**: Initial web search to find relevant URLs
2. **Browse Phase**:
   - If multiple search results exist: Spawn subagents for parallel research
   - If single result or spawning fails: Fall back to single-agent browser_use
3. **Synthesize Phase**: Aggregate results and generate comprehensive summary
4. **Complete Phase**: Mark research as complete

### Error Handling and Recovery

The implementation includes robust error handling:

1. **Subagent Spawn Failures**: Falls back to single-agent browser_use execution
2. **Aggregation Failures**: Logs error and falls back to direct browsing
3. **Timeout Management**: Respects configured timeout for subagent completion
4. **Graceful Degradation**: Always provides a fallback path to single-agent execution

### Timeline Integration

Progress events are emitted for timeline visualization:

1. **Subagent Spawned**: Emitted when a subagent is successfully spawned
2. **Subagent Progress**: Emitted for each progress event from the subagent
3. **Subagent Failed**: Emitted if a subagent fails to spawn
4. **Aggregation Complete**: Emitted when all subagents complete and results are aggregated

## Usage Example

```typescript
// Create Web Explorer with custom config
const webExplorer = new EnhancedWebExplorer({
  enableSubagentSpawning: true,
  maxConcurrentSubagents: 3,
  subagentTimeout: 60000,
});

// Spawn multiple subagents for parallel research
const searchResults = [
  { title: 'Result 1', url: 'https://example.com/1', snippet: 'First result' },
  { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result' },
  { title: 'Result 3', url: 'https://example.com/3', snippet: 'Third result' },
];

const subagents = await webExplorer.spawnMultipleSubagents(
  parentSessionId,
  searchResults.map(r => `Research: ${r.title}`),
  searchResults,
  runner
);

// Wait for completion and aggregate results
const aggregatedResults = await webExplorer.aggregateSubagentResults(
  parentSessionId,
  subagents
);

console.log('Research complete:', aggregatedResults);
```

## Requirements Mapping

### Requirement 4.1: Proper Subagent Spawning
✅ Implemented via `spawnBrowserSubagent()` and `spawnMultipleSubagents()` methods using SubagentSpawner

### Requirement 4.2: Session Isolation and Context Inheritance
✅ Implemented through:
- Unique session keys for each subagent
- Parent session ID tracking in SubagentRegistry
- Capped parent history (40 messages max) to prevent context overflow
- Proper context passing to subagents

### Requirement 4.3: Context Passing and Search Results
✅ Implemented via:
- Search results passed to subagents as task context
- Parent conversation history included in subagent initialization
- Task descriptions include URL and title information

### Requirement 4.4: Result Aggregation
✅ Implemented via `aggregateSubagentResults()` method that:
- Waits for all subagents to complete
- Collects results from SubagentRegistry
- Generates comprehensive research summary

### Requirement 4.5: Error Handling and Timeout Management
✅ Implemented via:
- Try-catch blocks around spawn and aggregation operations
- Configurable timeout for subagent completion
- Fallback to single-agent execution on failure
- Proper error logging and event emission

### Requirement 4.6: Fallback to Single-Agent Execution
✅ Implemented via:
- Graceful fallback when subagent spawning fails
- Fallback when aggregation fails
- Always provides browser_use as fallback mechanism

## Testing

Comprehensive unit tests are provided in `__tests__/web-explorer-subagent.test.ts`:

- Configuration initialization
- Subagent management and tracking
- Timeline event emission
- Research summary generation
- Status tracking and transitions
- Subagent type support
- Progress event types
- Session isolation

All tests pass successfully (21/21).

## Performance Considerations

1. **Concurrent Subagents**: Limited to 3 by default to prevent resource exhaustion
2. **Context Window**: Parent history capped at 40 messages to prevent overflow
3. **Timeout Management**: Configurable timeout prevents indefinite waiting
4. **Graceful Degradation**: Falls back to single-agent if parallel execution fails

## Future Enhancements

1. **Adaptive Subagent Count**: Dynamically adjust based on available resources
2. **Result Caching**: Cache successful research results for similar queries
3. **Learning System**: Track successful subagent configurations for optimization
4. **Advanced Aggregation**: Implement ML-based result deduplication and ranking
5. **Visual Grounding Integration**: Use visual grounding for enhanced element detection

## Debugging

Enable debug logging by setting environment variable:
```bash
DEBUG=web-explorer:* npm start
```

Key log messages:
- `[WebExplorer] Spawned browser subagent`: Subagent successfully spawned
- `[WebExplorer] Failed to spawn subagent`: Subagent spawn failed
- `[WebExplorer] Subagent aggregation complete`: Results aggregated successfully
- `[WebExplorer] Subagent aggregation failed`: Aggregation failed, falling back

## References

- SubagentSpawner: `main/agent/runner/subagent-spawn.ts`
- SubagentRegistry: `main/agent/runner/subagent-registry.ts`
- Agent Events: `main/agent/infra/agent-events.ts`
- Design Document: `.kiro/specs/enhanced-web-automation-system/design.md`
- Requirements: `.kiro/specs/enhanced-web-automation-system/requirements.md`

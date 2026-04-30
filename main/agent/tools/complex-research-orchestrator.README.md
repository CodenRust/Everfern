# Complex Research Orchestrator

## Overview

The `ComplexResearchOrchestrator` is a high-level component that plans and executes multi-step research with parallel source investigation and intelligent synthesis. It coordinates the entire research workflow from planning to answer generation.

## Features

### 1. Research Planning (Requirement 3.1)
- Plans research upfront before opening browser
- Extracts research goals from user queries
- Identifies target authoritative sites (max 10)
- Generates focused search queries (max 5)
- Specifies required information to find (max 10)
- Determines optimal parallelization (1-5 tasks)

### 2. Parallel Execution (Requirement 3.2)
- Executes research with 2-5 parallel browser tabs
- Distributes research tasks across tabs
- Coordinates tab execution
- Manages shared knowledge via SharedResearchMemory

### 3. Cross-Tab Knowledge Sharing (Requirement 3.3)
- Facts extracted in one tab are visible to all tabs
- Visited URLs are tracked globally
- URL queue is shared across tabs
- Prevents redundant work

### 4. Early Termination (Requirement 3.4)
- Monitors research progress continuously
- Terminates when goals are satisfied (70% threshold)
- Closes remaining tabs to save resources
- Checks completeness after each fact extraction

### 5. Real-Time Synthesis (Requirement 3.5)
- Synthesizes findings as facts arrive
- Updates answer incrementally
- Combines information from multiple sources
- Prioritizes high-confidence sources

### 6. Answer Generation with Citations (Requirement 3.6)
- Generates coherent answers from facts
- Includes inline source citations [1], [2], etc.
- Formats for readability
- Keeps answers concise (200-600 characters)

### 7. Error Handling (Requirement 3.7)
- Returns error message when no facts extracted
- Explains failure reason
- Suggests alternative queries
- Provides graceful degradation

## Usage

```typescript
import { createComplexResearchOrchestrator } from './complex-research-orchestrator';
import { AIClient } from '../../lib/ai-client';

// Create AI client
const aiClient = new AIClient({
  provider: 'anthropic',
  apiKey: 'your-api-key',
  model: 'claude-3-5-sonnet-20241022'
});

// Create orchestrator
const orchestrator = createComplexResearchOrchestrator(aiClient);

// Plan research
const plan = await orchestrator.planResearch(
  "Find the best project management tools with pricing"
);

console.log('Research Plan:', plan);
// {
//   goal: "Find the best project management tools with pricing",
//   targetSites: ["asana.com", "monday.com", "trello.com"],
//   searchQueries: ["project management tools pricing", "best PM software"],
//   mustFind: ["pricing", "features", "reviews"],
//   avoidPatterns: ["login", "signup", "cookie"],
//   parallelTasks: 3,
//   maxStepsPerTask: 15,
//   createdAt: 1234567890
// }

// Execute research (requires browser integration - Task 13.3)
const result = await orchestrator.executeParallel(plan);

console.log('Research Result:', result);
// {
//   answer: "The best project management tools include Asana [1], Monday.com [2], and Trello [3]...",
//   sources: [
//     { url: "https://asana.com/pricing", title: "Asana Pricing", qualityScore: 85, ... },
//     { url: "https://monday.com/pricing", title: "Monday Pricing", qualityScore: 90, ... }
//   ],
//   confidence: 0.87,
//   completeness: 0.95,
//   processingTime: 12500
// }

// Synthesize findings manually
const facts = [
  {
    url: "https://asana.com",
    title: "Asana",
    summary: "Asana is a project management tool with pricing starting at $10.99/user/month",
    prices: ["$10.99/user/month"],
    ratings: ["4.5/5"],
    keyFacts: ["Task management", "Team collaboration", "Timeline view"],
    timestamp: Date.now(),
    confidence: 0.9,
    source: 'ai' as const
  }
];

const answer = await orchestrator.synthesizeFindings(facts);
console.log('Synthesized Answer:', answer);

// Check completeness
const memory = createSharedMemory(); // Your SharedResearchMemory instance
const goals = ["pricing", "features", "reviews"];
const isComplete = orchestrator.determineCompleteness(memory, goals);
console.log('Research Complete:', isComplete);
```

## API Reference

### `planResearch(query: string): Promise<ResearchPlan>`

Plans research upfront before opening browser.

**Parameters:**
- `query`: User's research query

**Returns:**
- `ResearchPlan`: Structured research plan with goals, target sites, queries, etc.

**Validates:** Requirements 3.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6

**Performance:** < 2 seconds (target)

### `executeParallel(plan: ResearchPlan, sharedMemory?: SharedResearchMemory): Promise<ResearchResult>`

Executes research in parallel across multiple tabs.

**Parameters:**
- `plan`: Research plan from `planResearch()`
- `sharedMemory`: Optional shared memory instance (created if not provided)

**Returns:**
- `ResearchResult`: Answer with sources, confidence, completeness, and processing time

**Validates:** Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

**Performance:** < 30 seconds for 3-5 sources (target)

**Note:** Full browser integration will be completed in Task 13.3

### `synthesizeFindings(facts: ExtractedFact[]): Promise<string>`

Synthesizes findings from multiple sources into a coherent answer.

**Parameters:**
- `facts`: Array of extracted facts from research

**Returns:**
- `string`: Synthesized answer with inline citations

**Validates:** Requirements 3.5, 3.6

**Performance:** < 3 seconds for up to 10 sources (target)

### `determineCompleteness(memory: SharedResearchMemory, goals: string[]): boolean`

Determines if research goals are satisfied and can terminate early.

**Parameters:**
- `memory`: Shared research memory with current facts
- `goals`: Array of research goals to satisfy

**Returns:**
- `boolean`: True if research is complete (70% of goals satisfied)

**Validates:** Requirements 3.4

## Integration Points

### Browser Integration (Task 13.3)
The `executeParallel` method will be fully integrated with browser automation:
- Launch parallel browser tabs using Playwright
- Coordinate tab execution with FastPageAnalyzer
- Use SmartNavigationEngine for reliable navigation
- Share knowledge via SharedResearchMemory

### Fast Page Analyzer (Task 2)
- Analyzes pages instantly (< 200ms)
- Scores page quality (0-100)
- Extracts structured data
- Identifies relevant sections

### Smart Navigation Engine (Task 7)
- Reliable element clicking with retry logic
- Multi-strategy element selection
- Dynamic content handling
- Timeout enforcement

### Shimmer Progress Component (Task 4)
- Real-time progress updates
- Smooth state transitions
- Fact counter display
- Confidence indicator

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Research Planning | < 2s | ✓ |
| Synthesis (10 sources) | < 3s | ✓ |
| Overall Research | < 30s | Pending browser integration |

## Error Handling

### No Sources Found
```typescript
{
  answer: "No useful sources found. Please provide target sites or search queries.",
  sources: [],
  confidence: 0,
  completeness: 0,
  processingTime: 1234
}
```

### AI Failure Fallback
- Falls back to simple concatenation with citations
- Uses top 5 facts by confidence
- Maintains functionality even without AI

### Planning Failure Fallback
- Creates basic plan with user query
- Uses default parallelization (2 tasks)
- Sets reasonable step limits (15 steps)

## Testing

### Unit Tests (Task 5.9)
- Test research planning
- Test parallel tab orchestration
- Test early termination
- Test synthesis
- Test error handling

### Property Tests (Task 5.8)
- Property 14: Research Plan Creation Ordering
- Property 15: Parallel Tab Bounds
- Property 16: Cross-Tab Knowledge Sharing
- Property 17: Early Termination on Goal Satisfaction
- Property 18: Real-Time Synthesis
- Property 19: Answer with Citations
- Property 28: Research Plan Completeness
- Property 29: Research Plan Bounds

## Future Enhancements

1. **Adaptive Parallelization**: Dynamically adjust number of tabs based on query complexity
2. **Source Quality Prediction**: Predict source quality before visiting
3. **Incremental Answer Updates**: Stream answer updates as facts arrive
4. **Multi-Language Support**: Support research in multiple languages
5. **Citation Formatting**: Support different citation styles (APA, MLA, etc.)

## Related Components

- `FastPageAnalyzer`: Page analysis and quality scoring
- `SmartNavigationEngine`: Reliable element interaction
- `SharedResearchMemory`: Cross-tab knowledge sharing
- `ShimmerProgressComponent`: Real-time progress feedback
- `SpeedOptimizationLayer`: Caching and parallel execution

## License

Part of the Enhanced Browser Research System

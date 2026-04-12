# Tool Calling Animation Component Usage

## Overview
The new `ToolCallingAnimation` component provides a beautiful, collapsible interface for displaying tool execution progress, inspired by modern AI interfaces but with your unique style.

## Features
- ✨ Smooth expand/collapse animation
- 🔍 Animated search queries with status indicators
- 📄 Result cards with icons and hover effects
- 🎨 Dark mode support
- ⚡ Framer Motion animations
- 🎯 Fully customizable

## Import

```typescript
import { ToolCallingAnimation } from '@/components/ui/animated-loading-svg-text-shimmer';
```

## Basic Usage

```typescript
<ToolCallingAnimation
  title="Gathering information about procrastination"
  queries={[
    { id: '1', text: 'research about procrastination', status: 'complete' },
    { id: '2', text: 'causes of procrastination psychology', status: 'searching' },
    { id: '3', text: 'effects of procrastination on students work', status: 'searching' }
  ]}
  results={[
    {
      id: 'r1',
      title: 'Why Wait? The Science Behind Procrastination',
      source: 'Association for Psychological Science - APS',
      icon: 'web'
    },
    {
      id: 'r2',
      title: 'Understanding the Psychology of Procrastination',
      source: 'L&T EduTech | Building value for Learner, Academia and Industry',
      icon: 'file'
    },
    {
      id: 'r3',
      title: 'Homework Procrastination: Why Do Students...',
      source: 'Oxford Learning',
      icon: 'web'
    }
  ]}
/>
```

## Props

### ToolCallingAnimationProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"Gathering information"` | Header title text |
| `queries` | `ToolQuery[]` | `[]` | Array of search queries to display |
| `results` | `ToolResult[]` | `[]` | Array of results to display |
| `isExpanded` | `boolean` | `true` | Controlled expansion state |
| `onToggle` | `() => void` | `undefined` | Callback when toggle is clicked |
| `className` | `string` | `undefined` | Additional CSS classes |

### ToolQuery

```typescript
interface ToolQuery {
  id: string;
  text: string;
  status: 'searching' | 'complete';
}
```

### ToolResult

```typescript
interface ToolResult {
  id: string;
  title: string;
  source: string;
  icon: 'web' | 'file' | 'search';
}
```

## Integration Example in Chat Page

```typescript
// In your ToolTimeline or similar component
import { ToolCallingAnimation } from '@/components/ui/animated-loading-svg-text-shimmer';

// Example: Web search tool
{tc.toolName === 'web_search' && tc.status === 'running' && (
  <ToolCallingAnimation
    title="Searching the web"
    queries={[
      { 
        id: '1', 
        text: tc.args?.query as string || 'Searching...', 
        status: 'searching' 
      }
    ]}
  />
)}

// Example: Multiple tool calls
{isLive && liveToolCalls.some(tc => tc.toolName === 'web_search') && (
  <ToolCallingAnimation
    title="Gathering information"
    queries={liveToolCalls
      .filter(tc => tc.toolName === 'web_search')
      .map((tc, i) => ({
        id: tc.id,
        text: tc.args?.query as string || 'Searching...',
        status: tc.status === 'done' ? 'complete' : 'searching'
      }))
    }
    results={liveToolCalls
      .filter(tc => tc.toolName === 'web_search' && tc.status === 'done')
      .map((tc, i) => ({
        id: `result-${i}`,
        title: `Result ${i + 1}`,
        source: 'Web',
        icon: 'web' as const
      }))
    }
  />
)}
```

## Styling

The component uses your existing color scheme:
- **Primary colors**: Zinc/neutral tones
- **Accent colors**: 
  - Blue for web results
  - Purple for file results
  - Emerald for search and success states
- **Dark mode**: Fully supported with automatic color switching

## Animation Details

- **Expand/collapse**: 200ms smooth height animation
- **Query items**: Staggered fade-in with 100ms delay between items
- **Result cards**: Staggered slide-up with 100ms delay between items
- **Hover effects**: Smooth background color transitions
- **Chevron rotation**: 200ms rotation on toggle

## Customization

You can customize the appearance by:

1. **Passing custom className**:
```typescript
<ToolCallingAnimation 
  className="shadow-lg border-2" 
/>
```

2. **Controlled state**:
```typescript
const [expanded, setExpanded] = useState(false);

<ToolCallingAnimation
  isExpanded={expanded}
  onToggle={() => setExpanded(!expanded)}
/>
```

3. **Custom icons**: Modify the `getIcon` function in the component to add more icon types

## Best Practices

1. **Keep queries concise**: Limit query text to 50-60 characters for best display
2. **Limit results**: Show 3-5 results for optimal UX, use "+X more" indicator
3. **Status updates**: Update query status from 'searching' to 'complete' when done
4. **Unique IDs**: Always provide unique IDs for queries and results for proper animations
5. **Loading states**: Show the component immediately when tool starts executing

## Example: Complete Integration

```typescript
const ToolCallDisplay = ({ toolCall }: { toolCall: ToolCallDisplay }) => {
  if (toolCall.toolName === 'web_search') {
    return (
      <ToolCallingAnimation
        title={`Searching: ${toolCall.args?.query || 'Web'}`}
        queries={[
          {
            id: toolCall.id,
            text: toolCall.args?.query as string || 'Searching...',
            status: toolCall.status === 'done' ? 'complete' : 'searching'
          }
        ]}
        results={toolCall.status === 'done' && toolCall.output ? [
          {
            id: `${toolCall.id}-result`,
            title: 'Search completed',
            source: 'Web Search',
            icon: 'web'
          }
        ] : []}
      />
    );
  }
  
  // ... other tool types
};
```

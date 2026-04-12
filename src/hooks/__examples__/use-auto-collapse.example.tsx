/**
 * Example usage of useAutoCollapse hook
 * 
 * This file demonstrates how to use the useAutoCollapse hook in components
 * like ReasoningBranch and MissionTimeline.
 */

import { useAutoCollapse } from '../use-auto-collapse';

// Example 1: Basic usage in ReasoningBranch component
export function ReasoningBranchExample({ thought, isLive, duration }: {
  thought?: string;
  isLive?: boolean;
  duration?: number;
}) {
  const [expanded, setExpanded] = useAutoCollapse(
    isLive ?? false,
    true, // autoCollapseEnabled
    duration
  );

  if (!thought?.trim()) return null;

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}>
        {isLive ? 'Thinking…' : `Thought for ${duration}ms`}
      </button>
      {expanded && <div>{thought}</div>}
    </div>
  );
}

// Example 2: Usage in MissionTimeline component
export function MissionTimelineExample({ timeline, isRunning }: {
  timeline: any;
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useAutoCollapse(
    isRunning,
    true, // autoCollapseEnabled
  );

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}>
        Timeline {isRunning ? '(Running)' : '(Complete)'}
      </button>
      {expanded && <div>{/* Timeline steps */}</div>}
    </div>
  );
}

// Example 3: With auto-collapse disabled
export function ManualControlExample({ isLive }: { isLive: boolean }) {
  const [expanded, setExpanded] = useAutoCollapse(
    isLive,
    false, // autoCollapseEnabled - manual control only
  );

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)}>
        Toggle (Manual Control)
      </button>
      {expanded && <div>Content</div>}
    </div>
  );
}

// Example 4: Behavior demonstration
export function BehaviorDemo() {
  /**
   * Behavior:
   * 
   * 1. Initial state: expanded = false (collapsed by default)
   * 
   * 2. User can manually toggle: setExpanded(true) or setExpanded(false)
   * 
   * 3. When isLive transitions from true to false AND autoCollapseEnabled is true:
   *    - The hook automatically sets expanded = false
   *    - This happens when agent completes thinking or mission finishes
   * 
   * 4. When autoCollapseEnabled is false:
   *    - No automatic collapsing occurs
   *    - Only manual toggling via setExpanded works
   * 
   * 5. The hook tracks previous isLive state to detect transitions:
   *    - prevIsLive.current = true, isLive = false → Trigger auto-collapse
   *    - prevIsLive.current = false, isLive = false → No action
   *    - prevIsLive.current = true, isLive = true → No action
   */
  return null;
}

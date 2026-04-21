/**
 * Frontend type definitions for sub-agent progress streaming
 *
 * These types mirror the backend types defined in main/agent/tools/computer-use.ts
 * to ensure type safety across the IPC boundary.
 */

/**
 * Sub-agent progress event types
 */
export type SubAgentProgressEventType =
  | 'step'       // New step started
  | 'reasoning'  // Agent reasoning/thinking
  | 'action'     // Action execution
  | 'screenshot' // Screenshot captured
  | 'complete'   // Sub-agent completed
  | 'abort';     // Sub-agent aborted

/**
 * Sub-agent progress event
 */
export interface SubAgentProgressEvent {
  /** Event type */
  type: SubAgentProgressEventType;

  /** Tool call ID (unique identifier for this sub-agent execution) */
  toolCallId: string;

  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Current step number (1-indexed) */
  stepNumber?: number;

  /** Total steps (max turns) */
  totalSteps?: number;

  /** Event content/payload */
  content?: string;

  /** Action details (for action events) */
  action?: {
    type: string;           // e.g., "left_click", "type", "scroll"
    params: Record<string, unknown>;
    description: string;    // Human-readable description
  };

  /** Screenshot data (for screenshot events) */
  screenshot?: {
    base64: string;         // Base64-encoded image
    width: number;
    height: number;
  };

  /** Metadata */
  metadata?: {
    model?: string;
    provider?: string;
    [key: string]: unknown;
  };
}

/**
 * Buffered progress event batch
 */
export interface SubAgentProgressBatch {
  toolCallId: string;
  events: SubAgentProgressEvent[];
  timestamp: string;
}

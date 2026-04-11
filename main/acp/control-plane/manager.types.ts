/**
 * EverFern Desktop — ACP Control Plane Types
 *
 * Defines standard shapes for tracking agent sessions and their metadata.
 */

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'killed'
  | 'archived';

export interface AgentIdentity {
  /** The local UUID of the agent session */
  agentSessionId: string;
  /** An optional backend ACP session identifier */
  backendSessionId?: string;
}

export interface SessionAcpMeta {
  backend: string;
  agent: string;
  runtimeSessionName?: string;
  identity?: AgentIdentity;
  mode?: string;
  runtimeOptions?: Record<string, string>;
  cwd?: string;
  lastActivityAt: number;
  state?: any;
  lastError?: string;
}

export interface SessionRecord {
  sessionId: string;
  agentId: string;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  tokensUsed?: number;
  parentSessionId?: string;
  meta: SessionAcpMeta;
}

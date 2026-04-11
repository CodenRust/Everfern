/**
 * EverFern Desktop — Session Lifecycle Events
 * 
 * Listener pattern for session lifecycle events.
 * Implements OpenClaw-style session state tracking.
 */

import { getAgentEvents, type EventStream, type AgentEvent } from '../infra/agent-events';

export type SessionLifecycleEventType = 
    | 'session_created'
    | 'session_started'
    | 'session_paused'
    | 'session_resumed'
    | 'session_completed'
    | 'session_failed'
    | 'session_aborted'
    | 'turn_start'
    | 'turn_end'
    | 'compaction_start'
    | 'compaction_end';

export interface SessionLifecycleEvent {
    type: SessionLifecycleEventType;
    sessionKey: string;
    timestamp: number;
    data?: Record<string, unknown>;
}

type LifecycleCallback = (event: SessionLifecycleEvent) => void;

const listeners = new Map<string, Set<LifecycleCallback>>();

export function emitSessionLifecycleEvent(
    sessionKey: string,
    type: SessionLifecycleEventType,
    data?: Record<string, unknown>
): void {
    const event: SessionLifecycleEvent = {
        type,
        sessionKey,
        timestamp: Date.now(),
        data
    };

    // Emit via agent events
    getAgentEvents(sessionKey).emit('lifecycle', type, { sessionKey, timestamp: event.timestamp, ...data });

    // Call registered listeners
    const sessionListeners = listeners.get(sessionKey);
    if (sessionListeners) {
        sessionListeners.forEach(cb => cb(event));
    }

    console.log(`[Lifecycle] ${sessionKey}: ${type}`);
}

export function onSessionLifecycleEvent(
    sessionKey: string,
    callback: LifecycleCallback
): () => void {
    if (!listeners.has(sessionKey)) {
        listeners.set(sessionKey, new Set());
    }
    
    listeners.get(sessionKey)!.add(callback);

    return () => {
        listeners.get(sessionKey)?.delete(callback);
    };
}

export function removeSessionLifecycleListeners(sessionKey: string): void {
    listeners.delete(sessionKey);
}

// Convenience functions
export function sessionCreated(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_created', data);
}

export function sessionStarted(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_started', data);
}

export function sessionPaused(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_paused', data);
}

export function sessionResumed(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_resumed', data);
}

export function sessionCompleted(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_completed', data);
}

export function sessionFailed(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_failed', data);
}

export function sessionAborted(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'session_aborted', data);
}

export function turnStart(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'turn_start', data);
}

export function turnEnd(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'turn_end', data);
}

export function compactionStart(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'compaction_start', data);
}

export function compactionEnd(sessionKey: string, data?: Record<string, unknown>) {
    emitSessionLifecycleEvent(sessionKey, 'compaction_end', data);
}

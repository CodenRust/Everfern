"use strict";
/**
 * EverFern Desktop — Session Lifecycle Events
 *
 * Listener pattern for session lifecycle events.
 * Implements OpenClaw-style session state tracking.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSessionLifecycleEvent = emitSessionLifecycleEvent;
exports.onSessionLifecycleEvent = onSessionLifecycleEvent;
exports.removeSessionLifecycleListeners = removeSessionLifecycleListeners;
exports.sessionCreated = sessionCreated;
exports.sessionStarted = sessionStarted;
exports.sessionPaused = sessionPaused;
exports.sessionResumed = sessionResumed;
exports.sessionCompleted = sessionCompleted;
exports.sessionFailed = sessionFailed;
exports.sessionAborted = sessionAborted;
exports.turnStart = turnStart;
exports.turnEnd = turnEnd;
exports.compactionStart = compactionStart;
exports.compactionEnd = compactionEnd;
const agent_events_1 = require("../infra/agent-events");
const listeners = new Map();
function emitSessionLifecycleEvent(sessionKey, type, data) {
    const event = {
        type,
        sessionKey,
        timestamp: Date.now(),
        data
    };
    // Emit via agent events
    (0, agent_events_1.getAgentEvents)(sessionKey).emit('lifecycle', type, { sessionKey, timestamp: event.timestamp, ...data });
    // Call registered listeners
    const sessionListeners = listeners.get(sessionKey);
    if (sessionListeners) {
        sessionListeners.forEach(cb => cb(event));
    }
    console.log(`[Lifecycle] ${sessionKey}: ${type}`);
}
function onSessionLifecycleEvent(sessionKey, callback) {
    if (!listeners.has(sessionKey)) {
        listeners.set(sessionKey, new Set());
    }
    listeners.get(sessionKey).add(callback);
    return () => {
        listeners.get(sessionKey)?.delete(callback);
    };
}
function removeSessionLifecycleListeners(sessionKey) {
    listeners.delete(sessionKey);
}
// Convenience functions
function sessionCreated(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_created', data);
}
function sessionStarted(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_started', data);
}
function sessionPaused(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_paused', data);
}
function sessionResumed(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_resumed', data);
}
function sessionCompleted(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_completed', data);
}
function sessionFailed(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_failed', data);
}
function sessionAborted(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'session_aborted', data);
}
function turnStart(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'turn_start', data);
}
function turnEnd(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'turn_end', data);
}
function compactionStart(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'compaction_start', data);
}
function compactionEnd(sessionKey, data) {
    emitSessionLifecycleEvent(sessionKey, 'compaction_end', data);
}

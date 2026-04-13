"use strict";
/**
 * EverFern Desktop — Agent Events System
 *
 * Event-driven architecture for streaming agent events.
 * Implements OpenClaw-style event streams with sequential numbering.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgentEvents = getAgentEvents;
exports.removeAgentEvents = removeAgentEvents;
exports.emitLifecycle = emitLifecycle;
exports.emitTool = emitTool;
exports.emitAssistant = emitAssistant;
exports.emitError = emitError;
exports.emitCompaction = emitCompaction;
const events_1 = require("events");
class AgentEventEmitter {
    emitter = new events_1.EventEmitter();
    seqCounter = 0;
    sessionKey = '';
    listenersByStream = new Map();
    globalListeners = new Set();
    setSessionKey(key) {
        this.sessionKey = key;
        this.seqCounter = 0;
    }
    getSessionKey() {
        return this.sessionKey;
    }
    emit(stream, type, data = {}) {
        const event = {
            seq: ++this.seqCounter,
            ts: Date.now(),
            stream,
            type,
            data,
            sessionKey: this.sessionKey
        };
        // Emit to stream-specific listeners
        const streamListeners = this.listenersByStream.get(stream);
        if (streamListeners) {
            streamListeners.forEach(cb => cb(event));
        }
        // Emit to global listeners
        this.globalListeners.forEach(cb => cb(event));
        // Emit via EventEmitter for compatibility
        this.emitter.emit(type, event);
        this.emitter.emit('event', event);
        return event;
    }
    onStream(stream, callback) {
        if (!this.listenersByStream.has(stream)) {
            this.listenersByStream.set(stream, new Set());
        }
        this.listenersByStream.get(stream).add(callback);
        return () => {
            this.listenersByStream.get(stream)?.delete(callback);
        };
    }
    onAny(callback) {
        this.globalListeners.add(callback);
        return () => {
            this.globalListeners.delete(callback);
        };
    }
    on(type, callback) {
        this.emitter.on(type, callback);
        return () => this.emitter.off(type, callback);
    }
    once(type, callback) {
        this.emitter.once(type, callback);
    }
    removeAllListeners() {
        this.emitter.removeAllListeners();
        this.listenersByStream.clear();
        this.globalListeners.clear();
    }
    getSeq() {
        return this.seqCounter;
    }
}
// Singleton instance per session
const sessions = new Map();
function getAgentEvents(sessionKey) {
    if (!sessions.has(sessionKey)) {
        const events = new AgentEventEmitter();
        events.setSessionKey(sessionKey);
        sessions.set(sessionKey, events);
    }
    return sessions.get(sessionKey);
}
function removeAgentEvents(sessionKey) {
    const events = sessions.get(sessionKey);
    if (events) {
        events.removeAllListeners();
        sessions.delete(sessionKey);
    }
}
// Convenience event emitters for common event types
function emitLifecycle(sessionKey, type, data = {}) {
    return getAgentEvents(sessionKey).emit('lifecycle', type, data);
}
function emitTool(sessionKey, type, data = {}) {
    return getAgentEvents(sessionKey).emit('tool', type, data);
}
function emitAssistant(sessionKey, type, data = {}) {
    return getAgentEvents(sessionKey).emit('assistant', type, data);
}
function emitError(sessionKey, type, data = {}) {
    return getAgentEvents(sessionKey).emit('error', type, data);
}
function emitCompaction(sessionKey, type, data = {}) {
    return getAgentEvents(sessionKey).emit('compaction', type, data);
}

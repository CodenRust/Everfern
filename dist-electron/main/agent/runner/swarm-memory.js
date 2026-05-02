"use strict";
/**
 * EverFern Desktop — Swarm Memory Bus
 *
 * Shared real-time memory synchronization for an "army" of agents.
 * Allows agents to broadcast findings, updates, and goal pivots.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSwarmMemory = getSwarmMemory;
const events_1 = require("events");
const agent_events_1 = require("../infra/agent-events");
class SwarmMemoryBus extends events_1.EventEmitter {
    facts = new Map(); // sessionId -> facts[]
    activeSubscriptions = new Map(); // sessionId -> agentIds[]
    /**
     * Broadcast a fact to all agents in a specific session swarm.
     */
    broadcast(fact) {
        const fullFact = {
            ...fact,
            id: `fact_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: Date.now()
        };
        if (!this.facts.has(fullFact.sessionId)) {
            this.facts.set(fullFact.sessionId, []);
        }
        this.facts.get(fullFact.sessionId).push(fullFact);
        // Emit for real-time subscribers
        this.emit(`sync:${fullFact.sessionId}`, fullFact);
        // Also emit via the standard agent events system for UI visibility
        const agentEvents = (0, agent_events_1.getAgentEvents)(fullFact.sessionId);
        agentEvents.emit('lifecycle', 'memory_sync', {
            factId: fullFact.id,
            source: fullFact.sourceAgentId,
            type: fullFact.type,
            content: fullFact.content
        });
        console.log(`[SwarmMemory] 🧠 Fact broadcast in ${fullFact.sessionId}: ${fullFact.type} from ${fullFact.sourceAgentId}`);
    }
    /**
     * Get all synchronized memory for a session.
     */
    getMemory(sessionId) {
        return this.facts.get(sessionId) || [];
    }
    /**
     * Subscribe an agent to real-time memory updates for its swarm.
     * Returns a cleanup function.
     */
    subscribe(sessionId, agentId, callback) {
        if (!this.activeSubscriptions.has(sessionId)) {
            this.activeSubscriptions.set(sessionId, new Set());
        }
        this.activeSubscriptions.get(sessionId).add(agentId);
        const eventName = `sync:${sessionId}`;
        const listener = (fact) => {
            if (fact.sourceAgentId !== agentId) {
                callback(fact);
            }
        };
        this.on(eventName, listener);
        return () => {
            this.off(eventName, listener);
            this.activeSubscriptions.get(sessionId)?.delete(agentId);
        };
    }
    /**
     * Clear memory for a session (cleanup).
     */
    clearSession(sessionId) {
        this.facts.delete(sessionId);
        this.activeSubscriptions.delete(sessionId);
        this.removeAllListeners(`sync:${sessionId}`);
    }
}
// Singleton
let swarmInstance = null;
function getSwarmMemory() {
    if (!swarmInstance) {
        swarmInstance = new SwarmMemoryBus();
    }
    return swarmInstance;
}

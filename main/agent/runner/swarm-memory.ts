/**
 * EverFern Desktop — Swarm Memory Bus
 * 
 * Shared real-time memory synchronization for an "army" of agents.
 * Allows agents to broadcast findings, updates, and goal pivots.
 */

import { EventEmitter } from 'events';
import { getAgentEvents } from '../infra/agent-events';

export interface MemoryFact {
    id: string;
    sourceAgentId: string;
    sessionId: string;
    type: 'fact' | 'goal_update' | 'error' | 'pivot';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

class SwarmMemoryBus extends EventEmitter {
    private facts: Map<string, MemoryFact[]> = new Map(); // sessionId -> facts[]
    private activeSubscriptions: Map<string, Set<string>> = new Map(); // sessionId -> agentIds[]

    /**
     * Broadcast a fact to all agents in a specific session swarm.
     */
    broadcast(fact: Omit<MemoryFact, 'id' | 'timestamp'>): void {
        const fullFact: MemoryFact = {
            ...fact,
            id: `fact_${Math.random().toString(36).substring(2, 11)}`,
            timestamp: Date.now()
        };

        if (!this.facts.has(fullFact.sessionId)) {
            this.facts.set(fullFact.sessionId, []);
        }
        this.facts.get(fullFact.sessionId)!.push(fullFact);

        // Emit for real-time subscribers
        this.emit(`sync:${fullFact.sessionId}`, fullFact);

        // Also emit via the standard agent events system for UI visibility
        const agentEvents = getAgentEvents(fullFact.sessionId);
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
    getMemory(sessionId: string): MemoryFact[] {
        return this.facts.get(sessionId) || [];
    }

    /**
     * Subscribe an agent to real-time memory updates for its swarm.
     * Returns a cleanup function.
     */
    subscribe(sessionId: string, agentId: string, callback: (fact: MemoryFact) => void): () => void {
        if (!this.activeSubscriptions.has(sessionId)) {
            this.activeSubscriptions.set(sessionId, new Set());
        }
        this.activeSubscriptions.get(sessionId)!.add(agentId);

        const eventName = `sync:${sessionId}`;
        const listener = (fact: MemoryFact) => {
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
    clearSession(sessionId: string): void {
        this.facts.delete(sessionId);
        this.activeSubscriptions.delete(sessionId);
        this.removeAllListeners(`sync:${sessionId}`);
    }
}

// Singleton
let swarmInstance: SwarmMemoryBus | null = null;

export function getSwarmMemory(): SwarmMemoryBus {
    if (!swarmInstance) {
        swarmInstance = new SwarmMemoryBus();
    }
    return swarmInstance;
}

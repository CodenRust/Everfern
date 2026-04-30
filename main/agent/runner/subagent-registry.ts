/**
 * EverFern Desktop — Subagent Registry
 * 
 * In-memory + disk persistence for subagent visibility.
 * Implements OpenClaw-style parent-child session tracking.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export type AgentType = 'generic' | 'coding-specialist' | 'web-explorer' | 'data-analyst' | 'computer-use';

export interface SubagentEntry {
    agentId: string;
    parentSessionId: string;
    sessionKey: string;
    task: string;
    agentType: AgentType;
    mode: 'run' | 'session';
    status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted';
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
    result?: string;
    error?: string;
    workspaceDir?: string;
    maxDepth: number;
    currentDepth: number;
}

function getRegistryPath(): string {
    return path.join(os.homedir(), '.everfern', 'subagent-registry.json');
}

function ensureDir(): void {
    const dir = path.dirname(getRegistryPath());
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

class SubagentRegistry {
    private entries: Map<string, SubagentEntry> = new Map();
    private listeners: Map<string, Set<(entry: SubagentEntry) => void>> = new Map();

    constructor() {
        this.load();
    }

    private load(): void {
        ensureDir();
        const filePath = getRegistryPath();

        if (!fs.existsSync(filePath)) {
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data: SubagentEntry[] = JSON.parse(content);

            for (const entry of data) {
                // Only keep recent entries (24 hours)
                if (Date.now() - entry.updatedAt < 24 * 60 * 60 * 1000) {
                    this.entries.set(entry.agentId, entry);
                }
            }

            console.log(`[SubagentRegistry] Loaded ${this.entries.size} entries`);
        } catch (e) {
            console.error('[SubagentRegistry] Failed to load registry:', e);
        }
    }

    private save(): void {
        ensureDir();
        const filePath = getRegistryPath();

        try {
            const data = Array.from(this.entries.values());
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            console.error('[SubagentRegistry] Failed to save registry:', e);
        }
    }

    register(entry: Omit<SubagentEntry, 'createdAt' | 'updatedAt'>): SubagentEntry {
        const now = Date.now();
        const fullEntry: SubagentEntry = {
            ...entry,
            createdAt: now,
            updatedAt: now
        };

        this.entries.set(entry.agentId, fullEntry);
        this.save();
        this.notifyListeners(entry.parentSessionId, fullEntry);

        console.log(`[SubagentRegistry] Registered agent ${entry.agentId} (parent: ${entry.parentSessionId})`);
        return fullEntry;
    }

    get(agentId: string): SubagentEntry | undefined {
        return this.entries.get(agentId);
    }

    getBySessionKey(sessionKey: string): SubagentEntry | undefined {
        for (const entry of this.entries.values()) {
            if (entry.sessionKey === sessionKey) {
                return entry;
            }
        }
        return undefined;
    }

    getChildren(parentSessionId: string): SubagentEntry[] {
        return Array.from(this.entries.values())
            .filter(e => e.parentSessionId === parentSessionId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    getByParent(parentSessionId: string, status?: SubagentEntry['status']): SubagentEntry[] {
        let children = this.getChildren(parentSessionId);
        if (status) {
            children = children.filter(e => e.status === status);
        }
        return children;
    }

    hasPendingChildren(parentSessionId: string): boolean {
        return this.getByParent(parentSessionId, 'pending').length > 0 ||
               this.getByParent(parentSessionId, 'running').length > 0;
    }

    update(agentId: string, updates: Partial<SubagentEntry>): SubagentEntry | undefined {
        const existing = this.entries.get(agentId);
        if (!existing) return undefined;

        const updated: SubagentEntry = {
            ...existing,
            ...updates,
            updatedAt: Date.now()
        };

        this.entries.set(agentId, updated);
        this.save();
        this.notifyListeners(updated.parentSessionId, updated);

        return updated;
    }

    complete(agentId: string, result?: string, error?: string): SubagentEntry | undefined {
        return this.update(agentId, {
            status: error ? 'failed' : 'completed',
            completedAt: Date.now(),
            result,
            error
        });
    }

    abort(agentId: string): SubagentEntry | undefined {
        return this.update(agentId, {
            status: 'aborted',
            completedAt: Date.now()
        });
    }

    cleanup(): number {
        let cleaned = 0;
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

        for (const [agentId, entry] of this.entries.entries()) {
            if (entry.updatedAt < cutoff) {
                this.entries.delete(agentId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.save();
            console.log(`[SubagentRegistry] Cleaned up ${cleaned} old entries`);
        }

        return cleaned;
    }

    // Listener pattern for completion notifications
    onUpdate(parentSessionId: string, callback: (entry: SubagentEntry) => void): () => void {
        if (!this.listeners.has(parentSessionId)) {
            this.listeners.set(parentSessionId, new Set());
        }
        this.listeners.get(parentSessionId)!.add(callback);

        return () => {
            this.listeners.get(parentSessionId)?.delete(callback);
        };
    }

    private notifyListeners(parentSessionId: string, entry: SubagentEntry): void {
        const callbacks = this.listeners.get(parentSessionId);
        if (callbacks) {
            callbacks.forEach(cb => cb(entry));
        }
    }
}

// Singleton
let registry: SubagentRegistry | null = null;

export function getSubagentRegistry(): SubagentRegistry {
    if (!registry) {
        registry = new SubagentRegistry();
    }
    return registry;
}

// Convenience functions
export function generateAgentId(): string {
    return `agent_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
}

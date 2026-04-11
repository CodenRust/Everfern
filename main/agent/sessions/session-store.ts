/**
 * EverFern Desktop — Session Store
 * 
 * JSON-based session store with disk persistence.
 * Implements OpenClaw-style session management.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SessionEntry {
    sessionId: string;
    model: string;
    createdAt: number;
    updatedAt: number;
    status: 'running' | 'completed' | 'failed' | 'paused';
    parentSessionId?: string;
    agentId?: string;
    metadata?: Record<string, unknown>;
}

export interface SessionStore {
    sessions: Map<string, SessionEntry>;
    dir: string;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionsDir(): string {
    return path.join(os.homedir(), '.everfern', 'sessions');
}

function ensureDir(): void {
    const dir = getSessionsDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function createSessionStore(): SessionStore {
    ensureDir();
    const sessions = loadSessionsFromDisk();
    
    return {
        sessions,
        dir: getSessionsDir()
    };
}

function loadSessionsFromDisk(): Map<string, SessionEntry> {
    const dir = getSessionsDir();
    const sessions = new Map<string, SessionEntry>();
    
    if (!fs.existsSync(dir)) {
        return sessions;
    }

    try {
        const files = fs.readdirSync(dir);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            try {
                const filePath = path.join(dir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const entry: SessionEntry = JSON.parse(content);

                // Check TTL
                if (now - entry.updatedAt > SESSION_TTL_MS) {
                    fs.unlinkSync(filePath);
                    continue;
                }

                sessions.set(entry.sessionId, entry);
            } catch (e) {
                console.warn(`[SessionStore] Failed to load session from ${file}:`, e);
            }
        }
    } catch (e) {
        console.error('[SessionStore] Failed to read sessions directory:', e);
    }

    return sessions;
}

function saveSessionToDisk(entry: SessionEntry): void {
    const dir = getSessionsDir();
    const filePath = path.join(dir, `${entry.sessionId}.json`);
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[SessionStore] Failed to save session ${entry.sessionId}:`, e);
    }
}

function deleteSessionFromDisk(sessionId: string): void {
    const filePath = path.join(getSessionsDir(), `${sessionId}.json`);
    
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.error(`[SessionStore] Failed to delete session ${sessionId}:`, e);
    }
}

export class SessionStoreManager {
    private store: SessionStore;

    constructor() {
        this.store = createSessionStore();
    }

    create(entry: Omit<SessionEntry, 'createdAt' | 'updatedAt'>): SessionEntry {
        const now = Date.now();
        const fullEntry: SessionEntry = {
            ...entry,
            createdAt: now,
            updatedAt: now
        };

        this.store.sessions.set(entry.sessionId, fullEntry);
        saveSessionToDisk(fullEntry);

        console.log(`[SessionStore] Created session: ${entry.sessionId}`);
        return fullEntry;
    }

    get(sessionId: string): SessionEntry | undefined {
        return this.store.sessions.get(sessionId);
    }

    update(sessionId: string, updates: Partial<SessionEntry>): SessionEntry | undefined {
        const existing = this.store.sessions.get(sessionId);
        if (!existing) return undefined;

        const updated: SessionEntry = {
            ...existing,
            ...updates,
            updatedAt: Date.now()
        };

        this.store.sessions.set(sessionId, updated);
        saveSessionToDisk(updated);

        return updated;
    }

    delete(sessionId: string): boolean {
        const existed = this.store.sessions.has(sessionId);
        if (existed) {
            this.store.sessions.delete(sessionId);
            deleteSessionFromDisk(sessionId);
            console.log(`[SessionStore] Deleted session: ${sessionId}`);
        }
        return existed;
    }

    list(): SessionEntry[] {
        return Array.from(this.store.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    listByParent(parentSessionId: string): SessionEntry[] {
        return this.list().filter(s => s.parentSessionId === parentSessionId);
    }

    updateStatus(sessionId: string, status: SessionEntry['status']): SessionEntry | undefined {
        return this.update(sessionId, { status });
    }

    touch(sessionId: string): SessionEntry | undefined {
        return this.update(sessionId, {});
    }

    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, entry] of this.store.sessions.entries()) {
            if (now - entry.updatedAt > SESSION_TTL_MS) {
                this.delete(sessionId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[SessionStore] Cleaned up ${cleaned} expired sessions`);
        }

        return cleaned;
    }
}

// Singleton instance
let sessionStoreInstance: SessionStoreManager | null = null;

export function getSessionStore(): SessionStoreManager {
    if (!sessionStoreInstance) {
        sessionStoreInstance = new SessionStoreManager();
    }
    return sessionStoreInstance;
}

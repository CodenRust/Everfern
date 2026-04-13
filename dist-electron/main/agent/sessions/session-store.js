"use strict";
/**
 * EverFern Desktop — Session Store
 *
 * JSON-based session store with disk persistence.
 * Implements OpenClaw-style session management.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionStoreManager = void 0;
exports.createSessionStore = createSessionStore;
exports.getSessionStore = getSessionStore;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function getSessionsDir() {
    return path.join(os.homedir(), '.everfern', 'sessions');
}
function ensureDir() {
    const dir = getSessionsDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function createSessionStore() {
    ensureDir();
    const sessions = loadSessionsFromDisk();
    return {
        sessions,
        dir: getSessionsDir()
    };
}
function loadSessionsFromDisk() {
    const dir = getSessionsDir();
    const sessions = new Map();
    if (!fs.existsSync(dir)) {
        return sessions;
    }
    try {
        const files = fs.readdirSync(dir);
        const now = Date.now();
        for (const file of files) {
            if (!file.endsWith('.json'))
                continue;
            try {
                const filePath = path.join(dir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const entry = JSON.parse(content);
                // Check TTL
                if (now - entry.updatedAt > SESSION_TTL_MS) {
                    fs.unlinkSync(filePath);
                    continue;
                }
                sessions.set(entry.sessionId, entry);
            }
            catch (e) {
                console.warn(`[SessionStore] Failed to load session from ${file}:`, e);
            }
        }
    }
    catch (e) {
        console.error('[SessionStore] Failed to read sessions directory:', e);
    }
    return sessions;
}
function saveSessionToDisk(entry) {
    const dir = getSessionsDir();
    const filePath = path.join(dir, `${entry.sessionId}.json`);
    try {
        fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');
    }
    catch (e) {
        console.error(`[SessionStore] Failed to save session ${entry.sessionId}:`, e);
    }
}
function deleteSessionFromDisk(sessionId) {
    const filePath = path.join(getSessionsDir(), `${sessionId}.json`);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    catch (e) {
        console.error(`[SessionStore] Failed to delete session ${sessionId}:`, e);
    }
}
class SessionStoreManager {
    store;
    constructor() {
        this.store = createSessionStore();
    }
    create(entry) {
        const now = Date.now();
        const fullEntry = {
            ...entry,
            createdAt: now,
            updatedAt: now
        };
        this.store.sessions.set(entry.sessionId, fullEntry);
        saveSessionToDisk(fullEntry);
        console.log(`[SessionStore] Created session: ${entry.sessionId}`);
        return fullEntry;
    }
    get(sessionId) {
        return this.store.sessions.get(sessionId);
    }
    update(sessionId, updates) {
        const existing = this.store.sessions.get(sessionId);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            ...updates,
            updatedAt: Date.now()
        };
        this.store.sessions.set(sessionId, updated);
        saveSessionToDisk(updated);
        return updated;
    }
    delete(sessionId) {
        const existed = this.store.sessions.has(sessionId);
        if (existed) {
            this.store.sessions.delete(sessionId);
            deleteSessionFromDisk(sessionId);
            console.log(`[SessionStore] Deleted session: ${sessionId}`);
        }
        return existed;
    }
    list() {
        return Array.from(this.store.sessions.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }
    listByParent(parentSessionId) {
        return this.list().filter(s => s.parentSessionId === parentSessionId);
    }
    updateStatus(sessionId, status) {
        return this.update(sessionId, { status });
    }
    touch(sessionId) {
        return this.update(sessionId, {});
    }
    cleanup() {
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
exports.SessionStoreManager = SessionStoreManager;
// Singleton instance
let sessionStoreInstance = null;
function getSessionStore() {
    if (!sessionStoreInstance) {
        sessionStoreInstance = new SessionStoreManager();
    }
    return sessionStoreInstance;
}

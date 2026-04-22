"use strict";
/**
 * EverFern Desktop — Analysis Session Manager
 *
 * Manages stateful data analysis sessions with DataFrame persistence,
 * variable storage, and execution history tracking.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
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
exports.AnalysisSessionManagerImpl = void 0;
exports.getAnalysisSessionManager = getAnalysisSessionManager;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto_1 = require("crypto");
/**
 * Default inactivity threshold: 30 minutes
 */
const DEFAULT_INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000;
/**
 * Get the temporary directory for analysis session data
 */
function getAnalysisSessionDir() {
    return path.join(os.tmpdir(), 'everfern-analysis-sessions');
}
/**
 * Ensure the analysis session directory exists
 */
function ensureAnalysisSessionDir() {
    const dir = getAnalysisSessionDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Implementation of AnalysisSessionManager
 */
class AnalysisSessionManagerImpl {
    sessions;
    conversationToSessionMap;
    constructor() {
        this.sessions = new Map();
        this.conversationToSessionMap = new Map();
        ensureAnalysisSessionDir();
    }
    /**
     * Get existing session for conversation or create a new one
     * Requirements: 5.1
     */
    getOrCreateSession(conversationId) {
        // Check if session already exists for this conversation
        const existingSessionId = this.conversationToSessionMap.get(conversationId);
        if (existingSessionId) {
            const session = this.sessions.get(existingSessionId);
            if (session) {
                // Update last accessed time
                session.lastAccessedAt = Date.now();
                return session;
            }
        }
        // Create new session
        const sessionId = (0, crypto_1.randomUUID)();
        const now = Date.now();
        const session = {
            id: sessionId,
            conversationId,
            createdAt: now,
            lastAccessedAt: now,
            dataFrames: new Map(),
            variables: new Map(),
            executionHistory: [],
            resultCache: new Map(),
            cacheStats: { hits: 0, misses: 0 }
        };
        this.sessions.set(sessionId, session);
        this.conversationToSessionMap.set(conversationId, sessionId);
        console.log(`[AnalysisSession] Created new session ${sessionId} for conversation ${conversationId}`);
        return session;
    }
    /**
     * Store a DataFrame in the session
     * Requirements: 5.2
     *
     * Note: DataFrame serialization using pickle is handled by the Python executor.
     * This method stores the already-serialized DataFrame data.
     */
    storeDataFrame(sessionId, name, df) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // Store DataFrame in memory
        session.dataFrames.set(name, df);
        session.lastAccessedAt = Date.now();
        // Persist to disk
        const sessionDir = path.join(getAnalysisSessionDir(), sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        const dfPath = path.join(sessionDir, `${name}.pkl`);
        try {
            fs.writeFileSync(dfPath, df.pickledData);
            console.log(`[AnalysisSession] Stored DataFrame '${name}' for session ${sessionId}`);
        }
        catch (error) {
            console.error(`[AnalysisSession] Failed to persist DataFrame '${name}':`, error);
        }
    }
    /**
     * Retrieve a DataFrame from the session
     * Requirements: 5.2
     */
    retrieveDataFrame(sessionId, name) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        session.lastAccessedAt = Date.now();
        // Check in-memory first
        const df = session.dataFrames.get(name);
        if (df) {
            return df;
        }
        // Try to load from disk
        const sessionDir = path.join(getAnalysisSessionDir(), sessionId);
        const dfPath = path.join(sessionDir, `${name}.pkl`);
        if (fs.existsSync(dfPath)) {
            try {
                const pickledData = fs.readFileSync(dfPath);
                // Note: We don't have full metadata here, so return minimal structure
                // In practice, metadata should be stored separately or the Python executor
                // should handle full deserialization
                const serializedDf = {
                    name,
                    shape: [0, 0], // Unknown without deserializing
                    columns: [],
                    dtypes: {},
                    pickledData
                };
                session.dataFrames.set(name, serializedDf);
                return serializedDf;
            }
            catch (error) {
                console.error(`[AnalysisSession] Failed to load DataFrame '${name}':`, error);
                return null;
            }
        }
        return null;
    }
    /**
     * Get execution history for a session
     * Requirements: 5.3
     */
    getExecutionHistory(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return [];
        }
        session.lastAccessedAt = Date.now();
        return [...session.executionHistory]; // Return copy
    }
    /**
     * Add an execution record to the session history
     * Requirements: 5.3
     */
    addExecutionRecord(sessionId, record) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        session.executionHistory.push(record);
        session.lastAccessedAt = Date.now();
    }
    /**
     * Store a variable in the session
     * Requirements: 5.1
     */
    storeVariable(sessionId, name, value) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        session.variables.set(name, value);
        session.lastAccessedAt = Date.now();
    }
    /**
     * Retrieve a variable from the session
     * Requirements: 5.1
     */
    retrieveVariable(sessionId, name) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return undefined;
        }
        session.lastAccessedAt = Date.now();
        return session.variables.get(name);
    }
    /**
     * Reset a session, clearing all data
     * Requirements: 5.6
     */
    resetSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        // Clear in-memory data
        session.dataFrames.clear();
        session.variables.clear();
        session.executionHistory = [];
        session.resultCache.clear();
        session.cacheStats = { hits: 0, misses: 0 };
        session.lastAccessedAt = Date.now();
        // Delete persisted files
        const sessionDir = path.join(getAnalysisSessionDir(), sessionId);
        if (fs.existsSync(sessionDir)) {
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
                console.log(`[AnalysisSession] Reset session ${sessionId}`);
            }
            catch (error) {
                console.error(`[AnalysisSession] Failed to delete session directory:`, error);
            }
        }
    }
    /**
     * Cache a computed result to avoid redundant calculations
     * Requirements: 10.4
     */
    cacheResult(sessionId, key, value, dataStateHash) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        const cached = {
            key,
            value,
            computedAt: Date.now(),
            dataStateHash
        };
        session.resultCache.set(key, cached);
        session.lastAccessedAt = Date.now();
        console.log(`[AnalysisSession] Cached result '${key}' for session ${sessionId}`);
    }
    /**
     * Retrieve a cached result; returns null on cache miss or stale data
     * Requirements: 10.4
     */
    getCachedResult(sessionId, key, currentDataStateHash) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        session.lastAccessedAt = Date.now();
        const cached = session.resultCache.get(key);
        if (!cached) {
            session.cacheStats.misses++;
            return null;
        }
        // Invalidate if data has changed since the result was computed
        if (cached.dataStateHash !== currentDataStateHash) {
            session.resultCache.delete(key);
            session.cacheStats.misses++;
            console.log(`[AnalysisSession] Cache miss (stale) for '${key}' in session ${sessionId}`);
            return null;
        }
        session.cacheStats.hits++;
        console.log(`[AnalysisSession] Cache hit for '${key}' in session ${sessionId}`);
        return cached.value;
    }
    /**
     * Invalidate all cached results for a session (e.g. after data changes)
     * Requirements: 10.4
     */
    invalidateCache(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const count = session.resultCache.size;
        session.resultCache.clear();
        session.lastAccessedAt = Date.now();
        console.log(`[AnalysisSession] Invalidated ${count} cached results for session ${sessionId}`);
    }
    /**
     * Get cache hit/miss statistics for a session
     * Requirements: 10.4
     */
    getCacheStats(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { hits: 0, misses: 0 };
        }
        return { ...session.cacheStats };
    }
    /**
     * Clean up inactive sessions
     * Requirements: 5.5
     */
    cleanupInactiveSessions(inactivityThresholdMs = DEFAULT_INACTIVITY_THRESHOLD_MS) {
        const now = Date.now();
        const sessionsToDelete = [];
        for (const [sessionId, session] of this.sessions.entries()) {
            const inactiveTime = now - session.lastAccessedAt;
            if (inactiveTime > inactivityThresholdMs) {
                sessionsToDelete.push(sessionId);
            }
        }
        for (const sessionId of sessionsToDelete) {
            const session = this.sessions.get(sessionId);
            if (session) {
                // Remove from conversation map
                this.conversationToSessionMap.delete(session.conversationId);
                // Delete session directory
                const sessionDir = path.join(getAnalysisSessionDir(), sessionId);
                if (fs.existsSync(sessionDir)) {
                    try {
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }
                    catch (error) {
                        console.error(`[AnalysisSession] Failed to delete session directory:`, error);
                    }
                }
                // Remove from sessions map
                this.sessions.delete(sessionId);
            }
        }
        if (sessionsToDelete.length > 0) {
            console.log(`[AnalysisSession] Cleaned up ${sessionsToDelete.length} inactive sessions`);
        }
    }
    /**
     * Get all active sessions (for debugging/monitoring)
     */
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }
}
exports.AnalysisSessionManagerImpl = AnalysisSessionManagerImpl;
/**
 * Singleton instance
 */
let analysisSessionManagerInstance = null;
/**
 * Get the singleton AnalysisSessionManager instance
 */
function getAnalysisSessionManager() {
    if (!analysisSessionManagerInstance) {
        analysisSessionManagerInstance = new AnalysisSessionManagerImpl();
        // Set up periodic cleanup (every 10 minutes)
        setInterval(() => {
            analysisSessionManagerInstance?.cleanupInactiveSessions();
        }, 10 * 60 * 1000);
    }
    return analysisSessionManagerInstance;
}

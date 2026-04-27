"use strict";
/**
 * EverFern Desktop — Chat Vector Store
 *
 * Stores chat messages in SQLite for semantic search.
 * Uses text-based keyword matching (no vector embeddings).
 * Messages are stored in ~/.everfern/sql/chat.sqlite
 *
 * Has a write queue to prevent concurrent write errors.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatVectorDb = initChatVectorDb;
exports.getChatVectorDb = getChatVectorDb;
exports.embedAndStoreMessage = embedAndStoreMessage;
exports.searchChatVectors = searchChatVectors;
exports.getChatVectors = getChatVectors;
exports.deleteChatVectors = deleteChatVectors;
exports.closeChatVectorDb = closeChatVectorDb;
exports.getVectorStats = getVectorStats;
exports.refreshEmbeddingConfig = refreshEmbeddingConfig;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
let instance = null;
let isInitialized = false;
const VECTORS_DIR = path_1.default.join(os_1.default.homedir(), '.everfern', 'sql');
const DEBUG = false;
function log(...args) {
    if (DEBUG) {
        console.log('[ChatVectors]', ...args);
    }
}
function ensureDir() {
    if (!fs_1.default.existsSync(VECTORS_DIR)) {
        fs_1.default.mkdirSync(VECTORS_DIR, { recursive: true });
    }
}
let writeQueue = [];
let isWriteInProgress = false;
function queueWrite(fn) {
    writeQueue.push(fn);
    processQueue();
}
function processQueue() {
    if (isWriteInProgress || writeQueue.length === 0 || !instance)
        return;
    isWriteInProgress = true;
    const next = writeQueue.shift();
    if (next) {
        try {
            next();
        }
        catch (err) {
            log('Queue write error:', err);
        }
    }
    isWriteInProgress = false;
    // Process next in queue
    if (writeQueue.length > 0) {
        setTimeout(processQueue, 10);
    }
}
async function initChatVectorDb() {
    if (instance) {
        return instance;
    }
    ensureDir();
    const dbPath = path_1.default.join(VECTORS_DIR, 'chat.sqlite');
    return new Promise((resolve, reject) => {
        try {
            const db = new sqlite3_1.default.Database(dbPath, (err) => {
                if (err) {
                    log('Database open ERROR:', err.message);
                    const fallbackDb = new sqlite3_1.default.Database(':memory:');
                    instance = fallbackDb;
                    resolve(fallbackDb);
                    return;
                }
                log('Database opened successfully');
                db.exec(`
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            indexed_at INTEGER
          );

          CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
        `, (execErr) => {
                    if (execErr) {
                        log('Table creation ERROR:', execErr.message);
                    }
                    else {
                        log('Tables created successfully');
                    }
                    instance = db;
                    isInitialized = true;
                    resolve(db);
                });
            });
        }
        catch (err) {
            log('Database init FATAL ERROR:', err.message);
            reject(err);
        }
    });
}
async function getChatVectorDb() {
    if (!instance) {
        await initChatVectorDb();
    }
    return instance;
}
async function embedAndStoreMessage(id, chatId, role, content, createdAt) {
    log('embedAndStoreMessage:', { id, chatId, role, contentLength: content.length });
    if (!content || content.trim().length === 0) {
        log('Skipping empty content');
        return;
    }
    try {
        const db = await getChatVectorDb();
        // Use synchronous write in queue to prevent concurrent writes
        return new Promise((res, rej) => {
            queueWrite(() => {
                try {
                    db.run(`INSERT OR REPLACE INTO chat_messages (id, chat_id, role, content, created_at, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, chatId, role, content, createdAt, Date.now()], (e) => {
                        if (e) {
                            log('Store message ERROR:', e.message);
                            rej(e);
                        }
                        else {
                            log('Message stored successfully');
                            res();
                        }
                        isWriteInProgress = false;
                        processQueue();
                    });
                }
                catch (err) {
                    log('Queue write error:', err.message);
                    isWriteInProgress = false;
                    processQueue();
                    rej(err);
                }
            });
        });
    }
    catch (err) {
        log('embedAndStoreMessage failed:', err.message);
    }
}
async function searchChatVectors(query, topK = 10, filterChatId) {
    log('searchChatVectors:', { query: query.substring(0, 50), topK, filterChatId });
    try {
        const db = await getChatVectorDb();
        const queryLower = query.toLowerCase();
        let sql = `
      SELECT
        cm.id, cm.chat_id as chatId, cm.role, cm.content, cm.created_at as createdAt
      FROM chat_messages cm
    `;
        const params = [];
        if (filterChatId) {
            sql += ` WHERE cm.chat_id = ?`;
            params.push(filterChatId);
        }
        sql += ` ORDER BY cm.created_at DESC LIMIT ?`;
        params.push(topK * 3);
        const results = await new Promise((res, rej) => {
            db.all(sql, params, (e, rows) => {
                if (e) {
                    log('Search query ERROR:', e.message);
                    rej(e);
                }
                else {
                    log('Search returned', rows.length, 'results');
                    res(rows);
                }
            });
        });
        // Score by keyword match
        const scored = results.map(r => {
            const contentLower = r.content.toLowerCase();
            let similarity = 0;
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
            for (const word of queryWords) {
                if (contentLower.includes(word)) {
                    similarity += 0.15;
                }
            }
            return { ...r, similarity };
        });
        const filtered = scored
            .filter(r => r.similarity > 0)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
        log('Search scored results:', filtered.length);
        return filtered.map(r => ({
            id: r.id,
            chatId: r.chatId,
            role: r.role,
            content: r.content,
            createdAt: r.createdAt,
            similarity: r.similarity
        }));
    }
    catch (err) {
        log('searchChatVectors failed:', err.message);
        return [];
    }
}
async function getChatVectors(chatId) {
    log('getChatVectors:', chatId);
    try {
        const db = await getChatVectorDb();
        return new Promise((res, rej) => {
            db.all(`SELECT id, chat_id as chatId, role, content, created_at as createdAt FROM chat_messages WHERE chat_id = ? ORDER BY created_at`, [chatId], (e, rows) => {
                if (e) {
                    log('getChatVectors ERROR:', e.message);
                    rej(e);
                }
                else {
                    log('getChatVectors returned', rows.length, 'messages');
                    res(rows);
                }
            });
        });
    }
    catch (err) {
        log('getChatVectors failed:', err.message);
        return [];
    }
}
async function deleteChatVectors(chatId) {
    log('deleteChatVectors:', chatId);
    try {
        const db = await getChatVectorDb();
        return new Promise((res, rej) => {
            queueWrite(() => {
                db.run(`DELETE FROM chat_messages WHERE chat_id = ?`, [chatId], (e) => {
                    if (e) {
                        log('deleteChatVectors ERROR:', e.message);
                        rej(e);
                    }
                    else {
                        log('Deleted vectors for chat:', chatId);
                        res();
                    }
                    isWriteInProgress = false;
                    processQueue();
                });
            });
        });
    }
    catch (err) {
        log('deleteChatVectors failed:', err.message);
    }
}
async function closeChatVectorDb() {
    log('closeChatVectorDb');
    if (instance) {
        return new Promise((res, rej) => {
            instance.close((e) => {
                if (e) {
                    log('closeChatVectorDb ERROR:', e.message);
                    rej(e);
                }
                else {
                    log('Database closed');
                    instance = null;
                    isInitialized = false;
                    res();
                }
            });
        });
    }
}
async function getVectorStats() {
    ensureDir();
    const dbPath = path_1.default.join(VECTORS_DIR, 'chat.sqlite');
    let storageSize = 0;
    if (fs_1.default.existsSync(dbPath)) {
        const stats = fs_1.default.statSync(dbPath);
        storageSize = stats.size;
    }
    log('getVectorStats:', { storageSize, initialized: isInitialized });
    let messageCount = 0;
    if (instance) {
        messageCount = await new Promise((res) => {
            instance.get(`SELECT COUNT(*) as count FROM chat_messages`, (_e, row) => {
                res(row?.count ?? 0);
            });
        });
    }
    return {
        messageCount,
        dimensionCount: null,
        storageSize,
        initialized: isInitialized,
        error: null
    };
}
async function refreshEmbeddingConfig() {
    log('refreshEmbeddingConfig called (no-op, text-only mode)');
}

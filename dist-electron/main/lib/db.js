"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbOps = void 0;
exports.initMemoryDb = initMemoryDb;
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.ensureVectorTable = ensureVectorTable;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqliteVec = __importStar(require("sqlite-vec"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let instance = null;
let currentVectorDims = null;
function continueWithSetup(db, resolve, reject) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS memory_chunks (
      id TEXT PRIMARY KEY,
      text_content TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FTS5 table for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_fts USING fts5(
      text_content,
      content='memory_chunks',
      content_rowid='id'
    );

    -- Triggers to keep FTS5 up to date
    CREATE TRIGGER IF NOT EXISTS memory_chunks_ai AFTER INSERT ON memory_chunks BEGIN
      INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_chunks_ad AFTER DELETE ON memory_chunks BEGIN
      INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content) VALUES('delete', old.id, old.text_content);
    END;
    CREATE TRIGGER IF NOT EXISTS memory_chunks_au AFTER UPDATE ON memory_chunks BEGIN
      INSERT INTO memory_chunks_fts(memory_chunks_fts, rowid, text_content) VALUES('delete', old.id, old.text_content);
      INSERT INTO memory_chunks_fts(rowid, text_content) VALUES (new.id, new.text_content);
    END;

    -- Semantic Caching tables
    CREATE TABLE IF NOT EXISTS semantic_cache (
      id TEXT PRIMARY KEY,
      prompt_text TEXT NOT NULL,
      response_json TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, (execErr) => {
        if (execErr)
            return reject(execErr);
        instance = db;
        resolve(db);
    });
}
async function initMemoryDb() {
    if (instance)
        return instance;
    const userDataPath = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userDataPath, 'memory');
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path_1.default.join(dbDir, 'memory.sqlite');
    return new Promise((resolve, reject) => {
        const db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err)
                return reject(err);
            // Load sqlite-vec extension with a timeout guard
            let extLoaded = false;
            const extTimeout = setTimeout(() => {
                if (!extLoaded) {
                    extLoaded = true;
                    console.warn('[Optima] sqlite-vec loadExtension timed out — continuing without vector support');
                    continueWithSetup(db, resolve, reject);
                }
            }, 5000);
            try {
                db.loadExtension(sqliteVec.getLoadablePath(), (extErr) => {
                    if (extLoaded)
                        return; // timed out already
                    clearTimeout(extTimeout);
                    extLoaded = true;
                    if (extErr) {
                        console.warn('[Optima] Failed to load sqlite-vec extension — continuing without vector support:', extErr.message);
                    }
                    continueWithSetup(db, resolve, reject);
                });
            }
            catch (loadErr) {
                clearTimeout(extTimeout);
                if (!extLoaded) {
                    extLoaded = true;
                    console.warn('[Optima] sqlite-vec loadExtension threw — continuing without vector support:', loadErr.message);
                    continueWithSetup(db, resolve, reject);
                }
            }
        });
    });
}
async function getDb() {
    if (!instance)
        return await initMemoryDb();
    return instance;
}
function closeDb() {
    return new Promise((resolve, reject) => {
        if (instance) {
            instance.close((err) => {
                if (err)
                    return reject(err);
                instance = null;
                resolve();
            });
        }
        else {
            resolve();
        }
    });
}
exports.dbOps = {
    get: (sql, params = []) => {
        return new Promise(async (resolve, reject) => {
            const db = await getDb();
            db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
        });
    },
    all: (sql, params = []) => {
        return new Promise(async (resolve, reject) => {
            const db = await getDb();
            db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
        });
    },
    run: (sql, params = []) => {
        return new Promise(async (resolve, reject) => {
            const db = await getDb();
            db.run(sql, params, (err) => err ? reject(err) : resolve());
        });
    },
    exec: (sql) => {
        return new Promise(async (resolve, reject) => {
            const db = await getDb();
            db.exec(sql, (err) => err ? reject(err) : resolve());
        });
    }
};
async function ensureVectorTable(dimensions) {
    if (currentVectorDims === dimensions) {
        return;
    }
    // Drop existing vector table if dimensions change
    if (currentVectorDims && currentVectorDims !== dimensions) {
        try {
            await exports.dbOps.exec(`DROP TABLE IF EXISTS memory_chunks_vec`);
            await exports.dbOps.exec(`DROP TABLE IF EXISTS semantic_cache_vec`);
        }
        catch (err) {
            console.warn('Failed to drop vector tables', err);
        }
    }
    await exports.dbOps.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_chunks_vec USING vec0(
      id TEXT PRIMARY KEY,
      embedding float[${dimensions}]
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS semantic_cache_vec USING vec0(
      id TEXT PRIMARY KEY,
      embedding float[${dimensions}]
    );
  `);
    currentVectorDims = dimensions;
}

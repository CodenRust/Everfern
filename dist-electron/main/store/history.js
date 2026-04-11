"use strict";
/**
 * EverFern Desktop — Chat History Store
 *
 * Persists conversation history to ~/.everfern/store/conversations/
 * Each conversation is saved as a separate JSON file.
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
exports.ChatHistoryStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const CONVERSATIONS_DIR = path.join(os.homedir(), '.everfern', 'conversations');
const TIMELINE_DIR = path.join(os.homedir(), '.everfern', 'timeline');
function ensureDir() {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
        fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
    }
    if (!fs.existsSync(TIMELINE_DIR)) {
        fs.mkdirSync(TIMELINE_DIR, { recursive: true });
    }
}
class ChatHistoryStore {
    constructor() {
        ensureDir();
    }
    /**
     * List all conversations (summary only, no messages).
     * Sorted by updatedAt descending (newest first).
     */
    list() {
        ensureDir();
        try {
            const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
            const summaries = [];
            for (const file of files) {
                try {
                    const raw = fs.readFileSync(path.join(CONVERSATIONS_DIR, file), 'utf-8');
                    const conv = JSON.parse(raw);
                    summaries.push({
                        id: conv.id,
                        title: conv.title,
                        provider: conv.provider,
                        messageCount: conv.messages.length,
                        createdAt: conv.createdAt,
                        updatedAt: conv.updatedAt,
                    });
                }
                catch {
                    // Skip corrupted files
                }
            }
            return summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        catch (err) {
            console.error('[History] Failed to list conversations:', err);
            return [];
        }
    }
    /**
     * Load a full conversation by ID.
     */
    load(id) {
        try {
            const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
            if (!fs.existsSync(filePath))
                return null;
            const raw = fs.readFileSync(filePath, 'utf-8');
            const conv = JSON.parse(raw);
            const timelineFolderPath = path.join(TIMELINE_DIR, id);
            if (fs.existsSync(timelineFolderPath)) {
                conv.messages.forEach(msg => {
                    if (msg.hasTimeline && msg.id) {
                        const tlPath = path.join(timelineFolderPath, `${msg.id}.json`);
                        if (fs.existsSync(tlPath)) {
                            try {
                                const tlRaw = fs.readFileSync(tlPath, 'utf-8');
                                const tlData = JSON.parse(tlRaw);
                                msg.thought = tlData.thought;
                                msg.toolCalls = tlData.toolCalls;
                            }
                            catch (e) {
                                console.warn(`[History] Failed to parse timeline data for ${msg.id}`);
                            }
                        }
                    }
                });
            }
            return conv;
        }
        catch (err) {
            console.error(`[History] Failed to load conversation ${id}:`, err);
            return null;
        }
    }
    /**
     * Save a conversation (create or update).
     */
    save(conversation) {
        ensureDir();
        try {
            const clonedConv = JSON.parse(JSON.stringify(conversation));
            let hasAnyTimeline = false;
            const timelineFolderPath = path.join(TIMELINE_DIR, clonedConv.id);
            clonedConv.messages.forEach((msg) => {
                if (msg.thought || (msg.toolCalls && msg.toolCalls.length > 0)) {
                    if (!hasAnyTimeline) {
                        hasAnyTimeline = true;
                        if (!fs.existsSync(timelineFolderPath))
                            fs.mkdirSync(timelineFolderPath, { recursive: true });
                    }
                    if (!msg.id)
                        msg.id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    const tlData = {
                        thought: msg.thought,
                        toolCalls: msg.toolCalls
                    };
                    const tlPath = path.join(timelineFolderPath, `${msg.id}.json`);
                    fs.writeFileSync(tlPath, JSON.stringify(tlData, null, 2));
                    msg.hasTimeline = true;
                    delete msg.thought;
                    delete msg.toolCalls;
                }
            });
            const filePath = path.join(CONVERSATIONS_DIR, `${clonedConv.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(clonedConv, null, 2));
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[History] Failed to save conversation:`, msg);
            return { success: false, error: msg };
        }
    }
    /**
     * Delete a conversation by ID.
     */
    delete(id) {
        try {
            const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            const timelineFolderPath = path.join(TIMELINE_DIR, id);
            if (fs.existsSync(timelineFolderPath)) {
                fs.rmSync(timelineFolderPath, { recursive: true, force: true });
            }
            return { success: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[History] Failed to delete conversation ${id}:`, msg);
            return { success: false, error: msg };
        }
    }
}
exports.ChatHistoryStore = ChatHistoryStore;

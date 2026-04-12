"use strict";
/**
 * HITL (Human-in-the-Loop) Storage
 *
 * Stores HITL approval requests and responses in ~/.everfern/hitl/
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
exports.saveHitlRequest = saveHitlRequest;
exports.saveHitlResponse = saveHitlResponse;
exports.getHitlRecord = getHitlRecord;
exports.listHitlRecords = listHitlRecords;
exports.getHitlStats = getHitlStats;
exports.deleteConversationHitl = deleteConversationHitl;
exports.exportHitlSummary = exportHitlSummary;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const getHitlDir = () => {
    const dir = path.join(os.homedir(), '.everfern', 'hitl');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};
const getConversationHitlDir = (conversationId) => {
    const dir = path.join(getHitlDir(), conversationId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};
/**
 * Save a HITL request
 */
function saveHitlRequest(request) {
    try {
        const dir = getConversationHitlDir(request.conversationId);
        const filePath = path.join(dir, `${request.id}.json`);
        const record = {
            request,
            status: 'pending'
        };
        fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
        console.log(`[HITL Storage] Saved request: ${request.id}`);
    }
    catch (err) {
        console.error('[HITL Storage] Failed to save request:', err);
    }
}
/**
 * Save a HITL response
 */
function saveHitlResponse(response) {
    try {
        const dir = getConversationHitlDir(response.conversationId);
        const filePath = path.join(dir, `${response.requestId}.json`);
        // Load existing record
        let record;
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            record = JSON.parse(data);
        }
        else {
            console.warn(`[HITL Storage] Request ${response.requestId} not found, creating new record`);
            record = {
                request: {
                    id: response.requestId,
                    conversationId: response.conversationId,
                    timestamp: response.timestamp,
                    question: '',
                    details: { tools: [], summary: '', reasoning: '' },
                    options: []
                },
                status: 'pending'
            };
        }
        // Update with response
        record.response = response;
        record.status = response.approved ? 'approved' : 'rejected';
        fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
        console.log(`[HITL Storage] Saved response: ${response.id} (${record.status})`);
    }
    catch (err) {
        console.error('[HITL Storage] Failed to save response:', err);
    }
}
/**
 * Get a HITL record by request ID
 */
function getHitlRecord(conversationId, requestId) {
    try {
        const dir = getConversationHitlDir(conversationId);
        const filePath = path.join(dir, `${requestId}.json`);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    catch (err) {
        console.error('[HITL Storage] Failed to get record:', err);
        return null;
    }
}
/**
 * List all HITL records for a conversation
 */
function listHitlRecords(conversationId) {
    try {
        const dir = getConversationHitlDir(conversationId);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const records = [];
        for (const file of files) {
            const filePath = path.join(dir, file);
            const data = fs.readFileSync(filePath, 'utf-8');
            records.push(JSON.parse(data));
        }
        // Sort by timestamp (newest first)
        records.sort((a, b) => new Date(b.request.timestamp).getTime() - new Date(a.request.timestamp).getTime());
        return records;
    }
    catch (err) {
        console.error('[HITL Storage] Failed to list records:', err);
        return [];
    }
}
/**
 * Get HITL statistics for a conversation
 */
function getHitlStats(conversationId) {
    const records = listHitlRecords(conversationId);
    return {
        total: records.length,
        pending: records.filter(r => r.status === 'pending').length,
        approved: records.filter(r => r.status === 'approved').length,
        rejected: records.filter(r => r.status === 'rejected').length,
    };
}
/**
 * Delete all HITL records for a conversation
 */
function deleteConversationHitl(conversationId) {
    try {
        const dir = getConversationHitlDir(conversationId);
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`[HITL Storage] Deleted all records for conversation: ${conversationId}`);
        }
    }
    catch (err) {
        console.error('[HITL Storage] Failed to delete conversation records:', err);
    }
}
/**
 * Export HITL records to a summary file
 */
function exportHitlSummary(conversationId) {
    const records = listHitlRecords(conversationId);
    const stats = getHitlStats(conversationId);
    let summary = `# HITL Approval Summary\n\n`;
    summary += `**Conversation ID:** ${conversationId}\n`;
    summary += `**Generated:** ${new Date().toISOString()}\n\n`;
    summary += `## Statistics\n\n`;
    summary += `- Total Requests: ${stats.total}\n`;
    summary += `- Approved: ${stats.approved}\n`;
    summary += `- Rejected: ${stats.rejected}\n`;
    summary += `- Pending: ${stats.pending}\n\n`;
    summary += `## Detailed Records\n\n`;
    for (const record of records) {
        summary += `### Request ${record.request.id}\n\n`;
        summary += `**Timestamp:** ${record.request.timestamp}\n`;
        summary += `**Status:** ${record.status}\n`;
        summary += `**Question:** ${record.request.question}\n`;
        summary += `**Reasoning:** ${record.request.details.reasoning}\n`;
        summary += `**Tools:** ${record.request.details.summary}\n\n`;
        if (record.response) {
            summary += `**Response Timestamp:** ${record.response.timestamp}\n`;
            summary += `**Decision:** ${record.response.approved ? 'APPROVED' : 'REJECTED'}\n`;
            summary += `**Response:** ${record.response.response}\n\n`;
        }
        else {
            summary += `**Response:** Pending\n\n`;
        }
        summary += `---\n\n`;
    }
    return summary;
}

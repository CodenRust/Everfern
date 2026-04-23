"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHistoryHandlers = registerHistoryHandlers;
const electron_1 = require("electron");
const hitl_1 = require("../store/hitl");
function registerHistoryHandlers(historyStore) {
    electron_1.ipcMain.handle('history:list', async () => {
        return await historyStore.list();
    });
    electron_1.ipcMain.handle('history:load', async (_event, id) => {
        const conv = await historyStore.load(id);
        return conv ?? { error: 'Not found' };
    });
    electron_1.ipcMain.handle('history:save', async (_event, conv) => {
        return await historyStore.save(conv);
    });
    electron_1.ipcMain.handle('history:delete', async (_event, id) => {
        return await historyStore.delete(id);
    });
    // ── HITL Persistence ─────────────────────────────────────────────
    // Returns the most recent pending HITL request for a conversation, or null.
    electron_1.ipcMain.handle('hitl:get-pending', async (_event, conversationId) => {
        try {
            const records = (0, hitl_1.listHitlRecords)(conversationId);
            const pending = records.find(r => r.status === 'pending');
            return pending ?? null;
        }
        catch {
            return null;
        }
    });
    // Mark a HITL request as resolved (approved or rejected) on disk.
    electron_1.ipcMain.handle('hitl:resolve', async (_event, conversationId, requestId, approved) => {
        try {
            (0, hitl_1.saveHitlResponse)({
                id: `resp-${Date.now()}`,
                requestId,
                conversationId,
                timestamp: new Date().toISOString(),
                approved,
                response: approved ? '[HITL_APPROVED]' : '[HITL_REJECTED]',
            });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
}

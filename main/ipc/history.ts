import { ipcMain } from 'electron';
import { ChatHistoryStore } from '../store/history';
import { listHitlRecords, saveHitlResponse } from '../store/hitl';

export function registerHistoryHandlers(historyStore: ChatHistoryStore) {
  ipcMain.handle('history:list', async () => {
    return await historyStore.list();
  });

  ipcMain.handle('history:load', async (_event, id: string) => {
    const conv = await historyStore.load(id);
    return conv ?? { error: 'Not found' };
  });

  ipcMain.handle('history:save', async (_event, conv) => {
    return await historyStore.save(conv);
  });

  ipcMain.handle('history:delete', async (_event, id: string) => {
    return await historyStore.delete(id);
  });

  // ── HITL Persistence ─────────────────────────────────────────────
  // Returns the most recent pending HITL request for a conversation, or null.
  ipcMain.handle('hitl:get-pending', async (_event, conversationId: string) => {
    try {
      const records = listHitlRecords(conversationId);
      const pending = records.find(r => r.status === 'pending');
      return pending ?? null;
    } catch {
      return null;
    }
  });

  // Mark a HITL request as resolved (approved or rejected) on disk.
  ipcMain.handle('hitl:resolve', async (_event, conversationId: string, requestId: string, approved: boolean) => {
    try {
      saveHitlResponse({
        id: `resp-${Date.now()}`,
        requestId,
        conversationId,
        timestamp: new Date().toISOString(),
        approved,
        response: approved ? '[HITL_APPROVED]' : '[HITL_REJECTED]',
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}

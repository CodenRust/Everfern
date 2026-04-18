import { ipcMain } from 'electron';
import { ChatHistoryStore } from '../store/history';

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
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerHistoryHandlers = registerHistoryHandlers;
const electron_1 = require("electron");
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
}

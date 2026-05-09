"use strict";
/**
 * EverFern Desktop — Scheduled Tasks IPC Handlers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupScheduledTasksIPC = setupScheduledTasksIPC;
const electron_1 = require("electron");
const scheduled_tasks_1 = require("../store/scheduled-tasks");
function setupScheduledTasksIPC() {
    electron_1.ipcMain.handle('scheduled-tasks:list', async (_event, projectId) => {
        try {
            return await scheduled_tasks_1.scheduledTasksStore.list(projectId);
        }
        catch (err) {
            console.error('[IPC] Failed to list scheduled tasks:', err);
            return [];
        }
    });
    electron_1.ipcMain.handle('scheduled-tasks:get', async (_event, id) => {
        try {
            return await scheduled_tasks_1.scheduledTasksStore.get(id);
        }
        catch (err) {
            console.error(`[IPC] Failed to get scheduled task ${id}:`, err);
            return null;
        }
    });
    electron_1.ipcMain.handle('scheduled-tasks:save', async (_event, task) => {
        try {
            return await scheduled_tasks_1.scheduledTasksStore.save(task);
        }
        catch (err) {
            console.error('[IPC] Failed to save scheduled task:', err);
            throw err;
        }
    });
    electron_1.ipcMain.handle('scheduled-tasks:delete', async (_event, id) => {
        try {
            await scheduled_tasks_1.scheduledTasksStore.delete(id);
            return { success: true };
        }
        catch (err) {
            console.error(`[IPC] Failed to delete scheduled task ${id}:`, err);
            return { success: false, error: String(err) };
        }
    });
}

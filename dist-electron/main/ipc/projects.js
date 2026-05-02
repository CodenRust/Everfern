"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProjectsHandlers = registerProjectsHandlers;
const electron_1 = require("electron");
const projects_1 = require("../store/projects/projects");
function registerProjectsHandlers() {
    electron_1.ipcMain.handle('projects:list', async () => {
        return projects_1.projectsStore.list();
    });
    electron_1.ipcMain.handle('projects:create', async (_event, data) => {
        return projects_1.projectsStore.create(data);
    });
    electron_1.ipcMain.handle('projects:delete', async (_event, id) => {
        return projects_1.projectsStore.delete(id);
    });
    electron_1.ipcMain.handle('projects:getDefaultPath', async () => {
        const { app } = require('electron');
        const path = require('path');
        return path.join(app.getPath('documents'), 'Everfern', 'Projects');
    });
    electron_1.ipcMain.handle('projects:selectFolder', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    electron_1.ipcMain.handle('projects:selectFiles', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections']
        });
        if (result.canceled || result.filePaths.length === 0)
            return [];
        return result.filePaths;
    });
}

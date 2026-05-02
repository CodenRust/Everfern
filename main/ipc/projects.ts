import { ipcMain } from 'electron';
import { projectsStore } from '../store/projects/projects';

export function registerProjectsHandlers() {
  ipcMain.handle('projects:list', async () => {
    return projectsStore.list();
  });

  ipcMain.handle('projects:create', async (_event, data: { name: string; instructions?: string; path: string }) => {
    return projectsStore.create(data);
  });

  ipcMain.handle('projects:delete', async (_event, id: string) => {
    return projectsStore.delete(id);
  });

  ipcMain.handle('projects:getDefaultPath', async () => {
    const { app } = require('electron');
    const path = require('path');
    return path.join(app.getPath('documents'), 'Everfern', 'Projects');
  });

  ipcMain.handle('projects:selectFolder', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('projects:selectFiles', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });
}

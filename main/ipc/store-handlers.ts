import { ipcMain } from 'electron';
import { listArtifacts, readArtifact, writeArtifact, deleteArtifact } from '../store/artifacts';
import { listPlans, readPlan, writePlan, deletePlan } from '../store/plans';
import { listSites, readSiteFile, writeSiteFile, deleteSite } from '../store/sites';

export function registerStoreHandlers() {
  // Artifacts
  ipcMain.handle('artifacts:list', (_e, chatId?: string) => listArtifacts(chatId));
  ipcMain.handle('artifacts:read', (_e, chatId: string, filename: string) => readArtifact(chatId, filename));
  ipcMain.handle('artifacts:write', (_e, chatId: string, filename: string, content: string) => writeArtifact(chatId, filename, content));
  ipcMain.handle('artifacts:delete', (_e, chatId: string, filename: string) => deleteArtifact(chatId, filename));

  // Plans
  ipcMain.handle('plans:list', (_e, chatId: string) => listPlans(chatId));
  ipcMain.handle('plans:read', (_e, chatId: string, filename: string) => readPlan(chatId, filename));
  ipcMain.handle('plans:write', (_e, chatId: string, filename: string, content: string) => writePlan(chatId, filename, content));
  ipcMain.handle('plans:delete', (_e, chatId: string, filename: string) => deletePlan(chatId, filename));

  // Sites
  ipcMain.handle('sites:list', () => listSites());
  ipcMain.handle('sites:read-file', (_e, siteName: string, filePath: string) => readSiteFile(siteName, filePath));
  ipcMain.handle('sites:write-file', (_e, siteName: string, filePath: string, content: string) => writeSiteFile(siteName, filePath, content));
  ipcMain.handle('sites:delete', (_e, name: string) => deleteSite(name));
}

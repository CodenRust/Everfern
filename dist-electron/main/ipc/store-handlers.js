"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStoreHandlers = registerStoreHandlers;
const electron_1 = require("electron");
const artifacts_1 = require("../store/artifacts");
const plans_1 = require("../store/plans");
const sites_1 = require("../store/sites");
function registerStoreHandlers() {
    // Artifacts
    electron_1.ipcMain.handle('artifacts:list', (_e, chatId) => (0, artifacts_1.listArtifacts)(chatId));
    electron_1.ipcMain.handle('artifacts:read', (_e, chatId, filename) => (0, artifacts_1.readArtifact)(chatId, filename));
    electron_1.ipcMain.handle('artifacts:write', (_e, chatId, filename, content) => (0, artifacts_1.writeArtifact)(chatId, filename, content));
    electron_1.ipcMain.handle('artifacts:delete', (_e, chatId, filename) => (0, artifacts_1.deleteArtifact)(chatId, filename));
    // Plans
    electron_1.ipcMain.handle('plans:list', (_e, chatId) => (0, plans_1.listPlans)(chatId));
    electron_1.ipcMain.handle('plans:read', (_e, chatId, filename) => (0, plans_1.readPlan)(chatId, filename));
    electron_1.ipcMain.handle('plans:write', (_e, chatId, filename, content) => (0, plans_1.writePlan)(chatId, filename, content));
    electron_1.ipcMain.handle('plans:delete', (_e, chatId, filename) => (0, plans_1.deletePlan)(chatId, filename));
    // Sites
    electron_1.ipcMain.handle('sites:list', () => (0, sites_1.listSites)());
    electron_1.ipcMain.handle('sites:read-file', (_e, siteName, filePath) => (0, sites_1.readSiteFile)(siteName, filePath));
    electron_1.ipcMain.handle('sites:write-file', (_e, siteName, filePath, content) => (0, sites_1.writeSiteFile)(siteName, filePath, content));
    electron_1.ipcMain.handle('sites:delete', (_e, name) => (0, sites_1.deleteSite)(name));
}

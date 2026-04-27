"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolSettingsHandlers = registerToolSettingsHandlers;
const electron_1 = require("electron");
const tool_settings_1 = require("../store/tool-settings");
function registerToolSettingsHandlers() {
    electron_1.ipcMain.handle('tool-settings:get', () => tool_settings_1.toolSettingsStore.get());
    electron_1.ipcMain.handle('tool-settings:set', (_e, config) => {
        tool_settings_1.toolSettingsStore.set(config);
        return { success: true };
    });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBrowserUseHandlers = registerBrowserUseHandlers;
const electron_1 = require("electron");
const browser_use_1 = require("../agent/tools/browser-use");
function registerBrowserUseHandlers() {
    electron_1.ipcMain.handle('debug:open-browser', async () => {
        try {
            await (0, browser_use_1.openDebugBrowser)();
            return { success: true };
        }
        catch (error) {
            console.error('[IPC] Failed to open debug browser:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });
}

import { ipcMain } from 'electron';
import { openDebugBrowser } from '../agent/tools/browser-use';

export function registerBrowserUseHandlers() {
  ipcMain.handle('debug:open-browser', async () => {
    try {
      await openDebugBrowser();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Failed to open debug browser:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  });
}

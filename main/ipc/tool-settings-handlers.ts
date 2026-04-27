import { ipcMain } from 'electron';
import { toolSettingsStore, ToolSettingsConfig } from '../store/tool-settings';

export function registerToolSettingsHandlers(): void {
  ipcMain.handle('tool-settings:get', () => toolSettingsStore.get());
  ipcMain.handle('tool-settings:set', (_e, config: ToolSettingsConfig) => {
    toolSettingsStore.set(config);
    return { success: true };
  });
}

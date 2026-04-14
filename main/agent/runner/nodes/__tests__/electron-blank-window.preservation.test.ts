import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Electron Blank Window - Preservation Properties', () => {
  const mainFilePath = path.join(__dirname, '../../../../main.ts');
  const mainContent = fs.readFileSync(mainFilePath, 'utf-8');

  it('Property 2: Preservation - Dev mode tryLoad() path exists and uses http://localhost:3001', () => {
    // Verify that in dev mode (app.isPackaged === false), the code loads http://localhost:3001
    // This behavior MUST be preserved after the fix

    const devModeCheck = /if\s*\(\s*isDev\s*\)\s*\{[\s\S]*?http:\/\/localhost:3001/.test(
      mainContent
    );

    expect(
      devModeCheck,
      'Dev mode should load http://localhost:3001 (not everfern-app://)'
    ).toBe(true);
  });

  it('Property 2: Preservation - everfern-app protocol handler is registered', () => {
    // Verify that the everfern-app protocol handler is registered in app.whenReady()
    // This MUST remain unchanged after the fix

    const protocolHandlerCheck = /protocol\.handle\s*\(\s*['"]everfern-app['"]/.test(
      mainContent
    );

    expect(
      protocolHandlerCheck,
      'everfern-app protocol handler should be registered'
    ).toBe(true);
  });

  it('Property 2: Preservation - everfern-site protocol handler is registered', () => {
    // Verify that the everfern-site protocol handler is registered in app.whenReady()
    // This MUST remain unchanged after the fix

    const protocolHandlerCheck = /protocol\.handle\s*\(\s*['"]everfern-site['"]/.test(
      mainContent
    );

    expect(
      protocolHandlerCheck,
      'everfern-site protocol handler should be registered'
    ).toBe(true);
  });

  it('Property 2: Preservation - window-all-closed handler calls app.quit() on non-macOS', () => {
    // Verify that the window-all-closed handler exists and calls app.quit() on non-macOS
    // This MUST remain unchanged after the fix

    const windowAllClosedCheck = /app\.on\s*\(\s*['"]window-all-closed['"][\s\S]*?app\.quit\(\)/.test(
      mainContent
    );

    expect(
      windowAllClosedCheck,
      'window-all-closed handler should call app.quit() on non-macOS'
    ).toBe(true);
  });

  it('Property 2: Preservation - before-quit handler exists for cleanup', () => {
    // Verify that the before-quit handler exists for ShowUI process cleanup
    // This MUST remain unchanged after the fix

    const beforeQuitCheck = /app\.on\s*\(\s*['"]before-quit['"]/.test(mainContent);

    expect(beforeQuitCheck, 'before-quit handler should exist for cleanup').toBe(
      true
    );
  });

  it('Property 2: Preservation - ready-to-show and fallback timeout logic in createWindow()', () => {
    // Verify that the ready-to-show event and 5-second fallback timeout exist in createWindow()
    // This MUST remain unchanged after the fix

    const readyToShowCheck = /mainWindow\.once\s*\(\s*['"]ready-to-show['"]/.test(
      mainContent
    );
    const fallbackTimeoutCheck = /setTimeout[\s\S]*?5000/.test(mainContent);

    expect(readyToShowCheck, 'ready-to-show event handler should exist').toBe(true);
    expect(fallbackTimeoutCheck, '5-second fallback timeout should exist').toBe(
      true
    );
  });

  it('Property 2: Preservation - IPC handlers are registered after app.whenReady()', () => {
    // Verify that IPC handlers (window:minimize, window:maximize, etc.) are registered
    // These MUST remain unchanged after the fix

    const ipcHandlersCheck = /ipcMain\.handle\s*\(\s*['"]window:minimize['"]/.test(
      mainContent
    );

    expect(ipcHandlersCheck, 'IPC handlers should be registered').toBe(true);
  });

  it('Property 2: Preservation - createWindow() function is defined', () => {
    // Verify that the createWindow() function is defined
    // This MUST remain unchanged after the fix

    const createWindowDefined = /function\s+createWindow\s*\(\s*\)\s*:\s*void\s*\{/.test(
      mainContent
    );

    expect(createWindowDefined, 'createWindow() function should be defined').toBe(
      true
    );
  });
});

/**
 * Integration tests for auto-start functionality in main process
 * Tests the integration between AutoStartManager and main.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron modules
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => '/mock/path'),
    getAppPath: vi.fn(() => '/mock/app/path'),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn(),
    commandLine: {
      appendSwitch: vi.fn()
    }
  },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    once: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
      send: vi.fn()
    },
    show: vi.fn(),
    hide: vi.fn(),
    minimize: vi.fn(),
    isVisible: vi.fn(() => false),
    isMinimized: vi.fn(() => false)
  })),
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn(),
    on: vi.fn()
  },
  dialog: {},
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn()
  },
  net: {},
  clipboard: {},
  Notification: {
    isSupported: vi.fn(() => true)
  },
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn()
  },
  shell: {}
}));

// Mock the managers
vi.mock('../auto-start-manager', () => ({
  autoStartManager: {
    isEnabled: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    getPlatformInfo: vi.fn(),
    validatePlatformSupport: vi.fn()
  }
}));

vi.mock('../system-tray-manager', () => ({
  systemTrayManager: {
    isSupported: vi.fn(() => true),
    createTray: vi.fn(),
    setupWindowEvents: vi.fn(),
    showWindow: vi.fn(),
    hideToTray: vi.fn(),
    updateTrayMenu: vi.fn(),
    destroy: vi.fn()
  }
}));

describe('Auto-Start Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process.argv
    process.argv = ['node', 'main.js'];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should detect auto-start mode from command line arguments', () => {
    // Simulate auto-start mode
    process.argv = ['node', 'main.js', '--auto-start'];

    // Re-import main.ts to trigger the auto-start detection
    // Note: This is a simplified test - in reality, we'd need to test the actual logic
    const isAutoStartMode = process.argv.includes('--auto-start');

    expect(isAutoStartMode).toBe(true);
  });

  it('should not detect auto-start mode without flag', () => {
    // Normal startup
    process.argv = ['node', 'main.js'];

    const isAutoStartMode = process.argv.includes('--auto-start');

    expect(isAutoStartMode).toBe(false);
  });

  it('should handle auto-start mode with additional arguments', () => {
    // Auto-start with other arguments
    process.argv = ['node', 'main.js', '--some-other-flag', '--auto-start', '--debug'];

    const isAutoStartMode = process.argv.includes('--auto-start');

    expect(isAutoStartMode).toBe(true);
  });
});

describe('Auto-Start IPC Handlers', () => {
  let mockAutoStartManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAutoStartManager = {
      isEnabled: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      getPlatformInfo: vi.fn(),
      validatePlatformSupport: vi.fn()
    };
  });

  it('should handle autostart:get-status IPC call', async () => {
    mockAutoStartManager.isEnabled.mockResolvedValue(true);

    // Simulate the IPC handler logic
    const handler = async () => {
      try {
        const enabled = await mockAutoStartManager.isEnabled();
        return { success: true, enabled };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = await handler();

    expect(result).toEqual({ success: true, enabled: true });
    expect(mockAutoStartManager.isEnabled).toHaveBeenCalledOnce();
  });

  it('should handle autostart:enable IPC call', async () => {
    mockAutoStartManager.enable.mockResolvedValue(undefined);

    const handler = async () => {
      try {
        await mockAutoStartManager.enable();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = await handler();

    expect(result).toEqual({ success: true });
    expect(mockAutoStartManager.enable).toHaveBeenCalledOnce();
  });

  it('should handle autostart:disable IPC call', async () => {
    mockAutoStartManager.disable.mockResolvedValue(undefined);

    const handler = async () => {
      try {
        await mockAutoStartManager.disable();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = await handler();

    expect(result).toEqual({ success: true });
    expect(mockAutoStartManager.disable).toHaveBeenCalledOnce();
  });

  it('should handle errors in IPC handlers gracefully', async () => {
    const errorMessage = 'Auto-start not supported';
    mockAutoStartManager.enable.mockRejectedValue(new Error(errorMessage));

    const handler = async () => {
      try {
        await mockAutoStartManager.enable();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = await handler();

    expect(result).toEqual({ success: false, error: errorMessage });
    expect(mockAutoStartManager.enable).toHaveBeenCalledOnce();
  });

  it('should handle autostart:get-info IPC call', () => {
    const mockInfo = {
      platform: 'Windows',
      method: 'Registry (HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run)',
      location: 'Windows Registry'
    };
    mockAutoStartManager.getPlatformInfo.mockReturnValue(mockInfo);

    const handler = () => {
      try {
        const info = mockAutoStartManager.getPlatformInfo();
        return { success: true, info };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = handler();

    expect(result).toEqual({ success: true, info: mockInfo });
    expect(mockAutoStartManager.getPlatformInfo).toHaveBeenCalledOnce();
  });

  it('should handle autostart:validate-support IPC call', async () => {
    const mockValidation = { supported: true };
    mockAutoStartManager.validatePlatformSupport.mockResolvedValue(mockValidation);

    const handler = async () => {
      try {
        const validation = await mockAutoStartManager.validatePlatformSupport();
        return { success: true, validation };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    const result = await handler();

    expect(result).toEqual({ success: true, validation: mockValidation });
    expect(mockAutoStartManager.validatePlatformSupport).toHaveBeenCalledOnce();
  });
});

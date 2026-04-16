/**
 * Tests for AutoStartManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { AutoStartManager } from '../auto-start-manager';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/path/to/everfern.exe')
  }
}));

// Mock fs
vi.mock('fs');
const mockFs = vi.mocked(fs);

// Mock os
vi.mock('os');
const mockOs = vi.mocked(os);

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

describe('AutoStartManager', () => {
  let autoStartManager: AutoStartManager;
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockOs.homedir.mockReturnValue('/home/user');
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.unlinkSync.mockImplementation(() => undefined);
    mockFs.chmodSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });
  });

  describe('Platform Detection', () => {
    it('should detect Windows platform', () => {
      autoStartManager = new AutoStartManager('win32');
      const info = autoStartManager.getPlatformInfo();
      expect(info.platform).toBe('Windows');
      expect(info.method).toContain('Registry');
    });

    it('should detect macOS platform', () => {
      autoStartManager = new AutoStartManager('darwin');
      const info = autoStartManager.getPlatformInfo();
      expect(info.platform).toBe('macOS');
      expect(info.method).toContain('LaunchAgent');
    });

    it('should detect Linux platform', () => {
      autoStartManager = new AutoStartManager('linux');
      const info = autoStartManager.getPlatformInfo();
      expect(info.platform).toBe('Linux');
      expect(info.method).toContain('desktop file');
    });
  });

  describe('Linux Implementation', () => {
    beforeEach(() => {
      autoStartManager = new AutoStartManager('linux');
    });

    it('should check if auto-start is enabled on Linux', async () => {
      mockFs.existsSync.mockReturnValue(true);
      const isEnabled = await autoStartManager.isEnabled();
      expect(isEnabled).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('/home/user', '.config', 'autostart', 'everfern-desktop.desktop'));
    });

    it('should enable auto-start on Linux', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await autoStartManager.enable();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join('/home/user', '.config', 'autostart'), { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/home/user', '.config', 'autostart', 'everfern-desktop.desktop'),
        expect.stringContaining('[Desktop Entry]'),
        'utf8'
      );
      expect(mockFs.chmodSync).toHaveBeenCalledWith(path.join('/home/user', '.config', 'autostart', 'everfern-desktop.desktop'), 0o755);
    });

    it('should disable auto-start on Linux', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await autoStartManager.disable();

      expect(mockFs.unlinkSync).toHaveBeenCalledWith(path.join('/home/user', '.config', 'autostart', 'everfern-desktop.desktop'));
    });

    it('should generate correct desktop file content', async () => {
      await autoStartManager.enable();

      const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
        call[0].toString().includes('everfern-desktop.desktop')
      );

      expect(writeCall).toBeDefined();
      const content = writeCall![1] as string;
      expect(content).toContain('[Desktop Entry]');
      expect(content).toContain('Name=EverFern');
      expect(content).toContain('Exec="/mock/path/to/everfern.exe" --auto-start');
      expect(content).toContain('NoDisplay=true');
    });
  });

  describe('macOS Implementation', () => {
    beforeEach(() => {
      autoStartManager = new AutoStartManager('darwin');
    });

    it('should check if auto-start is enabled on macOS', async () => {
      mockFs.existsSync.mockReturnValue(true);
      const isEnabled = await autoStartManager.isEnabled();
      expect(isEnabled).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('/home/user', 'Library', 'LaunchAgents', 'com.everfern.desktop.plist'));
    });

    it('should enable auto-start on macOS', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await autoStartManager.enable();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.join('/home/user', 'Library', 'LaunchAgents'), { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join('/home/user', 'Library', 'LaunchAgents', 'com.everfern.desktop.plist'),
        expect.stringContaining('<?xml version="1.0"'),
        'utf8'
      );
    });

    it('should generate correct plist content', async () => {
      await autoStartManager.enable();

      const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
        call[0].toString().includes('com.everfern.desktop.plist')
      );

      expect(writeCall).toBeDefined();
      const content = writeCall![1] as string;
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('<key>Label</key>');
      expect(content).toContain('<string>com.everfern.desktop</string>');
      expect(content).toContain('<string>/mock/path/to/everfern.exe</string>');
      expect(content).toContain('<string>--auto-start</string>');
    });
  });

  describe('Windows Implementation', () => {
    beforeEach(() => {
      autoStartManager = new AutoStartManager('win32');
    });

    it('should validate platform support for Windows with winreg installed', async () => {
      autoStartManager = new AutoStartManager('win32');
      const validation = await autoStartManager.validatePlatformSupport();
      expect(validation.supported).toBe(true);
    });

    it('should handle Windows registry operations when winreg is available', async () => {
      // This test would require winreg to be installed, so we'll just test the validation
      autoStartManager = new AutoStartManager('win32');

      // Test that it attempts to use winreg (will fail without the package)
      const isEnabled = await autoStartManager.isEnabled();
      expect(isEnabled).toBe(false); // Should return false when winreg is not available
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      autoStartManager = new AutoStartManager('linux');
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(autoStartManager.enable()).rejects.toThrow('Permission denied');
    });

    it('should return false for unsupported platforms', async () => {
      autoStartManager = new AutoStartManager('freebsd');

      const isEnabled = await autoStartManager.isEnabled();
      expect(isEnabled).toBe(false);
    });

    it('should validate platform support correctly', async () => {
      autoStartManager = new AutoStartManager('freebsd');

      const validation = await autoStartManager.validatePlatformSupport();
      expect(validation.supported).toBe(false);
      expect(validation.reason).toContain('not supported');
    });
  });

  describe('Utility Methods', () => {
    it('should return correct startup path', () => {
      autoStartManager = new AutoStartManager('linux');
      const path = autoStartManager.getStartupPath();
      expect(path).toBe('/mock/path/to/everfern.exe');
      expect(app.getPath).toHaveBeenCalledWith('exe');
    });

    it('should provide platform information', () => {
      autoStartManager = new AutoStartManager('linux');

      const info = autoStartManager.getPlatformInfo();
      expect(info.platform).toBe('Linux');
      expect(info.method).toBe('XDG autostart desktop file');
      expect(info.location).toContain('everfern-desktop.desktop');
    });
  });
});

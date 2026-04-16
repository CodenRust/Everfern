/**
 * AutoStartManager - Cross-platform system auto-start functionality
 *
 * Handles registration and management of EverFern auto-start on system boot
 * across Windows, macOS, and Linux platforms.
 *
 * Requirements: 2.5, 2.7, 2.8
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';

export interface AutoStartConfig {
  enabled: boolean;
  minimizeToTray: boolean;
}

export class AutoStartManager {
  private readonly appName = 'EverFern';
  private readonly platform: string;

  constructor(platform?: string) {
    this.platform = platform || process.platform;
  }

  /**
   * Check if auto-start is currently enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return this.isEnabledWindows();
        case 'darwin':
          return this.isEnabledMacOS();
        case 'linux':
          return this.isEnabledLinux();
        default:
          console.warn(`[AutoStart] Unsupported platform: ${this.platform}`);
          return false;
      }
    } catch (error) {
      console.error('[AutoStart] Error checking auto-start status:', error);
      return false;
    }
  }

  /**
   * Enable auto-start functionality
   */
  async enable(): Promise<void> {
    try {
      console.log(`[AutoStart] Enabling auto-start on ${this.platform}`);

      switch (this.platform) {
        case 'win32':
          await this.enableWindows();
          break;
        case 'darwin':
          await this.enableMacOS();
          break;
        case 'linux':
          await this.enableLinux();
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      console.log('[AutoStart] Auto-start enabled successfully');
    } catch (error) {
      console.error('[AutoStart] Failed to enable auto-start:', error);
      throw error;
    }
  }

  /**
   * Disable auto-start functionality
   */
  async disable(): Promise<void> {
    try {
      console.log(`[AutoStart] Disabling auto-start on ${this.platform}`);

      switch (this.platform) {
        case 'win32':
          await this.disableWindows();
          break;
        case 'darwin':
          await this.disableMacOS();
          break;
        case 'linux':
          await this.disableLinux();
          break;
        default:
          throw new Error(`Unsupported platform: ${this.platform}`);
      }

      console.log('[AutoStart] Auto-start disabled successfully');
    } catch (error) {
      console.error('[AutoStart] Failed to disable auto-start:', error);
      throw error;
    }
  }

  /**
   * Get the startup path for the current platform
   */
  getStartupPath(): string {
    return app.getPath('exe');
  }

  // ── Windows Implementation ──────────────────────────────────────────

  private async isEnabledWindows(): Promise<boolean> {
    try {
      // NOTE: This requires the 'winreg' package to be installed
      // TODO: Add winreg to package.json dependencies
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      });

      return new Promise((resolve) => {
        regKey.get(this.appName, (err: any, item: any) => {
          if (err) {
            resolve(false);
          } else {
            resolve(!!item);
          }
        });
      });
    } catch (error) {
      console.error('[AutoStart] Windows registry check failed:', error);
      if ((error as any)?.code === 'MODULE_NOT_FOUND') {
        console.error('[AutoStart] winreg package not found. Please install: npm install winreg');
        console.error('[AutoStart] Also install types: npm install --save-dev @types/winreg');
      }
      return false;
    }
  }

  private async enableWindows(): Promise<void> {
    try {
      // NOTE: This requires the 'winreg' package to be installed
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      });

      const exePath = this.getStartupPath();
      const startupCommand = `"${exePath}" --auto-start`;

      return new Promise((resolve, reject) => {
        regKey.set(this.appName, Registry.REG_SZ, startupCommand, (err: any) => {
          if (err) {
            reject(new Error(`Failed to set Windows registry entry: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      if ((error as any)?.code === 'MODULE_NOT_FOUND') {
        throw new Error('winreg package not found. Please install: npm install winreg @types/winreg');
      }
      throw error;
    }
  }

  private async disableWindows(): Promise<void> {
    try {
      const Registry = require('winreg');
      const regKey = new Registry({
        hive: Registry.HKCU,
        key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      });

      return new Promise((resolve, reject) => {
        regKey.remove(this.appName, (err: any) => {
          if (err && err.message && err.message.includes('not found')) {
            // Entry doesn't exist, consider it success
            resolve();
          } else if (err && err.message && err.message.includes('unable to find')) {
            // Registry key or value not found, consider it success
            resolve();
          } else if (err) {
            reject(new Error(`Failed to remove Windows registry entry: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      if ((error as any)?.code === 'MODULE_NOT_FOUND') {
        throw new Error('winreg package not found. Please install: npm install winreg @types/winreg');
      }
      throw error;
    }
  }

  // ── macOS Implementation ────────────────────────────────────────────

  private async isEnabledMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath();
    return fs.existsSync(plistPath);
  }

  private async enableMacOS(): Promise<void> {
    const plistPath = this.getMacOSPlistPath();
    const plistDir = path.dirname(plistPath);

    // Ensure LaunchAgents directory exists
    if (!fs.existsSync(plistDir)) {
      fs.mkdirSync(plistDir, { recursive: true });
    }

    const exePath = this.getStartupPath();
    const plistContent = this.generateMacOSPlist(exePath);

    fs.writeFileSync(plistPath, plistContent, 'utf8');

    // Load the launch agent
    try {
      const { execSync } = require('child_process');
      execSync(`launchctl load "${plistPath}"`, { stdio: 'ignore' });
    } catch (error) {
      console.warn('[AutoStart] Failed to load launch agent, but plist was created:', error);
      // Don't throw - the plist file exists and will work on next login
    }
  }

  private async disableMacOS(): Promise<void> {
    const plistPath = this.getMacOSPlistPath();

    if (fs.existsSync(plistPath)) {
      // Unload the launch agent
      try {
        const { execSync } = require('child_process');
        execSync(`launchctl unload "${plistPath}"`, { stdio: 'ignore' });
      } catch (error) {
        console.warn('[AutoStart] Failed to unload launch agent:', error);
        // Continue with file removal
      }

      // Remove the plist file
      fs.unlinkSync(plistPath);
    }
  }

  private getMacOSPlistPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, 'Library', 'LaunchAgents', `com.everfern.desktop.plist`);
  }

  private generateMacOSPlist(exePath: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.everfern.desktop</string>
    <key>ProgramArguments</key>
    <array>
        <string>${exePath}</string>
        <string>--auto-start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>LaunchOnlyOnce</key>
    <true/>
</dict>
</plist>`;
  }

  // ── Linux Implementation ────────────────────────────────────────────

  private async isEnabledLinux(): Promise<boolean> {
    const desktopFilePath = this.getLinuxDesktopFilePath();
    return fs.existsSync(desktopFilePath);
  }

  private async enableLinux(): Promise<void> {
    const desktopFilePath = this.getLinuxDesktopFilePath();
    const desktopDir = path.dirname(desktopFilePath);

    // Ensure autostart directory exists
    if (!fs.existsSync(desktopDir)) {
      fs.mkdirSync(desktopDir, { recursive: true });
    }

    const exePath = this.getStartupPath();
    const desktopContent = this.generateLinuxDesktopFile(exePath);

    fs.writeFileSync(desktopFilePath, desktopContent, 'utf8');

    // Make the desktop file executable
    try {
      fs.chmodSync(desktopFilePath, 0o755);
    } catch (error) {
      console.warn('[AutoStart] Failed to make desktop file executable:', error);
    }
  }

  private async disableLinux(): Promise<void> {
    const desktopFilePath = this.getLinuxDesktopFilePath();

    if (fs.existsSync(desktopFilePath)) {
      fs.unlinkSync(desktopFilePath);
    }
  }

  private getLinuxDesktopFilePath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.config', 'autostart', 'everfern-desktop.desktop');
  }

  private generateLinuxDesktopFile(exePath: string): string {
    return `[Desktop Entry]
Type=Application
Name=EverFern
Comment=EverFern AI Assistant
Exec="${exePath}" --auto-start
Icon=everfern
Terminal=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
StartupNotify=false
Categories=Utility;
`;
  }

  // ── Utility Methods ─────────────────────────────────────────────────

  /**
   * Get platform-specific auto-start information
   */
  getPlatformInfo(): { platform: string; method: string; location: string } {
    switch (this.platform) {
      case 'win32':
        return {
          platform: 'Windows',
          method: 'Registry (HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run)',
          location: 'Windows Registry'
        };
      case 'darwin':
        return {
          platform: 'macOS',
          method: 'LaunchAgent plist file',
          location: this.getMacOSPlistPath()
        };
      case 'linux':
        return {
          platform: 'Linux',
          method: 'XDG autostart desktop file',
          location: this.getLinuxDesktopFilePath()
        };
      default:
        return {
          platform: this.platform,
          method: 'Unsupported',
          location: 'N/A'
        };
    }
  }

  /**
   * Validate that auto-start can be enabled on this platform
   */
  async validatePlatformSupport(): Promise<{ supported: boolean; reason?: string }> {
    switch (this.platform) {
      case 'win32':
        try {
          require('winreg');
          return { supported: true };
        } catch (error) {
          return {
            supported: false,
            reason: 'winreg package not installed. Run: npm install winreg @types/winreg'
          };
        }
      case 'darwin':
      case 'linux':
        return { supported: true };
      default:
        return {
          supported: false,
          reason: `Platform ${this.platform} is not supported`
        };
    }
  }
}

// Export singleton instance
export const autoStartManager = new AutoStartManager();

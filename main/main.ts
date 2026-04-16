/**
 * EverFern Desktop — Main Process (v2)
 *
 * Electron entry point. Creates the BrowserWindow, initializes the ACP
 * manager and AgentRunner, and registers all IPC handlers.
 *
 * Architecture:
 *   Renderer ─IPC─► Preload Bridge ─IPC─► Main Process
 *     ▲                                        │
 *     │            ACPManager (AIClient)        │
 *     │            AgentRunner (tools, prompt)  │
 *     └────────── ChatHistoryStore ─────────────┘
 */

import { app, BrowserWindow, ipcMain, dialog, protocol, net, clipboard, Notification } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ACPManager } from './acp/manager';
import type { ProviderType } from './acp/types';
import { ChatHistoryStore } from './store/history';
import { AgentRunner } from './agent/runner/runner';
import { ensureShowUIServer, killShowUIServer } from './agent/runner/showui-server';
import { AIClient } from './lib/ai-client';
import { getAllModelsFlat, FlatModelEntry, PROVIDER_REGISTRY, getModelsForProvider, formatModelName } from './lib/providers';
import { toggleDebugWindow, setupLogging } from './lib/debug';
import { systemTrayManager } from './lib/system-tray-manager';
import { autoStartManager } from './lib/auto-start-manager';
import { integrationService } from './integrations/integration-service';
import { MessageHandler } from './integrations/message-handler';

// ── Initialize Logging ──────────────────────────────────────────────
setupLogging();
console.log('[Startup] EverFern Main Process starting...');
console.log('[Startup] Platform:', process.platform);
console.log('[Startup] Node version:', process.version);
console.log('[Startup] App path:', app.getAppPath());
console.log('[Startup] User data:', app.getPath('userData'));

// ── Check for Auto-Start Mode ───────────────────────────────────────
const isAutoStartMode = process.argv.includes('--auto-start');
console.log('[Startup] Auto-start mode:', isAutoStartMode);

import { globalShortcut } from 'electron';
import { memorySaveTool } from './agent/tools/memory-save';
import { dbOps, closeDb } from './lib/db';
import { listArtifacts, readArtifact, writeArtifact, deleteArtifact } from './store/artifacts';
import { writePlan, readPlan, listPlans, deletePlan } from './store/plans';
import { listSites, readSiteFile, writeSiteFile, deleteSite } from './store/sites';
import { searchChatVectors, getChatVectors, deleteChatVectors, getVectorStats, initChatVectorDb, getVectorStats as getVecStats } from './store/chat-vectors';
import { registerContextEngine, setDefaultContextEngine } from './context-engine';
import { VectorContextEngine } from './context-engine/vector';
import { shell } from 'electron';
import { syncBuiltInSkills, mergeCustomSkills, getCustomSkillsPath, listCustomSkills, saveCustomSkill, deleteCustomSkill } from './lib/skills-sync';
import { CommandRegistry } from './agent/tools/terminal/registry';

// ── GPU / Cache Startup Fixes (must run before app.whenReady) ───────────────
// Disable GPU shader disk cache — prevents "Access is denied (0x5)" on Windows
// when a previous Electron process left the GPUCache directory locked.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
// Disable the net disk cache for the same reason (net\disk_cache errors).
app.commandLine.appendSwitch('disable-application-cache');
// Suppress Chromium GPU blocklist — lets the GPU initialise even after a crash.
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Clear any stale GPU / network cache directories left by a previous run.
(function clearStaleCache() {
  try {
    const userData = app.getPath('userData');
    const dirsToWipe = ['GPUCache', 'ShaderCache', 'DawnCache', 'GrShaderCache'];
    for (const dir of dirsToWipe) {
      const full = path.join(userData, dir);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
  } catch (e) {
    console.warn('[Startup] Could not clear stale GPU cache:', e);
  }
})();

// ── Singletons ──────────────────────────────────────────────────────

let acpManager: ACPManager;
let historyStore: ChatHistoryStore;

try {
  console.log('[Startup] Initializing ACPManager...');
  acpManager = new ACPManager();
  console.log('[Startup] Initializing ChatHistoryStore...');
  historyStore = new ChatHistoryStore();
  console.log('[Startup] Singletons initialized.');
} catch (err) {
  console.error('[Startup] ❌ Critical failure during singleton initialization:', err);
}

// Computer-Use Permissions (per session)
let permissionsGranted = false;
// System-files write permissions (per chat run/session, shared with sandbox runtime)
(globalThis as any).__everfernSystemFilesPermissionGranted = false;

// Last stream event for JSON viewer
let lastStreamEvent: any = null;
// Full chat messages for JSON viewer
let lastChatMessages: any[] = [];


let mainWindow: BrowserWindow | null = null;

// Tracks the ShowUI install/run process so we can kill it on app quit
let installProc: import('child_process').ChildProcess | null = null;

// Message handler for bot integrations
let messageHandler: MessageHandler | null = null;

// ── Window ──────────────────────────────────────────────────────────

function createWindow(): void {
  const isDev = !app.isPackaged;
  console.log(`[Window] Creating window (app.isPackaged: ${app.isPackaged}, isDev: ${isDev})`);
  console.log(`[Window] NODE_ENV: ${process.env.NODE_ENV}`);

  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    minWidth: 800, minHeight: 600,
    frame: false,
    icon: isDev
      ? path.join(__dirname, '../../public/images/logos/everfern-rounded.png')
      : path.join(app.getAppPath(), process.platform === 'win32'
          ? 'public/images/logos/everfern.ico'
          : 'public/images/logos/everfern-rounded.png'),
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#1a1a1a',
    show: !isAutoStartMode, // Don't show window immediately in auto-start mode
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: false, // Temporarily disabled for production path debugging
    },
  });

  // Fallback: Show window after 5 seconds if ready-to-show never fires (only in normal mode)
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible() && !isAutoStartMode) {
      console.warn('[Window] ready-to-show timed out, forcing show()');
      mainWindow.show();
    }
  }, 5000);

  mainWindow.once('ready-to-show', () => {
    console.log('[Window] ready-to-show received');
    clearTimeout(showFallback);

    // Initialize system tray first
    try {
      if (systemTrayManager.isSupported() && mainWindow) {
        systemTrayManager.createTray(mainWindow);
        systemTrayManager.setupWindowEvents();
        console.log('[Window] System tray initialized');
      } else {
        console.warn('[Window] System tray not supported on this platform or window not available');
      }
    } catch (error) {
      console.error('[Window] Failed to initialize system tray:', error);
    }

    // Handle auto-start mode
    if (isAutoStartMode) {
      console.log('[Window] Auto-start mode: minimizing to tray');
      if (systemTrayManager.isSupported()) {
        // Hide to tray instead of showing window
        systemTrayManager.hideToTray();
      } else {
        // If tray not supported, minimize window
        mainWindow?.minimize();
      }
    } else {
      // Normal startup: show window
      mainWindow?.show();
    }
  });

  if (isDev) {
    console.log('[Window] Loading dev URL: http://localhost:3001');

    // Wait for Next.js to be ready
    const waitForNext = () => new Promise<void>((resolve, reject) => {
      const net = require('net');
      const client = new net.Socket();
      client.connect(3001, '127.0.0.1', () => {
        client.destroy();
        console.log('[Window] Next.js is ready on port 3001');
        resolve();
      });
      client.on('error', () => {
        client.destroy();
        reject(new Error('Next.js not ready'));
      });
    });

    // Try to load, with retry logic
    const tryLoad = async () => {
      if (!mainWindow) {
        console.log('[Window] mainWindow is null, aborting');
        return;
      }
      for (let attempt = 1; attempt <= 30; attempt++) {
        try {
          console.log(`[Window] Attempt ${attempt}: checking if Next.js is ready...`);
          await waitForNext();
          console.log(`[Window] Next.js ready, calling loadURL...`);
          await mainWindow.loadURL('http://localhost:3001');
          console.log('[Window] ✅ Dev URL loaded successfully!');
          return;
        } catch (err) {
          console.log(`[Window] Attempt ${attempt}/30 failed: ${err}, waiting...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      console.error('[Window] ❌ Next.js did not start in time');
    };

    console.log('[Window] Starting tryLoad...');
    tryLoad();
  } else {
    console.log('[Window] Production mode detected, using everfern-app protocol');
    mainWindow.loadURL('everfern-app://./index.html').catch(err => {
      console.error('[Window] ❌ loadURL failed for everfern-app protocol:', err);
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Window] ❌ did-fail-load: ${errorCode} (${errorDescription}) for URL: ${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['Log', 'Info', 'Warn', 'Error'];
    const levelStr = levels[level] || 'Log';
    console.log(`[Renderer ${levelStr}] ${message} (at ${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Window] ❌ Renderer process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Window] ⚠️ Renderer is unresponsive');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Page finished loading');
  });

  mainWindow.on('closed', () => {
    console.log('[Window] Window closed');
    mainWindow = null;
  });
}

// ── Protocol: Local App & Sites ──────────────────────────────────────────
// registerSchemesAsPrivileged must be called BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'everfern-app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } },
  { scheme: 'everfern-site', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } }
]);

// ── Auto-start enabled bots ──────────────────────────────────────────────

/**
 * Auto-start enabled bots on app launch
 * Requirements: 8.1, 8.2, 8.3
 */
async function autoStartEnabledBots(): Promise<void> {
  try {
    console.log('[Integration] Checking for bots to auto-start...');

    // Get the bot integration manager from the integration service
    const botManager = integrationService.getService<any>('bot-integration-manager');

    if (!botManager) {
      console.warn('[Integration] Bot integration manager not available');
      return;
    }

    // Check Discord - start if enabled and has bot token
    if (integrationConfig.discord.enabled && integrationConfig.discord.botToken) {
      // Requirement 8.1: Check for configured model and provider
      if (!integrationConfig.discord.model || !integrationConfig.discord.provider) {
        // Requirement 8.2: Log warning for enabled bot without model configuration
        console.warn('[Integration] Discord bot is enabled but missing model/provider configuration. Message handler will not be initialized.');
        console.warn('[Integration] Please configure a model and provider in Discord settings.');
      }

      console.log('[Integration] Auto-starting Discord bot...');
      try {
        // Check if Discord platform is already registered
        const discordPlatform = botManager.getPlatform?.('discord');
        if (!discordPlatform) {
          // Platform needs to be configured and registered
          const { DiscordPlatform } = await import('./integrations/discord-platform');
          const platform = new DiscordPlatform({
            enabled: true,
            config: {
              botToken: integrationConfig.discord.botToken,
              applicationId: integrationConfig.discord.applicationId,
              respondToDMs: true,
              respondToGuilds: true,
              guildMentionOnly: true,
              allowedGuilds: integrationConfig.discord.allowedGuilds || [],
              allowedUsers: integrationConfig.discord.allowedUsers || []
            }
          });
          await platform.initialize();
          botManager.registerPlatform('discord', platform);

          // Update connected status
          integrationConfig.discord.connected = true;
          saveIntegrationConfig(integrationConfig);

          console.log('[Integration] Discord bot auto-started successfully');
        } else {
          console.log('[Integration] Discord bot already running');
        }
      } catch (error) {
        console.error('[Integration] Failed to auto-start Discord bot:', error);
        integrationConfig.discord.connected = false;
        saveIntegrationConfig(integrationConfig);
      }
    }

    // Check Telegram - start if enabled and has bot token
    if (integrationConfig.telegram.enabled && integrationConfig.telegram.botToken) {
      // Requirement 8.1: Check for configured model and provider
      if (!integrationConfig.telegram.model || !integrationConfig.telegram.provider) {
        // Requirement 8.2: Log warning for enabled bot without model configuration
        console.warn('[Integration] Telegram bot is enabled but missing model/provider configuration. Message handler will not be initialized.');
        console.warn('[Integration] Please configure a model and provider in Telegram settings.');
      }

      console.log('[Integration] Auto-starting Telegram bot...');
      try {
        // Check if Telegram platform is already registered
        const telegramPlatform = botManager.getPlatform?.('telegram');
        if (!telegramPlatform) {
          // Platform needs to be configured and registered
          const { TelegramPlatform } = await import('./integrations/telegram-platform');
          const platform = new TelegramPlatform({
            enabled: true,
            config: {
              botToken: integrationConfig.telegram.botToken,
              webhookUrl: integrationConfig.telegram.webhookUrl,
              respondToGroups: true,
              groupMentionOnly: true
            }
          });
          await platform.initialize();
          botManager.registerPlatform('telegram', platform);

          // Update connected status
          integrationConfig.telegram.connected = true;
          saveIntegrationConfig(integrationConfig);

          console.log('[Integration] Telegram bot auto-started successfully');
        } else {
          console.log('[Integration] Telegram bot already running');
        }
      } catch (error) {
        console.error('[Integration] Failed to auto-start Telegram bot:', error);
        integrationConfig.telegram.connected = false;
        saveIntegrationConfig(integrationConfig);
      }
    }

    console.log('[Integration] Auto-start check complete');
  } catch (error) {
    console.error('[Integration] Error during auto-start:', error);
  }
}

// ── App lifecycle ───────────────────────────────────────────────────

app.whenReady().then(async () => {
  console.log('[App] App ready, starting initialization...');

  // ── Protocol Handlers ──────────────────────────────────────────────

  // Custom protocol for the main application (Next.js out folder)
  protocol.handle('everfern-app', async (request) => {
    try {
      const url = new URL(request.url);
      let filePath = url.pathname;
      if (filePath === '/' || !filePath || filePath === '.') filePath = '/index.html';

      // Normalize path (handle leading slashes and dots)
      if (filePath.startsWith('./')) filePath = filePath.substring(1);
      if (!filePath.startsWith('/')) filePath = '/' + filePath;

      // In production, extraResources are in process.resourcesPath
      // In dev, they're in the project root
      const baseDir = app.isPackaged
        ? path.join(process.resourcesPath, 'out')
        : path.join(__dirname, '../../out');

      let absPath = path.join(baseDir, filePath);
      console.log(`[Protocol] Request: ${request.url} -> ${absPath} (baseDir: ${baseDir}, isPackaged: ${app.isPackaged})`);

      // Check if path exists
      if (fs.existsSync(absPath)) {
        const stats = fs.statSync(absPath);

        // If it's a directory, try to serve index.html from that directory
        if (stats.isDirectory()) {
          const dirIndexPath = path.join(absPath, 'index.html');
          if (fs.existsSync(dirIndexPath)) {
            console.log(`[Protocol] Directory detected, serving ${dirIndexPath}`);
            const data = fs.readFileSync(dirIndexPath);
            return new Response(data, {
              headers: { 'Content-Type': 'text/html' }
            });
          }
          // Directory exists but no index.html — fall back to root index.html for SPA routing
          console.log(`[Protocol] Directory ${absPath} has no index.html, falling back to root index.html`);
          absPath = path.join(baseDir, 'index.html');
        }

        // It's a file — serve it
        if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
          const extension = path.extname(absPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js':   'text/javascript',
            '.css':  'text/css',
            '.json': 'application/json',
            '.png':  'image/png',
            '.jpg':  'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif':  'image/gif',
            '.svg':  'image/svg+xml',
            '.ico':  'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf':  'font/ttf',
            '.otf':  'font/otf',
          };

          const contentType = mimeTypes[extension] || 'application/octet-stream';
          const data = fs.readFileSync(absPath);

          return new Response(data, {
            headers: { 'Content-Type': contentType }
          });
        }
      }

      // File not found — try index.html for client-side routing (SPA fallback)
      console.warn(`[Protocol] ⚠️ 404: ${absPath}, trying index.html for client-side routing`);
      const indexPath = path.join(baseDir, 'index.html');
      console.log(`[Protocol] Checking for index.html at: ${indexPath}`);

      if (fs.existsSync(indexPath)) {
        console.log(`[Protocol] ✅ Found index.html, serving for SPA routing`);
        const data = fs.readFileSync(indexPath);
        return new Response(data, {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      console.warn(`[Protocol] ❌ 404: ${absPath} and index.html not found`);
      console.warn(`[Protocol] baseDir exists: ${fs.existsSync(baseDir)}`);
      if (fs.existsSync(baseDir)) {
        const files = fs.readdirSync(baseDir).slice(0, 10);
        console.warn(`[Protocol] Files in baseDir: ${files.join(', ')}`);
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('[Protocol] ❌ Error handling request:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      return new Response(`Internal Server Error: ${errorMsg}`, { status: 500 });
    }
  });

  // Custom protocol for local sites
  protocol.handle('everfern-site', (request) => {
// ... existing site logic ...
    const url = new URL(request.url);
    const chatId = url.hostname;
    let filePath = url.pathname;

    if (filePath === '/' || !filePath) filePath = '/index.html';

    // Try sites folder first, then artifacts folder
    let absPath = path.join(os.homedir(), '.everfern', 'sites', chatId, filePath);
    if (!fs.existsSync(absPath)) {
      absPath = path.join(os.homedir(), '.everfern', 'artifacts', chatId, filePath);
    }

    if (!fs.existsSync(absPath)) return new Response('Not Found', { status: 404 });

    // Safety check: ensure path is within ~/.everfern/sites or ~/.everfern/artifacts
    const sitesRoot = path.join(os.homedir(), '.everfern', 'sites');
    const artifactsRoot = path.join(os.homedir(), '.everfern', 'artifacts');

    const isUnderSites = absPath.startsWith(sitesRoot);
    const isUnderArtifacts = absPath.startsWith(artifactsRoot);

    if (!isUnderSites && !isUnderArtifacts) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(`file://${absPath.replace(/\\/g, '/')}`);
  });

  // ── Create Main Window ─────────────────────────────────────────────
  createWindow();

  // ── Initialize Integration Services ─────────────────────────────────
  try {
    console.log('[App] Initializing integration services...');
    await integrationService.initialize();
    console.log('[App] Integration services initialized successfully');

    // Auto-start enabled and connected bots
    await autoStartEnabledBots();

    // Requirement 7.1, 8.3: Initialize MessageHandler after bot integration manager is ready
    const botManager = integrationService.getService<any>('bot-integration-manager');
    if (botManager) {
      // Check if at least one bot has model/provider configured
      const hasConfiguredBot =
        (integrationConfig.discord.enabled && integrationConfig.discord.connected &&
         integrationConfig.discord.model && integrationConfig.discord.provider) ||
        (integrationConfig.telegram.enabled && integrationConfig.telegram.connected &&
         integrationConfig.telegram.model && integrationConfig.telegram.provider);

      if (hasConfiguredBot) {
        messageHandler = new MessageHandler({
          integrationConfig,
          acpManager,
          botManager
        });
        console.log('[App] MessageHandler initialized successfully');
      } else {
        console.log('[App] No configured bots found, MessageHandler not initialized');
      }
    }
  } catch (error) {
    console.error('[App] Failed to initialize integration services:', error);
    // Don't block app startup if integration services fail
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // On macOS, re-create the window when the dock icon is clicked and no windows are open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ── ShowUI process cleanup on quit ──────────────────────────────────
app.on('before-quit', async () => {
  // Requirement 7.2: Clean up MessageHandler
  if (messageHandler) {
    try {
      console.log('[App] Shutting down MessageHandler...');
      await messageHandler.shutdown();
      messageHandler = null;
      console.log('[App] MessageHandler shutdown complete');
    } catch (error) {
      console.error('[App] Error shutting down MessageHandler:', error);
    }
  }

  // Stop integration services
  try {
    console.log('[App] Stopping integration services...');
    await integrationService.stop();
    console.log('[App] Integration services stopped successfully');
  } catch (error) {
    console.error('[App] Error stopping integration services:', error);
  }

  // Kill the install/run process spawned by showui:install
  if (installProc) {
    try { installProc.kill('SIGTERM'); } catch { /* ignore */ }
    installProc = null;
  }
  // Kill the server managed by showui-server.ts (e.g. from showui:launch)
  killShowUIServer();

  // Clean up system tray
  systemTrayManager.destroy();
});


// ── IPC: Window Controls ────────────────────────────────────────────

ipcMain.handle('window:minimize',    () => { mainWindow?.minimize(); });
ipcMain.handle('window:maximize',    () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
ipcMain.handle('window:close',       () => { mainWindow?.close(); });
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() || false);

// ── IPC: System Tray ────────────────────────────────────────────────

ipcMain.handle('tray:show-window', () => {
  systemTrayManager.showWindow();
  return { success: true };
});

ipcMain.handle('tray:hide-to-tray', () => {
  systemTrayManager.hideToTray();
  return { success: true };
});

ipcMain.handle('tray:is-supported', () => {
  return { supported: systemTrayManager.isSupported() };
});

ipcMain.handle('tray:update-menu', () => {
  systemTrayManager.updateTrayMenu();
  return { success: true };
});

// ── IPC: Auto-Start ─────────────────────────────────────────────────

ipcMain.handle('autostart:get-status', async () => {
  try {
    const enabled = await autoStartManager.isEnabled();
    return { success: true, enabled };
  } catch (error) {
    console.error('[AutoStart] Failed to get status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('autostart:enable', async () => {
  try {
    await autoStartManager.enable();
    console.log('[AutoStart] Auto-start enabled via IPC');
    return { success: true };
  } catch (error) {
    console.error('[AutoStart] Failed to enable:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('autostart:disable', async () => {
  try {
    await autoStartManager.disable();
    console.log('[AutoStart] Auto-start disabled via IPC');
    return { success: true };
  } catch (error) {
    console.error('[AutoStart] Failed to disable:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('autostart:get-info', () => {
  try {
    const info = autoStartManager.getPlatformInfo();
    return { success: true, info };
  } catch (error) {
    console.error('[AutoStart] Failed to get platform info:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('autostart:validate-support', async () => {
  try {
    const validation = await autoStartManager.validatePlatformSupport();
    return { success: true, validation };
  } catch (error) {
    console.error('[AutoStart] Failed to validate platform support:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// ── IPC: Audio ──────────────────────────────────────────────────────

ipcMain.handle('audio:play-sound', async (_event, soundPath: string) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const { execFile } = require('child_process');
    const os = require('os');

    // Construct full path to sound file
    const soundFilePath = path.join(__dirname, '../../public/sounds', soundPath);

    console.log(`[Audio] Playing sound: ${soundFilePath}`);

    if (!fs.existsSync(soundFilePath)) {
      console.warn(`[Audio] Sound file not found: ${soundFilePath}`);
      return false;
    }

    // Use platform-specific audio player
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: Use PowerShell to play sound
      execFile('powershell.exe', [
        '-Command',
        `(New-Object System.Media.SoundPlayer '${soundFilePath}').PlaySync()`
      ], { maxBuffer: 10 * 1024 * 1024 });
    } else if (platform === 'darwin') {
      // macOS: Use afplay command
      execFile('afplay', [soundFilePath]);
    } else if (platform === 'linux') {
      // Linux: Try paplay or other available audio player
      execFile('paplay', [soundFilePath], (err: any) => {
        if (err) {
          console.warn('[Audio] paplay failed, trying aplay:', err);
          execFile('aplay', [soundFilePath]);
        }
      });
    }

    return true;
  } catch (err) {
    console.error('[Audio] Error playing sound:', err);
    return false;
  }
});

// ── IPC: Config ─────────────────────────────────────────────────────

ipcMain.handle('save-config', async (_event, config) => {
  try {
    const configDir  = path.join(os.homedir(), '.everfern');
    const configPath = path.join(configDir, 'config.json');
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

    // Multi-file Key Isolation (Main Provider)
    if (config.apiKey && config.provider) {
      const keysDir = path.join(configDir, 'keys');
      if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
      const keyPath = path.join(keysDir, `${config.provider}.key`);
      fs.writeFileSync(keyPath, config.apiKey.trim());
      console.log(`[Config] Isolated key saved for ${config.provider}`);
    }

    // Key Isolation (Vision Model)
    if (config.vlm?.apiKey && config.vlm?.provider) {
      const keysDir = path.join(configDir, 'keys');
      if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
      const vlmKeyPath = path.join(keysDir, `vlm-${config.vlm.provider}.key`);
      fs.writeFileSync(vlmKeyPath, config.vlm.apiKey.trim());
      console.log(`[Config] Isolated vision key saved for ${config.vlm.provider}`);
    }

    // Save config WITHOUT the sensitive API keys
    const scrubbedConfig = { ...config };
    delete scrubbedConfig.apiKey;
    if (scrubbedConfig.vlm) {
      const scrubbedVlm = { ...scrubbedConfig.vlm };
      delete scrubbedVlm.apiKey;
      scrubbedConfig.vlm = scrubbedVlm;
    }
    fs.writeFileSync(configPath, JSON.stringify(scrubbedConfig, null, 2));

    // Immediately activate the new provider (with the key)
    if (config.provider) {
      acpManager.setProvider({
        provider: config.provider,
        apiKey:   config.apiKey,
        model:    scrubbedConfig.model,
        baseUrl:  scrubbedConfig.baseUrl,
        vlm:      scrubbedConfig.vlm, // Pass VLM to manager
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[Config] Failed to save:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// ── Helper: loadConfigSync ──────────────────────────────────────────

function loadConfigSync() {
  try {
    const configDir  = path.join(os.homedir(), '.everfern');
    const configPath = path.join(configDir, 'config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(data);

      // Auto-migrate hf.co/Qwen/Qwen3-VL-2B-Thinking-GGUF -> qwen3-vl:2b
      if (config.vlm?.model?.includes('hf.co/Qwen/Qwen3-VL-2B-Thinking-GGUF')) {
        config.vlm.model = 'qwen3-vl:2b';
      }

      config.keys = {};

      const keysDir = path.join(configDir, 'keys');
      if (fs.existsSync(keysDir)) {
        const files = fs.readdirSync(keysDir);
        for (const file of files) {
          if (file.endsWith('.key')) {
            const baseName = file.replace('.key', '');
            const key = fs.readFileSync(path.join(keysDir, file), 'utf-8').trim();

            if (baseName.startsWith('vlm-')) {
              const vlmProvider = baseName.replace('vlm-', '');
              if (config.vlm && config.vlm.provider === vlmProvider) {
                config.vlm.apiKey = key;
              }
            } else {
              config.keys[baseName] = key;
              if (config.provider === baseName) {
                config.apiKey = key;
              }
            }
          }
        }
      }
      return config;
    }
    return null;
  } catch (err) {
    console.error('[Config] Error loading config:', err);
    return null;
  }
}

ipcMain.handle('load-config', async () => {
  try {
    const config = loadConfigSync();
    if (!config) return { success: true, config: null };
    return { success: true, config };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// ── IPC: System ──────────────────────────────────────────────────────

ipcMain.handle('system:get-username', () => {
  return require('os').userInfo().username;
});

ipcMain.handle('system:open-file-picker', async (_, options?: { filters?: { name: string, extensions: string[] }[] }) => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'Text & Documents', extensions: ['txt', 'md', 'json', 'csv', 'js', 'ts', 'py', 'log', 'html', 'css'] }
    ]
  });
  if (canceled || filePaths.length === 0) return null;
  const originalFilePath = filePaths[0];
  try {
    const stats = fs.statSync(originalFilePath);
    const ext = path.extname(originalFilePath).toLowerCase();

    // Copy to ~/.everfern/attachments
    const attachmentsDir = path.join(os.homedir(), '.everfern', 'attachments');
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }
    const safeFileName = `${Date.now()}-${path.basename(originalFilePath)}`;
    const newFilePath = path.join(attachmentsDir, safeFileName);
    fs.copyFileSync(originalFilePath, newFilePath);

    let mimeType = 'application/octet-stream';
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      mimeType = `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}`;
      const base64 = fs.readFileSync(newFilePath).toString('base64');
      const uri = `data:${mimeType};base64,${base64}`;
      return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType, base64: uri, success: true };
    } else {
      const content = fs.readFileSync(newFilePath, 'utf-8');
      return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType: 'text/plain', content, success: true };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:open-folder-picker', async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled || filePaths.length === 0) return null;
  const folderPath = filePaths[0];
  try {
    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) return { success: false, error: 'Selected path is not a folder.' };
    return { path: folderPath, name: path.basename(folderPath), success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:wipe-account', async () => {
  // ...
});

ipcMain.handle('system:open-folder', async (_event, folderPath: string) => {
  if (folderPath && fs.existsSync(folderPath)) {
    shell.openPath(folderPath);
    return { success: true };
  }
  return { success: false, error: 'Folder not found' };
});

function getOllamaBinary(): string {
  const isWin = process.platform === 'win32';
  if (isWin) {
    const home = os.homedir();
    const ollamaPath = path.join(home, 'AppData', 'Local', 'Programs', 'ollama', 'ollama.exe');
    if (fs.existsSync(ollamaPath)) return `"${ollamaPath}"`;
    return 'ollama';
  }
  return '/usr/local/bin/ollama';
}

ipcMain.handle('system:ollama-status', () => {
  try {
    const { execSync } = require('child_process');
    const bin = getOllamaBinary();

    // Check if Ollama is installed
    try {
      execSync(`${bin} -v`, { stdio: 'ignore' });
    } catch {
      return { installed: false, modelInstalled: false };
    }

    // Check if the specific model is pulled
    try {
      const list = execSync(`"${bin}" list`, { encoding: 'utf8' });
      const modelInstalled = list.includes('qwen3-vl:2b');
      return { installed: true, modelInstalled };
    } catch {
      return { installed: true, modelInstalled: false };
    }
  } catch {
    return { installed: false, modelInstalled: false };
  }
});

ipcMain.handle('system:ollama-install', async (event) => {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');

    // Switch command based on platform
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : 'sh';
    const command = isWin
      ? 'irm https://ollama.com/install.ps1 | Invoke-Expression'
      : 'curl -fsSL https://ollama.com/install.sh | sh';

    const args = isWin
      ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
      : ['-c', command];

    const proc = spawn(shell, args, { shell: false });

    proc.stdout.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach((line: string) => {
        event.sender.send('system:ollama-install-line', { line: line.trim(), type: 'stdout' });
      });
    });

    proc.stderr.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach((line: string) => {
        event.sender.send('system:ollama-install-line', { line: line.trim(), type: 'stderr' });
      });
    });

    proc.on('close', (code: number) => {
      resolve({ success: code === 0, code });
    });
  });
});

ipcMain.handle('system:ollama-pull', async (event, modelName: string) => {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const bin = getOllamaBinary();
    const isWin = process.platform === 'win32';

    // Use `ollama pull` (not `ollama run`) — cleaner for background downloads, no interactive prompt
    // For Unix-like systems, we don't usually need shell: true if we have the full path,
    // but on Windows if the path has spaces and is not in PATH, shell: true can help with quoted paths.
    const proc = spawn(bin, ['pull', modelName], { shell: isWin && bin !== 'ollama' });

    proc.stdout.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach((line: string) => {
        event.sender.send('system:ollama-pull-line', { line: line.trim(), type: 'stdout' });
      });
    });

    proc.stderr.on('data', (d: Buffer) => {
      d.toString().split('\n').filter(Boolean).forEach((line: string) => {
        event.sender.send('system:ollama-pull-line', { line: line.trim(), type: 'stderr' });
      });
    });

    proc.on('close', (code: number) => resolve({ success: code === 0 || code === null, code }));
  });
});

// ── IPC: Memory ──────────────────────────────────────────────────────

ipcMain.handle('memory:save-direct', async (_event, content: string, metadata?: string) => {
  return memorySaveTool.execute({ content, metadata });
});

// ── IPC: ACP Provider ────────────────────────────────────────────────

ipcMain.handle('acp:list-providers', () => acpManager.listProviders());

ipcMain.handle('acp:set-provider', async (_event, config) => {
  return acpManager.setProvider(config);
});

ipcMain.handle('acp:health-check', async () => acpManager.healthCheck());

ipcMain.handle('acp:validate-nvidia-model', async (_event, modelId: string, apiKey: string) => {
  try {
    const res = await fetch(`https://integrate.api.nvidia.com/v1/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { valid: false };
    const data = await res.json();
    const exists = data.data?.some((m: any) => m.id === modelId);
    return { valid: !!exists };
  } catch {
    return { valid: false };
  }
});

ipcMain.handle('acp:list-models', async () => {
  try {
    const config = acpManager.getActiveConfig();
    let providerType = config ? config.provider : 'everfern';
    if ((providerType as string) === 'google') providerType = 'gemini';

    // 1. Get models for the active configured provider
    const activeModels = getAllModelsFlat().filter(m => m.providerType === providerType);

    if (providerType === 'nvidia' && (config as any)?.customModel) {
      if (!activeModels.find(m => m.id === (config as any).customModel)) {
        activeModels.unshift({
          id: (config as any).customModel,
          name: (config as any).customModel + " (Custom)",
          provider: 'Nvidia NIM',
          providerType: 'nvidia' as any
        });
      }
    }

    // 2. Fetch local Ollama models dynamically
    let ollamaModels: FlatModelEntry[] = [];
    try {
      const ollamaClient = new AIClient({ provider: 'ollama' });
      const rawOllama = await ollamaClient.listModels();
      ollamaModels = rawOllama.map((m: string) => ({
        id: m,
        name: m,
        provider: 'Ollama',
        providerType: 'ollama' as any
      }));
      if (rawOllama.length === 0) {
        ollamaModels.push({ id: 'ollama-empty', name: 'No models found in Ollama', provider: 'Ollama', providerType: 'ollama' as any });
      }
    } catch {
      ollamaModels.push({ id: 'ollama-error', name: 'Ollama is not running/installed', provider: 'Ollama', providerType: 'ollama' as any });
    }

    // 3. Fetch local LM Studio dynamically
    let lmstudioModels: FlatModelEntry[] = [];
    try {
      const lmClient = new AIClient({ provider: 'lmstudio' });
      const rawLm = await lmClient.listModels();
      lmstudioModels = rawLm.map((m: string) => ({
        id: m,
        name: m,
        provider: 'LM Studio',
        providerType: 'lmstudio' as any
      }));
      if (rawLm.length === 0) {
        lmstudioModels.push({ id: 'lmstudio-empty', name: 'No models found in LM Studio', provider: 'LM Studio', providerType: 'lmstudio' as any });
      }
    } catch {
      lmstudioModels.push({ id: 'lmstudio-error', name: 'LM Studio is not running/installed', provider: 'LM Studio', providerType: 'lmstudio' as any });
    }

    // Deduplicate and combine
    const merged = [...activeModels];
    for (const om of [...ollamaModels, ...lmstudioModels]) {
       if (!merged.find(m => m.id === om.id)) merged.push(om);
    }

    if (merged.length === 0) {
      merged.push({ id: 'everfern-1', name: 'Fern-1', provider: 'EverFern Cloud', providerType: 'everfern' as any });
    }

    return { success: true, models: merged };
  } catch (error) {
    console.error('[acp:list-models] Error:', error);
    return { success: false, models: [], error: String(error) };
  }
});

// ── IPC: Agentic Chat ────────────────────────────────────────────────

/**
 * Main chat handler — routes through the AgentRunner.
 * The runner injects the EverFern system prompt, handles tool calls,
 * and returns the final response.
 */
ipcMain.removeHandler('acp:chat');
ipcMain.handle('acp:chat', async (_event, request: {
  messages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>;
  model?: string;
  providerType?: string;
  conversationId?: string;
}) => {
  let client = acpManager.getClient();
  const config = loadConfigSync();
  // Dynamic provider resolution: if the frontend specifies a providerType that differs
  // from the statically-configured provider, create a fresh AIClient with the correct
  // API key loaded from ~/.everfern/keys/<provider>.key
  if (request.providerType) {
    const currentProvider = acpManager.getActiveConfig()?.provider;
    if (request.providerType !== currentProvider || !client) {
      const apiKey = config?.keys?.[request.providerType] || '';
      client = new AIClient({
        provider: request.providerType as any,
        model: request.model,
        apiKey,
      });
      console.log(`[acp:chat] Dynamic provider switch: ${currentProvider} → ${request.providerType}`);
    } else if (request.model) {
      client.setModel(request.model);
    }
  }

  if (!client) {
    return { error: 'No AI provider configured. Please complete setup first.' };
  }

  let sessionPermissionGranted = false;
  (globalThis as any).__everfernSystemFilesPermissionGranted = false;

  const runnerConfig = {
    showuiUrl: config?.showuiUrl || 'http://127.0.0.1:7860',
    ollamaBaseUrl: (request.providerType === 'ollama' || config?.provider === 'ollama') ? config?.baseUrl || 'http://localhost:11434' : undefined,
    requestPermission: (): Promise<boolean> => {
      return new Promise((resolve) => {
        agentPermissionResolver = (granted: boolean) => {
            if (granted) {
              sessionPermissionGranted = true;
              (globalThis as any).__everfernSystemFilesPermissionGranted = true;
            }
            resolve(granted);
        };
        if (mainWindow) {
            // Send permission request and show system notification
            mainWindow.webContents.send('agent:permission-request');

            // Show system notification
            if (Notification.isSupported()) {
              const iconPath = path.join(app.getAppPath(), 'public', 'images', 'logos', 'icon.png');
              const notification = new Notification({
                title: 'EverFern Permission Required',
                body: 'The agent needs permission to access system files. Click to approve.',
                urgency: 'normal',
                icon: fs.existsSync(iconPath) ? iconPath : undefined,
              });
              notification.on('click', () => {
                mainWindow?.focus();
              });
              notification.show();
            }
        } else {
            resolve(false);
        }
      });
    },
    checkPermission: () => sessionPermissionGranted,
    vlm: config?.vlm,
  };

  const runner = new AgentRunner(client, runnerConfig);

  // Extract the latest user message as the trigger
  const history  = request.messages.slice(0, -1);
  const lastMsg  = request.messages[request.messages.length - 1];
  const userInput = lastMsg?.content ?? '';

  try {
    const result = await runner.run(userInput, history, request.model, request.conversationId);
    (globalThis as any).__everfernSystemFilesPermissionGranted = false;
    return {
      success: true,
      response: {
        content:   result.response,
        toolCalls: result.toolCalls,
        model:     request.model ?? 'unknown',
      },
    };
  } catch (error) {
    console.error('[AgentRunner] Error:', error);
    (globalThis as any).__everfernSystemFilesPermissionGranted = false;
    return { error: error instanceof Error ? error.message : String(error) };
  }
});

/**
 * Streaming chat — sends chunks via IPC events.
 * Renderer listens on 'acp:stream-chunk' and 'acp:tool-call'.
 * Supports cancellation via 'acp:stop'.
 */
import { globalAbortManager } from './agent/runner/abort-manager';
let streamAborted = false; // Keep for backward compatibility
let agentPermissionResolver: ((granted: boolean) => void) | null = null;

ipcMain.removeHandler('agent:permission-response');
ipcMain.handle('agent:permission-response', (_event, granted: boolean) => {
  if (agentPermissionResolver) {
    agentPermissionResolver(granted);
    agentPermissionResolver = null;
  }
  if (granted) {
    (globalThis as any).__everfernSystemFilesPermissionGranted = true;
  }
  return { success: true };
});

ipcMain.removeHandler('acp:validate-nvidia-model');
ipcMain.handle('acp:validate-nvidia-model', async (_event, modelId: string, apiKey: string) => {
  try {
    const res = await fetch(`https://integrate.api.nvidia.com/v1/models/${modelId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) return { valid: false };
    const data = await res.json() as any;
    const hasVision = data?.capabilities?.vision === true
      || (data?.id ?? '').toLowerCase().includes('vision')
      || (data?.id ?? '').toLowerCase().includes('vl')
      || (data?.id ?? '').toLowerCase().includes('vllm');
    return { valid: true, hasVision, modelData: data };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
});


ipcMain.handle('acp:stop', () => {
  // Use the new AbortSignalManager for centralized abort handling
  globalAbortManager.setAborted();
  streamAborted = true; // Keep for backward compatibility

  // Also abort any running computer-use tool
  const { abortComputerUse } = require('./agent/tools/computer-use');
  abortComputerUse();

  return { success: true };
});

// Handle HITL responses from frontend
ipcMain.on('acp:hitl-response', (event, response: string) => {
  console.log('[Main] 📥 HITL response received from frontend:', response);

  // Forward the HITL response to the frontend as a new user message
  // This will trigger the normal chat flow and be processed by the runner's HITL detection logic
  console.log('[Main] 🔄 Forwarding HITL response as user message to frontend');

  // Send the HITL response back to the frontend as a synthetic user message
  // The frontend will then send it through the normal streaming flow
  event.sender.send('acp:hitl-response-processed', {
    message: response,
    shouldSendAsMessage: true
  });
});

ipcMain.handle('acp:stream', async (event, request: {
  messages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>;
  model?: string;
  providerType?: string;
  conversationId?: string;
}) => {
  const streamSender = event.sender;
  // Reset abort state for new mission using AbortSignalManager
  globalAbortManager.reset();
  streamAborted = false; // Keep for backward compatibility

  let client = acpManager.getClient();
  const config = loadConfigSync();
  // Dynamic provider resolution: same logic as acp:chat
  if (request.providerType) {
    const currentProvider = acpManager.getActiveConfig()?.provider;
    if (request.providerType !== currentProvider || !client) {
      const apiKey = config?.keys?.[request.providerType] || '';
      client = new AIClient({
        provider: request.providerType as any,
        model: request.model,
        apiKey,
      });
      console.log(`[acp:stream] Dynamic provider switch: ${currentProvider} → ${request.providerType}`);
    } else if (request.model) {
      client.setModel(request.model);
    }
  }

  if (!client) {
    return { error: 'No AI provider configured.' };
  }

  let sessionPermissionGranted = false;
  (globalThis as any).__everfernSystemFilesPermissionGranted = false;

  const runnerConfig = {
    showuiUrl: config?.showuiUrl || 'http://127.0.0.1:7860',
    ollamaBaseUrl: (request.providerType === 'ollama' || config?.provider === 'ollama') ? config?.baseUrl || 'http://localhost:11434' : undefined,
    requestPermission: (): Promise<boolean> => {
      return new Promise((resolve) => {
        agentPermissionResolver = (granted: boolean) => {
            if (granted) {
              sessionPermissionGranted = true;
              (globalThis as any).__everfernSystemFilesPermissionGranted = true;
            }
            resolve(granted);
        };
        if (mainWindow) {
            // Send permission request and show system notification
            mainWindow.webContents.send('agent:permission-request');

            // Show system notification
            if (Notification.isSupported()) {
              const iconPath = path.join(app.getAppPath(), 'public', 'images', 'logos', 'icon.png');
              const notification = new Notification({
                title: 'EverFern Permission Required',
                body: 'The agent needs permission to access system files. Click to approve.',
                urgency: 'normal',
                icon: fs.existsSync(iconPath) ? iconPath : undefined,
              });
              notification.on('click', () => {
                mainWindow?.focus();
              });
              notification.show();
            }
        } else {
            resolve(false);
        }
      });
    },
    checkPermission: () => sessionPermissionGranted, // Security: Ask once per chat request
    vlm: config?.vlm,
    shouldAbort: globalAbortManager.createShouldAbortCallback(),
  };

  const runner    = new AgentRunner(client, runnerConfig);
  const history   = request.messages.slice(0, -1);
  const lastMsg   = request.messages[request.messages.length - 1];
  const userInput = lastMsg?.content ?? '';
  // const sender    = event.sender; // Fixed TS2451

  // Store messages for JSON viewer
  lastChatMessages = [...history];
  if (lastMsg) lastChatMessages.push(lastMsg);

  // ── Register Global Shortcuts ─────────────────────────────────────────
  const abortKey = 'CommandOrControl+Shift+X';
  const abortHandler = () => {
    // Use AbortSignalManager for centralized abort handling
    globalAbortManager.setAborted();
    streamAborted = true; // Keep for backward compatibility
    const { abortComputerUse } = require('./agent/tools/computer-use');
    abortComputerUse();
  };

  const jsonViewerKey = 'CommandOrControl+Shift+J';
  const jsonViewerHandler = () => {
    // Build full chat history for JSON viewer
    const chatHistory = {
      type: 'full_chat_history',
      messageCount: lastChatMessages.length,
      messages: lastChatMessages.map((m: any) => {
        const msg: any = { role: m.role };
        if (m.role === 'system') {
          msg.content = '[SYSTEM PROMPT - HIDDEN]';
          msg.contentPreview = typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : '[Complex system prompt]';
        } else if (typeof m.content === 'string') {
          msg.content = m.content;
          msg.contentLength = m.content.length;
        } else if (Array.isArray(m.content)) {
          msg.content = m.content.map((c: any) => c.type === 'text' ? c.text : c.type === 'image_url' ? '[Image]' : '[Content]').join('\n');
          msg.hasMultimodal = true;
        }
        if (m.tool_calls) {
          msg.toolCalls = m.tool_calls.map((tc: any) => ({ name: tc.function?.name || tc.name, arguments: tc.function?.arguments || tc.arguments, id: tc.id }));
        }
        if (m.role === 'tool') {
          msg.toolName = m.tool_name;
          msg.toolCallId = m.tool_call_id;
          msg.resultPreview = typeof m.content === 'string' ? m.content.substring(0, 500) + (m.content.length > 500 ? '...' : '') : '[Complex result]';
        }
        return msg;
      }),
      lastEvent: lastStreamEvent ? {
        type: lastStreamEvent.type,
        data: lastStreamEvent
      } : null
    };

    const json = JSON.stringify(chatHistory, null, 2);

    // Copy to clipboard
    clipboard.writeText(json);

    // Notify renderer to show JSON viewer
    streamSender.send('acp:show-json-viewer', {
      json,
      type: 'full_chat_history'
    });

    console.log('[Shortcut] Ctrl+Shift+J: Copied full chat history to clipboard');
  };

  globalShortcut.register(abortKey, abortHandler);
  globalShortcut.register(jsonViewerKey, jsonViewerHandler);

  try {
    for await (const streamEvent of runner.runStream(userInput, history, request.model, request.conversationId)) {
      // Store last event for JSON viewer
      lastStreamEvent = streamEvent;

      // Check abort using both old and new systems for compatibility
      if (streamAborted || globalAbortManager.streamAborted) {
        streamSender.send('acp:stream-chunk', { delta: '\n\n🛑 Stopped by user.', done: true });
        break;
      }
      const safeSend = (channel: string, data: any) => {
        try {
          // Deep serialization safety check
          const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
            if (value instanceof Error) return { message: value.message, stack: value.stack };
            if (value instanceof Set) return Array.from(value);
            if (value instanceof Map) return Object.fromEntries(value);
            // Handle potentially cyclic objects or non-serializable properties
            if (typeof value === 'function') return '[Function]';
            return value;
          }));
          streamSender.send(channel, safeData);
        } catch (err) {
          console.error(`[IPC] Serialization failed for ${channel}:`, err);
          // Fallback to minimal info if full serialization fails
          streamSender.send(channel, { error: 'Serialization failed', type: data?.type || 'unknown' });
        }
      };

      if (streamEvent.type === 'chunk') {
        safeSend('acp:stream-chunk', { delta: streamEvent.content, done: false });
      } else if (streamEvent.type === 'thought') {
        safeSend('acp:thought', { content: streamEvent.content });
      } else if (streamEvent.type === 'tool_start') {
        safeSend('acp:tool-start', { toolName: streamEvent.toolName, toolArgs: streamEvent.toolArgs });
      } else if (streamEvent.type === 'tool_call') {
        // Debug: Log the tool call structure before sending
        if (streamEvent.toolCall?.toolName === 'ask_user_question') {
          console.log('[IPC] Sending ask_user_question tool call:', JSON.stringify(streamEvent.toolCall, null, 2));
        }
        safeSend('acp:tool-call', streamEvent.toolCall);
        // Store tool call in messages
        if (streamEvent.toolCall) {
          const toolCallId = `tool_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          lastChatMessages.push({
            role: 'assistant',
            tool_calls: [{
              name: streamEvent.toolCall.toolName,
              arguments: streamEvent.toolCall.args,
              id: toolCallId
            }]
          });
          if (streamEvent.toolCall.result) {
            lastChatMessages.push({
              role: 'tool',
              tool_name: streamEvent.toolCall.toolName,
              tool_call_id: toolCallId,
              content: streamEvent.toolCall.result.output || JSON.stringify(streamEvent.toolCall.result)
            });
          }
        }
      } else if (streamEvent.type === 'tool_update') {
        safeSend('acp:tool-update', { toolName: streamEvent.toolName, update: streamEvent.update });
      } else if (streamEvent.type === 'optima') {
        safeSend('acp:optima', { event: streamEvent.event, details: streamEvent.details });
      } else if (streamEvent.type === 'show_artifact') {
        safeSend('acp:show-artifact', { name: streamEvent.name });
      } else if (streamEvent.type === 'show_plan') {
        safeSend('acp:show-plan', { chatId: streamEvent.chatId, content: streamEvent.content });
      } else if (streamEvent.type === 'view_skill') {
        safeSend('acp:view-skill', { name: streamEvent.name });
      } else if (streamEvent.type === 'skill_detected') {
        safeSend('acp:skill-detected', { skillName: streamEvent.skillName, skillDescription: streamEvent.skillDescription, reason: streamEvent.reason });
      } else if (streamEvent.type === 'intent_classified') {
        safeSend('acp:intent-classified', { intent: streamEvent.intent, confidence: streamEvent.confidence, phase: streamEvent.phase });
      } else if (streamEvent.type === 'plan_created') {
        safeSend('acp:plan-created', { plan: streamEvent.plan });
      } else if (streamEvent.type === 'task_analyzed') {
        safeSend('acp:task-analyzed', { analysis: streamEvent.analysis });
      } else if (streamEvent.type === 'parallel_group_start') {
        safeSend('acp:parallel-group-start', { groupIndex: streamEvent.groupIndex, stepCount: streamEvent.stepCount });
      } else if (streamEvent.type === 'parallel_group_end') {
        safeSend('acp:parallel-group-end', { groupIndex: streamEvent.groupIndex, durationMs: streamEvent.durationMs });
      } else if (streamEvent.type === 'hitl_request') {
        console.log('[Main] HITL request received, sending to frontend:', streamEvent.request);
        safeSend('acp:hitl-request', streamEvent.request);
        console.log('[Main] HITL request sent to frontend via IPC');
      } else if (streamEvent.type === 'mission_step_update') {
        safeSend('acp:mission-step-update', { step: streamEvent.step, timeline: streamEvent.timeline });
      } else if (streamEvent.type === 'mission_phase_change') {
        safeSend('acp:mission-phase-change', { phase: streamEvent.phase, timeline: streamEvent.timeline });
      } else if (streamEvent.type === 'mission_complete') {
        safeSend('acp:mission-complete', {
          timeline: streamEvent.timeline,
          steps: streamEvent.steps,
          thinkingDuration: streamEvent.thinkingDuration
        });
      } else if (streamEvent.type === 'done') {
        safeSend('acp:stream-chunk', { delta: '', done: true });
      } else if (streamEvent.type === 'usage') {
        safeSend('acp:usage', {
          promptTokens: streamEvent.promptTokens,
          completionTokens: streamEvent.completionTokens,
          totalTokens: streamEvent.totalTokens,
        });
      } else if (streamEvent.type === 'surface_action') {
        safeSend('acp:surface-action', streamEvent);
      }
    }
    (globalThis as any).__everfernSystemFilesPermissionGranted = false;
    return { success: true };
  } catch (error) {
    if (streamAborted) {
      streamSender.send('acp:stream-chunk', { delta: '', done: true });
      (globalThis as any).__everfernSystemFilesPermissionGranted = false;
      return { success: true, stopped: true };
    }
    streamSender.send('acp:stream-chunk', { delta: `\n\n[Error: ${String(error)}]`, done: true });
    (globalThis as any).__everfernSystemFilesPermissionGranted = false;
    return { error: String(error) };
  } finally {
    globalShortcut.unregister(abortKey);
    globalShortcut.unregister(jsonViewerKey);
  }
});

// ── IPC: Chat History ────────────────────────────────────────────────

ipcMain.handle('history:list',    ()                     => historyStore.list());
ipcMain.handle('history:load',    (_e, id: string)       => historyStore.load(id) ?? { error: 'Not found' });
ipcMain.handle('history:save',    (_e, conv)             => historyStore.save(conv));
ipcMain.handle('history:delete',  async (_e, id: string)       => historyStore.delete(id));

// ── IPC: Artifacts ───────────────────────────────────────────────────

ipcMain.handle('artifacts:list',   (_e, chatId?: string)  => listArtifacts(chatId));
ipcMain.handle('artifacts:read',   (_e, chatId: string, filename: string) => readArtifact(chatId, filename));
ipcMain.handle('artifacts:write',  (_e, chatId: string, filename: string, content: string) => writeArtifact(chatId, filename, content));
ipcMain.handle('artifacts:delete', (_e, chatId: string, filename: string) => deleteArtifact(chatId, filename));

// ── IPC: Plans ────────────────────────────────────────────────────────

ipcMain.handle('plans:list',   (_e, chatId: string)                          => listPlans(chatId));
ipcMain.handle('plans:read',   (_e, chatId: string, filename: string)        => readPlan(chatId, filename));
ipcMain.handle('plans:write',  (_e, chatId: string, filename: string, content: string) => writePlan(chatId, filename, content));
ipcMain.handle('plans:delete', (_e, chatId: string, filename: string)        => deletePlan(chatId, filename));

// ── IPC: Sites ────────────────────────────────────────────────────────

ipcMain.handle('sites:list',   (_e, chatId?: string)                         => listSites(chatId));
ipcMain.handle('sites:read',   (_e, chatId: string, filename: string)        => readSiteFile(chatId, filename));
ipcMain.handle('sites:write',  (_e, chatId: string, filename: string, content: string) => writeSiteFile(chatId, filename, content));
ipcMain.handle('sites:delete', (_e, chatId: string, filename?: string)       => deleteSite(chatId, filename));
ipcMain.handle('sites:open-folder', (_e, chatId: string) => {
  const dir = path.join(os.homedir(), '.everfern', 'sites', chatId);
  if (fs.existsSync(dir)) shell.openPath(dir);
});

// ── IPC: Debug / JSON Viewer ───────────────────────────────────────────

ipcMain.handle('debug:get-last-event', () => {
  return lastStreamEvent;
});

ipcMain.handle('debug:get-chat-history', () => {
  // Build full chat history from lastStreamEvent and stored messages
  const fullHistory: any[] = [];

  // Add stored chat messages
  if (lastChatMessages.length > 0) {
    for (const m of lastChatMessages) {
      const msg: any = { role: m.role };
      if (m.role === 'system') {
        msg.content = '[SYSTEM PROMPT - HIDDEN]';
        msg.contentPreview = typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : '[Complex system prompt]';
      } else if (typeof m.content === 'string') {
        msg.content = m.content;
        msg.contentLength = m.content.length;
      } else if (Array.isArray(m.content)) {
        msg.content = m.content.map((c: any) => c.type === 'text' ? c.text : c.type === 'image_url' ? '[Image]' : '[Content]').join('\n');
        msg.hasMultimodal = true;
      }
      if (m.tool_calls) {
        msg.toolCalls = m.tool_calls.map((tc: any) => ({ name: tc.function?.name || tc.name, arguments: tc.function?.arguments || tc.arguments, id: tc.id }));
      }
      if (m.role === 'tool') {
        msg.toolName = m.tool_name;
        msg.toolCallId = m.tool_call_id;
        msg.resultPreview = typeof m.content === 'string' ? m.content.substring(0, 500) + (m.content.length > 500 ? '...' : '') : '[Complex result]';
      }
      fullHistory.push(msg);
    }
  }

  // Add current stream event as the last message
  if (lastStreamEvent) {
    const eventMsg: any = { role: 'event', eventType: lastStreamEvent.type };

    if (lastStreamEvent.type === 'chunk') {
      eventMsg.content = lastStreamEvent.content;
    } else if (lastStreamEvent.type === 'tool_start') {
      eventMsg.toolName = lastStreamEvent.toolName;
      eventMsg.toolArgs = lastStreamEvent.toolArgs;
      eventMsg.description = `Starting: ${lastStreamEvent.toolName}`;
    } else if (lastStreamEvent.type === 'tool_call') {
      eventMsg.toolCall = lastStreamEvent.toolCall;
      eventMsg.description = `Tool called: ${lastStreamEvent.toolCall?.toolName || 'unknown'}`;
    } else if (lastStreamEvent.type === 'thought') {
      eventMsg.thinking = lastStreamEvent.content;
    } else {
      eventMsg.data = lastStreamEvent;
    }

    if (fullHistory.length > 0 || Object.keys(eventMsg).length > 2) {
      fullHistory.push(eventMsg);
    }
  }

  return { type: 'full_chat_history', messageCount: fullHistory.length, messages: fullHistory };
});

ipcMain.handle('debug:copy-to-clipboard', (_e, text: string) => {
  clipboard.writeText(text);
  return true;
});

// ── IPC: ShowUI Local Install ─────────────────────────────────────────

/**
 * Runs the ShowUI installation pipeline step-by-step.
 * Streams each line of stdout/stderr back via 'showui:install-line' events.
 * Emits 'showui:install-done' when all steps complete (or on failure).
 *
 * Steps:
 *   1. conda create -n showui python=3.11 -y
 *   2. conda run -n showui git clone https://github.com/showlab/ShowUI.git <dest>
 *   3. conda run -n showui pip install -r requirements.txt  (in cloned dir)
 */
ipcMain.handle('showui:install', async (event) => {
  const { spawn, execSync } = require('child_process') as typeof import('child_process');
  const installSender = event.sender;

  const isWindows = process.platform === 'win32';
  const scriptsDir = path.join(app.getAppPath(), 'scripts');

  const emit = (line: string, step: number, kind: 'out' | 'err' | 'info' | 'done' | 'fail' | 'pip', pkg?: string, pct?: number, speed?: string, eta?: string) => {
    if (!installSender.isDestroyed()) {
      installSender.send('showui:install-line', { line, step, kind, pkg, pct, speed, eta });
    }
  };

  // ── Determine which command to run ────────────────────────────────
  let cmd: string;
  let args: string[];
  let spawnOpts: import('child_process').SpawnOptions;

  if (isWindows) {
    // Windows: always use setup-showui.bat which internally calls WSL
    const batScript = path.join(scriptsDir, 'setup-showui.bat');
    cmd = batScript;
    args = [];
    spawnOpts = { shell: true, env: { ...process.env, PYTHONUNBUFFERED: '1' } };
    emit('Windows detected — will use WSL if available, then native Python fallback.', 1, 'info');
  } else {
    // macOS / Linux: run setup-unix.sh directly
    const shScript = path.join(scriptsDir, 'setup-unix.sh');
    try { execSync(`chmod +x "${shScript}"`); } catch { /* ignore */ }
    cmd = 'bash';
    args = [shScript];
    spawnOpts = { shell: false, env: { ...process.env, PYTHONUNBUFFERED: '1' } };
    emit('Unix detected — running native setup-unix.sh.', 1, 'info');
  }

  try {
    emit('Initializing EverFern ShowUI Installer...', 1, 'info');

    return new Promise((resolve) => {
      const proc = spawn(cmd, args, spawnOpts);
      installProc = proc; // track for cleanup on app quit
      let resolvedAlready = false;

      // Fallback: actively poll the server in case logs are swallowed
      const pollTimer = setInterval(async () => {
        if (resolvedAlready) {
          clearInterval(pollTimer);
          return;
        }
        try {
          // Send a quick GET to the Gradio port. Any response (even 404/405) means it's alive.
          const res = await fetch('http://127.0.0.1:7860/', { method: 'GET', signal: AbortSignal.timeout(1500) });
          if (res.status && !resolvedAlready) {
            resolvedAlready = true;
            clearInterval(pollTimer);
            emit('EVERFERN_PROGRESS:100', 1, 'info', undefined, 100);
            emit('✅ ShowUI is running on port 7860! Setup complete.', 3, 'done', undefined, 100);
            resolve({ success: true });
          }
        } catch (e) { /* ignore ECONNREFUSED */ }
      }, 3000);

      const parseLine = (l: string) => {
        const line = l.trim();
        if (!line) return;

        // Progress markers
        if (line.includes('EVERFERN_PROGRESS:')) {
          const pct = parseInt(line.split('EVERFERN_PROGRESS:')[1], 10);
          if (!isNaN(pct)) { emit(line, 1, 'info', undefined, pct); return; }
        }
        // ── ShowUI Gradio server is live ────────────────────────────────
        if (line.includes('Running on local URL:') || line.includes('Running on public URL:')) {
          emit(line, 1, 'out');
          if (!resolvedAlready) {
            resolvedAlready = true;
            emit('EVERFERN_PROGRESS:100', 1, 'info', undefined, 100);
            emit('✅ ShowUI is running! Setup complete.', 3, 'done', undefined, 100);
            resolve({ success: true });
          }
          return;
        }
        // Reboot required (exit 11 from bat)
        if (line.includes('REBOOT')) {
          emit('⚠️ WSL installed! Please REBOOT your PC and re-run EverFern.', 1, 'info', undefined, 0);
          return;
        }
        // pip Collecting
        if (line.startsWith('Collecting ')) {
          emit(line, 1, 'pip', line.split(' ')[1]);
          // fall through to print the log
        }
        // pip Downloading
        if (line.startsWith('Downloading ')) {
          emit(line, 1, 'pip', line.split(' ')[1]);
          // fall through to print the log
        }
        // pip progress: ━━━━━━━━━━━━━━━━ 1.2/3.4 MB 2.5 MB/s eta 0:00:01
        const progressMatch = line.match(/([\d\.]+)\/([\d\.]+)\s+([kMGPE]?B)/i);
        if (progressMatch) {
          const dl = parseFloat(progressMatch[1]);
          const total = parseFloat(progressMatch[2]);
          if (total > 0) {
            const pct = Math.round((dl / total) * 100);
            const speedMatch = line.match(/([\d\.]+\s+[kMGPE]?B\/s)/i);
            const etaMatch = line.match(/eta\s+([\d:]+)/i);
            emit('', 1, 'pip', undefined, pct, speedMatch?.[1], etaMatch?.[1]);
            // Don't return, let it print the progress bar cleanly or drop it? Let's hide the raw pip bar to keep logs clean
            return;
          }
        }

        emit(line, 1, 'out');
      };

      let bufferedOut = '';
      proc.stdout?.on('data', (d: Buffer) => {
        bufferedOut += d.toString();
        let idx;
        while ((idx = bufferedOut.search(/[\r\n]/)) !== -1) {
          const line = bufferedOut.substring(0, idx);
          bufferedOut = bufferedOut.substring(idx + 1);
          parseLine(line);
        }
      });

      let bufferedErr = '';
      proc.stderr?.on('data', (d: Buffer) => {
        bufferedErr += d.toString();
        let idx;
        while ((idx = bufferedErr.search(/[\r\n]/)) !== -1) {
          const line = bufferedErr.substring(0, idx).trim();
          bufferedErr = bufferedErr.substring(idx + 1);
          if (!line) continue;
          // Gradio prints "Running on local URL:" to stderr — run through parseLine
          // so our URL-detection / progress logic fires correctly.
          if (line.includes('Running on local URL:') || line.includes('Running on public URL:') || line.includes('EVERFERN_PROGRESS:')) {
            parseLine(line);
          } else {
            emit(line, 1, 'err');
          }
        }
      });

      proc.on('close', (code) => {
        clearInterval(pollTimer);
        if (resolvedAlready) return; // already resolved when Gradio URL appeared
        if (code === 0) {
          emit('✅ ShowUI installation complete!', 3, 'done', undefined, 100);
          resolve({ success: true });
        } else if (code === 11) {
          // Special: reboot required for WSL
          emit('⚠️ Reboot required to finish WSL setup. Please restart your PC.', 2, 'info');
          resolve({ success: false, error: 'reboot_required' });
        } else {
          const msg = `Installation failed with exit code ${code}`;
          emit(`❌ ${msg}`, 0, 'fail');
          resolve({ success: false, error: msg });
        }
      });

      proc.on('error', (err) => {
        clearInterval(pollTimer);
        emit(`❌ Process Error: ${err.message}`, 0, 'fail');
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(`❌ Setup Exception: ${msg}`, 0, 'fail');
    return { success: false, error: msg };
  }
});

ipcMain.handle('showui:launch', async (event) => {
  const launchSender = event.sender;
  const emit = (line: string, kind: 'out' | 'err' | 'info' | 'done') => {
    if (!launchSender.isDestroyed()) launchSender.send('showui:install-line', { line, step: 4, kind });
  };

  try {
    const success = await ensureShowUIServer((line) => emit(line, 'info'));
    return { success };
  } catch (error) {
    emit(`[Launch] Error: ${error}`, 'err');
    return { success: false, error: String(error) };
  }
});

// ── IPC: Permissions ──────────────────────────────────────────────────

ipcMain.handle('permissions:grant', () => {
  permissionsGranted = true;
  return { success: true };
});

ipcMain.handle('permissions:status', () => {
  return { granted: permissionsGranted };
});

// ── IPC: Terminal Processes ───────────────────────────────────────────

ipcMain.handle('terminal:list-processes', () => {
  const registry = CommandRegistry.getInstance();
  return registry.listCommands();
});

ipcMain.handle('terminal:kill-process', (_event, id: string) => {
  const registry = CommandRegistry.getInstance();
  return { success: registry.terminate(id) };
});

// ── IPC: Vector Store (Text-based search, no SQLite-vec) ─────────────

registerContextEngine('vector', () => new VectorContextEngine());
setDefaultContextEngine('vector');

// Initialize vector DB asynchronously, won't block app startup
setTimeout(() => {
  initChatVectorDb().then(() => {
    console.log('[Vectors] Database initialized');
  }).catch(err => {
    console.warn('[Vectors] Initialization failed (non-blocking):', err.message);
  });
}, 5000);

ipcMain.handle('vectors:search', async (_event, query: string, topK: number = 10, chatId?: string) => {
  try {
    return await searchChatVectors(query, topK, chatId);
  } catch (err) {
    console.warn('[Vectors] Search error:', err);
    return [];
  }
});

ipcMain.handle('vectors:get', async (_event, chatId: string) => {
  try {
    return await getChatVectors(chatId);
  } catch (err) {
    console.warn('[Vectors] Get error:', err);
    return [];
  }
});

ipcMain.handle('vectors:delete', async (_event, chatId: string) => {
  try {
    await deleteChatVectors(chatId);
    return { success: true };
  } catch (err) {
    console.warn('[Vectors] Delete error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('vectors:stats', async () => {
  try {
    return await getVecStats();
  } catch (err) {
    console.warn('[Vectors] Stats error:', err);
    return { messageCount: 0, storageSize: 0, dimensionCount: null, initialized: false, error: String(err) };
  }
});

ipcMain.handle('vectors:index-message', async (_event, id: string, chatId: string, role: string, content: string, createdAt: number) => {
  try {
    const { embedAndStoreMessage } = await import('./store/chat-vectors');
    await embedAndStoreMessage(id, chatId, role, content, createdAt);
    return { success: true };
  } catch (err) {
    console.warn('[Vectors] Index error:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('vectors:refresh-config', async () => {
  return { success: true };
});

// ── Custom Skills IPC Handlers ─────────────────────────────────────────────

ipcMain.handle('skills:list-custom', async () => {
  return listCustomSkills();
});

ipcMain.handle('skills:save-custom', async (_event, data: { name: string; description: string; content: string }) => {
  const result = saveCustomSkill(data);
  if (result.success) {
    mergeCustomSkills();
  }
  return result;
});

ipcMain.handle('skills:delete-custom', async (_event, name: string) => {
  const result = deleteCustomSkill(name);
  if (result.success) {
    syncBuiltInSkills();
    mergeCustomSkills();
  }
  return result;
});

ipcMain.handle('skills:get-custom-path', async () => {
  return getCustomSkillsPath();
});

// ── IPC: Integration Management ─────────────────────────────────────────────

interface IntegrationConfig {
  telegram: {
    enabled: boolean;
    botToken: string;
    webhookUrl?: string;
    connected: boolean;
    model?: string;
    provider?: string;
  };
  discord: {
    enabled: boolean;
    botToken: string;
    applicationId: string;
    connected: boolean;
    model?: string;
    provider?: string;
    allowedGuilds?: string[];
    allowedUsers?: string[];
  };
}

// Store integration config in memory (will be persisted to file later)
let integrationConfig: IntegrationConfig = {
  telegram: {
    enabled: false,
    botToken: '',
    webhookUrl: '',
    connected: false,
  },
  discord: {
    enabled: false,
    botToken: '',
    applicationId: '',
    connected: false,
  },
};

// Load integration config from file
const loadIntegrationConfig = (): IntegrationConfig => {
  try {
    const configPath = path.join(os.homedir(), '.everfern', 'integration-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const loaded = JSON.parse(data);

      // Deep merge to ensure backward compatibility with configs missing model/provider fields
      return {
        telegram: {
          ...integrationConfig.telegram,
          ...loaded.telegram,
        },
        discord: {
          ...integrationConfig.discord,
          ...loaded.discord,
        },
      };
    }
  } catch (error) {
    console.warn('[Integration] Failed to load config:', error);
  }
  return integrationConfig;
};

// Save integration config to file
const saveIntegrationConfig = (config: IntegrationConfig): void => {
  try {
    const configDir = path.join(os.homedir(), '.everfern');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const configPath = path.join(configDir, 'integration-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('[Integration] Failed to save config:', error);
    throw error;
  }
};

// Test Telegram bot connection
const testTelegramConnection = async (botToken: string): Promise<boolean> => {
  try {
    if (!botToken || !botToken.trim()) {
      return false;
    }

    // Test the bot token by calling getMe API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Integration] Telegram API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    if (data.ok && data.result) {
      console.log('[Integration] Telegram bot connected:', data.result.username);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Integration] Telegram connection test failed:', error);
    return false;
  }
};

// Test Discord bot connection
const testDiscordConnection = async (botToken: string, applicationId: string): Promise<boolean> => {
  try {
    if (!botToken || !botToken.trim() || !applicationId || !applicationId.trim()) {
      return false;
    }

    // Test the bot token by calling Discord API to get application info
    const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Integration] Discord API error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    if (data.id && data.name) {
      console.log('[Integration] Discord bot connected:', data.name);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Integration] Discord connection test failed:', error);
    return false;
  }
};

// Load config on startup
integrationConfig = loadIntegrationConfig();

ipcMain.handle('integration:get-config', (): Promise<IntegrationConfig> => {
  return Promise.resolve(integrationConfig);
});

ipcMain.handle('integration:save-config', async (_event, config: IntegrationConfig): Promise<void> => {
  try {
    integrationConfig = { ...config };
    saveIntegrationConfig(integrationConfig);
    console.log('[Integration] Configuration saved successfully');

    // Reinitialize MessageHandler if config changed
    const botManager = integrationService.getService<any>('bot-integration-manager');
    if (botManager) {
      // Check if at least one bot has model/provider configured
      const hasConfiguredBot =
        (integrationConfig.discord.enabled && integrationConfig.discord.connected &&
         integrationConfig.discord.model && integrationConfig.discord.provider) ||
        (integrationConfig.telegram.enabled && integrationConfig.telegram.connected &&
         integrationConfig.telegram.model && integrationConfig.telegram.provider);

      if (hasConfiguredBot) {
        // Shutdown existing MessageHandler if it exists
        if (messageHandler) {
          console.log('[Integration] Shutting down existing MessageHandler...');
          await messageHandler.shutdown();
          messageHandler = null;
        }

        // Create new MessageHandler with updated config
        messageHandler = new MessageHandler({
          integrationConfig,
          acpManager,
          botManager
        });
        console.log('[Integration] MessageHandler reinitialized with updated config');
      } else if (messageHandler) {
        // No configured bots, shutdown MessageHandler
        console.log('[Integration] No configured bots, shutting down MessageHandler...');
        await messageHandler.shutdown();
        messageHandler = null;
      }

      // Update Discord platform config if it's running
      const discordPlatform = botManager.getPlatform?.('discord');
      if (discordPlatform && integrationConfig.discord.enabled) {
        console.log('[Integration] Updating Discord platform configuration...');
        // Disconnect and reconnect with new config
        await discordPlatform.disconnect();
        const { DiscordPlatform } = await import('./integrations/discord-platform');
        const newPlatform = new DiscordPlatform({
          enabled: true,
          config: {
            botToken: integrationConfig.discord.botToken,
            applicationId: integrationConfig.discord.applicationId,
            respondToDMs: true,
            respondToGuilds: true,
            guildMentionOnly: true,
            allowedGuilds: integrationConfig.discord.allowedGuilds || [],
            allowedUsers: integrationConfig.discord.allowedUsers || []
          }
        });
        await newPlatform.initialize();
        botManager.registerPlatform('discord', newPlatform);
        console.log('[Integration] Discord platform updated with new config');
      }
    }
  } catch (error) {
    console.error('[Integration] Failed to save configuration:', error);
    throw error;
  }
});

ipcMain.handle('integration:test-connection', async (_event, platform: string): Promise<boolean> => {
  try {
    console.log(`[Integration] Testing ${platform} connection...`);

    let result = false;

    if (platform === 'telegram') {
      result = await testTelegramConnection(integrationConfig.telegram.botToken);
      console.log(`[Integration] Telegram test result: ${result}`);
    } else if (platform === 'discord') {
      result = await testDiscordConnection(
        integrationConfig.discord.botToken,
        integrationConfig.discord.applicationId
      );
      console.log(`[Integration] Discord test result: ${result}`);
    } else {
      console.warn(`[Integration] Unknown platform: ${platform}`);
      return false;
    }

    // Update the connected status based on test result
    if (platform === 'telegram') {
      integrationConfig.telegram.connected = result;
    } else if (platform === 'discord') {
      integrationConfig.discord.connected = result;
    }

    // Persist the updated configuration to disk
    saveIntegrationConfig(integrationConfig);
    console.log(`[Integration] Updated ${platform} connected status to: ${result}`);

    // If test succeeded and platform is enabled, start the bot
    if (result) {
      const botManager = integrationService.getService<any>('bot-integration-manager');

      if (botManager) {
        try {
          if (platform === 'discord' && integrationConfig.discord.enabled) {
            // Check if Discord platform is already registered
            const existingPlatform = botManager.getPlatform?.('discord');
            if (!existingPlatform) {
              console.log('[Integration] Starting Discord bot after successful test...');
              const { DiscordPlatform } = await import('./integrations/discord-platform');
              const discordPlatform = new DiscordPlatform({
                enabled: true,
                config: {
                  botToken: integrationConfig.discord.botToken,
                  applicationId: integrationConfig.discord.applicationId,
                  respondToDMs: true,
                  respondToGuilds: true,
                  guildMentionOnly: true,
                  allowedGuilds: integrationConfig.discord.allowedGuilds || [],
                  allowedUsers: integrationConfig.discord.allowedUsers || []
                }
              });
              await discordPlatform.initialize();
              botManager.registerPlatform('discord', discordPlatform);
              console.log('[Integration] Discord bot started and registered');
            } else {
              console.log('[Integration] Discord bot already running');
            }
          } else if (platform === 'telegram' && integrationConfig.telegram.enabled) {
            // Check if Telegram platform is already registered
            const existingPlatform = botManager.getPlatform?.('telegram');
            if (!existingPlatform) {
              console.log('[Integration] Starting Telegram bot after successful test...');
              const { TelegramPlatform } = await import('./integrations/telegram-platform');
              const telegramPlatform = new TelegramPlatform({
                enabled: true,
                config: {
                  botToken: integrationConfig.telegram.botToken,
                  webhookUrl: integrationConfig.telegram.webhookUrl,
                  respondToGroups: true,
                  groupMentionOnly: false
                }
              });
              await telegramPlatform.initialize();
              botManager.registerPlatform('telegram', telegramPlatform);
              console.log('[Integration] Telegram bot started and registered');
            } else {
              console.log('[Integration] Telegram bot already running');
            }
          }
        } catch (startError) {
          console.error(`[Integration] Failed to start ${platform} bot after test:`, startError);
          // Don't fail the test connection, just log the error
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`[Integration] Connection test failed for ${platform}:`, error);

    // Set connected to false on error
    if (platform === 'telegram') {
      integrationConfig.telegram.connected = false;
    } else if (platform === 'discord') {
      integrationConfig.discord.connected = false;
    }
    saveIntegrationConfig(integrationConfig);

    return false;
  }
});

ipcMain.handle('integration:get-service-status', (_event, serviceName?: string) => {
  try {
    return integrationService.getServiceStatus(serviceName);
  } catch (error) {
    console.error('[Integration] Failed to get service status:', error);
    return { name: serviceName || 'unknown', status: 'error', error: String(error) };
  }
});

ipcMain.handle('integration:get-system-status', () => {
  try {
    return integrationService.getSystemStatus();
  } catch (error) {
    console.error('[Integration] Failed to get system status:', error);
    return {
      initialized: false,
      started: false,
      servicesRunning: 0,
      servicesTotal: 0,
      errors: [String(error)]
    };
  }
});

ipcMain.handle('integration:start-service', async (_event, serviceName: string) => {
  try {
    const service = integrationService.getService(serviceName);
    if (service && typeof service.start === 'function') {
      await service.start();
      return { success: true };
    }
    return { success: false, error: 'Service not found or not startable' };
  } catch (error) {
    console.error(`[Integration] Failed to start service ${serviceName}:`, error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('integration:stop-service', async (_event, serviceName: string) => {
  try {
    const service = integrationService.getService(serviceName);
    if (service && typeof service.stop === 'function') {
      await service.stop();
      return { success: true };
    }
    return { success: false, error: 'Service not found or not stoppable' };
  } catch (error) {
    console.error(`[Integration] Failed to stop service ${serviceName}:`, error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('integration:restart-service', async (_event, serviceName: string) => {
  try {
    const service = integrationService.getService(serviceName);
    if (service) {
      if (typeof service.stop === 'function') {
        await service.stop();
      }
      if (typeof service.start === 'function') {
        await service.start();
      }
      return { success: true };
    }
    return { success: false, error: 'Service not found' };
  } catch (error) {
    console.error(`[Integration] Failed to restart service ${serviceName}:`, error);
    return { success: false, error: String(error) };
  }
});

// ── IPC: Providers ──────────────────────────────────────────────────

ipcMain.handle('providers:get-all', () => {
  const providers = Object.values(PROVIDER_REGISTRY);

  // Check which providers have API keys configured
  const providersWithStatus = providers.map((provider) => {
    let enabled = true;

    // For providers that require API keys, check if they're configured
    if (provider.requiresApiKey) {
      try {
        const config = loadConfigSync();
        if (config && config.keys) {
          // Check if the provider has an API key in the keys object
          const apiKey = config.keys[provider.type];
          enabled = !!apiKey && apiKey.trim().length > 0;
        } else {
          enabled = false;
        }
      } catch {
        enabled = false;
      }
    }
    // Local providers (ollama, lmstudio) are always enabled
    // everfern is always enabled (no API key required)

    return {
      ...provider,
      enabled
    };
  });

  return providersWithStatus;
});

ipcMain.handle('providers:get-models', (_event, providerType: string): FlatModelEntry[] => {
  const type = providerType as ProviderType;
  const models = getModelsForProvider(type);
  const providerMeta = PROVIDER_REGISTRY[type];

  return models.map(modelId => ({
    id: modelId,
    name: formatModelName(modelId),
    provider: providerMeta?.name || providerType,
    providerType: type
  }));
});

export function isPermissionGranted() { return permissionsGranted; }

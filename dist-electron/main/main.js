"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPermissionGranted = isPermissionGranted;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const manager_1 = require("./acp/manager");
const history_1 = require("./store/history");
const runner_1 = require("./agent/runner/runner");
const showui_server_1 = require("./agent/runner/showui-server");
const ai_client_1 = require("./lib/ai-client");
const providers_1 = require("./lib/providers");
const debug_1 = require("./lib/debug");
// ── Initialize Logging ──────────────────────────────────────────────
(0, debug_1.setupLogging)();
console.log('[Startup] EverFern Main Process starting...');
console.log('[Startup] Platform:', process.platform);
console.log('[Startup] Node version:', process.version);
console.log('[Startup] App path:', electron_1.app.getAppPath());
console.log('[Startup] User data:', electron_1.app.getPath('userData'));
const electron_2 = require("electron");
const memory_save_1 = require("./agent/tools/memory-save");
const artifacts_1 = require("./store/artifacts");
const plans_1 = require("./store/plans");
const sites_1 = require("./store/sites");
const chat_vectors_1 = require("./store/chat-vectors");
const context_engine_1 = require("./context-engine");
const vector_1 = require("./context-engine/vector");
const electron_3 = require("electron");
const skills_sync_1 = require("./lib/skills-sync");
const registry_1 = require("./agent/tools/terminal/registry");
// ── GPU / Cache Startup Fixes (must run before app.whenReady) ───────────────
// Disable GPU shader disk cache — prevents "Access is denied (0x5)" on Windows
// when a previous Electron process left the GPUCache directory locked.
electron_1.app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
// Disable the net disk cache for the same reason (net\disk_cache errors).
electron_1.app.commandLine.appendSwitch('disable-application-cache');
// Suppress Chromium GPU blocklist — lets the GPU initialise even after a crash.
electron_1.app.commandLine.appendSwitch('ignore-gpu-blocklist');
// Clear any stale GPU / network cache directories left by a previous run.
(function clearStaleCache() {
    try {
        const userData = electron_1.app.getPath('userData');
        const dirsToWipe = ['GPUCache', 'ShaderCache', 'DawnCache', 'GrShaderCache'];
        for (const dir of dirsToWipe) {
            const full = path.join(userData, dir);
            if (fs.existsSync(full)) {
                fs.rmSync(full, { recursive: true, force: true });
            }
        }
    }
    catch (e) {
        console.warn('[Startup] Could not clear stale GPU cache:', e);
    }
})();
// ── Singletons ──────────────────────────────────────────────────────
let acpManager;
let historyStore;
try {
    console.log('[Startup] Initializing ACPManager...');
    acpManager = new manager_1.ACPManager();
    console.log('[Startup] Initializing ChatHistoryStore...');
    historyStore = new history_1.ChatHistoryStore();
    console.log('[Startup] Singletons initialized.');
}
catch (err) {
    console.error('[Startup] ❌ Critical failure during singleton initialization:', err);
}
// Computer-Use Permissions (per session)
let permissionsGranted = false;
// System-files write permissions (per chat run/session, shared with sandbox runtime)
globalThis.__everfernSystemFilesPermissionGranted = false;
// Last stream event for JSON viewer
let lastStreamEvent = null;
// Full chat messages for JSON viewer
let lastChatMessages = [];
let mainWindow = null;
// Tracks the ShowUI install/run process so we can kill it on app quit
let installProc = null;
// ── Window ──────────────────────────────────────────────────────────
function createWindow() {
    const isDev = !electron_1.app.isPackaged;
    console.log(`[Window] Creating window (app.isPackaged: ${electron_1.app.isPackaged}, isDev: ${isDev})`);
    console.log(`[Window] NODE_ENV: ${process.env.NODE_ENV}`);
    mainWindow = new electron_1.BrowserWindow({
        width: 1200, height: 800,
        minWidth: 800, minHeight: 600,
        frame: false,
        icon: isDev
            ? path.join(__dirname, '../../public/images/logos/everfern-rounded.png')
            : path.join(electron_1.app.getAppPath(), process.platform === 'win32'
                ? 'public/images/logos/everfern.ico'
                : 'public/images/logos/everfern-rounded.png'),
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#1a1a1a',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            webSecurity: false, // Temporarily disabled for production path debugging
        },
    });
    // Fallback: Show window after 5 seconds if ready-to-show never fires
    const showFallback = setTimeout(() => {
        if (mainWindow && !mainWindow.isVisible()) {
            console.warn('[Window] ready-to-show timed out, forcing show()');
            mainWindow.show();
        }
    }, 5000);
    mainWindow.once('ready-to-show', () => {
        console.log('[Window] ready-to-show received');
        clearTimeout(showFallback);
        mainWindow?.show();
    });
    if (isDev) {
        console.log('[Window] Loading dev URL: http://localhost:3001');
        // Wait for Next.js to be ready
        const waitForNext = () => new Promise((resolve, reject) => {
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
                }
                catch (err) {
                    console.log(`[Window] Attempt ${attempt}/30 failed: ${err}, waiting...`);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            console.error('[Window] ❌ Next.js did not start in time');
        };
        console.log('[Window] Starting tryLoad...');
        tryLoad();
    }
    else {
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
electron_1.protocol.registerSchemesAsPrivileged([
    { scheme: 'everfern-app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } },
    { scheme: 'everfern-site', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } }
]);
// ── App lifecycle ───────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    console.log('[App] App ready, starting initialization...');
    // ── Protocol Handlers ──────────────────────────────────────────────
    // Custom protocol for the main application (Next.js out folder)
    electron_1.protocol.handle('everfern-app', async (request) => {
        try {
            const url = new URL(request.url);
            let filePath = url.pathname;
            if (filePath === '/' || !filePath || filePath === '.')
                filePath = '/index.html';
            // Normalize path (handle leading slashes and dots)
            if (filePath.startsWith('./'))
                filePath = filePath.substring(1);
            if (!filePath.startsWith('/'))
                filePath = '/' + filePath;
            const baseDir = electron_1.app.isPackaged
                ? path.join(electron_1.app.getAppPath(), 'out')
                : path.join(__dirname, '../../out');
            const absPath = path.join(baseDir, filePath);
            console.log(`[Protocol] Request: ${request.url} -> ${absPath} (baseDir: ${baseDir}, isPackaged: ${electron_1.app.isPackaged})`);
            if (!fs.existsSync(absPath)) {
                console.warn(`[Protocol] ⚠️ 404: ${absPath}, trying index.html for client-side routing`);
                const indexPath = path.join(baseDir, 'index.html');
                if (fs.existsSync(indexPath)) {
                    const data = fs.readFileSync(indexPath);
                    return new Response(data, {
                        headers: { 'Content-Type': 'text/html' }
                    });
                }
                console.warn(`[Protocol] ❌ 404: ${absPath} and index.html not found`);
                return new Response('Not Found', { status: 404 });
            }
            const extension = path.extname(absPath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.otf': 'font/otf',
            };
            const contentType = mimeTypes[extension] || 'application/octet-stream';
            const data = fs.readFileSync(absPath);
            return new Response(data, {
                headers: { 'Content-Type': contentType }
            });
        }
        catch (err) {
            console.error('[Protocol] ❌ Error handling request:', err);
            const errorMsg = err instanceof Error ? err.message : String(err);
            return new Response(`Internal Server Error: ${errorMsg}`, { status: 500 });
        }
    });
    // Custom protocol for local sites
    electron_1.protocol.handle('everfern-site', (request) => {
        // ... existing site logic ...
        const url = new URL(request.url);
        const chatId = url.hostname;
        let filePath = url.pathname;
        if (filePath === '/' || !filePath)
            filePath = '/index.html';
        // Try sites folder first, then artifacts folder
        let absPath = path.join(os.homedir(), '.everfern', 'sites', chatId, filePath);
        if (!fs.existsSync(absPath)) {
            absPath = path.join(os.homedir(), '.everfern', 'artifacts', chatId, filePath);
        }
        if (!fs.existsSync(absPath))
            return new Response('Not Found', { status: 404 });
        // Safety check: ensure path is within ~/.everfern/sites or ~/.everfern/artifacts
        const sitesRoot = path.join(os.homedir(), '.everfern', 'sites');
        const artifactsRoot = path.join(os.homedir(), '.everfern', 'artifacts');
        const isUnderSites = absPath.startsWith(sitesRoot);
        const isUnderArtifacts = absPath.startsWith(artifactsRoot);
        if (!isUnderSites && !isUnderArtifacts) {
            return new Response('Forbidden', { status: 403 });
        }
        return electron_1.net.fetch(`file://${absPath.replace(/\\/g, '/')}`);
    });
    // ── Create Main Window ─────────────────────────────────────────────
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    // On macOS, re-create the window when the dock icon is clicked and no windows are open.
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// ── ShowUI process cleanup on quit ──────────────────────────────────
electron_1.app.on('before-quit', () => {
    // Kill the install/run process spawned by showui:install
    if (installProc) {
        try {
            installProc.kill('SIGTERM');
        }
        catch { /* ignore */ }
        installProc = null;
    }
    // Kill the server managed by showui-server.ts (e.g. from showui:launch)
    (0, showui_server_1.killShowUIServer)();
});
// ── IPC: Window Controls ────────────────────────────────────────────
electron_1.ipcMain.handle('window:minimize', () => { mainWindow?.minimize(); });
electron_1.ipcMain.handle('window:maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); });
electron_1.ipcMain.handle('window:close', () => { mainWindow?.close(); });
electron_1.ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() || false);
// ── IPC: Audio ──────────────────────────────────────────────────────
electron_1.ipcMain.handle('audio:play-sound', async (_event, soundPath) => {
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
        }
        else if (platform === 'darwin') {
            // macOS: Use afplay command
            execFile('afplay', [soundFilePath]);
        }
        else if (platform === 'linux') {
            // Linux: Try paplay or other available audio player
            execFile('paplay', [soundFilePath], (err) => {
                if (err) {
                    console.warn('[Audio] paplay failed, trying aplay:', err);
                    execFile('aplay', [soundFilePath]);
                }
            });
        }
        return true;
    }
    catch (err) {
        console.error('[Audio] Error playing sound:', err);
        return false;
    }
});
// ── IPC: Config ─────────────────────────────────────────────────────
electron_1.ipcMain.handle('save-config', async (_event, config) => {
    try {
        const configDir = path.join(os.homedir(), '.everfern');
        const configPath = path.join(configDir, 'config.json');
        if (!fs.existsSync(configDir))
            fs.mkdirSync(configDir, { recursive: true });
        // Multi-file Key Isolation (Main Provider)
        if (config.apiKey && config.provider) {
            const keysDir = path.join(configDir, 'keys');
            if (!fs.existsSync(keysDir))
                fs.mkdirSync(keysDir, { recursive: true });
            const keyPath = path.join(keysDir, `${config.provider}.key`);
            fs.writeFileSync(keyPath, config.apiKey.trim());
            console.log(`[Config] Isolated key saved for ${config.provider}`);
        }
        // Key Isolation (Vision Model)
        if (config.vlm?.apiKey && config.vlm?.provider) {
            const keysDir = path.join(configDir, 'keys');
            if (!fs.existsSync(keysDir))
                fs.mkdirSync(keysDir, { recursive: true });
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
                apiKey: config.apiKey,
                model: scrubbedConfig.model,
                baseUrl: scrubbedConfig.baseUrl,
                vlm: scrubbedConfig.vlm, // Pass VLM to manager
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('[Config] Failed to save:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});
// ── Helper: loadConfigSync ──────────────────────────────────────────
function loadConfigSync() {
    try {
        const configDir = path.join(os.homedir(), '.everfern');
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
                        }
                        else {
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
    }
    catch (err) {
        console.error('[Config] Error loading config:', err);
        return null;
    }
}
electron_1.ipcMain.handle('load-config', async () => {
    try {
        const config = loadConfigSync();
        if (!config)
            return { success: true, config: null };
        return { success: true, config };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});
// ── IPC: System ──────────────────────────────────────────────────────
electron_1.ipcMain.handle('system:get-username', () => {
    return require('os').userInfo().username;
});
electron_1.ipcMain.handle('system:open-file-picker', async (_, options) => {
    if (!mainWindow)
        return null;
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: options?.filters || [
            { name: 'All Files', extensions: ['*'] },
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
            { name: 'Text & Documents', extensions: ['txt', 'md', 'json', 'csv', 'js', 'ts', 'py', 'log', 'html', 'css'] }
        ]
    });
    if (canceled || filePaths.length === 0)
        return null;
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
        }
        else {
            const content = fs.readFileSync(newFilePath, 'utf-8');
            return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType: 'text/plain', content, success: true };
        }
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
electron_1.ipcMain.handle('system:open-folder-picker', async () => {
    if (!mainWindow)
        return null;
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0)
        return null;
    const folderPath = filePaths[0];
    try {
        const stats = fs.statSync(folderPath);
        if (!stats.isDirectory())
            return { success: false, error: 'Selected path is not a folder.' };
        return { path: folderPath, name: path.basename(folderPath), success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
});
electron_1.ipcMain.handle('system:wipe-account', async () => {
    // ...
});
electron_1.ipcMain.handle('system:open-folder', async (_event, folderPath) => {
    if (folderPath && fs.existsSync(folderPath)) {
        electron_3.shell.openPath(folderPath);
        return { success: true };
    }
    return { success: false, error: 'Folder not found' };
});
function getOllamaBinary() {
    const isWin = process.platform === 'win32';
    if (isWin) {
        const home = os.homedir();
        const ollamaPath = path.join(home, 'AppData', 'Local', 'Programs', 'ollama', 'ollama.exe');
        if (fs.existsSync(ollamaPath))
            return `"${ollamaPath}"`;
        return 'ollama';
    }
    return '/usr/local/bin/ollama';
}
electron_1.ipcMain.handle('system:ollama-status', () => {
    try {
        const { execSync } = require('child_process');
        const bin = getOllamaBinary();
        // Check if Ollama is installed
        try {
            execSync(`${bin} -v`, { stdio: 'ignore' });
        }
        catch {
            return { installed: false, modelInstalled: false };
        }
        // Check if the specific model is pulled
        try {
            const list = execSync(`"${bin}" list`, { encoding: 'utf8' });
            const modelInstalled = list.includes('qwen3-vl:2b');
            return { installed: true, modelInstalled };
        }
        catch {
            return { installed: true, modelInstalled: false };
        }
    }
    catch {
        return { installed: false, modelInstalled: false };
    }
});
electron_1.ipcMain.handle('system:ollama-install', async (event) => {
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
        proc.stdout.on('data', (d) => {
            d.toString().split('\n').filter(Boolean).forEach((line) => {
                event.sender.send('system:ollama-install-line', { line: line.trim(), type: 'stdout' });
            });
        });
        proc.stderr.on('data', (d) => {
            d.toString().split('\n').filter(Boolean).forEach((line) => {
                event.sender.send('system:ollama-install-line', { line: line.trim(), type: 'stderr' });
            });
        });
        proc.on('close', (code) => {
            resolve({ success: code === 0, code });
        });
    });
});
electron_1.ipcMain.handle('system:ollama-pull', async (event, modelName) => {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        const bin = getOllamaBinary();
        const isWin = process.platform === 'win32';
        // Use `ollama pull` (not `ollama run`) — cleaner for background downloads, no interactive prompt
        // For Unix-like systems, we don't usually need shell: true if we have the full path,
        // but on Windows if the path has spaces and is not in PATH, shell: true can help with quoted paths.
        const proc = spawn(bin, ['pull', modelName], { shell: isWin && bin !== 'ollama' });
        proc.stdout.on('data', (d) => {
            d.toString().split('\n').filter(Boolean).forEach((line) => {
                event.sender.send('system:ollama-pull-line', { line: line.trim(), type: 'stdout' });
            });
        });
        proc.stderr.on('data', (d) => {
            d.toString().split('\n').filter(Boolean).forEach((line) => {
                event.sender.send('system:ollama-pull-line', { line: line.trim(), type: 'stderr' });
            });
        });
        proc.on('close', (code) => resolve({ success: code === 0 || code === null, code }));
    });
});
// ── IPC: Memory ──────────────────────────────────────────────────────
electron_1.ipcMain.handle('memory:save-direct', async (_event, content, metadata) => {
    return memory_save_1.memorySaveTool.execute({ content, metadata });
});
// ── IPC: ACP Provider ────────────────────────────────────────────────
electron_1.ipcMain.handle('acp:list-providers', () => acpManager.listProviders());
electron_1.ipcMain.handle('acp:set-provider', async (_event, config) => {
    return acpManager.setProvider(config);
});
electron_1.ipcMain.handle('acp:health-check', async () => acpManager.healthCheck());
electron_1.ipcMain.handle('acp:validate-nvidia-model', async (_event, modelId, apiKey) => {
    try {
        const res = await fetch(`https://integrate.api.nvidia.com/v1/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok)
            return { valid: false };
        const data = await res.json();
        const exists = data.data?.some((m) => m.id === modelId);
        return { valid: !!exists };
    }
    catch {
        return { valid: false };
    }
});
electron_1.ipcMain.handle('acp:list-models', async () => {
    try {
        const config = acpManager.getActiveConfig();
        let providerType = config ? config.provider : 'everfern';
        if (providerType === 'google')
            providerType = 'gemini';
        // 1. Get models for the active configured provider
        const activeModels = (0, providers_1.getAllModelsFlat)().filter(m => m.providerType === providerType);
        if (providerType === 'nvidia' && config?.customModel) {
            if (!activeModels.find(m => m.id === config.customModel)) {
                activeModels.unshift({
                    id: config.customModel,
                    name: config.customModel + " (Custom)",
                    provider: 'Nvidia NIM',
                    providerType: 'nvidia'
                });
            }
        }
        // 2. Fetch local Ollama models dynamically
        let ollamaModels = [];
        try {
            const ollamaClient = new ai_client_1.AIClient({ provider: 'ollama' });
            const rawOllama = await ollamaClient.listModels();
            ollamaModels = rawOllama.map((m) => ({
                id: m,
                name: m,
                provider: 'Ollama',
                providerType: 'ollama'
            }));
            if (rawOllama.length === 0) {
                ollamaModels.push({ id: 'ollama-empty', name: 'No models found in Ollama', provider: 'Ollama', providerType: 'ollama' });
            }
        }
        catch {
            ollamaModels.push({ id: 'ollama-error', name: 'Ollama is not running/installed', provider: 'Ollama', providerType: 'ollama' });
        }
        // 3. Fetch local LM Studio dynamically
        let lmstudioModels = [];
        try {
            const lmClient = new ai_client_1.AIClient({ provider: 'lmstudio' });
            const rawLm = await lmClient.listModels();
            lmstudioModels = rawLm.map((m) => ({
                id: m,
                name: m,
                provider: 'LM Studio',
                providerType: 'lmstudio'
            }));
            if (rawLm.length === 0) {
                lmstudioModels.push({ id: 'lmstudio-empty', name: 'No models found in LM Studio', provider: 'LM Studio', providerType: 'lmstudio' });
            }
        }
        catch {
            lmstudioModels.push({ id: 'lmstudio-error', name: 'LM Studio is not running/installed', provider: 'LM Studio', providerType: 'lmstudio' });
        }
        // Deduplicate and combine
        const merged = [...activeModels];
        for (const om of [...ollamaModels, ...lmstudioModels]) {
            if (!merged.find(m => m.id === om.id))
                merged.push(om);
        }
        if (merged.length === 0) {
            merged.push({ id: 'everfern-1', name: 'Fern-1', provider: 'EverFern Cloud', providerType: 'everfern' });
        }
        return { success: true, models: merged };
    }
    catch (error) {
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
electron_1.ipcMain.removeHandler('acp:chat');
electron_1.ipcMain.handle('acp:chat', async (_event, request) => {
    let client = acpManager.getClient();
    const config = loadConfigSync();
    // Dynamic provider resolution: if the frontend specifies a providerType that differs
    // from the statically-configured provider, create a fresh AIClient with the correct
    // API key loaded from ~/.everfern/keys/<provider>.key
    if (request.providerType) {
        const currentProvider = acpManager.getActiveConfig()?.provider;
        if (request.providerType !== currentProvider || !client) {
            const apiKey = config?.keys?.[request.providerType] || '';
            client = new ai_client_1.AIClient({
                provider: request.providerType,
                model: request.model,
                apiKey,
            });
            console.log(`[acp:chat] Dynamic provider switch: ${currentProvider} → ${request.providerType}`);
        }
        else if (request.model) {
            client.setModel(request.model);
        }
    }
    if (!client) {
        return { error: 'No AI provider configured. Please complete setup first.' };
    }
    let sessionPermissionGranted = false;
    globalThis.__everfernSystemFilesPermissionGranted = false;
    const runnerConfig = {
        showuiUrl: config?.showuiUrl || 'http://127.0.0.1:7860',
        ollamaBaseUrl: (request.providerType === 'ollama' || config?.provider === 'ollama') ? config?.baseUrl || 'http://localhost:11434' : undefined,
        requestPermission: () => {
            return new Promise((resolve) => {
                agentPermissionResolver = (granted) => {
                    if (granted) {
                        sessionPermissionGranted = true;
                        globalThis.__everfernSystemFilesPermissionGranted = true;
                    }
                    resolve(granted);
                };
                if (mainWindow) {
                    // Send permission request and show system notification
                    mainWindow.webContents.send('agent:permission-request');
                    // Show system notification
                    if (electron_1.Notification.isSupported()) {
                        const iconPath = path.join(electron_1.app.getAppPath(), 'public', 'images', 'logos', 'icon.png');
                        const notification = new electron_1.Notification({
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
                }
                else {
                    resolve(false);
                }
            });
        },
        checkPermission: () => sessionPermissionGranted,
        vlm: config?.vlm,
    };
    const runner = new runner_1.AgentRunner(client, runnerConfig);
    // Extract the latest user message as the trigger
    const history = request.messages.slice(0, -1);
    const lastMsg = request.messages[request.messages.length - 1];
    const userInput = lastMsg?.content ?? '';
    try {
        const result = await runner.run(userInput, history, request.model, request.conversationId);
        globalThis.__everfernSystemFilesPermissionGranted = false;
        return {
            success: true,
            response: {
                content: result.response,
                toolCalls: result.toolCalls,
                model: request.model ?? 'unknown',
            },
        };
    }
    catch (error) {
        console.error('[AgentRunner] Error:', error);
        globalThis.__everfernSystemFilesPermissionGranted = false;
        return { error: error instanceof Error ? error.message : String(error) };
    }
});
/**
 * Streaming chat — sends chunks via IPC events.
 * Renderer listens on 'acp:stream-chunk' and 'acp:tool-call'.
 * Supports cancellation via 'acp:stop'.
 */
let streamAborted = false;
let agentPermissionResolver = null;
electron_1.ipcMain.removeHandler('agent:permission-response');
electron_1.ipcMain.handle('agent:permission-response', (_event, granted) => {
    if (agentPermissionResolver) {
        agentPermissionResolver(granted);
        agentPermissionResolver = null;
    }
    if (granted) {
        globalThis.__everfernSystemFilesPermissionGranted = true;
    }
    return { success: true };
});
electron_1.ipcMain.removeHandler('acp:validate-nvidia-model');
electron_1.ipcMain.handle('acp:validate-nvidia-model', async (_event, modelId, apiKey) => {
    try {
        const res = await fetch(`https://integrate.api.nvidia.com/v1/models/${modelId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok)
            return { valid: false };
        const data = await res.json();
        const hasVision = data?.capabilities?.vision === true
            || (data?.id ?? '').toLowerCase().includes('vision')
            || (data?.id ?? '').toLowerCase().includes('vl')
            || (data?.id ?? '').toLowerCase().includes('vllm');
        return { valid: true, hasVision, modelData: data };
    }
    catch (err) {
        return { valid: false, error: String(err) };
    }
});
electron_1.ipcMain.handle('acp:stop', () => {
    streamAborted = true;
    // Also abort any running computer-use tool
    const { abortComputerUse } = require('./agent/tools/computer-use');
    abortComputerUse();
    return { success: true };
});
electron_1.ipcMain.handle('acp:stream', async (event, request) => {
    const streamSender = event.sender;
    streamAborted = false; // RESET STOP STATE FOR NEW MISSION
    let client = acpManager.getClient();
    const config = loadConfigSync();
    // Dynamic provider resolution: same logic as acp:chat
    if (request.providerType) {
        const currentProvider = acpManager.getActiveConfig()?.provider;
        if (request.providerType !== currentProvider || !client) {
            const apiKey = config?.keys?.[request.providerType] || '';
            client = new ai_client_1.AIClient({
                provider: request.providerType,
                model: request.model,
                apiKey,
            });
            console.log(`[acp:stream] Dynamic provider switch: ${currentProvider} → ${request.providerType}`);
        }
        else if (request.model) {
            client.setModel(request.model);
        }
    }
    if (!client) {
        return { error: 'No AI provider configured.' };
    }
    let sessionPermissionGranted = false;
    globalThis.__everfernSystemFilesPermissionGranted = false;
    const runnerConfig = {
        showuiUrl: config?.showuiUrl || 'http://127.0.0.1:7860',
        ollamaBaseUrl: (request.providerType === 'ollama' || config?.provider === 'ollama') ? config?.baseUrl || 'http://localhost:11434' : undefined,
        requestPermission: () => {
            return new Promise((resolve) => {
                agentPermissionResolver = (granted) => {
                    if (granted) {
                        sessionPermissionGranted = true;
                        globalThis.__everfernSystemFilesPermissionGranted = true;
                    }
                    resolve(granted);
                };
                if (mainWindow) {
                    // Send permission request and show system notification
                    mainWindow.webContents.send('agent:permission-request');
                    // Show system notification
                    if (electron_1.Notification.isSupported()) {
                        const iconPath = path.join(electron_1.app.getAppPath(), 'public', 'images', 'logos', 'icon.png');
                        const notification = new electron_1.Notification({
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
                }
                else {
                    resolve(false);
                }
            });
        },
        checkPermission: () => sessionPermissionGranted, // Security: Ask once per chat request
        vlm: config?.vlm,
        shouldAbort: () => streamAborted,
    };
    const runner = new runner_1.AgentRunner(client, runnerConfig);
    const history = request.messages.slice(0, -1);
    const lastMsg = request.messages[request.messages.length - 1];
    const userInput = lastMsg?.content ?? '';
    // const sender    = event.sender; // Fixed TS2451
    // Store messages for JSON viewer
    lastChatMessages = [...history];
    if (lastMsg)
        lastChatMessages.push(lastMsg);
    // ── Register Global Shortcuts ─────────────────────────────────────────
    const abortKey = 'CommandOrControl+Shift+X';
    const abortHandler = () => {
        streamAborted = true;
        const { abortComputerUse } = require('./agent/tools/computer-use');
        abortComputerUse();
    };
    const jsonViewerKey = 'CommandOrControl+Shift+J';
    const jsonViewerHandler = () => {
        // Build full chat history for JSON viewer
        const chatHistory = {
            type: 'full_chat_history',
            messageCount: lastChatMessages.length,
            messages: lastChatMessages.map((m) => {
                const msg = { role: m.role };
                if (m.role === 'system') {
                    msg.content = '[SYSTEM PROMPT - HIDDEN]';
                    msg.contentPreview = typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : '[Complex system prompt]';
                }
                else if (typeof m.content === 'string') {
                    msg.content = m.content;
                    msg.contentLength = m.content.length;
                }
                else if (Array.isArray(m.content)) {
                    msg.content = m.content.map((c) => c.type === 'text' ? c.text : c.type === 'image_url' ? '[Image]' : '[Content]').join('\n');
                    msg.hasMultimodal = true;
                }
                if (m.tool_calls) {
                    msg.toolCalls = m.tool_calls.map((tc) => ({ name: tc.function?.name || tc.name, arguments: tc.function?.arguments || tc.arguments, id: tc.id }));
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
        electron_1.clipboard.writeText(json);
        // Notify renderer to show JSON viewer
        streamSender.send('acp:show-json-viewer', {
            json,
            type: 'full_chat_history'
        });
        console.log('[Shortcut] Ctrl+Shift+J: Copied full chat history to clipboard');
    };
    electron_2.globalShortcut.register(abortKey, abortHandler);
    electron_2.globalShortcut.register(jsonViewerKey, jsonViewerHandler);
    try {
        for await (const streamEvent of runner.runStream(userInput, history, request.model, request.conversationId)) {
            // Store last event for JSON viewer
            lastStreamEvent = streamEvent;
            if (streamAborted) {
                streamSender.send('acp:stream-chunk', { delta: '\n\n🛑 Stopped by user.', done: true });
                break;
            }
            const safeSend = (channel, data) => {
                try {
                    // Deep serialization safety check
                    const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
                        if (value instanceof Error)
                            return { message: value.message, stack: value.stack };
                        if (value instanceof Set)
                            return Array.from(value);
                        if (value instanceof Map)
                            return Object.fromEntries(value);
                        // Handle potentially cyclic objects or non-serializable properties
                        if (typeof value === 'function')
                            return '[Function]';
                        return value;
                    }));
                    streamSender.send(channel, safeData);
                }
                catch (err) {
                    console.error(`[IPC] Serialization failed for ${channel}:`, err);
                    // Fallback to minimal info if full serialization fails
                    streamSender.send(channel, { error: 'Serialization failed', type: data?.type || 'unknown' });
                }
            };
            if (streamEvent.type === 'chunk') {
                safeSend('acp:stream-chunk', { delta: streamEvent.content, done: false });
            }
            else if (streamEvent.type === 'thought') {
                safeSend('acp:thought', { content: streamEvent.content });
            }
            else if (streamEvent.type === 'tool_start') {
                safeSend('acp:tool-start', { toolName: streamEvent.toolName, toolArgs: streamEvent.toolArgs });
            }
            else if (streamEvent.type === 'tool_call') {
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
            }
            else if (streamEvent.type === 'tool_update') {
                safeSend('acp:tool-update', { toolName: streamEvent.toolName, update: streamEvent.update });
            }
            else if (streamEvent.type === 'optima') {
                safeSend('acp:optima', { event: streamEvent.event, details: streamEvent.details });
            }
            else if (streamEvent.type === 'show_artifact') {
                safeSend('acp:show-artifact', { name: streamEvent.name });
            }
            else if (streamEvent.type === 'show_plan') {
                safeSend('acp:show-plan', { chatId: streamEvent.chatId, content: streamEvent.content });
            }
            else if (streamEvent.type === 'view_skill') {
                safeSend('acp:view-skill', { name: streamEvent.name });
            }
            else if (streamEvent.type === 'skill_detected') {
                safeSend('acp:skill-detected', { skillName: streamEvent.skillName, skillDescription: streamEvent.skillDescription, reason: streamEvent.reason });
            }
            else if (streamEvent.type === 'intent_classified') {
                safeSend('acp:intent-classified', { intent: streamEvent.intent, confidence: streamEvent.confidence, phase: streamEvent.phase });
            }
            else if (streamEvent.type === 'plan_created') {
                safeSend('acp:plan-created', { plan: streamEvent.plan });
            }
            else if (streamEvent.type === 'task_analyzed') {
                safeSend('acp:task-analyzed', { analysis: streamEvent.analysis });
            }
            else if (streamEvent.type === 'parallel_group_start') {
                safeSend('acp:parallel-group-start', { groupIndex: streamEvent.groupIndex, stepCount: streamEvent.stepCount });
            }
            else if (streamEvent.type === 'parallel_group_end') {
                safeSend('acp:parallel-group-end', { groupIndex: streamEvent.groupIndex, durationMs: streamEvent.durationMs });
            }
            else if (streamEvent.type === 'hitl_request') {
                console.log('[Main] HITL request received, sending to frontend:', streamEvent.request);
                safeSend('acp:hitl-request', streamEvent.request);
                console.log('[Main] HITL request sent to frontend via IPC');
            }
            else if (streamEvent.type === 'mission_step_update') {
                safeSend('acp:mission-step-update', { step: streamEvent.step, timeline: streamEvent.timeline });
            }
            else if (streamEvent.type === 'mission_phase_change') {
                safeSend('acp:mission-phase-change', { phase: streamEvent.phase, timeline: streamEvent.timeline });
            }
            else if (streamEvent.type === 'mission_complete') {
                safeSend('acp:mission-complete', {
                    timeline: streamEvent.timeline,
                    steps: streamEvent.steps,
                    thinkingDuration: streamEvent.thinkingDuration
                });
            }
            else if (streamEvent.type === 'done') {
                safeSend('acp:stream-chunk', { delta: '', done: true });
            }
            else if (streamEvent.type === 'usage') {
                safeSend('acp:usage', {
                    promptTokens: streamEvent.promptTokens,
                    completionTokens: streamEvent.completionTokens,
                    totalTokens: streamEvent.totalTokens,
                });
            }
            else if (streamEvent.type === 'surface_action') {
                safeSend('acp:surface-action', streamEvent);
            }
        }
        globalThis.__everfernSystemFilesPermissionGranted = false;
        return { success: true };
    }
    catch (error) {
        if (streamAborted) {
            streamSender.send('acp:stream-chunk', { delta: '', done: true });
            globalThis.__everfernSystemFilesPermissionGranted = false;
            return { success: true, stopped: true };
        }
        streamSender.send('acp:stream-chunk', { delta: `\n\n[Error: ${String(error)}]`, done: true });
        globalThis.__everfernSystemFilesPermissionGranted = false;
        return { error: String(error) };
    }
    finally {
        electron_2.globalShortcut.unregister(abortKey);
        electron_2.globalShortcut.unregister(jsonViewerKey);
    }
});
// ── IPC: Chat History ────────────────────────────────────────────────
electron_1.ipcMain.handle('history:list', () => historyStore.list());
electron_1.ipcMain.handle('history:load', (_e, id) => historyStore.load(id) ?? { error: 'Not found' });
electron_1.ipcMain.handle('history:save', (_e, conv) => historyStore.save(conv));
electron_1.ipcMain.handle('history:delete', async (_e, id) => historyStore.delete(id));
// ── IPC: Artifacts ───────────────────────────────────────────────────
electron_1.ipcMain.handle('artifacts:list', (_e, chatId) => (0, artifacts_1.listArtifacts)(chatId));
electron_1.ipcMain.handle('artifacts:read', (_e, chatId, filename) => (0, artifacts_1.readArtifact)(chatId, filename));
electron_1.ipcMain.handle('artifacts:write', (_e, chatId, filename, content) => (0, artifacts_1.writeArtifact)(chatId, filename, content));
electron_1.ipcMain.handle('artifacts:delete', (_e, chatId, filename) => (0, artifacts_1.deleteArtifact)(chatId, filename));
// ── IPC: Plans ────────────────────────────────────────────────────────
electron_1.ipcMain.handle('plans:list', (_e, chatId) => (0, plans_1.listPlans)(chatId));
electron_1.ipcMain.handle('plans:read', (_e, chatId, filename) => (0, plans_1.readPlan)(chatId, filename));
electron_1.ipcMain.handle('plans:write', (_e, chatId, filename, content) => (0, plans_1.writePlan)(chatId, filename, content));
electron_1.ipcMain.handle('plans:delete', (_e, chatId, filename) => (0, plans_1.deletePlan)(chatId, filename));
// ── IPC: Sites ────────────────────────────────────────────────────────
electron_1.ipcMain.handle('sites:list', (_e, chatId) => (0, sites_1.listSites)(chatId));
electron_1.ipcMain.handle('sites:read', (_e, chatId, filename) => (0, sites_1.readSiteFile)(chatId, filename));
electron_1.ipcMain.handle('sites:write', (_e, chatId, filename, content) => (0, sites_1.writeSiteFile)(chatId, filename, content));
electron_1.ipcMain.handle('sites:delete', (_e, chatId, filename) => (0, sites_1.deleteSite)(chatId, filename));
electron_1.ipcMain.handle('sites:open-folder', (_e, chatId) => {
    const dir = path.join(os.homedir(), '.everfern', 'sites', chatId);
    if (fs.existsSync(dir))
        electron_3.shell.openPath(dir);
});
// ── IPC: Debug / JSON Viewer ───────────────────────────────────────────
electron_1.ipcMain.handle('debug:get-last-event', () => {
    return lastStreamEvent;
});
electron_1.ipcMain.handle('debug:get-chat-history', () => {
    // Build full chat history from lastStreamEvent and stored messages
    const fullHistory = [];
    // Add stored chat messages
    if (lastChatMessages.length > 0) {
        for (const m of lastChatMessages) {
            const msg = { role: m.role };
            if (m.role === 'system') {
                msg.content = '[SYSTEM PROMPT - HIDDEN]';
                msg.contentPreview = typeof m.content === 'string' ? m.content.substring(0, 200) + '...' : '[Complex system prompt]';
            }
            else if (typeof m.content === 'string') {
                msg.content = m.content;
                msg.contentLength = m.content.length;
            }
            else if (Array.isArray(m.content)) {
                msg.content = m.content.map((c) => c.type === 'text' ? c.text : c.type === 'image_url' ? '[Image]' : '[Content]').join('\n');
                msg.hasMultimodal = true;
            }
            if (m.tool_calls) {
                msg.toolCalls = m.tool_calls.map((tc) => ({ name: tc.function?.name || tc.name, arguments: tc.function?.arguments || tc.arguments, id: tc.id }));
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
        const eventMsg = { role: 'event', eventType: lastStreamEvent.type };
        if (lastStreamEvent.type === 'chunk') {
            eventMsg.content = lastStreamEvent.content;
        }
        else if (lastStreamEvent.type === 'tool_start') {
            eventMsg.toolName = lastStreamEvent.toolName;
            eventMsg.toolArgs = lastStreamEvent.toolArgs;
            eventMsg.description = `Starting: ${lastStreamEvent.toolName}`;
        }
        else if (lastStreamEvent.type === 'tool_call') {
            eventMsg.toolCall = lastStreamEvent.toolCall;
            eventMsg.description = `Tool called: ${lastStreamEvent.toolCall?.toolName || 'unknown'}`;
        }
        else if (lastStreamEvent.type === 'thought') {
            eventMsg.thinking = lastStreamEvent.content;
        }
        else {
            eventMsg.data = lastStreamEvent;
        }
        if (fullHistory.length > 0 || Object.keys(eventMsg).length > 2) {
            fullHistory.push(eventMsg);
        }
    }
    return { type: 'full_chat_history', messageCount: fullHistory.length, messages: fullHistory };
});
electron_1.ipcMain.handle('debug:copy-to-clipboard', (_e, text) => {
    electron_1.clipboard.writeText(text);
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
electron_1.ipcMain.handle('showui:install', async (event) => {
    const { spawn, execSync } = require('child_process');
    const installSender = event.sender;
    const isWindows = process.platform === 'win32';
    const scriptsDir = path.join(electron_1.app.getAppPath(), 'scripts');
    const emit = (line, step, kind, pkg, pct, speed, eta) => {
        if (!installSender.isDestroyed()) {
            installSender.send('showui:install-line', { line, step, kind, pkg, pct, speed, eta });
        }
    };
    // ── Determine which command to run ────────────────────────────────
    let cmd;
    let args;
    let spawnOpts;
    if (isWindows) {
        // Windows: always use setup-showui.bat which internally calls WSL
        const batScript = path.join(scriptsDir, 'setup-showui.bat');
        cmd = batScript;
        args = [];
        spawnOpts = { shell: true, env: { ...process.env, PYTHONUNBUFFERED: '1' } };
        emit('Windows detected — will use WSL if available, then native Python fallback.', 1, 'info');
    }
    else {
        // macOS / Linux: run setup-unix.sh directly
        const shScript = path.join(scriptsDir, 'setup-unix.sh');
        try {
            execSync(`chmod +x "${shScript}"`);
        }
        catch { /* ignore */ }
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
                }
                catch (e) { /* ignore ECONNREFUSED */ }
            }, 3000);
            const parseLine = (l) => {
                const line = l.trim();
                if (!line)
                    return;
                // Progress markers
                if (line.includes('EVERFERN_PROGRESS:')) {
                    const pct = parseInt(line.split('EVERFERN_PROGRESS:')[1], 10);
                    if (!isNaN(pct)) {
                        emit(line, 1, 'info', undefined, pct);
                        return;
                    }
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
            proc.stdout?.on('data', (d) => {
                bufferedOut += d.toString();
                let idx;
                while ((idx = bufferedOut.search(/[\r\n]/)) !== -1) {
                    const line = bufferedOut.substring(0, idx);
                    bufferedOut = bufferedOut.substring(idx + 1);
                    parseLine(line);
                }
            });
            let bufferedErr = '';
            proc.stderr?.on('data', (d) => {
                bufferedErr += d.toString();
                let idx;
                while ((idx = bufferedErr.search(/[\r\n]/)) !== -1) {
                    const line = bufferedErr.substring(0, idx).trim();
                    bufferedErr = bufferedErr.substring(idx + 1);
                    if (!line)
                        continue;
                    // Gradio prints "Running on local URL:" to stderr — run through parseLine
                    // so our URL-detection / progress logic fires correctly.
                    if (line.includes('Running on local URL:') || line.includes('Running on public URL:') || line.includes('EVERFERN_PROGRESS:')) {
                        parseLine(line);
                    }
                    else {
                        emit(line, 1, 'err');
                    }
                }
            });
            proc.on('close', (code) => {
                clearInterval(pollTimer);
                if (resolvedAlready)
                    return; // already resolved when Gradio URL appeared
                if (code === 0) {
                    emit('✅ ShowUI installation complete!', 3, 'done', undefined, 100);
                    resolve({ success: true });
                }
                else if (code === 11) {
                    // Special: reboot required for WSL
                    emit('⚠️ Reboot required to finish WSL setup. Please restart your PC.', 2, 'info');
                    resolve({ success: false, error: 'reboot_required' });
                }
                else {
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
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit(`❌ Setup Exception: ${msg}`, 0, 'fail');
        return { success: false, error: msg };
    }
});
electron_1.ipcMain.handle('showui:launch', async (event) => {
    const launchSender = event.sender;
    const emit = (line, kind) => {
        if (!launchSender.isDestroyed())
            launchSender.send('showui:install-line', { line, step: 4, kind });
    };
    try {
        const success = await (0, showui_server_1.ensureShowUIServer)((line) => emit(line, 'info'));
        return { success };
    }
    catch (error) {
        emit(`[Launch] Error: ${error}`, 'err');
        return { success: false, error: String(error) };
    }
});
// ── IPC: Permissions ──────────────────────────────────────────────────
electron_1.ipcMain.handle('permissions:grant', () => {
    permissionsGranted = true;
    return { success: true };
});
electron_1.ipcMain.handle('permissions:status', () => {
    return { granted: permissionsGranted };
});
// ── IPC: Terminal Processes ───────────────────────────────────────────
electron_1.ipcMain.handle('terminal:list-processes', () => {
    const registry = registry_1.CommandRegistry.getInstance();
    return registry.listCommands();
});
electron_1.ipcMain.handle('terminal:kill-process', (_event, id) => {
    const registry = registry_1.CommandRegistry.getInstance();
    return { success: registry.terminate(id) };
});
// ── IPC: Vector Store (Text-based search, no SQLite-vec) ─────────────
(0, context_engine_1.registerContextEngine)('vector', () => new vector_1.VectorContextEngine());
(0, context_engine_1.setDefaultContextEngine)('vector');
// Initialize vector DB asynchronously, won't block app startup
setTimeout(() => {
    (0, chat_vectors_1.initChatVectorDb)().then(() => {
        console.log('[Vectors] Database initialized');
    }).catch(err => {
        console.warn('[Vectors] Initialization failed (non-blocking):', err.message);
    });
}, 5000);
electron_1.ipcMain.handle('vectors:search', async (_event, query, topK = 10, chatId) => {
    try {
        return await (0, chat_vectors_1.searchChatVectors)(query, topK, chatId);
    }
    catch (err) {
        console.warn('[Vectors] Search error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('vectors:get', async (_event, chatId) => {
    try {
        return await (0, chat_vectors_1.getChatVectors)(chatId);
    }
    catch (err) {
        console.warn('[Vectors] Get error:', err);
        return [];
    }
});
electron_1.ipcMain.handle('vectors:delete', async (_event, chatId) => {
    try {
        await (0, chat_vectors_1.deleteChatVectors)(chatId);
        return { success: true };
    }
    catch (err) {
        console.warn('[Vectors] Delete error:', err);
        return { success: false, error: String(err) };
    }
});
electron_1.ipcMain.handle('vectors:stats', async () => {
    try {
        return await (0, chat_vectors_1.getVectorStats)();
    }
    catch (err) {
        console.warn('[Vectors] Stats error:', err);
        return { messageCount: 0, storageSize: 0, dimensionCount: null, initialized: false, error: String(err) };
    }
});
electron_1.ipcMain.handle('vectors:index-message', async (_event, id, chatId, role, content, createdAt) => {
    try {
        const { embedAndStoreMessage } = await Promise.resolve().then(() => __importStar(require('./store/chat-vectors')));
        await embedAndStoreMessage(id, chatId, role, content, createdAt);
        return { success: true };
    }
    catch (err) {
        console.warn('[Vectors] Index error:', err);
        return { success: false, error: String(err) };
    }
});
electron_1.ipcMain.handle('vectors:refresh-config', async () => {
    return { success: true };
});
// ── Custom Skills IPC Handlers ─────────────────────────────────────────────
electron_1.ipcMain.handle('skills:list-custom', async () => {
    return (0, skills_sync_1.listCustomSkills)();
});
electron_1.ipcMain.handle('skills:save-custom', async (_event, data) => {
    const result = (0, skills_sync_1.saveCustomSkill)(data);
    if (result.success) {
        (0, skills_sync_1.mergeCustomSkills)();
    }
    return result;
});
electron_1.ipcMain.handle('skills:delete-custom', async (_event, name) => {
    const result = (0, skills_sync_1.deleteCustomSkill)(name);
    if (result.success) {
        (0, skills_sync_1.syncBuiltInSkills)();
        (0, skills_sync_1.mergeCustomSkills)();
    }
    return result;
});
electron_1.ipcMain.handle('skills:get-custom-path', async () => {
    return (0, skills_sync_1.getCustomSkillsPath)();
});
function isPermissionGranted() { return permissionsGranted; }

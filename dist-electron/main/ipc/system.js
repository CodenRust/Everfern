"use strict";
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
exports.registerSystemHandlers = registerSystemHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const memory_save_1 = require("../agent/tools/memory-save");
function registerSystemHandlers() {
    electron_1.ipcMain.handle('system:get-username', () => {
        return os.userInfo().username;
    });
    electron_1.ipcMain.handle('system:open-file-picker', async (_event, options) => {
        console.log('[IPC] system:open-file-picker called with options:', options);
        const mainWindow = global.mainWindow;
        if (!mainWindow) {
            console.error('[IPC] system:open-file-picker: mainWindow not available');
            return { success: false, error: 'Main window not available' };
        }
        try {
            console.log('[IPC] Opening file dialog...');
            const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: options?.filters || [
                    { name: 'All Files', extensions: ['*'] },
                    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
                    { name: 'Text & Documents', extensions: ['txt', 'md', 'json', 'csv', 'js', 'ts', 'py', 'log', 'html', 'css'] }
                ]
            });
            console.log('[IPC] Dialog result - canceled:', canceled, 'filePaths:', filePaths);
            if (canceled || filePaths.length === 0) {
                console.log('[IPC] User canceled or no file selected');
                return { success: false, canceled: true };
            }
            const originalFilePath = filePaths[0];
            console.log('[IPC] Processing file:', originalFilePath);
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
            console.log('[IPC] File copied to:', newFilePath);
            let mimeType = 'application/octet-stream';
            if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
                mimeType = `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}`;
                const base64 = fs.readFileSync(newFilePath).toString('base64');
                const uri = `data:${mimeType};base64,${base64}`;
                console.log('[IPC] Returning image file, size:', stats.size);
                return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType, base64: uri, success: true };
            }
            else {
                const content = fs.readFileSync(newFilePath, 'utf-8');
                console.log('[IPC] Returning text file, size:', stats.size);
                return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType: 'text/plain', content, success: true };
            }
        }
        catch (err) {
            console.error('[IPC] Error in open-file-picker:', err);
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('system:open-folder-picker', async () => {
        const mainWindow = global.mainWindow;
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
    electron_1.ipcMain.handle('system:open-folder', async (_event, folderPath) => {
        if (folderPath && fs.existsSync(folderPath)) {
            electron_1.shell.openPath(folderPath);
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
            const shellCmd = isWin ? 'powershell.exe' : 'sh';
            const command = isWin
                ? 'irm https://ollama.com/install.ps1 | Invoke-Expression'
                : 'curl -fsSL https://ollama.com/install.sh | sh';
            const args = isWin
                ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
                : ['-c', command];
            const proc = spawn(shellCmd, args, { shell: false });
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
    electron_1.ipcMain.handle('memory:save-direct', async (_event, content, metadata) => {
        return memory_save_1.memorySaveTool.execute({ content, metadata });
    });
    electron_1.ipcMain.handle('system:wipe-account', async () => {
        const everfernDir = path.join(os.homedir(), '.everfern');
        try {
            // Wipe .everfern directory
            if (fs.existsSync(everfernDir)) {
                fs.rmSync(everfernDir, { recursive: true, force: true });
            }
            fs.mkdirSync(everfernDir, { recursive: true });
            // Also wipe the SQLite database (chat history lives here, not in .everfern)
            const userDataPath = electron_1.app.getPath('userData');
            const dbDir = path.join(userDataPath, 'memory');
            if (fs.existsSync(dbDir)) {
                fs.rmSync(dbDir, { recursive: true, force: true });
            }
            console.log('[IPC] system:wipe-account: .everfern and SQLite DB wiped');
            return { success: true };
        }
        catch (err) {
            console.error('[IPC] system:wipe-account error:', err);
            return { success: false, error: err.message };
        }
    });
}

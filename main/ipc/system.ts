import { ipcMain, dialog, shell, Notification, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { memorySaveTool } from '../agent/tools/memory-save';

export function registerSystemHandlers() {
  ipcMain.handle('system:get-username', () => {
    return os.userInfo().username;
  });

  ipcMain.handle('system:open-file-picker', async (_event, options?: { filters?: { name: string, extensions: string[] }[] }) => {
    console.log('[IPC] system:open-file-picker called with options:', options);

    const mainWindow = (global as any).mainWindow;
    if (!mainWindow) {
      console.error('[IPC] system:open-file-picker: mainWindow not available');
      return { success: false, error: 'Main window not available' };
    }

    try {
      console.log('[IPC] Opening file dialog...');
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
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
      } else {
        const content = fs.readFileSync(newFilePath, 'utf-8');
        console.log('[IPC] Returning text file, size:', stats.size);
        return { path: newFilePath, name: path.basename(originalFilePath), size: stats.size, mimeType: 'text/plain', content, success: true };
      }
    } catch (err: any) {
      console.error('[IPC] Error in open-file-picker:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('system:open-folder-picker', async () => {
    const mainWindow = (global as any).mainWindow;
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
      const shellCmd = isWin ? 'powershell.exe' : 'sh';
      const command = isWin
        ? 'irm https://ollama.com/install.ps1 | Invoke-Expression'
        : 'curl -fsSL https://ollama.com/install.sh | sh';

      const args = isWin
        ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
        : ['-c', command];

      const proc = spawn(shellCmd, args, { shell: false });

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

  ipcMain.handle('memory:save-direct', async (_event, content: string, metadata?: string) => {
    return memorySaveTool.execute({ content, metadata });
  });

  ipcMain.handle('system:wipe-account', async () => {
    const everfernDir = path.join(os.homedir(), '.everfern');
    try {
      // Wipe .everfern directory
      if (fs.existsSync(everfernDir)) {
        fs.rmSync(everfernDir, { recursive: true, force: true });
      }
      fs.mkdirSync(everfernDir, { recursive: true });

      // Also wipe the SQLite database (chat history lives here, not in .everfern)
      const userDataPath = app.getPath('userData');
      const dbDir = path.join(userDataPath, 'memory');
      if (fs.existsSync(dbDir)) {
        fs.rmSync(dbDir, { recursive: true, force: true });
      }

      console.log('[IPC] system:wipe-account: .everfern and SQLite DB wiped');
      return { success: true };
    } catch (err: any) {
      console.error('[IPC] system:wipe-account error:', err);
      return { success: false, error: err.message };
    }
  });
}

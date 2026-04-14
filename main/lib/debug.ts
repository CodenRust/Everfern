import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export const DebugEmitter = new EventEmitter();

let debugWin: BrowserWindow | null = null;
const logs: any[] = [];

DebugEmitter.on('log', (title: string, data: any) => {
  const entry = { time: new Date().toISOString(), title, data };
  logs.push(entry);
  if (debugWin) {
    debugWin.webContents.executeJavaScript(`window.appendLog(${JSON.stringify(JSON.stringify(entry))})`).catch(() => {});
  }
});

/**
 * Hooks into console.log/warn/error to redirect to the Debug Window.
 */
export function setupLogging() {
  try {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      try {
        const title = args.length > 0 && typeof args[0] === 'string' ? args[0] : 'Log';
        DebugEmitter.emit('log', title, args.length > 1 ? args.slice(1) : args[0]);
      } catch (e) { /* ignore emission errors */ }
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      try {
        DebugEmitter.emit('log', '⚠️ WARNING', args);
      } catch (e) { /* ignore */ }
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      try {
        DebugEmitter.emit('log', '❌ ERROR', args);
      } catch (e) { /* ignore */ }
    };
    
    // Direct push to ensure first log is captured even if emitter is slow
    logs.push({ 
      time: new Date().toISOString(), 
      title: '[System]', 
      data: 'Console logging successfully intercepted. Diagnostics active.' 
    });
    
    console.log('[Debug] Global console logging hooked.');
  } catch (err) {
    // If we fail to hook, we can't really log it to the debug window, but we can try stdout
    process.stdout.write('FAILED TO HOOK LOGGING: ' + String(err) + '\n');
  }
}

export function toggleDebugWindow() {
  if (debugWin) {
    debugWin.focus();
    return;
  }
  debugWin = new BrowserWindow({
    width: 900, height: 700,
    title: 'EverFern Debug Monitor',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>EverFern Debug Monitor</title>
      <style>
        body { background: #1e1e1e; color: #d4d4d4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
        h2 { color: #4fc1ff; margin-top: 0; }
        .log-entry { border: 1px solid #444; margin-bottom: 20px; background: #252526; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .log-header { background: #333; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #444; color: #4fc1ff; font-family: 'Courier New', monospace; }
        .log-body { padding: 15px; overflow-x: auto; white-space: pre-wrap; font-size: 13px; color: #cecece; font-family: 'Courier New', monospace; }
        .warning .log-header { color: #ce9178; }
        .error .log-header { color: #f44747; }
      </style>
    </head>
    <body>
      <h2>📡 EverFern System & API Monitor</h2>
      <p style="color: #888; font-size: 14px;">Real-time stream of backend events, API calls, and console logs.</p>
      <div id="logs"></div>
      <script>
        const container = document.getElementById('logs');
        window.appendLog = function(entryStr) {
          const entry = JSON.parse(entryStr);
          const div = document.createElement('div');
          div.className = 'log-entry';
          if (entry.title && (entry.title.includes('⚠️') || entry.title.includes('WARNING'))) div.classList.add('warning');
          if (entry.title && (entry.title.includes('❌') || entry.title.includes('ERROR'))) div.classList.add('error');
          
          const header = document.createElement('div');
          header.className = 'log-header';
          header.innerText = '[' + entry.time + '] ' + entry.title;
          
          const body = document.createElement('div');
          body.className = 'log-body';
          
          let content = entry.data;
          if (typeof content !== 'string') {
            try {
              content = JSON.stringify(content, null, 2);
            } catch (e) {
              content = String(content);
            }
          }
          body.innerText = content;
          
          div.appendChild(header);
          div.appendChild(body);
          container.appendChild(div);
          window.scrollTo(0, document.body.scrollHeight);
        };
      </script>
    </body>
    </html>
  `;
  
  debugWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  
  debugWin.webContents.on('did-finish-load', () => {
    logs.forEach(entry => {
      debugWin!.webContents.executeJavaScript(`window.appendLog(${JSON.stringify(JSON.stringify(entry))})`).catch(() => {});
    });
  });

  debugWin.on('closed', () => { debugWin = null; });
}

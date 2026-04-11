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
exports.DebugEmitter = void 0;
exports.toggleDebugWindow = toggleDebugWindow;
const events_1 = require("events");
const electron_1 = require("electron");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
exports.DebugEmitter = new events_1.EventEmitter();
let debugWin = null;
const logs = [];
exports.DebugEmitter.on('log', (title, data) => {
    const entry = { time: new Date().toISOString(), title, data };
    logs.push(entry);
    if (debugWin) {
        debugWin.webContents.executeJavaScript(`window.appendLog(${JSON.stringify(JSON.stringify(entry))})`).catch(() => { });
    }
});
function toggleDebugWindow() {
    if (debugWin) {
        debugWin.focus();
        return;
    }
    debugWin = new electron_1.BrowserWindow({
        width: 900, height: 700,
        title: 'EverFern Debug API Logs',
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    const htmlPath = path.join(os.homedir(), '.everfern', 'debug.html');
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>API Call Debugger</title>
      <style>
        body { background: #1e1e1e; color: #d4d4d4; font-family: 'Courier New', Courier, monospace; padding: 20px; }
        .log-entry { border: 1px solid #444; margin-bottom: 20px; background: #252526; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .log-header { background: #333; padding: 12px 15px; font-weight: bold; border-bottom: 1px solid #444; color: #4fc1ff; }
        .log-body { padding: 15px; overflow-x: auto; white-space: pre-wrap; font-size: 13px; color: #cecece;}
      </style>
    </head>
    <body>
      <h2>📡 API Calls & Logs Monitor</h2>
      <p style="color: #888">This window intercepts inner HTTP bindings from the backend so you can perfectly verify exactly what JSON is sent.</p>
      <div id="logs"></div>
      <script>
        const container = document.getElementById('logs');
        window.appendLog = function(entryStr) {
          const entry = JSON.parse(entryStr);
          const div = document.createElement('div');
          div.className = 'log-entry';
          
          const header = document.createElement('div');
          header.className = 'log-header';
          header.innerText = '[' + entry.time + '] ' + entry.title;
          
          const body = document.createElement('div');
          body.className = 'log-body';
          body.innerText = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2);
          
          div.appendChild(header);
          div.appendChild(body);
          container.appendChild(div);
          window.scrollTo(0, document.body.scrollHeight);
        };
      </script>
    </body>
    </html>
  `;
    fs.writeFileSync(htmlPath, htmlContent);
    debugWin.loadFile(htmlPath);
    debugWin.webContents.on('did-finish-load', () => {
        logs.forEach(entry => {
            debugWin.webContents.executeJavaScript(`window.appendLog(${JSON.stringify(JSON.stringify(entry))})`).catch(() => { });
        });
    });
    debugWin.on('closed', () => { debugWin = null; });
}

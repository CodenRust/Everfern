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
exports.bridgeServer = void 0;
const http = __importStar(require("http"));
const events_1 = require("events");
const ws_1 = require("ws");
/**
 * EverFern Localhost Bridge Server (WebSocket Edition)
 *
 * Provides a low-latency, bi-directional communication hub between the
 * Chrome Extension and the Electron App.
 */
class ExtensionBridgeServer extends events_1.EventEmitter {
    server = null;
    wss = null;
    port = 4001;
    activeSessions = new Map();
    start() {
        if (this.server)
            return;
        this.server = http.createServer((req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            const url = new URL(req.url || '', `http://localhost:${this.port}`);
            // ── HTTP Routes ───────────────────────────────────────────────────────
            // 1. Handshake / Heartbeat (Source of Truth)
            if (url.pathname === '/handshake') {
                const sessionId = url.searchParams.get('sessionId');
                const session = sessionId ? this.activeSessions.get(sessionId) : Array.from(this.activeSessions.values())[0];
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    status: session ? 'active' : 'idle',
                    sessionActive: !!session,
                    playwrightSession: session ? {
                        id: session.id,
                        active: true,
                        url: session.url,
                        title: session.title
                    } : null,
                    timestamp: Date.now()
                }));
                return;
            }
            // 2. Event Ingest (Legacy Fallback)
            if (url.pathname === '/event' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const event = JSON.parse(body);
                        this.emit('extension-event', event);
                        res.writeHead(200);
                        res.end(JSON.stringify({ received: true }));
                    }
                    catch (e) {
                        res.writeHead(400);
                        res.end('Invalid JSON');
                    }
                });
                return;
            }
            res.writeHead(404);
            res.end();
        });
        // ── WebSocket Server ──────────────────────────────────────────────────
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
            console.log('[BridgeServer] 🔌 Extension connected via WebSocket');
            // Force immediate activation state on the extension if sessions are active
            if (this.activeSessions.size > 0) {
                const firstSession = Array.from(this.activeSessions.values())[0];
                ws.send(JSON.stringify({
                    type: 'command',
                    command: 'activate-extension',
                    data: {
                        sessionId: firstSession.id,
                        playwrightDetected: true,
                        url: firstSession.url,
                        title: firstSession.title
                    }
                }));
            }
            // Send initial state
            this.sendState(ws);
            ws.on('message', (message) => {
                try {
                    const payload = JSON.parse(message.toString());
                    console.log(`[BridgeServer] 📥 Message received [${payload.type}]`);
                    if (payload.type === 'handshake') {
                        console.log(`[BridgeServer] 👋 Handshake from extension: ${payload.extensionId}`);
                    }
                    this.emit('extension-event', payload);
                }
                catch (e) {
                    console.error('[BridgeServer] ❌ Failed to parse WS message:', e);
                }
            });
            ws.on('close', () => {
                console.log('[BridgeServer] 🔌 Extension disconnected');
            });
        });
        this.server.listen(this.port, '127.0.0.1', () => {
            console.log(`[BridgeServer] 🚀 Real-time localhost bridge active on port ${this.port}`);
        });
        this.server.on('error', (err) => {
            console.error('[BridgeServer] Error:', err);
        });
    }
    setSession(id, url = '', title = '') {
        if (!id) {
            this.activeSessions.clear();
        }
        else {
            this.activeSessions.set(id, { id, url, title });
        }
        console.log(`[BridgeServer] Session updated: ${id || 'all cleared'} (${url})`);
        // Broadcast state change to all connected extensions
        this.broadcastState();
    }
    broadcastState() {
        if (!this.wss)
            return;
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                this.sendState(client);
            }
        });
    }
    sendState(ws) {
        const sessions = Array.from(this.activeSessions.values());
        ws.send(JSON.stringify({
            type: 'state-update',
            data: {
                status: sessions.length > 0 ? 'active' : 'idle',
                sessionActive: sessions.length > 0,
                sessions: sessions, // All active sessions
                playwrightSession: sessions[0] || null, // Primary session for popup
                timestamp: Date.now()
            }
        }));
    }
    /**
     * Send a direct command to all connected extension instances
     */
    broadcastCommand(command, data = {}) {
        if (!this.wss)
            return;
        console.log(`[BridgeServer] 📢 Broadcasting command: ${command}`);
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'command',
                    command,
                    data
                }));
            }
        });
    }
    stop() {
        this.wss?.close();
        this.server?.close();
        this.server = null;
        this.wss = null;
    }
}
exports.bridgeServer = new ExtensionBridgeServer();

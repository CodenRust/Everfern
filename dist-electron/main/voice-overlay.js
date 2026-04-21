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
exports.VoiceOverlayManager = void 0;
const electron_1 = require("electron");
const uiohook_napi_1 = require("uiohook-napi");
const path = __importStar(require("path"));
class VoiceOverlayManager {
    overlayWindow = null;
    isCtrlDown = false;
    isAltDown = false;
    isListening = false;
    holdTimeout = null;
    constructor() {
        console.log('[VoiceOverlay] Initializing manager...');
        this.initOverlayWindow();
        this.setupHook();
    }
    initOverlayWindow() {
        try {
            const primaryDisplay = electron_1.screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.workAreaSize;
            console.log(`[VoiceOverlay] Screen size: ${width}x${height}`);
            this.overlayWindow = new electron_1.BrowserWindow({
                width: 600,
                height: 120,
                x: Math.floor(width / 2 - 300),
                y: height - 140, // Above taskbar
                transparent: true,
                frame: false,
                alwaysOnTop: true,
                skipTaskbar: true,
                show: false,
                webPreferences: {
                    preload: path.join(__dirname, '..', 'preload', 'preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true,
                }
            });
            const isDev = !electron_1.app.isPackaged;
            const overlayUrl = isDev ? 'http://localhost:3001/overlay' : 'everfern-app://./overlay/index.html';
            console.log(`[VoiceOverlay] Loading URL: ${overlayUrl}`);
            if (isDev) {
                this.overlayWindow.loadURL(overlayUrl).catch(e => console.error('[VoiceOverlay] Failed to load URL:', e));
            }
            else {
                this.overlayWindow.loadURL(overlayUrl).catch(e => console.error('[VoiceOverlay] Failed to load URL:', e));
            }
            this.overlayWindow.setIgnoreMouseEvents(true);
            console.log('[VoiceOverlay] Window initialized.');
        }
        catch (err) {
            console.error('[VoiceOverlay] Critical error initializing window:', err);
        }
    }
    setupHook() {
        console.log('[VoiceOverlay] Setting up uIOhook...');
        try {
            uiohook_napi_1.uIOhook.on('keydown', (e) => {
                // Log all keycodes to help debug if Ctrl/Alt are different
                // console.log(`[VoiceOverlay] Keydown: ${e.keycode}`);
                if (e.keycode === uiohook_napi_1.UiohookKey.Ctrl || e.keycode === uiohook_napi_1.UiohookKey.CtrlRight) {
                    this.isCtrlDown = true;
                    // console.log('[VoiceOverlay] Ctrl Down');
                }
                if (e.keycode === uiohook_napi_1.UiohookKey.Alt || e.keycode === uiohook_napi_1.UiohookKey.AltRight) {
                    this.isAltDown = true;
                    // console.log('[VoiceOverlay] Alt Down');
                }
                this.checkState();
            });
            uiohook_napi_1.uIOhook.on('keyup', (e) => {
                if (e.keycode === uiohook_napi_1.UiohookKey.Ctrl || e.keycode === uiohook_napi_1.UiohookKey.CtrlRight) {
                    this.isCtrlDown = false;
                    // console.log('[VoiceOverlay] Ctrl Up');
                }
                if (e.keycode === uiohook_napi_1.UiohookKey.Alt || e.keycode === uiohook_napi_1.UiohookKey.AltRight) {
                    this.isAltDown = false;
                    // console.log('[VoiceOverlay] Alt Up');
                }
                this.checkState();
            });
            uiohook_napi_1.uIOhook.start();
            console.log('[VoiceOverlay] uIOhook started successfully.');
        }
        catch (err) {
            console.error('[VoiceOverlay] Failed to start uIOhook:', err);
        }
    }
    checkState() {
        const shouldListen = this.isCtrlDown && this.isAltDown;
        if (shouldListen && !this.isListening) {
            console.log('[VoiceOverlay] Starting listening state...');
            this.isListening = true;
            if (this.holdTimeout)
                clearTimeout(this.holdTimeout);
            if (this.overlayWindow) {
                this.overlayWindow.showInactive();
                this.overlayWindow.webContents.send('voice-overlay:state', { state: 'listening' });
                console.log('[VoiceOverlay] IPC state sent: listening');
            }
            else {
                console.warn('[VoiceOverlay] Cannot start: overlayWindow is null');
            }
        }
        else if (!shouldListen && this.isListening) {
            console.log('[VoiceOverlay] Stopping listening state, executing...');
            this.isListening = false;
            if (this.overlayWindow) {
                this.overlayWindow.webContents.send('voice-overlay:state', { state: 'executing' });
                if (this.holdTimeout)
                    clearTimeout(this.holdTimeout);
                this.holdTimeout = setTimeout(() => {
                    console.log('[VoiceOverlay] Returning to idle...');
                    this.overlayWindow?.webContents.send('voice-overlay:state', { state: 'idle' });
                    setTimeout(() => {
                        this.overlayWindow?.hide();
                        console.log('[VoiceOverlay] Window hidden.');
                    }, 500);
                }, 3000);
            }
        }
    }
}
exports.VoiceOverlayManager = VoiceOverlayManager;

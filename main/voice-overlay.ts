import { app, BrowserWindow, screen } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import * as path from 'path';

export class VoiceOverlayManager {
  private overlayWindow: BrowserWindow | null = null;
  private isCtrlDown = false;
  private isAltDown = false;
  private isListening = false;
  private holdTimeout: NodeJS.Timeout | null = null;

  constructor() {
    console.log('[VoiceOverlay] Initializing manager...');
    this.initOverlayWindow();
    this.setupHook();
  }

  private initOverlayWindow() {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.workAreaSize;
      
      console.log(`[VoiceOverlay] Screen size: ${width}x${height}`);

      this.overlayWindow = new BrowserWindow({
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

      const isDev = !app.isPackaged;
      const overlayUrl = isDev ? 'http://localhost:3001/overlay' : 'everfern-app://./overlay/index.html';
      
      console.log(`[VoiceOverlay] Loading URL: ${overlayUrl}`);
      
      if (isDev) {
        this.overlayWindow.loadURL(overlayUrl).catch(e => console.error('[VoiceOverlay] Failed to load URL:', e));
      } else {
        this.overlayWindow.loadURL(overlayUrl).catch(e => console.error('[VoiceOverlay] Failed to load URL:', e));
      }

      this.overlayWindow.setIgnoreMouseEvents(true);
      console.log('[VoiceOverlay] Window initialized.');
    } catch (err) {
      console.error('[VoiceOverlay] Critical error initializing window:', err);
    }
  }

  private setupHook() {
    console.log('[VoiceOverlay] Setting up uIOhook...');
    
    try {
      uIOhook.on('keydown', (e) => {
        // Log all keycodes to help debug if Ctrl/Alt are different
        // console.log(`[VoiceOverlay] Keydown: ${e.keycode}`);
        
        if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
          this.isCtrlDown = true;
          // console.log('[VoiceOverlay] Ctrl Down');
        }
        if (e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight) {
          this.isAltDown = true;
          // console.log('[VoiceOverlay] Alt Down');
        }
        this.checkState();
      });

      uIOhook.on('keyup', (e) => {
        if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
          this.isCtrlDown = false;
          // console.log('[VoiceOverlay] Ctrl Up');
        }
        if (e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight) {
          this.isAltDown = false;
          // console.log('[VoiceOverlay] Alt Up');
        }
        this.checkState();
      });

      uIOhook.start();
      console.log('[VoiceOverlay] uIOhook started successfully.');
    } catch (err) {
      console.error('[VoiceOverlay] Failed to start uIOhook:', err);
    }
  }

  private checkState() {
    const shouldListen = this.isCtrlDown && this.isAltDown;
    
    if (shouldListen && !this.isListening) {
      console.log('[VoiceOverlay] Starting listening state...');
      this.isListening = true;
      if (this.holdTimeout) clearTimeout(this.holdTimeout);
      
      if (this.overlayWindow) {
        this.overlayWindow.showInactive();
        this.overlayWindow.webContents.send('voice-overlay:state', { state: 'listening' });
        console.log('[VoiceOverlay] IPC state sent: listening');
      } else {
        console.warn('[VoiceOverlay] Cannot start: overlayWindow is null');
      }
    } else if (!shouldListen && this.isListening) {
      console.log('[VoiceOverlay] Stopping listening state, executing...');
      this.isListening = false;
      
      if (this.overlayWindow) {
        this.overlayWindow.webContents.send('voice-overlay:state', { state: 'executing' });
        
        if (this.holdTimeout) clearTimeout(this.holdTimeout);
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

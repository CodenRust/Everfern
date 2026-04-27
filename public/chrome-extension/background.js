/**
 * Background Service Worker for EverFern Web Automation Extension
 * Manages extension lifecycle, Playwright detection, and secure messaging
 */

// Extension state management (Fallback defaults)
let extensionState = {
  activated: false,
  playwrightSession: null,
  shimmerActive: false
};

/**
 * Helper to sync local state from storage
 */
async function syncState() {
  const result = await chrome.storage.local.get(['extensionState', 'playwrightSession', 'shimmerActive']);
  extensionState = {
    activated: result.extensionState?.activated || false,
    playwrightSession: result.playwrightSession || null,
    shimmerActive: result.shimmerActive || false
  };
  return extensionState;
}

// Playwright detection patterns
const PLAYWRIGHT_DETECTION_PATTERNS = [
  /playwright/i,
  /pw-runner/i,
  /__PLAYWRIGHT__/,
  /pw\.browser/i
];

/**
 * Initialize extension on install/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[EverFern] Extension installed/updated:', details.reason);

  // Initialize storage
  chrome.storage.local.set({
    extensionState: {
      activated: false,
      playwrightSession: null,
      capturedElements: [],
      shimmerActive: false
    },
    securityConfig: {
      messageValidation: true,
      encryptionEnabled: false,
      allowedOrigins: ['*']
    }
  });
});

/**
 * Listen for messages from content scripts and extension components
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Proactive detection from content script DOM bridge
  if (request.type === 'playwright-detected-in-page') {
    handlePlaywrightDetection({ payload: request.payload }, sender, () => {});
    return true;
  }

  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
});

/**
 * Listen for external messages (from the Playwright browser page)
 */
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[EverFern] Received EXTERNAL message:', request.type, 'from', sender.url);
  
  const processMessage = (tab) => {
    if (!tab) {
        console.warn('[EverFern] External message dropped: No valid tab target.');
        sendResponse({ success: false, error: 'Target tab not found' });
        return;
    }
    handleMessage(request, { ...sender, tab }, sendResponse);
  };

  if (sender.tab && sender.tab.id) {
      processMessage(sender.tab);
  } else {
      // Robust tab identification: check URL then fallback to active
      const cleanUrl = sender.url ? sender.url.split(/[?#]/)[0] : null;
      
      chrome.tabs.query({}, (allTabs) => {
          let targetTab = allTabs.find(t => t.url === sender.url);
          if (!targetTab && cleanUrl) {
              targetTab = allTabs.find(t => t.url && t.url.startsWith(cleanUrl));
          }
          if (!targetTab) {
              targetTab = allTabs.find(t => t.active && t.lastFocusedWindow);
          }
          processMessage(targetTab);
      });
  }
  return true; 
});

/**
 * Handle incoming messages with validation
 */
async function handleMessage(request, sender, sendResponse) {
  try {
    // Validate message structure
    if (!request.type) {
      throw new Error('Invalid message: missing type field');
    }

    console.log('[EverFern] Received message:', request.type, 'from', sender.url);

    switch (request.type) {
      case 'detect-playwright':
        await handlePlaywrightDetection(request, sender, sendResponse);
        break;

      case 'activate-extension':
        await handleExtensionActivation(request, sender, sendResponse);
        break;

      case 'deactivate-extension':
        await handleExtensionDeactivation(request, sender, sendResponse);
        break;

      case 'capture-elements':
        await handleElementCapture(request, sender, sendResponse);
        break;

      case 'highlight-element':
        await handleElementHighlight(request, sender, sendResponse);
        break;

      case 'apply-shimmer':
        await handleShimmerApplication(request, sender, sendResponse);
        break;

      case 'remove-shimmer':
        await handleShimmerRemoval(request, sender, sendResponse);
        break;

      case 'send-to-main-app':
        await handleMainAppMessage(request, sender, sendResponse);
        break;

      case 'get-extension-state':
        await handleStateQuery(request, sender, sendResponse);
        break;

      default:
        throw new Error(`Unknown message type: ${request.type}`);
    }
  } catch (error) {
    console.error('[EverFern] Message handling error:', error);
    sendResponse({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Detect if Playwright is running in the current tab
 */
async function handlePlaywrightDetection(request, sender, sendResponse) {
  try {
    const tabId = sender.tab?.id;
    if (!tabId) {
        throw new Error('No active tab identified for detection.');
    }

    // Inject detection script into the MAIN world to see variables like window.__PLAYWRIGHT__
    // Fix: property is 'func' in MV3, not 'function'
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: detectPlaywrightInPage
    });

    const detected = result[0]?.result || false;

    if (detected) {
      extensionState.playwrightSession = {
        id: request.payload?.sessionId || `session-${Date.now()}`,
        active: true,
        url: sender.url,
        title: sender.tab?.title || 'Automation Tab',
        startTime: new Date().toISOString(),
        automationLevel: request.payload?.automationLevel || 'enhanced'
      };
      
      // Mark as activated since we found Playwright
      extensionState.activated = true;

      // Update storage
      await chrome.storage.local.set({
        playwrightSession: extensionState.playwrightSession,
        extensionState: { 
            activated: true,
            shimmerActive: extensionState.shimmerActive
        }
      });

      console.log('[EverFern] Playwright detected and extension activated for tab:', tabId);
    }

    sendResponse({
      success: true,
      detected,
      sessionId: extensionState.playwrightSession?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Playwright detection error:', error);
    sendResponse({
      success: false,
      detected: false,
      error: error.message
    });
  }
}

/**
 * Activate extension for the current tab
 */
async function handleExtensionActivation(request, sender, sendResponse) {
  try {
    const tabId = sender.tab.id;

    // Verify Playwright is running
    const playwrightDetected = request.playwrightDetected || request.payload?.playwrightDetected;
    if (!playwrightDetected && !extensionState.playwrightSession?.active) {
      throw new Error('Playwright not detected. Extension activation requires active Playwright session.');
    }


    extensionState.activated = true;

    // Notify content script to activate
    await chrome.tabs.sendMessage(tabId, {
      type: 'extension-activated',
      payload: {
        sessionId: extensionState.playwrightSession?.id,
        automationLevel: 'enhanced'
      }
    });

    // Update storage
    await chrome.storage.local.set({
      extensionState: {
        ...extensionState,
        activated: true
      }
    });

    console.log('[EverFern] Extension activated for tab:', tabId);

    sendResponse({
      success: true,
      activated: true,
      sessionId: extensionState.playwrightSession?.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Extension activation error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Deactivate extension
 */
async function handleExtensionDeactivation(request, sender, sendResponse) {
  try {
    const tabId = sender.tab.id;

    extensionState.activated = false;

    // Notify content script to deactivate
    await chrome.tabs.sendMessage(tabId, {
      type: 'extension-deactivated'
    });

    // Update storage
    await chrome.storage.local.set({
      extensionState: {
        ...extensionState,
        activated: false,
        capturedElements: [],
        shimmerActive: false
      }
    });

    console.log('[EverFern] Extension deactivated for tab:', tabId);

    sendResponse({
      success: true,
      activated: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Extension deactivation error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Capture interactive elements from the page
 */
async function handleElementCapture(request, sender, sendResponse) {
  try {
    if (!extensionState.activated) {
      throw new Error('Extension not activated');
    }

    const tabId = sender.tab.id;

    // Execute element capture in content script
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'capture-elements-request'
    });

    if (!result.success) {
      throw new Error(result.error || 'Element capture failed');
    }

    const elements = result.elements || [];

    // Store captured elements
    extensionState.capturedElements = elements;
    await chrome.storage.local.set({
      capturedElements: elements
    });

    console.log('[EverFern] Captured', elements.length, 'elements');

    sendResponse({
      success: true,
      elements,
      count: elements.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Element capture error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Highlight a specific element
 */
async function handleElementHighlight(request, sender, sendResponse) {
  try {
    if (!extensionState.activated) {
      throw new Error('Extension not activated');
    }

    const { selector } = request.payload || {};
    if (!selector) {
      throw new Error('Missing selector in payload');
    }

    const tabId = sender.tab.id;

    // Send highlight request to content script
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'highlight-element-request',
      payload: { selector }
    });

    if (!result.success) {
      throw new Error(result.error || 'Element highlight failed');
    }

    console.log('[EverFern] Highlighted element:', selector);

    sendResponse({
      success: true,
      selector,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Element highlight error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Apply beach color shimmer effect to website
 */
async function handleShimmerApplication(request, sender, sendResponse) {
  try {
    if (!extensionState.activated) {
      throw new Error('Extension not activated');
    }

    const tabId = sender.tab.id;

    // Send shimmer request to content script
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'apply-shimmer-request'
    });

    if (!result.success) {
      throw new Error(result.error || 'Shimmer application failed');
    }

    extensionState.shimmerActive = true;
    await chrome.storage.local.set({
      shimmerActive: true
    });

    console.log('[EverFern] Beach color shimmer applied');

    sendResponse({
      success: true,
      shimmerActive: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Shimmer application error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Remove beach color shimmer effect
 */
async function handleShimmerRemoval(request, sender, sendResponse) {
  try {
    const tabId = sender.tab.id;

    // Send removal request to content script
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'remove-shimmer-request'
    });

    if (!result.success) {
      throw new Error(result.error || 'Shimmer removal failed');
    }

    extensionState.shimmerActive = false;
    await chrome.storage.local.set({
      shimmerActive: false
    });

    console.log('[EverFern] Beach color shimmer removed');

    sendResponse({
      success: true,
      shimmerActive: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Shimmer removal error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

const BRIDGE_URL = 'http://localhost:4001';
const WS_URL = 'ws://localhost:4001';
let socket = null;
let reconnectDelay = 2000;

/**
 * Connect to the real-time WebSocket bridge
 */
function connectToBridge() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[EverFern] Connecting to real-time bridge...');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log('[EverFern] 🟢 Connected to real-time bridge');
    reconnectDelay = 2000; // Reset delay
    
    // Initial handshake
    socket.send(JSON.stringify({
      type: 'handshake',
      extensionId: chrome.runtime.id,
      timestamp: Date.now()
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data);
      console.log('[EverFern] 📥 WebSocket update:', payload.type);

      // Handle Direct Commands (e.g. apply-shimmer)
      if (payload.type === 'command') {
          console.log('[EverFern] ⚡ Executing remote command:', payload.command);
          if (payload.command === 'apply-shimmer' || payload.command === 'activate-extension') {
              // Get active tab and forward the command
              const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
              if (tab?.id) {
                  const msgType = payload.command === 'apply-shimmer' ? 'apply-shimmer-request' : 'extension-activated';
                  chrome.tabs.sendMessage(tab.id, { type: msgType }).catch(() => {});
                  
                  if (payload.command === 'activate-extension') {
                      extensionState.activated = true;
                      await chrome.storage.local.set({ extensionState: { activated: true, shimmerActive: extensionState.shimmerActive } });
                  }
              }
          }
          return;
      }

      if (payload.type === 'state-update') {
        const { status, session, sessionActive, playwrightSession } = payload.data;
        const isActive = status === 'active' || sessionActive === true;
        const finalSession = session || playwrightSession;
        
        // Mark as activated and detected
        extensionState.activated = isActive;
        extensionState.playwrightSession = finalSession;

        // Force storage sync for popup
        await chrome.storage.local.set({ 
          extensionState: { activated: isActive, shimmerActive: extensionState.shimmerActive },
          playwrightSession: finalSession,
          lastSync: Date.now()
        });
        
        console.log('[EverFern] 🔄 Sync complete. Active:', isActive);
      }
    } catch (e) {
      console.error('[EverFern] Failed to parse bridge message:', e);
    }
  };

  socket.onclose = () => {
    console.log('[EverFern] 🔴 Bridge connection closed. Retrying...');
    socket = null;
    setTimeout(connectToBridge, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000); // Max 30s
  };

  socket.onerror = (err) => {
    console.error('[EverFern] ⚠️ Bridge socket error:', err);
    socket?.close();
  };
}

// Start real-time connection
connectToBridge();

/**
 * Send message to main application via Playwright Bridge, WebSocket Bridge, OR Localhost HTTP
 */
async function handleMainAppMessage(request, sender, sendResponse) {
  try {
    const { message } = request.payload || {};
    if (!message) {
      throw new Error('Missing message in payload');
    }

    const tabId = sender.tab?.id;
    const payload = { 
        type: message.type, 
        data: message, 
        tabId,
        url: sender.url,
        timestamp: new Date().toISOString() 
    };

    // 1. Try Playwright Binding Bridge (Fastest, per-tab context)
    if (tabId) {
        chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: (data) => {
              if (typeof window.__EVERFERN_BRIDGE__ === 'function') {
                  window.__EVERFERN_BRIDGE__(data);
              }
          },
          args: [message]
        }).catch(() => {});
    }

    // 2. Try WebSocket Bridge (Real-time, cross-process)
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        console.log('[EverFern] Message pushed via WebSocket bridge');
    } else {
        // 3. Fallback to Localhost HTTP Bridge
        fetch(`${BRIDGE_URL}/event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
        console.log('[EverFern] Message pushed via HTTP bridge (fallback)');
    }

    sendResponse({
      success: true,
      bridged: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] Main app bridge error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Query current extension state
 */
async function handleStateQuery(request, sender, sendResponse) {
  try {
    const state = await chrome.storage.local.get([
      'extensionState',
      'playwrightSession',
      'capturedElements'
    ]);

    sendResponse({
      success: true,
      state: {
        activated: extensionState.activated,
        playwrightSession: extensionState.playwrightSession,
        capturedElements: extensionState.capturedElements,
        messageQueueLength: extensionState.messageQueue.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[EverFern] State query error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Detect Playwright in the page context
 * This function runs in the page context
 */
function detectPlaywrightInPage() {
  try {
    // Check for Playwright global objects
    if (window.__PLAYWRIGHT__) {
      return true;
    }

    // Check for Playwright in window properties
    if (window.pw && window.pw.browser) {
      return true;
    }

    // Check for Playwright in navigator
    if (navigator.webdriver === true) {
      return true;
    }

    // Check for common Playwright markers
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.src && /playwright|pw-runner/.test(script.src)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error detecting Playwright:', error);
    return false;
  }
}

/**
 * Listen for tab updates to detect Playwright sessions
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Attempt to detect Playwright in newly loaded tabs
    chrome.tabs.sendMessage(tabId, {
      type: 'detect-playwright'
    }).catch(() => {
      // Silently fail if content script not ready
    });
  }
});

/**
 * Clean up when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log('[EverFern] Tab closed:', tabId);

  // Reset extension state if this was the active tab
  if (extensionState.playwrightSession) {
    extensionState.activated = false;
    extensionState.playwrightSession = null;
    extensionState.capturedElements = [];
    extensionState.shimmerActive = false;
  }
});

console.log('[EverFern] Background service worker initialized');

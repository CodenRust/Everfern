/**
 * Content Script for EverFern Web Automation Extension
 * Handles DOM interaction, shimmer effects, and the futuristic control overlay.
 */

const contentScriptState = {
  extensionActive: false,
  playwrightDetected: false,
  shimmerActive: false,
  capturedElements: [],
};

/**
 * Initialize the futuristic control overlay
 */
function createControlOverlay() {
  if (document.getElementById('everfern-control-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'everfern-control-overlay';
  
  // Add corner accents
  ['tl', 'tr', 'bl', 'br'].forEach(pos => {
    const corner = document.createElement('div');
    corner.className = `everfern-corner everfern-corner-${pos}`;
    overlay.appendChild(corner);
  });

  // Add HUD text
  const hud = document.createElement('div');
  hud.className = 'hud-text';
  hud.innerText = 'EverFern AI Active';
  overlay.appendChild(hud);

  document.documentElement.appendChild(overlay);
}

/**
 * Toggle the visibility of the control overlay
 */
function updateOverlayVisibility() {
  const overlay = document.getElementById('everfern-control-overlay');
  if (!overlay) return;

  if (contentScriptState.extensionActive) {
    overlay.classList.add('active');
  } else {
    overlay.classList.remove('active');
  }
}

/**
 * Detect if Playwright is running
 */
function detectPlaywright() {
  try {
    const domAttr = document.documentElement.getAttribute('data-everfern-playwright') === 'true';
    const globals = !!(window.__PLAYWRIGHT__ || (window.pw && window.pw.browser));
    const webdriver = navigator.webdriver === true;
    const beacon = !!document.getElementById('everfern-session-beacon');

    if (domAttr || globals || webdriver || beacon) {
      if (!contentScriptState.playwrightDetected) {
        contentScriptState.playwrightDetected = true;
        console.log('[EverFern Content] 🟢 Playwright detected');
        
        // Auto-activate since we found the agent
        contentScriptState.extensionActive = true;
        createControlOverlay();
        updateOverlayVisibility();

        chrome.runtime.sendMessage({
          type: 'playwright-detected-in-page',
          payload: { playwrightDetected: true }
        }).catch(() => {});
      }
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Apply futuristic shimmer to interactive elements
 */
async function applyShimmer() {
  // Remove existing
  document.querySelectorAll('.everfern-shimmer-highlight').forEach(e => e.remove());

  // Find interactive elements
  const interactives = Array.from(document.querySelectorAll('a, button, input, select, [role="button"], .btn'));
  
  interactives.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    const highlight = document.createElement('div');
    highlight.className = 'everfern-shimmer-highlight';
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    
    document.body.appendChild(highlight);
  });

  contentScriptState.shimmerActive = true;
  return { success: true, count: interactives.length };
}

/**
 * Listen for commands from the background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'detect-playwright-request':
      const detected = detectPlaywright();
      sendResponse({ success: true, detected });
      break;

    case 'extension-activated':
      contentScriptState.extensionActive = true;
      createControlOverlay();
      updateOverlayVisibility();
      sendResponse({ success: true });
      break;

    case 'extension-deactivated':
      contentScriptState.extensionActive = false;
      updateOverlayVisibility();
      document.querySelectorAll('.everfern-shimmer-highlight').forEach(e => e.remove());
      sendResponse({ success: true });
      break;

    case 'apply-shimmer-request':
      applyShimmer().then(sendResponse);
      return true;

    case 'capture-elements-request':
      // Simplified capture for now
      const elements = Array.from(document.querySelectorAll('a, button, input'))
        .slice(0, 50)
        .map(el => ({
          tagName: el.tagName.toLowerCase(),
          textContent: el.innerText || '',
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()
        }));
      sendResponse({ success: true, elements });
      break;
  }
});

// Periodic detection
setInterval(detectPlaywright, 2000);

// Initial setup
if (document.readyState === 'complete') {
  detectPlaywright();
} else {
  window.addEventListener('load', detectPlaywright);
}

console.log('[EverFern Content] Futuristic Automation Engine Loaded');

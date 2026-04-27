/**
 * Popup Script for EverFern Web Automation Extension
 * Manages the extension popup UI and user interactions
 */

// UI Elements
const elements = {
  extensionStatus: document.getElementById('extensionStatus'),
  extensionStatusText: document.getElementById('extensionStatusText'),
  playwrightStatus: document.getElementById('playwrightStatus'),
  playwrightStatusText: document.getElementById('playwrightStatusText'),
  shimmerStatus: document.getElementById('shimmerStatus'),
  shimmerStatusText: document.getElementById('shimmerStatusText'),
  detectPlaywrightBtn: document.getElementById('detectPlaywrightBtn'),
  activateBtn: document.getElementById('activateBtn'),
  captureElementsBtn: document.getElementById('captureElementsBtn'),
  applyShimmerBtn: document.getElementById('applyShimmerBtn'),
  removeShimmerBtn: document.getElementById('removeShimmerBtn'),
  deactivateBtn: document.getElementById('deactivateBtn'),
  infoSection: document.getElementById('infoSection'),
  infoTitle: document.getElementById('infoTitle'),
  infoMessage: document.getElementById('infoMessage'),
  errorMessage: document.getElementById('errorMessage')
};

// Popup state
const popupState = {
  extensionActive: false,
  playwrightDetected: false,
  shimmerActive: false,
  currentTab: null
};

/**
 * Initialize popup
 */
async function initializePopup() {
  console.log('[EverFern Popup] Initializing');

  // Get current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  popupState.currentTab = tabs[0];

  // Set up event listeners
  setupEventListeners();

  // Listen for storage changes to auto-update UI
  chrome.storage.onChanged.addListener((changes) => {
      console.log('[EverFern Popup] Storage changed, updating UI');
      loadExtensionState();
  });

  // CRITICAL: Proactively query the localhost bridge on popup open
  // This ensures the UI is correct even if the service worker is waking up
  try {
      const BRIDGE_URL = 'http://localhost:4001';
      const res = await fetch(`${BRIDGE_URL}/handshake`);
      const data = await res.json();
      if (data.success && data.sessionActive) {
          console.log('[EverFern Popup] Bridge confirms active session');
          popupState.extensionActive = true;
          popupState.playwrightDetected = true;
          
          await chrome.storage.local.set({
              playwrightSession: data.playwrightSession,
              extensionState: { activated: true, shimmerActive: false }
          });
      }
  } catch (e) {
      console.log('[EverFern Popup] Bridge not reachable');
  }

  // Load initial state
  await loadExtensionState();
}

/**
 * Set up event listeners for buttons
 */
function setupEventListeners() {
  elements.detectPlaywrightBtn.addEventListener('click', handleDetectPlaywright);
  elements.activateBtn.addEventListener('click', handleActivateExtension);
  elements.captureElementsBtn.addEventListener('click', handleCaptureElements);
  elements.applyShimmerBtn.addEventListener('click', handleApplyShimmer);
  elements.removeShimmerBtn.addEventListener('click', handleRemoveShimmer);
  elements.deactivateBtn.addEventListener('click', handleDeactivateExtension);
}

/**
 * Load extension state from storage
 */
async function loadExtensionState() {
  try {
    const result = await chrome.storage.local.get([
      'extensionState',
      'playwrightSession'
    ]);

    const extensionState = result.extensionState || {};
    const playwrightSession = result.playwrightSession;

    popupState.extensionActive = extensionState.activated || false;
    popupState.shimmerActive = extensionState.shimmerActive || false;
    popupState.playwrightDetected = !!playwrightSession?.active;

    updateUI();
  } catch (error) {
    console.error('[EverFern Popup] Error loading state:', error);
    showError('Failed to load extension state');
  }
}

/**
 * Update UI based on current state
 */
function updateUI() {
  // Update extension status
  updateStatusIndicator(
    elements.extensionStatus,
    elements.extensionStatusText,
    popupState.extensionActive ? 'active' : 'inactive',
    popupState.extensionActive ? 'Active' : 'Inactive'
  );

  // Update Playwright status
  updateStatusIndicator(
    elements.playwrightStatus,
    elements.playwrightStatusText,
    popupState.playwrightDetected ? 'active' : 'inactive',
    popupState.playwrightDetected ? 'Detected' : 'Not Detected'
  );

  // Update shimmer status
  updateStatusIndicator(
    elements.shimmerStatus,
    elements.shimmerStatusText,
    popupState.shimmerActive ? 'active' : 'inactive',
    popupState.shimmerActive ? 'On' : 'Off'
  );

  // Update button states
  if (elements.activateBtn) elements.activateBtn.disabled = !popupState.playwrightDetected || popupState.extensionActive;
  if (elements.captureElementsBtn) elements.captureElementsBtn.disabled = !popupState.extensionActive;
  if (elements.applyShimmerBtn) elements.applyShimmerBtn.disabled = !popupState.extensionActive;
  if (elements.deactivateBtn) elements.deactivateBtn.disabled = !popupState.extensionActive;
}

/**
 * Update status indicator
 */
function updateStatusIndicator(indicator, label, status, text) {
  indicator.className = `status-indicator ${status}`;
  label.textContent = text;
}

/**
 * Handle Playwright detection
 */
async function handleDetectPlaywright() {
  try {
    setButtonLoading(elements.detectPlaywrightBtn, true);

    const response = await chrome.tabs.sendMessage(popupState.currentTab.id, {
      type: 'detect-playwright'
    });

    if (response.success) {
      popupState.playwrightDetected = response.detected;

      if (response.detected) {
        showInfo('Playwright Detected', 'Playwright automation detected on this page. You can now activate the extension.');
      } else {
        showInfo('Playwright Not Detected', 'Playwright automation was not detected on this page.');
      }

      updateUI();
    } else {
      showError(response.error || 'Failed to detect Playwright');
    }
  } catch (error) {
    console.error('[EverFern Popup] Playwright detection error:', error);
    showError('Failed to detect Playwright: ' + error.message);
  } finally {
    setButtonLoading(elements.detectPlaywrightBtn, false);
  }
}

/**
 * Handle extension activation
 */
async function handleActivateExtension() {
  try {
    setButtonLoading(elements.activateBtn, true);

    const response = await chrome.runtime.sendMessage({
      type: 'activate-extension',
      playwrightDetected: popupState.playwrightDetected
    });

    if (response.success) {
      popupState.extensionActive = true;
      showInfo('Extension Activated', 'The extension is now active and ready for automation.');
      updateUI();
    } else {
      showError(response.error || 'Failed to activate extension');
    }
  } catch (error) {
    console.error('[EverFern Popup] Activation error:', error);
    showError('Failed to activate extension: ' + error.message);
  } finally {
    setButtonLoading(elements.activateBtn, false);
  }
}

/**
 * Handle element capture
 */
async function handleCaptureElements() {
  try {
    setButtonLoading(elements.captureElementsBtn, true);

    const response = await chrome.runtime.sendMessage({
      type: 'capture-elements'
    });

    if (response.success) {
      showInfo(
        'Elements Captured',
        `Successfully captured ${response.count} interactive elements from the page.`
      );
    } else {
      showError(response.error || 'Failed to capture elements');
    }
  } catch (error) {
    console.error('[EverFern Popup] Capture error:', error);
    showError('Failed to capture elements: ' + error.message);
  } finally {
    setButtonLoading(elements.captureElementsBtn, false);
  }
}

/**
 * Handle shimmer application
 */
async function handleApplyShimmer() {
  try {
    setButtonLoading(elements.applyShimmerBtn, true);

    const response = await chrome.runtime.sendMessage({
      type: 'apply-shimmer'
    });

    if (response.success) {
      popupState.shimmerActive = true;
      showInfo('Shimmer Applied', 'Beach color shimmer effect applied to interactive elements.');
      updateUI();
    } else {
      showError(response.error || 'Failed to apply shimmer');
    }
  } catch (error) {
    console.error('[EverFern Popup] Shimmer application error:', error);
    showError('Failed to apply shimmer: ' + error.message);
  } finally {
    setButtonLoading(elements.applyShimmerBtn, false);
  }
}

/**
 * Handle shimmer removal
 */
async function handleRemoveShimmer() {
  try {
    setButtonLoading(elements.removeShimmerBtn, true);

    const response = await chrome.runtime.sendMessage({
      type: 'remove-shimmer'
    });

    if (response.success) {
      popupState.shimmerActive = false;
      showInfo('Shimmer Removed', 'Beach color shimmer effect removed from the page.');
      updateUI();
    } else {
      showError(response.error || 'Failed to remove shimmer');
    }
  } catch (error) {
    console.error('[EverFern Popup] Shimmer removal error:', error);
    showError('Failed to remove shimmer: ' + error.message);
  } finally {
    setButtonLoading(elements.removeShimmerBtn, false);
  }
}

/**
 * Handle extension deactivation
 */
async function handleDeactivateExtension() {
  try {
    setButtonLoading(elements.deactivateBtn, true);

    const response = await chrome.runtime.sendMessage({
      type: 'deactivate-extension'
    });

    if (response.success) {
      popupState.extensionActive = false;
      popupState.shimmerActive = false;
      showInfo('Extension Deactivated', 'The extension has been deactivated.');
      updateUI();
    } else {
      showError(response.error || 'Failed to deactivate extension');
    }
  } catch (error) {
    console.error('[EverFern Popup] Deactivation error:', error);
    showError('Failed to deactivate extension: ' + error.message);
  } finally {
    setButtonLoading(elements.deactivateBtn, false);
  }
}

/**
 * Show info message
 */
function showInfo(title, message) {
  elements.infoTitle.textContent = title;
  elements.infoMessage.textContent = message;
  elements.infoSection.style.display = 'block';
  elements.errorMessage.classList.remove('show');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.infoSection.style.display = 'none';
  }, 5000);
}

/**
 * Show error message
 */
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.add('show');
  elements.infoSection.style.display = 'none';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    elements.errorMessage.classList.remove('show');
  }, 5000);
}

/**
 * Set button loading state
 */
function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span>';
  } else {
    button.disabled = false;
    button.textContent = button.getAttribute('data-original-text') || button.textContent;
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}

console.log('[EverFern Popup] Popup script loaded');

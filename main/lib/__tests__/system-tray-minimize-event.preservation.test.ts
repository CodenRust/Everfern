/**
 * Preservation Property Tests - System Tray Minimize Event Fix
 *
 * **Validates: Requirements 3.2, 3.3, 3.4, 3.5**
 *
 * Property 2: Preservation - User-Initiated Close Actions Still Work
 *
 * After the fix (removing minimize event interception), these tests verify that:
 * - Close button (X) still hides to tray when minimizeToTray is enabled
 * - Tray icon interactions still work correctly
 * - Tray menu still works correctly
 * - When minimizeToTray is disabled, close uses default behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { BrowserWindow } from 'electron';
import { SystemTrayManager } from '../system-tray-manager';

// Mock Electron modules
vi.mock('electron', () => {
  class MockTray {
    setToolTip = vi.fn();
    setContextMenu = vi.fn();
    on = vi.fn();
    destroy = vi.fn();
    displayBalloon = vi.fn();
  }

  return {
    Tray: MockTray,
    Menu: {
      buildFromTemplate: vi.fn(() => ({})),
    },
    BrowserWindow: vi.fn(),
    app: {
      isPackaged: false,
      focus: vi.fn(),
      quit: vi.fn(),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({
        isEmpty: () => false,
        resize: vi.fn().mockReturnThis(),
        setTemplateImage: vi.fn(),
      })),
      createEmpty: vi.fn(() => ({
        isEmpty: () => true,
        resize: vi.fn().mockReturnThis(),
        setTemplateImage: vi.fn(),
      })),
    },
  };
});

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
  },
  existsSync: vi.fn(() => true),
}));

describe('Preservation - User-Initiated Close Actions Still Work', () => {
  let trayManager: SystemTrayManager;
  let mockWindow: any;
  let closeEventHandler: ((event: any) => void) | null = null;
  let hideCallCount: number;
  let preventDefaultCallCount: number;

  beforeEach(() => {
    hideCallCount = 0;
    preventDefaultCallCount = 0;
    closeEventHandler = null;

    // Create mock window with event listener tracking
    mockWindow = {
      on: vi.fn((eventName: string, handler: any) => {
        if (eventName === 'close') {
          closeEventHandler = handler;
        }
      }),
      isMinimized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      show: vi.fn(),
      hide: vi.fn(() => {
        hideCallCount++;
      }),
      focus: vi.fn(),
      restore: vi.fn(),
      webContents: {
        send: vi.fn(),
      },
    };
  });

  afterEach(() => {
    if (trayManager) {
      trayManager.destroy();
    }
  });

  /**
   * Requirement 3.2: User clicking close button (X) with minimizeToTray enabled → hide to tray
   *
   * This is the PRIMARY way to minimize to tray after the fix.
   */
  it('PROPERTY 2: User clicking close button (X) with minimizeToTray enabled should hide to tray', () => {
    trayManager = new SystemTrayManager({
      minimizeToTray: true,
      showOnStart: false,
    });

    trayManager.createTray(mockWindow);
    trayManager.setupWindowEvents();

    // Verify close event handler was registered
    expect(closeEventHandler).not.toBeNull();

    // Simulate user clicking the close button (X)
    const mockCloseEvent = {
      preventDefault: vi.fn(() => {
        preventDefaultCallCount++;
      }),
      _source: 'user-close-button',
      _isUserInitiated: true,
    };

    // Trigger the close event handler
    if (closeEventHandler) {
      closeEventHandler(mockCloseEvent);
    }

    // ASSERTIONS - These should PASS (close button still hides to tray)

    // Expected Behavior (from bugfix.md Requirement 3.2):
    // - Window should hide to tray (hideCallCount = 1)
    // - Default behavior should be prevented (preventDefaultCallCount = 1)

    expect(hideCallCount).toBe(1); // Window should be hidden to tray
    expect(preventDefaultCallCount).toBe(1); // Default close should be prevented (app doesn't quit)
  });

  /**
   * Requirement 3.3: User interacting with tray icon (click, double-click) → show/hide window
   *
   * This behavior is unchanged by the fix.
   */
  it('PROPERTY 2: Tray icon click should toggle window visibility', () => {
    trayManager = new SystemTrayManager({
      minimizeToTray: true,
      showOnStart: false,
    });

    trayManager.createTray(mockWindow);
    trayManager.setupWindowEvents();

    const tray = trayManager.getTray();
    expect(tray).not.toBeNull();

    // Get the click handler registered on the tray
    const trayOnCalls = (tray as any).on.mock.calls;
    const clickHandler = trayOnCalls.find((call: any) => call[0] === 'click')?.[1];
    expect(clickHandler).toBeDefined();

    // Test 1: Window is visible → click should hide to tray
    mockWindow.isVisible.mockReturnValue(true);
    hideCallCount = 0;

    clickHandler();

    expect(hideCallCount).toBe(1); // Window should be hidden

    // Test 2: Window is hidden → click should show window
    mockWindow.isVisible.mockReturnValue(false);
    const showCallCount = mockWindow.show.mock.calls.length;

    clickHandler();

    expect(mockWindow.show.mock.calls.length).toBe(showCallCount + 1); // Window should be shown
    expect(mockWindow.focus).toHaveBeenCalled(); // Window should be focused
  });

  /**
   * Requirement 3.5: When minimizeToTray is disabled → normal close behavior
   *
   * This behavior is unchanged by the fix.
   */
  it('PROPERTY 2: When minimizeToTray is disabled, close should use default behavior', () => {
    // Create tray manager with minimizeToTray DISABLED
    trayManager = new SystemTrayManager({
      minimizeToTray: false,
      showOnStart: false,
    });

    trayManager.createTray(mockWindow);
    trayManager.setupWindowEvents();

    // Verify close event handler was registered
    expect(closeEventHandler).not.toBeNull();

    // Simulate user clicking the close button (X)
    const mockCloseEvent = {
      preventDefault: vi.fn(() => {
        preventDefaultCallCount++;
      }),
      _source: 'user-close-button',
      _isUserInitiated: true,
    };

    // Trigger the close event handler
    if (closeEventHandler) {
      closeEventHandler(mockCloseEvent);
    }

    // ASSERTIONS - These should PASS (close uses default behavior)

    // Expected Behavior (from bugfix.md Requirement 3.5):
    // - Window should NOT hide to tray (hideCallCount = 0)
    // - Default close behavior should proceed (preventDefaultCallCount = 0)

    expect(hideCallCount).toBe(0); // Window should NOT be hidden to tray
    expect(preventDefaultCallCount).toBe(0); // Default close should proceed (app quits)
  });
});

/**
 * Property-Based Tests - User-Initiated Close Actions Preservation
 *
 * These tests use property-based testing to generate many test cases automatically,
 * providing stronger guarantees that user-initiated close actions work correctly.
 */
describe('Preservation Property-Based Tests - User-Initiated Close Actions', () => {
  let trayManager: SystemTrayManager;
  let mockWindow: any;
  let closeEventHandler: ((event: any) => void) | null = null;

  beforeEach(() => {
    closeEventHandler = null;

    mockWindow = {
      on: vi.fn((eventName: string, handler: any) => {
        if (eventName === 'close') {
          closeEventHandler = handler;
        }
      }),
      isMinimized: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      restore: vi.fn(),
      webContents: {
        send: vi.fn(),
      },
    };
  });

  afterEach(() => {
    if (trayManager) {
      trayManager.destroy();
    }
  });

  /**
   * Property: For all user-initiated close events with minimizeToTray enabled,
   * the window must hide to tray and default behavior must be prevented.
   *
   * This is the PRIMARY way to minimize to tray after the fix.
   */
  it('property: user-initiated close with minimizeToTray enabled always hides to tray', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // showOnStart
        fc.integer({ min: 1, max: 10 }), // number of close events
        (showOnStart, numEvents) => {
          // Reset mocks before each property test iteration
          mockWindow.hide.mockClear();
          mockWindow.show.mockClear();
          mockWindow.focus.mockClear();

          trayManager = new SystemTrayManager({
            minimizeToTray: true,
            showOnStart,
          });

          trayManager.createTray(mockWindow);
          trayManager.setupWindowEvents();

          expect(closeEventHandler).not.toBeNull();

          let totalPreventDefaultCalls = 0;

          for (let i = 0; i < numEvents; i++) {
            const mockCloseEvent = {
              preventDefault: vi.fn(() => {
                totalPreventDefaultCalls++;
              }),
              _source: 'user-close-button',
              _isUserInitiated: true,
            };

            if (closeEventHandler) {
              closeEventHandler(mockCloseEvent);
            }
          }

          // All user-initiated close events should hide to tray
          const totalHideCalls = mockWindow.hide.mock.calls.length;
          expect(totalHideCalls).toBe(numEvents);
          expect(totalPreventDefaultCalls).toBe(numEvents);

          trayManager.destroy();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: For all close events with minimizeToTray disabled,
   * the window must NOT hide to tray and default behavior must proceed.
   */
  it('property: when minimizeToTray is disabled, close events use default behavior', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // showOnStart
        fc.integer({ min: 1, max: 10 }), // number of close events
        (showOnStart, numEvents) => {
          // Reset mocks before each property test iteration
          mockWindow.hide.mockClear();
          mockWindow.show.mockClear();
          mockWindow.focus.mockClear();

          trayManager = new SystemTrayManager({
            minimizeToTray: false, // DISABLED
            showOnStart,
          });

          trayManager.createTray(mockWindow);
          trayManager.setupWindowEvents();

          const handler = closeEventHandler;
          expect(handler).not.toBeNull();

          let totalPreventDefaultCalls = 0;

          for (let i = 0; i < numEvents; i++) {
            const mockEvent = {
              preventDefault: vi.fn(() => {
                totalPreventDefaultCalls++;
              }),
              _source: `user-close-button`,
              _isUserInitiated: true,
            };

            if (handler) {
              handler(mockEvent);
            }
          }

          // When minimizeToTray is disabled, NO events should hide to tray
          const totalHideCalls = mockWindow.hide.mock.calls.length;
          expect(totalHideCalls).toBe(0);
          expect(totalPreventDefaultCalls).toBe(0);

          trayManager.destroy();
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Tray icon interactions always work correctly regardless of configuration.
   */
  it('property: tray icon click always toggles window visibility', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // minimizeToTray
        fc.boolean(), // showOnStart
        fc.boolean(), // initial window visibility
        (minimizeToTray, showOnStart, isVisible) => {
          trayManager = new SystemTrayManager({
            minimizeToTray,
            showOnStart,
          });

          trayManager.createTray(mockWindow);
          trayManager.setupWindowEvents();

          const tray = trayManager.getTray();
          expect(tray).not.toBeNull();

          // Get the click handler
          const trayOnCalls = (tray as any).on.mock.calls;
          const clickHandler = trayOnCalls.find((call: any) => call[0] === 'click')?.[1];
          expect(clickHandler).toBeDefined();

          // Set initial window visibility
          mockWindow.isVisible.mockReturnValue(isVisible);

          const initialHideCalls = mockWindow.hide.mock.calls.length;
          const initialShowCalls = mockWindow.show.mock.calls.length;

          clickHandler();

          if (isVisible) {
            // Window was visible → should be hidden
            expect(mockWindow.hide.mock.calls.length).toBe(initialHideCalls + 1);
          } else {
            // Window was hidden → should be shown
            expect(mockWindow.show.mock.calls.length).toBe(initialShowCalls + 1);
          }

          trayManager.destroy();
        }
      ),
      { numRuns: 30 }
    );
  });
});

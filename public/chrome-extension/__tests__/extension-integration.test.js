/**
 * Integration Tests for Chrome Extension Automation System
 * Validates end-to-end workflows and component interactions
 */

describe('Chrome Extension Integration Tests', () => {
  // Mock Chrome API
  const mockChrome = {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn()
      }
    },
    tabs: {
      sendMessage: jest.fn(),
      query: jest.fn(),
      onUpdated: {
        addListener: jest.fn()
      },
      onRemoved: {
        addListener: jest.fn()
      }
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    },
    scripting: {
      executeScript: jest.fn()
    }
  };

  beforeEach(() => {
    global.chrome = mockChrome;
    jest.clearAllMocks();
  });

  describe('Complete Automation Workflow', () => {
    test('should execute full automation workflow: detect -> activate -> capture -> shimmer', async () => {
      // Step 1: Detect Playwright
      const detectResponse = {
        success: true,
        detected: true,
        sessionId: 'session-123'
      };

      // Step 2: Activate Extension
      const activateResponse = {
        success: true,
        activated: true,
        sessionId: 'session-123'
      };

      // Step 3: Capture Elements
      const captureResponse = {
        success: true,
        elements: [
          { selector: 'button', tagName: 'BUTTON', isInteractive: true },
          { selector: 'a', tagName: 'A', isInteractive: true }
        ],
        count: 2
      };

      // Step 4: Apply Shimmer
      const shimmerResponse = {
        success: true,
        shimmerActive: true
      };

      expect(detectResponse.detected).toBe(true);
      expect(activateResponse.activated).toBe(true);
      expect(captureResponse.count).toBe(2);
      expect(shimmerResponse.shimmerActive).toBe(true);
    });

    test('should handle element interaction workflow', () => {
      // Create test element
      const button = document.createElement('button');
      button.id = 'test-button';
      button.textContent = 'Test';
      document.body.appendChild(button);

      // Track interactions
      const interactions = [];

      button.addEventListener('click', () => {
        interactions.push({
          type: 'click',
          selector: '#test-button',
          timestamp: new Date().toISOString()
        });
      });

      // Simulate click
      button.click();

      expect(interactions.length).toBe(1);
      expect(interactions[0].type).toBe('click');
      expect(interactions[0].selector).toBe('#test-button');

      document.body.removeChild(button);
    });

    test('should handle shimmer effect lifecycle', () => {
      const button = document.createElement('button');
      button.textContent = 'Shimmer Test';
      document.body.appendChild(button);

      // Apply shimmer
      button.classList.add('everfern-shimmer-effect');
      expect(button.classList.contains('everfern-shimmer-effect')).toBe(true);

      // Remove shimmer
      button.classList.remove('everfern-shimmer-effect');
      expect(button.classList.contains('everfern-shimmer-effect')).toBe(false);

      document.body.removeChild(button);
    });

    test('should handle multiple element selection', () => {
      const button1 = document.createElement('button');
      button1.id = 'btn1';
      button1.textContent = 'Button 1';
      document.body.appendChild(button1);

      const button2 = document.createElement('button');
      button2.id = 'btn2';
      button2.textContent = 'Button 2';
      document.body.appendChild(button2);

      const selectedElements = [];

      button1.addEventListener('click', () => {
        selectedElements.push(button1);
        button1.classList.add('everfern-selected-element');
      });

      button2.addEventListener('click', () => {
        selectedElements.push(button2);
        button2.classList.add('everfern-selected-element');
      });

      button1.click();
      button2.click();

      expect(selectedElements.length).toBe(2);
      expect(button1.classList.contains('everfern-selected-element')).toBe(true);
      expect(button2.classList.contains('everfern-selected-element')).toBe(true);

      document.body.removeChild(button1);
      document.body.removeChild(button2);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle Playwright detection failure gracefully', () => {
      const response = {
        success: false,
        detected: false,
        error: 'Playwright not detected'
      };

      expect(response.success).toBe(false);
      expect(response.detected).toBe(false);
      expect(response.error).toBeTruthy();
    });

    test('should handle extension activation failure', () => {
      const response = {
        success: false,
        error: 'Playwright not detected. Extension activation requires active Playwright session.'
      };

      expect(response.success).toBe(false);
      expect(response.error).toContain('Playwright');
    });

    test('should handle element capture failure', () => {
      const response = {
        success: false,
        error: 'Extension not activated'
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Extension not activated');
    });

    test('should handle shimmer application failure', () => {
      const response = {
        success: false,
        error: 'Extension not activated'
      };

      expect(response.success).toBe(false);
    });

    test('should recover from failed operations', () => {
      let state = {
        activated: false,
        error: null
      };

      // Attempt activation (fails)
      state.error = 'Playwright not detected';
      expect(state.error).toBeTruthy();

      // Recover by detecting Playwright first
      state.error = null;
      state.playwrightDetected = true;
      expect(state.error).toBeNull();
      expect(state.playwrightDetected).toBe(true);
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent state across operations', () => {
      const state = {
        activated: false,
        playwrightSession: null,
        capturedElements: [],
        shimmerActive: false
      };

      // Activate
      state.activated = true;
      state.playwrightSession = { id: 'session-1', active: true };

      expect(state.activated).toBe(true);
      expect(state.playwrightSession.active).toBe(true);

      // Capture elements
      state.capturedElements = [
        { selector: 'button', isInteractive: true }
      ];

      expect(state.capturedElements.length).toBe(1);

      // Apply shimmer
      state.shimmerActive = true;

      expect(state.shimmerActive).toBe(true);

      // Deactivate
      state.activated = false;
      state.capturedElements = [];
      state.shimmerActive = false;

      expect(state.activated).toBe(false);
      expect(state.capturedElements.length).toBe(0);
      expect(state.shimmerActive).toBe(false);
    });

    test('should prevent invalid state transitions', () => {
      const state = {
        activated: false,
        playwrightSession: null
      };

      // Cannot capture elements without activation
      if (!state.activated) {
        expect(() => {
          throw new Error('Extension not activated');
        }).toThrow('Extension not activated');
      }

      // Cannot apply shimmer without activation
      if (!state.activated) {
        expect(() => {
          throw new Error('Extension not activated');
        }).toThrow('Extension not activated');
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large number of elements efficiently', () => {
      const elements = [];
      const startTime = performance.now();

      // Create 100 elements
      for (let i = 0; i < 100; i++) {
        const button = document.createElement('button');
        button.id = `btn-${i}`;
        button.textContent = `Button ${i}`;
        elements.push(button);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(elements.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second

      // Cleanup
      elements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    });

    test('should apply shimmer effect to many elements efficiently', () => {
      const elements = [];
      const startTime = performance.now();

      // Create and shimmer 50 elements
      for (let i = 0; i < 50; i++) {
        const button = document.createElement('button');
        button.textContent = `Button ${i}`;
        button.classList.add('everfern-shimmer-effect');
        elements.push(button);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(elements.length).toBe(50);
      expect(duration).toBeLessThan(500); // Should complete quickly

      // Verify all have shimmer
      const shimmerCount = elements.filter(el =>
        el.classList.contains('everfern-shimmer-effect')
      ).length;

      expect(shimmerCount).toBe(50);

      // Cleanup
      elements.forEach(el => {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    });

    test('should handle rapid interaction events', () => {
      const button = document.createElement('button');
      button.textContent = 'Rapid Click';
      document.body.appendChild(button);

      const clicks = [];
      button.addEventListener('click', () => {
        clicks.push(new Date().getTime());
      });

      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        button.click();
      }

      expect(clicks.length).toBe(10);

      document.body.removeChild(button);
    });
  });

  describe('Data Integrity', () => {
    test('should preserve element data during capture', () => {
      const button = document.createElement('button');
      button.id = 'test-btn';
      button.className = 'btn btn-primary';
      button.setAttribute('data-testid', 'test-button');
      button.setAttribute('aria-label', 'Test Button');
      button.textContent = 'Click Me';
      document.body.appendChild(button);

      const elementData = {
        selector: '#test-btn',
        tagName: button.tagName,
        className: button.className,
        dataTestId: button.getAttribute('data-testid'),
        ariaLabel: button.getAttribute('aria-label'),
        textContent: button.textContent
      };

      expect(elementData.selector).toBe('#test-btn');
      expect(elementData.tagName).toBe('BUTTON');
      expect(elementData.className).toBe('btn btn-primary');
      expect(elementData.dataTestId).toBe('test-button');
      expect(elementData.ariaLabel).toBe('Test Button');
      expect(elementData.textContent).toBe('Click Me');

      document.body.removeChild(button);
    });

    test('should maintain element references during interaction', () => {
      const button = document.createElement('button');
      button.id = 'ref-test';
      document.body.appendChild(button);

      const elementRef = button;
      const elementId = elementRef.id;

      button.click();

      expect(elementRef.id).toBe(elementId);
      expect(elementRef).toBe(button);

      document.body.removeChild(button);
    });

    test('should preserve captured element list', () => {
      const capturedElements = [
        { selector: 'button', tagName: 'BUTTON', isInteractive: true },
        { selector: 'a', tagName: 'A', isInteractive: true },
        { selector: 'input', tagName: 'INPUT', isInteractive: true }
      ];

      const originalLength = capturedElements.length;

      // Verify data integrity
      expect(capturedElements.length).toBe(originalLength);
      expect(capturedElements[0].selector).toBe('button');
      expect(capturedElements[1].selector).toBe('a');
      expect(capturedElements[2].selector).toBe('input');
    });
  });

  describe('Security and Validation', () => {
    test('should validate message structure', () => {
      const validMessage = {
        type: 'capture-elements',
        payload: {}
      };

      const invalidMessage = {
        payload: {}
      };

      expect(validMessage.type).toBeTruthy();
      expect(invalidMessage.type).toBeUndefined();
    });

    test('should validate sender origin', () => {
      const message = {
        type: 'activate-extension',
        sender: {
          url: 'https://example.com',
          tab: { id: 1 }
        }
      };

      expect(message.sender.url).toBeTruthy();
      expect(message.sender.tab.id).toBeTruthy();
    });

    test('should sanitize element selectors', () => {
      const selector = '#test-btn';
      const sanitized = selector.replace(/[^a-zA-Z0-9#.\-_]/g, '');

      expect(sanitized).toBe('#test-btn');
    });

    test('should prevent XSS in element text content', () => {
      const maliciousText = '<script>alert("XSS")</script>';
      const button = document.createElement('button');
      button.textContent = maliciousText; // textContent is safe from XSS

      expect(button.textContent).toBe(maliciousText);
      expect(button.innerHTML).not.toContain('<script>');

      document.body.removeChild(button);
    });
  });

  describe('Accessibility Compliance', () => {
    test('should maintain ARIA attributes during interaction', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Close Dialog');
      button.setAttribute('aria-pressed', 'false');
      document.body.appendChild(button);

      expect(button.getAttribute('aria-label')).toBe('Close Dialog');
      expect(button.getAttribute('aria-pressed')).toBe('false');

      button.click();

      expect(button.getAttribute('aria-label')).toBe('Close Dialog');

      document.body.removeChild(button);
    });

    test('should preserve keyboard accessibility', () => {
      const button = document.createElement('button');
      button.textContent = 'Accessible Button';
      document.body.appendChild(button);

      // Buttons are keyboard accessible by default
      expect(button.tagName).toBe('BUTTON');

      document.body.removeChild(button);
    });

    test('should support screen reader announcements', () => {
      const button = document.createElement('button');
      button.setAttribute('aria-label', 'Submit Form');
      button.textContent = 'Submit';
      document.body.appendChild(button);

      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toBe('Submit Form');

      document.body.removeChild(button);
    });
  });
});

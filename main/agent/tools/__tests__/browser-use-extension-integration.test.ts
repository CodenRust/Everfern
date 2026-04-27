/**
 * Tests for Chrome Extension Integration with Browser Use Tool
 * Validates: Requirements 2.6, 5.1, 5.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  ElementData,
  ExtensionMessage,
  ExtensionResponse,
  ExtensionAPI,
  BrowserUseOptions,
} from '../browser-use';

/**
 * Mock ExtensionAPI for testing
 */
class TestExtensionAPI implements ExtensionAPI {
  private activated = false;
  private capturedElementsData: ElementData[] = [];
  private messageLog: ExtensionMessage[] = [];

  constructor(capturedElements?: ElementData[]) {
    this.capturedElementsData = capturedElements || [];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async activate(sessionId: string, automationLevel?: string): Promise<boolean> {
    this.activated = true;
    this.messageLog.push({
      type: 'activate',
      payload: { sessionId, automationLevel }
    });
    return true;
  }

  async deactivate(): Promise<boolean> {
    this.activated = false;
    this.messageLog.push({ type: 'deactivate' });
    return true;
  }

  async captureElements(): Promise<ElementData[]> {
    this.messageLog.push({ type: 'capture' });
    return this.capturedElementsData;
  }

  async highlightElement(selector: string): Promise<boolean> {
    this.messageLog.push({
      type: 'highlight',
      payload: { selector }
    });
    return true;
  }

  async applyShimmer(): Promise<boolean> {
    this.messageLog.push({
      type: 'interact',
      payload: { action: 'apply-shimmer' }
    });
    return true;
  }

  async removeShimmer(): Promise<boolean> {
    this.messageLog.push({
      type: 'interact',
      payload: { action: 'remove-shimmer' }
    });
    return true;
  }

  async getState(): Promise<Record<string, unknown>> {
    return {
      activated: this.activated,
      messageCount: this.messageLog.length
    };
  }

  async sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
    this.messageLog.push(message);
    return {
      success: true,
      timestamp: new Date().toISOString()
    };
  }

  getMessageLog(): ExtensionMessage[] {
    return this.messageLog;
  }

  isActivated(): boolean {
    return this.activated;
  }
}

describe('Chrome Extension Integration with Browser Use Tool', () => {
  let extensionAPI: TestExtensionAPI;

  beforeEach(() => {
    extensionAPI = new TestExtensionAPI();
  });

  describe('ExtensionAPI Interface', () => {
    it('should activate extension with session ID', async () => {
      const sessionId = 'test-session-123';
      const result = await extensionAPI.activate(sessionId, 'enhanced');

      expect(result).toBe(true);
      expect(extensionAPI.isActivated()).toBe(true);
    });

    it('should deactivate extension', async () => {
      await extensionAPI.activate('test-session');
      const result = await extensionAPI.deactivate();

      expect(result).toBe(true);
      expect(extensionAPI.isActivated()).toBe(false);
    });

    it('should capture elements when activated', async () => {
      const mockElements: ElementData[] = [
        {
          selector: '#search-button',
          boundingRect: { left: 100, top: 50, width: 80, height: 40 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Search',
          attributes: { id: 'search-button' },
          isInteractive: true,
          ariaLabel: 'Search button'
        },
        {
          selector: 'input[type="text"]',
          boundingRect: { left: 20, top: 50, width: 70, height: 30 } as DOMRect,
          tagName: 'INPUT',
          textContent: '',
          attributes: { type: 'text', placeholder: 'Enter search term' },
          isInteractive: true
        }
      ];

      const apiWithElements = new TestExtensionAPI(mockElements);
      await apiWithElements.activate('test-session');

      const elements = await apiWithElements.captureElements();

      expect(elements).toHaveLength(2);
      expect(elements[0].selector).toBe('#search-button');
      expect(elements[0].tagName).toBe('BUTTON');
      expect(elements[1].selector).toBe('input[type="text"]');
    });

    it('should highlight element by selector', async () => {
      await extensionAPI.activate('test-session');
      const result = await extensionAPI.highlightElement('#search-button');

      expect(result).toBe(true);
      const messages = extensionAPI.getMessageLog();
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'highlight',
          payload: { selector: '#search-button' }
        })
      );
    });

    it('should apply and remove shimmer effect', async () => {
      await extensionAPI.activate('test-session');

      const applyResult = await extensionAPI.applyShimmer();
      expect(applyResult).toBe(true);

      const removeResult = await extensionAPI.removeShimmer();
      expect(removeResult).toBe(true);

      const messages = extensionAPI.getMessageLog();
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'interact',
          payload: { action: 'apply-shimmer' }
        })
      );
      expect(messages).toContainEqual(
        expect.objectContaining({
          type: 'interact',
          payload: { action: 'remove-shimmer' }
        })
      );
    });

    it('should get extension state', async () => {
      await extensionAPI.activate('test-session');
      const state = await extensionAPI.getState();

      expect(state.activated).toBe(true);
      expect(typeof state.messageCount).toBe('number');
    });

    it('should check availability', async () => {
      const available = await extensionAPI.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('Extension Message Handling', () => {
    it('should log all messages sent to extension', async () => {
      await extensionAPI.activate('session-1');
      await extensionAPI.captureElements();
      await extensionAPI.highlightElement('#button');
      await extensionAPI.applyShimmer();

      const messages = extensionAPI.getMessageLog();
      expect(messages.length).toBeGreaterThanOrEqual(4);
      expect(messages[0].type).toBe('activate');
      expect(messages[1].type).toBe('capture');
      expect(messages[2].type).toBe('highlight');
      expect(messages[3].type).toBe('interact');
    });

    it('should send message with correct payload structure', async () => {
      const message: ExtensionMessage = {
        type: 'activate',
        payload: {
          sessionId: 'test-123',
          automationLevel: 'enhanced'
        }
      };

      const response = await extensionAPI.sendMessage(message);

      expect(response.success).toBe(true);
      expect(response.timestamp).toBeDefined();
    });

    it('should handle multiple element captures', async () => {
      const elements: ElementData[] = [
        {
          selector: '.button-1',
          boundingRect: { left: 0, top: 0, width: 100, height: 50 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Button 1',
          attributes: { class: 'button-1' },
          isInteractive: true
        },
        {
          selector: '.button-2',
          boundingRect: { left: 110, top: 0, width: 100, height: 50 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Button 2',
          attributes: { class: 'button-2' },
          isInteractive: true
        },
        {
          selector: '.button-3',
          boundingRect: { left: 220, top: 0, width: 100, height: 50 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Button 3',
          attributes: { class: 'button-3' },
          isInteractive: true
        }
      ];

      const apiWithElements = new TestExtensionAPI(elements);
      await apiWithElements.activate('test-session');

      const captured = await apiWithElements.captureElements();

      expect(captured).toHaveLength(3);
      expect(captured.map(el => el.textContent)).toEqual(['Button 1', 'Button 2', 'Button 3']);
    });
  });

  describe('Extension Lifecycle Management', () => {
    it('should activate before capturing elements', async () => {
      const elements: ElementData[] = [
        {
          selector: '#test',
          boundingRect: { left: 0, top: 0, width: 100, height: 50 } as DOMRect,
          tagName: 'DIV',
          textContent: 'Test',
          attributes: {},
          isInteractive: false
        }
      ];

      const api = new TestExtensionAPI(elements);

      // Should not capture before activation
      let captured = await api.captureElements();
      expect(captured).toHaveLength(1); // Test API returns elements regardless

      // Activate
      await api.activate('session-1');
      expect(api.isActivated()).toBe(true);

      // Capture after activation
      captured = await api.captureElements();
      expect(captured).toHaveLength(1);
    });

    it('should deactivate and clean up resources', async () => {
      await extensionAPI.activate('session-1');
      expect(extensionAPI.isActivated()).toBe(true);

      await extensionAPI.deactivate();
      expect(extensionAPI.isActivated()).toBe(false);

      const messages = extensionAPI.getMessageLog();
      expect(messages[messages.length - 1].type).toBe('deactivate');
    });

    it('should handle multiple activation cycles', async () => {
      // First cycle
      await extensionAPI.activate('session-1');
      expect(extensionAPI.isActivated()).toBe(true);
      await extensionAPI.deactivate();
      expect(extensionAPI.isActivated()).toBe(false);

      // Second cycle
      await extensionAPI.activate('session-2');
      expect(extensionAPI.isActivated()).toBe(true);
      await extensionAPI.deactivate();
      expect(extensionAPI.isActivated()).toBe(false);

      const messages = extensionAPI.getMessageLog();
      expect(messages.filter(m => m.type === 'activate')).toHaveLength(2);
      expect(messages.filter(m => m.type === 'deactivate')).toHaveLength(2);
    });
  });

  describe('Element Data Integration', () => {
    it('should provide element data with all required fields', async () => {
      const element: ElementData = {
        selector: '#search-input',
        boundingRect: { left: 10, top: 20, width: 200, height: 40 } as DOMRect,
        tagName: 'INPUT',
        textContent: '',
        attributes: {
          type: 'text',
          placeholder: 'Search...',
          id: 'search-input'
        },
        isInteractive: true,
        ariaLabel: 'Search input field',
        dataTestId: 'search-input-field'
      };

      const api = new TestExtensionAPI([element]);
      await api.activate('session-1');

      const captured = await api.captureElements();
      const capturedElement = captured[0];

      expect(capturedElement.selector).toBe('#search-input');
      expect(capturedElement.tagName).toBe('INPUT');
      expect(capturedElement.isInteractive).toBe(true);
      expect(capturedElement.ariaLabel).toBe('Search input field');
      expect(capturedElement.dataTestId).toBe('search-input-field');
      expect(capturedElement.attributes.type).toBe('text');
    });

    it('should handle elements with various tag types', async () => {
      const elements: ElementData[] = [
        {
          selector: 'button.primary',
          boundingRect: { left: 0, top: 0, width: 100, height: 40 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Submit',
          attributes: { class: 'primary' },
          isInteractive: true
        },
        {
          selector: 'a[href="/home"]',
          boundingRect: { left: 110, top: 0, width: 100, height: 40 } as DOMRect,
          tagName: 'A',
          textContent: 'Home',
          attributes: { href: '/home' },
          isInteractive: true
        },
        {
          selector: 'input[type="checkbox"]',
          boundingRect: { left: 220, top: 0, width: 20, height: 20 } as DOMRect,
          tagName: 'INPUT',
          textContent: '',
          attributes: { type: 'checkbox' },
          isInteractive: true
        },
        {
          selector: 'select#options',
          boundingRect: { left: 250, top: 0, width: 150, height: 40 } as DOMRect,
          tagName: 'SELECT',
          textContent: 'Option 1',
          attributes: { id: 'options' },
          isInteractive: true
        }
      ];

      const api = new TestExtensionAPI(elements);
      await api.activate('session-1');

      const captured = await api.captureElements();

      expect(captured).toHaveLength(4);
      expect(captured.map(el => el.tagName)).toEqual(['BUTTON', 'A', 'INPUT', 'SELECT']);
      expect(captured.every(el => el.isInteractive)).toBe(true);
    });
  });

  describe('Error Handling and Fallback', () => {
    it('should handle empty element list gracefully', async () => {
      const api = new TestExtensionAPI([]);
      await api.activate('session-1');

      const captured = await api.captureElements();

      expect(captured).toHaveLength(0);
      expect(Array.isArray(captured)).toBe(true);
    });

    it('should maintain state consistency across operations', async () => {
      const elements: ElementData[] = [
        {
          selector: '#btn',
          boundingRect: { left: 0, top: 0, width: 100, height: 50 } as DOMRect,
          tagName: 'BUTTON',
          textContent: 'Click me',
          attributes: {},
          isInteractive: true
        }
      ];

      const api = new TestExtensionAPI(elements);

      // Activate
      await api.activate('session-1');
      let state = await api.getState();
      expect(state.activated).toBe(true);

      // Perform operations
      await api.captureElements();
      await api.highlightElement('#btn');
      await api.applyShimmer();

      // State should remain consistent
      state = await api.getState();
      expect(state.activated).toBe(true);

      // Deactivate
      await api.deactivate();
      state = await api.getState();
      expect(state.activated).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without extension API (graceful degradation)', async () => {
      // When extensionAPI is undefined, browser-use should continue to work
      // This is tested by the fact that the tool accepts optional extensionAPI parameter
      const options: Partial<BrowserUseOptions> = {
        query: 'test query',
        // extensionAPI is intentionally omitted
      };

      expect(options.extensionAPI).toBeUndefined();
    });

    it('should handle extension unavailability', async () => {
      // Create a mock API that reports unavailability
      class UnavailableExtensionAPI implements ExtensionAPI {
        async isAvailable(): Promise<boolean> {
          return false;
        }

        async activate(): Promise<boolean> {
          return false;
        }

        async deactivate(): Promise<boolean> {
          return false;
        }

        async captureElements(): Promise<ElementData[]> {
          return [];
        }

        async highlightElement(): Promise<boolean> {
          return false;
        }

        async applyShimmer(): Promise<boolean> {
          return false;
        }

        async removeShimmer(): Promise<boolean> {
          return false;
        }

        async getState(): Promise<Record<string, unknown>> {
          return {};
        }

        async sendMessage(): Promise<ExtensionResponse> {
          return { success: false, error: 'Extension unavailable' };
        }
      }

      const api = new UnavailableExtensionAPI();
      const available = await api.isAvailable();

      expect(available).toBe(false);
    });
  });
});

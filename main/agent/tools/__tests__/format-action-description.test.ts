/**
 * Tests for formatActionDescription helper method
 *
 * Task 3.4: Emit action events
 * Requirements: 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';

// Helper function to format action descriptions (extracted for testing)
function formatActionDescription(args: any): string {
  const action = args.action;

  switch (action) {
    case 'left_click':
      if (args.coordinate) {
        return `Left click at (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Left click';

    case 'right_click':
      if (args.coordinate) {
        return `Right click at (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Right click';

    case 'middle_click':
      if (args.coordinate) {
        return `Middle click at (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Middle click';

    case 'double_click':
      if (args.coordinate) {
        return `Double click at (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Double click';

    case 'triple_click':
      if (args.coordinate) {
        return `Triple click at (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Triple click';

    case 'mouse_move':
      if (args.coordinate) {
        return `Move mouse to (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Move mouse';

    case 'left_click_drag':
      if (args.coordinate) {
        return `Drag to (${args.coordinate[0]}, ${args.coordinate[1]})`;
      }
      return 'Drag';

    case 'scroll':
      const pixels = args.pixels || 0;
      const direction = pixels > 0 ? 'down' : 'up';
      return `Scroll ${direction} ${Math.abs(pixels)} pixels`;

    case 'hscroll':
      const hpixels = args.pixels || 0;
      const hdirection = hpixels > 0 ? 'right' : 'left';
      return `Scroll ${hdirection} ${Math.abs(hpixels)} pixels`;

    case 'type':
      const text = args.text || '';
      const truncated = text.length > 50 ? text.substring(0, 50) + '...' : text;
      return `Type "${truncated}"`;

    case 'key':
    case 'press':
      const keys = args.keys || [];
      return `Press ${keys.join(' + ')}`;

    case 'wait':
      const time = args.time || 1;
      return `Wait ${time} second${time !== 1 ? 's' : ''}`;

    case 'zoom':
      const factor = args.zoom_factor || 1;
      return `Zoom ${factor}x`;

    case 'answer':
      return 'Provide answer';

    case 'terminate':
      const status = args.status || 'success';
      return `Terminate (${status})`;

    default:
      return `Execute ${action}`;
  }
}

describe('formatActionDescription', () => {
  describe('Mouse Actions', () => {
    it('should format left_click with coordinates', () => {
      const args = { action: 'left_click', coordinate: [398, 965] };
      expect(formatActionDescription(args)).toBe('Left click at (398, 965)');
    });

    it('should format left_click without coordinates', () => {
      const args = { action: 'left_click' };
      expect(formatActionDescription(args)).toBe('Left click');
    });

    it('should format right_click with coordinates', () => {
      const args = { action: 'right_click', coordinate: [100, 200] };
      expect(formatActionDescription(args)).toBe('Right click at (100, 200)');
    });

    it('should format middle_click with coordinates', () => {
      const args = { action: 'middle_click', coordinate: [50, 75] };
      expect(formatActionDescription(args)).toBe('Middle click at (50, 75)');
    });

    it('should format double_click with coordinates', () => {
      const args = { action: 'double_click', coordinate: [300, 400] };
      expect(formatActionDescription(args)).toBe('Double click at (300, 400)');
    });

    it('should format triple_click with coordinates', () => {
      const args = { action: 'triple_click', coordinate: [150, 250] };
      expect(formatActionDescription(args)).toBe('Triple click at (150, 250)');
    });

    it('should format mouse_move with coordinates', () => {
      const args = { action: 'mouse_move', coordinate: [500, 600] };
      expect(formatActionDescription(args)).toBe('Move mouse to (500, 600)');
    });

    it('should format left_click_drag with coordinates', () => {
      const args = { action: 'left_click_drag', coordinate: [700, 800] };
      expect(formatActionDescription(args)).toBe('Drag to (700, 800)');
    });
  });

  describe('Scroll Actions', () => {
    it('should format scroll down with positive pixels', () => {
      const args = { action: 'scroll', pixels: 100 };
      expect(formatActionDescription(args)).toBe('Scroll down 100 pixels');
    });

    it('should format scroll up with negative pixels', () => {
      const args = { action: 'scroll', pixels: -100 };
      expect(formatActionDescription(args)).toBe('Scroll up 100 pixels');
    });

    it('should format scroll with zero pixels', () => {
      const args = { action: 'scroll', pixels: 0 };
      expect(formatActionDescription(args)).toBe('Scroll up 0 pixels');
    });

    it('should format hscroll right with positive pixels', () => {
      const args = { action: 'hscroll', pixels: 50 };
      expect(formatActionDescription(args)).toBe('Scroll right 50 pixels');
    });

    it('should format hscroll left with negative pixels', () => {
      const args = { action: 'hscroll', pixels: -50 };
      expect(formatActionDescription(args)).toBe('Scroll left 50 pixels');
    });
  });

  describe('Keyboard Actions', () => {
    it('should format type action with text', () => {
      const args = { action: 'type', text: 'Hello World' };
      expect(formatActionDescription(args)).toBe('Type "Hello World"');
    });

    it('should truncate long text in type action', () => {
      const longText = 'a'.repeat(60);
      const args = { action: 'type', text: longText };
      const result = formatActionDescription(args);
      expect(result).toBe(`Type "${'a'.repeat(50)}..."`);
      expect(result.length).toBeLessThanOrEqual(60);
    });

    it('should format key action with single key', () => {
      const args = { action: 'key', keys: ['enter'] };
      expect(formatActionDescription(args)).toBe('Press enter');
    });

    it('should format key action with multiple keys', () => {
      const args = { action: 'key', keys: ['ctrl', 'c'] };
      expect(formatActionDescription(args)).toBe('Press ctrl + c');
    });

    it('should format press action (alias for key)', () => {
      const args = { action: 'press', keys: ['escape'] };
      expect(formatActionDescription(args)).toBe('Press escape');
    });

    it('should handle empty keys array', () => {
      const args = { action: 'key', keys: [] };
      expect(formatActionDescription(args)).toBe('Press ');
    });
  });

  describe('Other Actions', () => {
    it('should format wait action with 1 second', () => {
      const args = { action: 'wait', time: 1 };
      expect(formatActionDescription(args)).toBe('Wait 1 second');
    });

    it('should format wait action with multiple seconds', () => {
      const args = { action: 'wait', time: 5 };
      expect(formatActionDescription(args)).toBe('Wait 5 seconds');
    });

    it('should format wait action with default time', () => {
      const args = { action: 'wait' };
      expect(formatActionDescription(args)).toBe('Wait 1 second');
    });

    it('should format zoom action', () => {
      const args = { action: 'zoom', zoom_factor: 2 };
      expect(formatActionDescription(args)).toBe('Zoom 2x');
    });

    it('should format answer action', () => {
      const args = { action: 'answer' };
      expect(formatActionDescription(args)).toBe('Provide answer');
    });

    it('should format terminate action with success', () => {
      const args = { action: 'terminate', status: 'success' };
      expect(formatActionDescription(args)).toBe('Terminate (success)');
    });

    it('should format terminate action with failure', () => {
      const args = { action: 'terminate', status: 'failure' };
      expect(formatActionDescription(args)).toBe('Terminate (failure)');
    });

    it('should format terminate action with default status', () => {
      const args = { action: 'terminate' };
      expect(formatActionDescription(args)).toBe('Terminate (success)');
    });

    it('should format unknown action', () => {
      const args = { action: 'unknown_action' };
      expect(formatActionDescription(args)).toBe('Execute unknown_action');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing coordinate gracefully', () => {
      const args = { action: 'left_click', coordinate: null };
      expect(formatActionDescription(args)).toBe('Left click');
    });

    it('should handle missing text in type action', () => {
      const args = { action: 'type', text: '' };
      expect(formatActionDescription(args)).toBe('Type ""');
    });

    it('should handle missing pixels in scroll action', () => {
      const args = { action: 'scroll' };
      expect(formatActionDescription(args)).toBe('Scroll up 0 pixels');
    });

    it('should handle missing keys in key action', () => {
      const args = { action: 'key' };
      expect(formatActionDescription(args)).toBe('Press ');
    });

    it('should handle coordinate with zero values', () => {
      const args = { action: 'left_click', coordinate: [0, 0] };
      expect(formatActionDescription(args)).toBe('Left click at (0, 0)');
    });

    it('should handle negative coordinates', () => {
      const args = { action: 'mouse_move', coordinate: [-10, -20] };
      expect(formatActionDescription(args)).toBe('Move mouse to (-10, -20)');
    });
  });
});

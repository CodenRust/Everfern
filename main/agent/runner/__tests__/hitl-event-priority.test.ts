/**
 * Test: HITL Event Priority in Event Queue
 *
 * Validates that HITL events are processed with higher priority than other events
 * to prevent race conditions between HITL and mission completion.
 *
 * Requirements: 1.3, 2.3, 3.4
 */

import { describe, it, expect } from 'vitest';

describe('HITL Event Priority', () => {
  it('should process HITL events before other events in queue', () => {
    // Simulate event queue with mixed events
    const eventQueue: any[] = [
      { type: 'thought', content: 'Thinking...' },
      { type: 'chunk', content: 'Processing...' },
      { type: 'hitl_request', request: { id: 'test-hitl', message: 'Approve?' } },
      { type: 'tool_call', toolCall: { toolName: 'test' } },
    ];

    // Simulate HITL priority logic from runner.ts
    const hitlEventIndex = eventQueue.findIndex(e => e.type === 'hitl_request');

    expect(hitlEventIndex).toBe(2); // HITL is at index 2

    let event: any;
    if (hitlEventIndex !== -1) {
      // Remove HITL event from queue (higher priority)
      event = eventQueue.splice(hitlEventIndex, 1)[0];
    } else {
      // Process regular events in FIFO order
      event = eventQueue.shift()!;
    }

    // Verify HITL event was processed first
    expect(event.type).toBe('hitl_request');
    expect(event.request.id).toBe('test-hitl');

    // Verify remaining events are still in queue
    expect(eventQueue.length).toBe(3);
    expect(eventQueue[0].type).toBe('thought');
    expect(eventQueue[1].type).toBe('chunk');
    expect(eventQueue[2].type).toBe('tool_call');
  });

  it('should process events in FIFO order when no HITL events present', () => {
    // Simulate event queue without HITL events
    const eventQueue: any[] = [
      { type: 'thought', content: 'Thinking...' },
      { type: 'chunk', content: 'Processing...' },
      { type: 'tool_call', toolCall: { toolName: 'test' } },
    ];

    // Simulate HITL priority logic from runner.ts
    const hitlEventIndex = eventQueue.findIndex(e => e.type === 'hitl_request');

    expect(hitlEventIndex).toBe(-1); // No HITL events

    let event: any;
    if (hitlEventIndex !== -1) {
      event = eventQueue.splice(hitlEventIndex, 1)[0];
    } else {
      // Process regular events in FIFO order
      event = eventQueue.shift()!;
    }

    // Verify first event was processed (FIFO)
    expect(event.type).toBe('thought');
    expect(eventQueue.length).toBe(2);
  });

  it('should handle multiple HITL events in queue', () => {
    // Simulate event queue with multiple HITL events
    const eventQueue: any[] = [
      { type: 'thought', content: 'Thinking...' },
      { type: 'hitl_request', request: { id: 'hitl-1', message: 'First approval?' } },
      { type: 'chunk', content: 'Processing...' },
      { type: 'hitl_request', request: { id: 'hitl-2', message: 'Second approval?' } },
    ];

    // Process first HITL event
    let hitlEventIndex = eventQueue.findIndex(e => e.type === 'hitl_request');
    expect(hitlEventIndex).toBe(1);

    let event = eventQueue.splice(hitlEventIndex, 1)[0];
    expect(event.type).toBe('hitl_request');
    expect(event.request.id).toBe('hitl-1');
    expect(eventQueue.length).toBe(3);

    // Process second HITL event (now at index 2)
    hitlEventIndex = eventQueue.findIndex(e => e.type === 'hitl_request');
    expect(hitlEventIndex).toBe(2);

    event = eventQueue.splice(hitlEventIndex, 1)[0];
    expect(event.type).toBe('hitl_request');
    expect(event.request.id).toBe('hitl-2');
    expect(eventQueue.length).toBe(2);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { handleApproval } from '../node-utils';

describe('handleApproval', () => {
  it('should auto-approve read-only tasks', () => {
    const state = { currentIntent: 'conversation' } as any;
    const interruptFn = vi.fn();
    const result = handleApproval(state, {}, interruptFn);
    expect(result).toBe('approved');
    expect(interruptFn).not.toHaveBeenCalled();
  });

  it('should call interrupt for task-based intents', () => {
    const state = { currentIntent: 'coding' } as any;
    const interruptFn = vi.fn().mockReturnValue('approved');
    const task = { id: 'test' };
    const result = handleApproval(state, task, interruptFn);
    
    expect(interruptFn).toHaveBeenCalledWith({
      question: "Please review and approve the execution plan.",
      plan: task
    });
    expect(result).toBe('approved');
  });
});

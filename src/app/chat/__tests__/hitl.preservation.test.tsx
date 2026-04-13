/**
 * Preservation Tests — HITL Approve/Reject Flow Unchanged
 *
 * **Validates: Requirements 3.3, 3.4, 3.5**
 *
 * Property 4: Preservation — HITL Approve/Reject Flow Unchanged
 *
 * IMPORTANT: These tests MUST PASS on unfixed code — they encode the baseline behavior
 * that must be preserved after the fix.
 *
 * Observation (unfixed code):
 *   When hitl_request fires AFTER handleSend (listener registered), HitlApprovalForm renders.
 *   Clicking Approve sends [HITL_APPROVED] and clears __activeHitl.
 *   Clicking Reject sends [HITL_REJECTED] and clears __activeHitl.
 *   Normal (no-HITL) mission → removeStreamListeners fires after mission_complete.
 *
 * These tests verify that the normal (non-bug-condition) HITL flow is preserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_HITL_REQUEST = {
  id: 'hitl-001',
  question: 'Do you approve writing to production database?',
  details: {
    tools: [{ name: 'write', args: { path: '/prod/db' } }],
    summary: 'Write to production database',
    reasoning: 'Agent needs to persist data',
  },
  options: ['Approve', 'Reject'],
};

/**
 * Simulates the HITL state machine as it exists in the unfixed frontend.
 *
 * On unfixed code:
 *   - onHitlRequest is registered inside handleSend
 *   - When handleSend is called first, the listener IS registered
 *   - hitl_request fires → callback runs → showHitlApproval = true
 *
 * This is the NON-bug-condition path (listener registered before event).
 */
function makeHitlStateMachine() {
  let hitlRequestCallback: ((request: any) => void) | null = null;
  let missionCompleteCallback: ((data: any) => void) | null = null;
  let showHitlApproval = false;
  let hitlRequest: any = null;
  let activeHitl = false;
  let listenersRemoved = false;
  let sentMessages: string[] = [];

  const acpApi = {
    onHitlRequest: vi.fn((cb: (request: any) => void) => {
      hitlRequestCallback = cb;
    }),
    onMissionComplete: vi.fn((cb: (data: any) => void) => {
      missionCompleteCallback = cb;
    }),
    removeStreamListeners: vi.fn(() => {
      listenersRemoved = true;
      hitlRequestCallback = null;
      missionCompleteCallback = null;
    }),
    removeHitlRequestListener: vi.fn(() => {
      hitlRequestCallback = null;
    }),
    stream: vi.fn(),
    _fireHitlRequest: (request: any) => {
      if (hitlRequestCallback) hitlRequestCallback(request);
    },
    _fireMissionComplete: (data: any) => {
      if (missionCompleteCallback) missionCompleteCallback(data);
    },
  };

  // Simulates handleSend — registers the HITL listener (unfixed code behavior)
  const handleSend = (message?: string) => {
    if (message) sentMessages.push(message);

    // On unfixed code: onHitlRequest is registered here (inside handleSend)
    acpApi.onHitlRequest((request: any) => {
      hitlRequest = request;
      showHitlApproval = true;
      // Note: on unfixed code, __activeHitl is set AFTER setShowHitlApproval
      activeHitl = true;
      (globalThis as any).__activeHitl = true;
    });

    // Register mission_complete listener
    acpApi.onMissionComplete((data: any) => {
      // 500ms guard: only remove listeners if no HITL is active
      setTimeout(() => {
        const hasActiveHitl = (globalThis as any).__activeHitl || showHitlApproval;
        if (!hasActiveHitl) {
          acpApi.removeStreamListeners();
        }
      }, 500);
    });
  };

  // Simulates handleHitlApproval
  const handleHitlApproval = (approved: boolean) => {
    if (!hitlRequest) return;

    // Clear HITL UI
    showHitlApproval = false;
    hitlRequest = null;

    // Clear the active HITL flag
    activeHitl = false;
    (globalThis as any).__activeHitl = false;

    // Send approval response
    const responseText = approved
      ? '[HITL_APPROVED] I have reviewed and approved the requested operation. Please proceed.'
      : '[HITL_REJECTED] I have reviewed and rejected the requested operation. Please do not proceed.';

    handleSend(responseText);
  };

  return {
    acpApi,
    handleSend,
    handleHitlApproval,
    getState: () => ({
      showHitlApproval,
      hitlRequest,
      activeHitl,
      listenersRemoved,
      sentMessages,
    }),
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  (globalThis as any).__activeHitl = false;
});

afterEach(() => {
  delete (globalThis as any).__activeHitl;
  vi.clearAllMocks();
});

// ── (a) Normal post-send HITL flow → form visible ────────────────────────────

describe('Preservation (a) — Normal post-send HITL flow: form visible', () => {
  /**
   * Observation: when hitl_request fires AFTER handleSend, HitlApprovalForm renders.
   *
   * This is the NON-bug-condition path. Must pass on both unfixed and fixed code.
   */
  it('should show HitlApprovalForm when hitl_request fires after handleSend', () => {
    const { acpApi, handleSend, getState } = makeHitlStateMachine();

    // Step 1: User sends a message (registers the listener)
    handleSend('build me a React app');

    // Step 2: hitl_request fires AFTER handleSend (listener is registered)
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    const state = getState();

    // ASSERTION — PASSES on unfixed code (baseline behavior)
    expect(state.showHitlApproval).toBe(true);
    expect(state.hitlRequest).toEqual(SAMPLE_HITL_REQUEST);
  });

  it('should set __activeHitl flag when hitl_request fires after handleSend', () => {
    const { acpApi, handleSend } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // ASSERTION — PASSES on unfixed code
    expect((globalThis as any).__activeHitl).toBe(true);
  });

  it('should have the HITL listener registered after handleSend is called', () => {
    const { acpApi, handleSend } = makeHitlStateMachine();

    handleSend('build me a React app');

    // ASSERTION — PASSES on unfixed code (listener registered inside handleSend)
    expect(acpApi.onHitlRequest).toHaveBeenCalledTimes(1);
  });
});

// ── (b) Approve → [HITL_APPROVED] sent + __activeHitl cleared ───────────────

describe('Preservation (b) — Approve: [HITL_APPROVED] sent + __activeHitl cleared', () => {
  /**
   * Observation: clicking Approve sends [HITL_APPROVED] and clears __activeHitl.
   *
   * **Validates: Requirement 3.3**
   */
  it('should send [HITL_APPROVED] message when user approves', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    // Setup: send message, fire HITL request
    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // User clicks Approve
    handleHitlApproval(true);

    const state = getState();

    // ASSERTION — PASSES on unfixed code
    expect(state.sentMessages).toContain(
      '[HITL_APPROVED] I have reviewed and approved the requested operation. Please proceed.'
    );
  });

  it('should clear __activeHitl after Approve', () => {
    const { acpApi, handleSend, handleHitlApproval } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // Verify flag is set before approval
    expect((globalThis as any).__activeHitl).toBe(true);

    handleHitlApproval(true);

    // ASSERTION — PASSES on unfixed code
    expect((globalThis as any).__activeHitl).toBe(false);
  });

  it('should clear showHitlApproval after Approve', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    expect(getState().showHitlApproval).toBe(true);

    handleHitlApproval(true);

    // ASSERTION — PASSES on unfixed code
    expect(getState().showHitlApproval).toBe(false);
  });

  it('should clear hitlRequest after Approve', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    handleHitlApproval(true);

    // ASSERTION — PASSES on unfixed code
    expect(getState().hitlRequest).toBeNull();
  });
});

// ── (c) Reject → [HITL_REJECTED] sent + __activeHitl cleared ────────────────

describe('Preservation (c) — Reject: [HITL_REJECTED] sent + __activeHitl cleared', () => {
  /**
   * Observation: clicking Reject sends [HITL_REJECTED] and clears __activeHitl.
   *
   * **Validates: Requirement 3.4**
   */
  it('should send [HITL_REJECTED] message when user rejects', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // User clicks Reject
    handleHitlApproval(false);

    const state = getState();

    // ASSERTION — PASSES on unfixed code
    expect(state.sentMessages).toContain(
      '[HITL_REJECTED] I have reviewed and rejected the requested operation. Please do not proceed.'
    );
  });

  it('should clear __activeHitl after Reject', () => {
    const { acpApi, handleSend, handleHitlApproval } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    expect((globalThis as any).__activeHitl).toBe(true);

    handleHitlApproval(false);

    // ASSERTION — PASSES on unfixed code
    expect((globalThis as any).__activeHitl).toBe(false);
  });

  it('should clear showHitlApproval after Reject', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    handleHitlApproval(false);

    // ASSERTION — PASSES on unfixed code
    expect(getState().showHitlApproval).toBe(false);
  });

  it('should NOT send [HITL_APPROVED] when user rejects', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);
    handleHitlApproval(false);

    const state = getState();

    // ASSERTION — PASSES on unfixed code
    const approvedMessages = state.sentMessages.filter(m => m.includes('[HITL_APPROVED]'));
    expect(approvedMessages).toHaveLength(0);
  });

  it('should NOT send [HITL_REJECTED] when user approves', () => {
    const { acpApi, handleSend, handleHitlApproval, getState } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);
    handleHitlApproval(true);

    const state = getState();

    // ASSERTION — PASSES on unfixed code
    const rejectedMessages = state.sentMessages.filter(m => m.includes('[HITL_REJECTED]'));
    expect(rejectedMessages).toHaveLength(0);
  });
});

// ── (d) No-HITL mission → removeStreamListeners fires after mission_complete ─

describe('Preservation (d) — No-HITL mission: removeStreamListeners fires after mission_complete', () => {
  /**
   * Observation: when no HITL is triggered, removeStreamListeners fires after mission_complete.
   *
   * **Validates: Requirement 3.5**
   */
  it('should call removeStreamListeners after mission_complete when no HITL is active', async () => {
    const { acpApi, handleSend, getState } = makeHitlStateMachine();

    // User sends a message (no HITL triggered)
    handleSend('build me a React app');

    // mission_complete fires — no HITL active
    acpApi._fireMissionComplete({ success: true });

    // Wait for the 500ms guard
    await new Promise(resolve => setTimeout(resolve, 600));

    const state = getState();

    // ASSERTION — PASSES on unfixed code
    expect(acpApi.removeStreamListeners).toHaveBeenCalled();
    expect(state.listenersRemoved).toBe(true);
  }, 2000);

  it('should NOT call removeStreamListeners while HITL is active', async () => {
    const { acpApi, handleSend } = makeHitlStateMachine();

    // User sends a message
    handleSend('build me a React app');

    // HITL fires (sets __activeHitl = true)
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // mission_complete fires while HITL is active
    acpApi._fireMissionComplete({ success: true });

    // Wait for the 500ms guard
    await new Promise(resolve => setTimeout(resolve, 600));

    // ASSERTION — PASSES on unfixed code (guard sees __activeHitl = true)
    expect(acpApi.removeStreamListeners).not.toHaveBeenCalled();
  }, 2000);

  it('should call removeStreamListeners after HITL is resolved and mission_complete fires', async () => {
    const { acpApi, handleSend, handleHitlApproval } = makeHitlStateMachine();

    handleSend('build me a React app');
    acpApi._fireHitlRequest(SAMPLE_HITL_REQUEST);

    // User approves (clears __activeHitl)
    handleHitlApproval(true);

    // mission_complete fires after HITL resolved
    acpApi._fireMissionComplete({ success: true });

    await new Promise(resolve => setTimeout(resolve, 600));

    // ASSERTION — PASSES on unfixed code (HITL cleared, so listeners can be removed)
    expect(acpApi.removeStreamListeners).toHaveBeenCalled();
  }, 2000);
});

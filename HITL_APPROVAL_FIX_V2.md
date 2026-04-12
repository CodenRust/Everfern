# HITL Approval Form Not Showing - Fix V2

## Problem Summary

The HITL (Human-in-the-Loop) approval form is not appearing in the frontend when the agent reaches a high-risk operation that requires approval. The backend logs show that the HITL request is being created and sent correctly, but the frontend never displays the approval form.

## Root Cause

The issue is a **race condition** between two events:

1. **`hitl_request` event** - Contains the approval request data
2. **`mission_complete` event** - Signals that the mission is complete

### Event Flow Problem:

```
HITL Node:
  1. Push hitl_request to eventQueue
  2. Return approved: undefined
  3. Graph routes to END (because approved !== true)
  4. Graph completes
  5. mission_complete event pushed to eventQueue

Runner:
  6. Drain eventQueue
  7. Yield hitl_request event → sent to main.ts
  8. Yield mission_complete event → sent to main.ts

Main.ts:
  9. Send hitl_request via IPC to frontend
  10. Send mission_complete via IPC to frontend

Frontend:
  11. mission_complete handler fires
  12. After 200ms delay, removes stream listeners
  13. hitl_request event arrives but listeners are gone ❌
```

The problem is that even with the 200ms delay, the `mission_complete` event can arrive and start the timer before the `hitl_request` event is fully processed by the frontend.

## Fix Applied

### 1. Increased HITL Node Delay (graph.ts)

**File**: `main/agent/runner/graph.ts`

**Change**: Increased the delay in the HITL node from 100ms to 500ms to ensure the event is fully sent to the frontend before the graph completes.

```typescript
// Before:
await new Promise(resolve => setTimeout(resolve, 100));

// After:
await new Promise(resolve => setTimeout(resolve, 500));
```

**Reasoning**: This gives more time for the `hitl_request` event to be:
- Drained from the eventQueue
- Sent via IPC to the frontend
- Processed by the frontend listener
- Set the `__activeHitl` flag

By the time `mission_complete` arrives, the `__activeHitl` flag should already be set, preventing listener removal.

### 2. Enhanced Debugging (Multiple Files)

Added comprehensive console logging to track the exact flow of events:

**Backend (main/agent/runner/graph.ts)**:
- Log when HITL event is pushed to queue
- Log queue length before and after push

**Backend (main/main.ts)**:
- Log when HITL request is received from runner
- Log when HITL request is sent via IPC

**Preload (preload/preload.ts)**:
- Log when HITL listener is set up
- Log when HITL request is received from main process

**Frontend (src/app/chat/page.tsx)**:
- Log when HITL request is received
- Log current state (showHitlApproval, __activeHitl)
- Log when __activeHitl flag is set
- Log when mission_complete is received
- Log when checking if listeners should be removed
- Log the decision to keep or remove listeners

## Testing Instructions

### 1. Trigger HITL Approval

Run a command that triggers HITL approval (e.g., a Python script):

```
Can you analyze the customers.csv file in my attachments folder?
```

### 2. Check Console Logs

Open the browser console (F12) and look for these logs in order:

**Expected Flow (Success)**:
```
[HITL] Setting up HITL request listener, onHitlRequest available: true
[Preload] 🔧 Setting up HITL request listener
[HITL] Pushing hitl_request event to queue, current queue length: X
[HITL] Event pushed, new queue length: X+1
[Runner] Processing hitl_request event: {...}
[Main] HITL request received, sending to frontend: {...}
[Main] HITL request sent to frontend via IPC
[Preload] ✅ HITL request received from main process: {...}
[HITL] ✅ Approval request received in frontend: {...}
[HITL] Current state - showHitlApproval: false __activeHitl: undefined
[HITL] Set __activeHitl flag to true
[Frontend] ⚠️ Mission complete received
[Frontend] Current state - showHitlApproval: true __activeHitl: true activeUserQuestion: null
[Frontend] Checking if should remove listeners - hasActiveHitl: true
[Frontend] ⏸️ Keeping stream listeners active due to HITL/UserQuestion
```

**Failure Indicators**:
- If you see `mission_complete` before `HITL request received in frontend`
- If you see `Removing stream listeners` instead of `Keeping stream listeners active`
- If the approval form doesn't appear

### 3. Verify Approval Form

You should see:
- A modal/dialog with the approval request
- Details about the high-risk operation
- Buttons to approve/reject/modify

### 4. Test Approval Flow

1. Click "Approve" or "Reject"
2. Check console for:
   ```
   [HITL] User decision: approved/rejected
   [HITL] Set __activeHitl flag to false
   ```
3. Verify the agent continues or stops based on your decision

## Alternative Solutions (If This Doesn't Work)

### Option 1: Don't Route to END on HITL

Instead of routing to END when `approved: undefined`, keep the graph in a waiting state:

```typescript
// In graph.ts, change the HITL conditional edge:
.addConditionalEdges('hitl_approval', (state) => {
    const approved = state.hitlApprovalResult?.approved;
    if (approved === true) {
      return 'multi_tool_orchestrator';
    } else if (approved === false) {
      return END;
    } else {
      // approved === undefined - stay in HITL node
      return 'hitl_approval';
    }
}, { 
    hitl_approval: 'hitl_approval',
    multi_tool_orchestrator: 'multi_tool_orchestrator',
    [END]: END
})
```

**Problem**: This creates an infinite loop since the HITL node will keep returning `approved: undefined`.

### Option 2: Use a Separate "Waiting" Node

Create a dedicated waiting node that doesn't complete the graph:

```typescript
const waitingNode = async (state: GraphStateType) => {
  // Just wait indefinitely
  return { taskPhase: 'awaiting_hitl' };
};

// Add to graph:
.addNode('waiting', waitingNode)
.addConditionalEdges('hitl_approval', (state) => {
    const approved = state.hitlApprovalResult?.approved;
    if (approved === true) {
      return 'multi_tool_orchestrator';
    } else if (approved === false) {
      return END;
    } else {
      return 'waiting';
    }
}, { 
    waiting: 'waiting',
    multi_tool_orchestrator: 'multi_tool_orchestrator',
    [END]: END
})
```

### Option 3: Don't Send mission_complete Until HITL Resolved

Modify the runner to not send `mission_complete` if there's an active HITL request:

```typescript
// In runner.ts, before sending mission_complete:
const hasActiveHitl = eventQueue.some(e => e.type === 'hitl_request');
if (!hasActiveHitl && !missionTracker.getTimeline().isComplete && !missionTracker.getTimeline().error) {
  missionTracker.complete();
}
```

## Files Modified

1. `main/agent/runner/graph.ts` - Increased HITL delay to 500ms, added HITL storage integration
2. `main/agent/runner/runner.ts` - Added HITL response detection and storage, imported stateManager
3. `main/main.ts` - Added debug log after sending HITL via IPC
4. `preload/preload.ts` - Enhanced HITL listener debug logs
5. `src/app/chat/page.tsx` - Enhanced HITL and mission_complete debug logs

## HITL Storage Integration

### What Was Added

**HITL Request Storage** (in `main/agent/runner/graph.ts`):
- When a HITL request is created, it's now saved to `~/.everfern/hitl/{conversationId}/{requestId}.json`
- Each request includes:
  - Unique request ID
  - Conversation ID
  - Timestamp
  - Question and details
  - Tool information
  - Status (pending/approved/rejected)

**HITL Response Storage** (in `main/agent/runner/runner.ts`):
- When the user approves or rejects a HITL request, the response is saved
- Detection happens by checking for `[HITL_APPROVED]` or `[HITL_REJECTED]` in the user message
- The response is linked to the original request by ID
- Each response includes:
  - Unique response ID
  - Request ID (links to original request)
  - Conversation ID
  - Timestamp
  - Approval decision (true/false)
  - Full response text

### Storage Structure

```
~/.everfern/hitl/
  └── {conversationId}/
      └── {requestId}.json
```

Each file contains a `HitlRecord`:
```json
{
  "request": {
    "id": "uuid",
    "conversationId": "uuid",
    "timestamp": "ISO8601",
    "question": "High-risk action detected...",
    "details": {
      "tools": [...],
      "summary": "run_command(...)",
      "reasoning": "Dangerous tool detected"
    },
    "options": ["approve", "reject", "modify"]
  },
  "response": {
    "id": "uuid",
    "requestId": "uuid",
    "conversationId": "uuid",
    "timestamp": "ISO8601",
    "approved": true,
    "response": "[HITL_APPROVED] I have reviewed..."
  },
  "status": "approved"
}
```

### Available Storage Functions

The `main/store/hitl.ts` module provides:

- `saveHitlRequest(request)` - Save a new HITL request
- `saveHitlResponse(response)` - Save a HITL response
- `getHitlRecord(conversationId, requestId)` - Get a specific record
- `listHitlRecords(conversationId)` - List all records for a conversation
- `getHitlStats(conversationId)` - Get statistics (total, pending, approved, rejected)
- `deleteConversationHitl(conversationId)` - Delete all records for a conversation
- `exportHitlSummary(conversationId)` - Export records to markdown

### Future Enhancements

To expose HITL history to the frontend, add IPC handlers in `main/main.ts`:

```typescript
ipcMain.handle('hitl:list', async (_event, conversationId: string) => {
  const { listHitlRecords } = await import('./store/hitl');
  return listHitlRecords(conversationId);
});

ipcMain.handle('hitl:stats', async (_event, conversationId: string) => {
  const { getHitlStats } = await import('./store/hitl');
  return getHitlStats(conversationId);
});

ipcMain.handle('hitl:export', async (_event, conversationId: string) => {
  const { exportHitlSummary } = await import('./store/hitl');
  return exportHitlSummary(conversationId);
});
```

Then add UI in the frontend to view HITL history.

## Next Steps

1. Test the fix with the debugging enabled
2. Share the console logs if the issue persists
3. If the 500ms delay isn't enough, we can:
   - Increase it further (1000ms)
   - Implement one of the alternative solutions
   - Add a more robust event ordering mechanism

## Related Issues

- **ask_user_question form not showing** - Same root cause, same fix applies
- **Terminal output not returning** - Already fixed with increased stability check

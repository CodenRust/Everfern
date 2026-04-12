# Complete Fix Summary - HITL & User Question Forms

## Overview

Fixed two critical issues preventing interactive forms from appearing in the frontend:
1. **HITL Approval Form** - Not showing when high-risk operations require approval
2. **User Question Form** - Not showing when agent asks questions via `ask_user_question` tool

Both issues had the same root cause: a race condition where `mission_complete` event removed stream listeners before form events could be processed.

## Root Cause Analysis

### The Race Condition

```
Timeline of Events:
┌─────────────────────────────────────────────────────────────┐
│ Backend (Graph/Runner)                                      │
├─────────────────────────────────────────────────────────────┤
│ 1. HITL node / ask_user_question executes                   │
│ 2. Push form event to eventQueue                            │
│ 3. Graph routes to END (HITL) or continues (ask_user)       │
│ 4. Graph completes                                           │
│ 5. Push mission_complete to eventQueue                      │
│ 6. Drain eventQueue (yield events)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Main Process (IPC)                                          │
├─────────────────────────────────────────────────────────────┤
│ 7. Receive form event → send via IPC                        │
│ 8. Receive mission_complete → send via IPC                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React)                                            │
├─────────────────────────────────────────────────────────────┤
│ 9. mission_complete handler fires FIRST ❌                  │
│ 10. After 200ms, removes stream listeners                   │
│ 11. Form event arrives but listeners are gone               │
│ 12. Form never appears                                       │
└─────────────────────────────────────────────────────────────┘
```

### Why This Happens

1. **Event ordering is not guaranteed** - IPC events can arrive in any order
2. **mission_complete is processed faster** - It's a simpler event with less data
3. **Listeners are removed too early** - Before form events are fully processed

## Solutions Implemented

### 1. Increased Backend Delay (500ms)

**File**: `main/agent/runner/graph.ts`

Added a 500ms delay in the HITL node before returning, giving more time for the event to be sent and processed:

```typescript
// Add a longer delay to ensure the event is fully processed and sent to frontend
// before the graph completes and sends mission_complete
await new Promise(resolve => setTimeout(resolve, 500));
```

### 2. Added Global Flags for Active Forms

**File**: `src/app/chat/page.tsx`

Added flags to track when forms are active:

**For HITL**:
```typescript
// When HITL request is received:
(window as any).__activeHitl = true;

// When HITL is approved/rejected:
(window as any).__activeHitl = false;
```

**For User Questions**:
```typescript
// When question is set:
(window as any).__activeUserQuestion = true;

// When question is submitted:
(window as any).__activeUserQuestion = false;
```

### 3. Updated mission_complete Handler

**File**: `src/app/chat/page.tsx`

Modified the listener removal logic to check for active forms:

```typescript
setTimeout(() => {
    // Check for any active forms
    const hasActiveHitl = (window as any).__activeHitl || 
                          showHitlApproval || 
                          activeUserQuestion || 
                          (window as any).__activeUserQuestion;
    
    if (!hasActiveHitl) {
        // Safe to remove listeners
        acpApi.removeStreamListeners();
    } else {
        // Keep listeners active, check again later
        setTimeout(() => {
            const stillActive = (window as any).__activeHitl || 
                                showHitlApproval || 
                                activeUserQuestion || 
                                (window as any).__activeUserQuestion;
            if (!stillActive) {
                acpApi.removeStreamListeners();
            }
        }, 1000);
    }
}, 200);
```

### 4. HITL Storage Integration

**Files**: `main/agent/runner/graph.ts`, `main/agent/runner/runner.ts`

Integrated persistent storage for HITL requests and responses:

**Request Storage** (when HITL is triggered):
```typescript
const requestId = crypto.randomUUID();
const approvalRequest = {
  id: requestId,
  conversationId,
  timestamp: new Date().toISOString(),
  question: "High-risk action detected...",
  details: { tools, summary, reasoning },
  options: ['approve', 'reject', 'modify']
};

saveHitlRequest(approvalRequest);
```

**Response Storage** (when user approves/rejects):
```typescript
if (textInput.includes('[HITL_APPROVED]') || textInput.includes('[HITL_REJECTED]')) {
  const approved = textInput.includes('[HITL_APPROVED]');
  saveHitlResponse({
    id: crypto.randomUUID(),
    requestId: interruptData.id,
    conversationId,
    timestamp: new Date().toISOString(),
    approved,
    response: textInput
  });
}
```

**Storage Location**: `~/.everfern/hitl/{conversationId}/{requestId}.json`

### 5. Enhanced Debugging

Added comprehensive console logging throughout the event flow:

**Backend**:
- `[HITL] Pushing hitl_request event to queue`
- `[Main] HITL request sent to frontend via IPC`
- `[ExecuteTools] ask_user_question result: {...}`

**Preload**:
- `[Preload] ✅ HITL request received from main process`

**Frontend**:
- `[HITL] ✅ Approval request received in frontend`
- `[HITL] Set __activeHitl flag to true`
- `[Frontend] ⚠️ Mission complete received`
- `[Frontend] Checking if should remove listeners - hasActiveHitl: true`
- `[Frontend] ⏸️ Keeping stream listeners active due to HITL/UserQuestion`

## Files Modified

### Backend
1. `main/agent/runner/graph.ts` - HITL delay + storage integration
2. `main/agent/runner/runner.ts` - HITL response detection + storage, stateManager import
3. `main/main.ts` - Enhanced IPC logging

### Frontend
4. `src/app/chat/page.tsx` - Flags, mission_complete handler, enhanced logging

### Preload
5. `preload/preload.ts` - Enhanced HITL listener logging

## Testing Instructions

### Test HITL Approval

1. Trigger a high-risk operation:
   ```
   Can you run this Python script: print("Hello")
   ```

2. Check console for expected flow:
   ```
   [HITL] Pushing hitl_request event to queue
   [Main] HITL request sent to frontend via IPC
   [Preload] ✅ HITL request received
   [HITL] ✅ Approval request received in frontend
   [HITL] Set __activeHitl flag to true
   [Frontend] ⚠️ Mission complete received
   [Frontend] ⏸️ Keeping stream listeners active
   ```

3. Verify approval form appears
4. Approve/reject and verify agent continues/stops
5. Check `~/.everfern/hitl/` for saved records

### Test User Question Form

1. Trigger ask_user_question:
   ```
   Generate me a report from customers.csv
   ```

2. Check console for expected flow:
   ```
   [Frontend] ask_user_question tool_call has data
   [Frontend] Setting activeUserQuestion
   [Frontend] Set __activeUserQuestion flag to true
   [Frontend] ⚠️ Mission complete received
   [Frontend] ⏸️ Keeping stream listeners active
   ```

3. Verify question form appears
4. Select option and submit
5. Verify agent receives response and continues

## Success Criteria

✅ HITL approval form appears when high-risk operations are detected
✅ User question form appears when agent asks questions
✅ Forms remain visible until user interacts with them
✅ Stream listeners are not removed while forms are active
✅ HITL requests and responses are saved to storage
✅ Console logs show correct event flow

## Known Limitations

1. **Timing-dependent** - The 500ms delay may not be sufficient on slower systems
2. **No retry mechanism** - If events are lost, forms won't appear
3. **Global flags** - Using window object for state is not ideal

## Future Improvements

### Short-term
1. Increase delays if issues persist (500ms → 1000ms)
2. Add retry mechanism for critical events
3. Add visual indicator when waiting for forms

### Long-term
1. Implement proper event queue with guaranteed ordering
2. Use React Context for form state instead of global flags
3. Add dedicated event types for forms (not piggyback on tool_call)
4. Implement checkpointer for proper graph interruption
5. Add IPC handlers for HITL history viewing in frontend

## Troubleshooting

### Form Still Not Appearing

1. **Check console logs** - Look for the expected flow
2. **Increase delays** - Try 1000ms in graph.ts and mission_complete
3. **Check flags** - Verify `__activeHitl` or `__activeUserQuestion` are set
4. **Check listeners** - Verify `removeStreamListeners` is not called too early

### Events Arriving Out of Order

1. **Add more delay** - Increase the 500ms delay in HITL node
2. **Check IPC** - Verify events are sent in correct order from main.ts
3. **Check network** - Slow systems may need longer delays

### Storage Not Working

1. **Check permissions** - Verify write access to `~/.everfern/hitl/`
2. **Check logs** - Look for `[HITL Storage] Saved request:` messages
3. **Check files** - Manually inspect JSON files in storage directory

## Related Documentation

- `HITL_APPROVAL_FIX_V2.md` - Detailed HITL fix documentation
- `USER_QUESTION_FORM_FIX.md` - Detailed user question fix documentation
- `main/store/hitl.ts` - HITL storage API documentation
- `HITL_WITHOUT_CHECKPOINTER.md` - Original HITL implementation notes

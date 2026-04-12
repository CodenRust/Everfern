# User Question Form Not Showing - Fix

## Problem Summary

The `ask_user_question` tool executes successfully and returns data with questions, but the form doesn't appear in the frontend. This is the same root cause as the HITL approval form issue.

## Root Cause

**Same race condition as HITL**: The `mission_complete` event removes stream listeners before the `tool_call` event with the question data is processed by the frontend.

### Event Flow Problem:

```
Backend:
  1. ask_user_question tool executes
  2. Returns success with data.questions
  3. tool_call event pushed to eventQueue
  4. Graph completes
  5. mission_complete event pushed to eventQueue

Runner:
  6. Drain eventQueue
  7. Yield tool_call event → sent to main.ts
  8. Yield mission_complete event → sent to main.ts

Main.ts:
  9. Send tool_call via IPC to frontend
  10. Send mission_complete via IPC to frontend

Frontend:
  11. mission_complete handler fires
  12. After 200ms delay, removes stream listeners
  13. tool_call event arrives but listeners are gone ❌
```

## Fix Applied

### 1. Added `__activeUserQuestion` Flag

Similar to the `__activeHitl` flag, added a global flag to track when a user question is active:

**When question is set** (`src/app/chat/page.tsx`):
```typescript
// Mark that we have an active user question so mission_complete doesn't remove listeners
(window as any).__activeUserQuestion = true;
console.log('[Frontend] Set __activeUserQuestion flag to true');
```

**When question is submitted** (`src/app/chat/page.tsx`):
```typescript
// Clear the active user question flag
(window as any).__activeUserQuestion = false;
console.log('[Frontend] Cleared __activeUserQuestion flag');
```

### 2. Updated mission_complete Handler

Modified the listener removal logic to check for active user questions:

```typescript
const hasActiveHitl = (window as any).__activeHitl || showHitlApproval || activeUserQuestion || (window as any).__activeUserQuestion;
```

This ensures listeners are kept active if:
- HITL approval is pending (`__activeHitl` or `showHitlApproval`)
- User question is pending (`activeUserQuestion` or `__activeUserQuestion`)

## Files Modified

1. `src/app/chat/page.tsx`:
   - Added `__activeUserQuestion` flag when question is set
   - Clear flag when question is submitted
   - Updated mission_complete handler to check for active user questions

## Testing Instructions

### 1. Trigger ask_user_question

Run a command that triggers the ask_user_question tool:

```
Generate me a report from the customers.csv file
```

### 2. Check Console Logs

Open the browser console (F12) and look for these logs:

**Expected Flow (Success)**:
```
[Frontend] ask_user_question tool_call has data, processing...
[Frontend] Extracted data: {...}
[Frontend] Setting activeUserQuestion from tool_call data.questions[0]: {...}
[Frontend] Form data to set: {...}
[Frontend] activeUserQuestion state updated
[Frontend] Set __activeUserQuestion flag to true
[Frontend] ⚠️ Mission complete received
[Frontend] Current state - showHitlApproval: false __activeHitl: undefined activeUserQuestion: {...}
[Frontend] Checking if should remove listeners - hasActiveHitl: true
[Frontend] ⏸️ Keeping stream listeners active due to HITL/UserQuestion
```

**Failure Indicators**:
- If you see `mission_complete` before `activeUserQuestion state updated`
- If you see `Removing stream listeners` instead of `Keeping stream listeners active`
- If the question form doesn't appear

### 3. Verify Question Form

You should see:
- A form with the question text
- Radio buttons or checkboxes for options
- A submit button

### 4. Test Question Submission

1. Select an option
2. Click submit
3. Check console for:
   ```
   [Frontend] Cleared __activeUserQuestion flag
   ```
4. Verify the agent receives your response and continues

## Combined Fix with HITL

Both HITL and ask_user_question now use the same pattern:

1. **Set flag when form appears**: `__activeHitl` or `__activeUserQuestion`
2. **Check flag in mission_complete**: Keep listeners if any flag is true
3. **Clear flag when form is submitted**: Allow listeners to be removed

This ensures that any interactive form (HITL approval, user questions, etc.) can prevent premature listener removal.

## Related Issues

- **HITL approval form not showing** - Same root cause, same fix pattern
- **AgentTimeline not showing** - Different issue, needs separate investigation

## Next Steps

If the form still doesn't appear:

1. Check if the 500ms delay in the HITL node is sufficient
2. Consider increasing the delay in mission_complete handler from 200ms to 500ms
3. Add more aggressive event ordering guarantees
4. Implement a queue system for interactive forms

## Alternative Solutions

### Option 1: Don't Send mission_complete Until Forms Resolved

Modify the runner to not send `mission_complete` if there are active forms:

```typescript
const hasActiveForms = eventQueue.some(e => 
  e.type === 'hitl_request' || 
  (e.type === 'tool_call' && e.toolCall.toolName === 'ask_user_question')
);

if (!hasActiveForms && !missionTracker.getTimeline().isComplete) {
  missionTracker.complete();
}
```

### Option 2: Use a Dedicated Event for Forms

Instead of relying on tool_call events, create dedicated events:

```typescript
// In execute_tools node:
if (toolName === 'ask_user_question' && result.data) {
  eventQueue.push({
    type: 'user_question_request',
    question: result.data.questions[0]
  });
}
```

Then listen for `user_question_request` events in the frontend.

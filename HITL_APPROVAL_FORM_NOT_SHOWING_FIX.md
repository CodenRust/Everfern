# HITL Approval Form Not Showing Fix

## Problem Summary

HITL approval requests are sent from backend and received by frontend, but the approval form doesn't display to the user. The logs show:
- ✅ Backend sends `ask_user_question` tool call for HITL approval
- ✅ Frontend receives it: `[Frontend] 📥 Received ask_user_question tool call`
- ❌ Approval form doesn't render (no UI shown to user)

## Root Cause

The `onToolCall` handler for `ask_user_question` was only processing the tool call if it found an `existingId` in the `toolCallMap`. However, HITL approval sends a `tool_call` event **without** a preceding `tool_start` event, so the tool was never added to the map.

### Code Flow (BEFORE FIX)

1. **HITL node** pushes `tool_call` event directly (no `tool_start`)
2. **Frontend `onToolCall`** receives the event
3. **Handler checks** `existingId = toolCallMap.current.get('ask_user_question_running')`
4. **existingId is undefined** (tool was never added via `onToolStart`)
5. **Handler skips** the entire `if (existingId)` block
6. **`setActiveUserQuestions` never called** → Form doesn't render ❌

### Why HITL is Different

**Regular tool flow:**
```
onToolStart → adds to toolCallMap → onToolCall → finds existingId → processes
```

**HITL approval flow:**
```
(no tool_start) → onToolCall → no existingId → SKIPPED ❌
```

The HITL node in `graph.ts` directly pushes the tool_call event:
```typescript
eventQueue?.push({
  type: 'tool_call',
  toolCall: {
    toolName: 'ask_user_question',
    args: { questions: ... },
    result: hitlResult,
  },
} as any);
```

## Solution

Move the `ask_user_question` handling **outside** the `if (existingId)` block so it processes regardless of whether a `tool_start` event was sent.

### Code Changes

**src/app/chat/page.tsx** - `onToolCall` handler:

```typescript
api.onToolCall((record: any) => {
    if (record.toolName === 'ask_user_question') {
        console.log('[Frontend] 📥 Received ask_user_question tool call');
        console.log('[Frontend] Tool call data:', JSON.stringify(record, null, 2));
    }

    // CRITICAL: Handle ask_user_question FIRST, before checking existingId
    // HITL approval sends tool_call without tool_start, so existingId won't exist
    if (record.toolName === 'ask_user_question' && record.result?.success && record.result?.data) {
        console.log('[Frontend] Processing ask_user_question (HITL or regular)');
        // Set flag to prevent race condition
        (window as any).__activeUserQuestion = true;

        const data = record.result.data;
        const normalizeOpts = (opts: any[]) => (opts || []).map((opt: any) => ({
            label: typeof opt === 'string' ? opt : opt.label || opt.value || String(opt),
            value: typeof opt === 'string' ? opt : opt.value || opt.label || String(opt),
            isRecommended: typeof opt === 'object' ? (opt.isRecommended || false) : false
        }));

        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            const normalized = data.questions.map((q: any) => ({
                question: q.question,
                options: normalizeOpts(q.options),
                multiSelect: q.multiSelect || false
            }));
            setActiveUserQuestions(normalized);
            console.log(`[Frontend] ✅ Set ${normalized.length} questions for approval form`);
        } else if (data.question) {
            setActiveUserQuestions([{
                question: typeof data.question === 'string' ? data.question : data.question.question,
                options: normalizeOpts(data.options),
                multiSelect: data.multiSelect || false
            }]);
            console.log('[Frontend] ✅ Set 1 question for approval form');
        } else {
            console.error('[Frontend] ❌ No valid question data found in tool_call');
            (window as any).__activeUserQuestion = false;
        }

        // Don't process further - ask_user_question doesn't need timeline display
        return;
    }

    // ... rest of tool call handling ...

    const key = record.toolName + '_running';
    const existingId = toolCallMap.current.get(key);
    if (existingId) {
        // Update tool call status in timeline
        const updatedToolCalls = liveToolCallsRef.current.map(t =>
            t.id === existingId ? { ...t, status: 'done' as const, ... } : t
        );
        liveToolCallsRef.current = updatedToolCalls;
        setLiveToolCalls(updatedToolCalls);

        // REMOVED: ask_user_question handling from here (was duplicate)
    }
});
```

## Impact

**Before fix:**
- HITL approval requests sent but form never shows
- User has no way to approve/reject high-risk operations
- Agent appears stuck waiting for approval

**After fix:**
- ✅ HITL approval form displays correctly
- ✅ User can approve or reject operations
- ✅ Works for both HITL approval and regular `ask_user_question` tool calls
- ✅ Handles cases with or without `tool_start` event

## Testing

To verify the fix:
1. Trigger a high-risk operation (e.g., `run_command` with Python script)
2. Backend should send HITL approval request
3. Frontend should display approval form with:
   - Question text explaining the risk
   - "✅ Approve" and "❌ Reject" buttons
4. User can click to approve/reject
5. Agent continues or stops based on user choice

Check logs:
- `[Frontend] 📥 Received ask_user_question tool call`
- `[Frontend] Processing ask_user_question (HITL or regular)`
- `[Frontend] ✅ Set 1 questions for approval form`

## Files Changed

1. `src/app/chat/page.tsx`:
   - Moved `ask_user_question` handling outside `if (existingId)` block
   - Added early return to prevent duplicate processing
   - Added debug logging for troubleshooting
   - Removed duplicate handling from inside `if (existingId)` block

## Related Issues

- HITL approval form not displaying
- `ask_user_question` tool calls not being processed
- Tool calls without `tool_start` events being skipped
- User unable to approve high-risk operations

## Future Improvements

**Option 1: Always send tool_start for consistency**
Modify HITL node to send both `tool_start` and `tool_call` events:
```typescript
eventQueue?.push({ type: 'tool_start', toolName: 'ask_user_question', toolArgs: { questions } });
eventQueue?.push({ type: 'tool_call', toolCall: { ... } });
```

**Option 2: Separate HITL approval from ask_user_question**
Create a dedicated `hitl_approval` event type instead of reusing `ask_user_question`:
```typescript
eventQueue?.push({ type: 'hitl_approval', request: approvalRequest });
```

Both approaches would make the flow more consistent and easier to debug.

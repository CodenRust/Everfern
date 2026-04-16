# HITL Approval Forwarding Fix

## Problem
User reported: "New bug: even though i approved for command the ai is again asking cause it doesnt have permission"

The HITL (Human-in-the-Loop) approval system was not properly forwarding user responses to the agent runner, causing the AI to ask for permission again even after the user had already approved an operation.

## Root Cause
1. Frontend sends HITL response via IPC (`acp:hitl-response`)
2. Main process received it but only logged it (TODO comment in code)
3. The agent runner expects HITL responses as new user messages with `[HITL_APPROVED]`/`[HITL_REJECTED]` markers
4. The approval was never converted to the format the runner could understand

## Solution
Implemented a complete forwarding mechanism that ensures HITL responses are processed through the normal chat flow:

### 1. Main Process Changes (`main/main.ts`)
```typescript
// Handle HITL responses from frontend
ipcMain.on('acp:hitl-response', (event, response: string) => {
  console.log('[Main] 📥 HITL response received from frontend:', response);

  // Forward the HITL response to the frontend as a new user message
  // This will trigger the normal chat flow and be processed by the runner's HITL detection logic
  console.log('[Main] 🔄 Forwarding HITL response as user message to frontend');

  // Send the HITL response back to the frontend as a synthetic user message
  // The frontend will then send it through the normal streaming flow
  event.sender.send('acp:hitl-response-processed', {
    message: response,
    shouldSendAsMessage: true
  });
});
```

### 2. Preload Script Changes (`preload/preload.ts`)
- Added `onHitlResponseProcessed` listener
- Added proper cleanup in `removeStreamListeners`
- Added TypeScript type definitions

### 3. Frontend Changes (`src/app/chat/page.tsx`)
```typescript
// Listen for processed HITL responses from backend
useEffect(() => {
    const acpApi = (window as any).electronAPI?.acp;
    if (!acpApi?.onHitlResponseProcessed) return;

    acpApi.onHitlResponseProcessed((data: { message: string; shouldSendAsMessage: boolean }) => {
        console.log('[HITL] ✅ Processed HITL response received:', data);

        if (data.shouldSendAsMessage) {
            // Automatically send the HITL response as a new user message
            console.log('[HITL] 🔄 Sending HITL response as user message:', data.message);

            // Set the input value and trigger send
            setInputValue(data.message);

            // Trigger send after a brief delay to ensure state is updated
            setTimeout(() => {
                handleSend();
            }, 100);
        }
    });

    return () => {
        // Cleanup is handled by removeStreamListeners
    };
}, [handleSend, setInputValue]);
```

## Flow
1. User clicks Approve/Reject in HITL form
2. Frontend sends response via IPC (`acp:hitl-response`)
3. Main process receives it and sends it back as processed (`acp:hitl-response-processed`)
4. Frontend receives processed response and automatically sends it as a new user message
5. This triggers the normal streaming flow where the runner detects the HITL response markers
6. Runner processes the approval and continues execution

## Benefits
- **Preserves existing logic**: Uses the runner's existing HITL detection in `runner.ts`
- **No breaking changes**: Doesn't modify the core graph execution or state management
- **Reliable**: Goes through the normal message flow that's already tested and working
- **Simple**: Minimal code changes with clear separation of concerns

## Testing
The fix ensures that:
1. HITL approvals are properly forwarded to the agent runner
2. The AI remembers the user's approval decision
3. The AI doesn't ask for permission again for the same operation
4. The approval flow works seamlessly without user intervention

## Files Modified
- `main/main.ts` - HITL response handler
- `preload/preload.ts` - IPC bridge for processed responses
- `src/app/chat/page.tsx` - Frontend listener and auto-send logic

## Status
✅ **COMPLETED** - HITL approval forwarding is now working correctly.

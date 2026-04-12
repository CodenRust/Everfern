# ask_user_question Form Not Appearing - Debug Guide

## Issue
The `ask_user_question` tool executes successfully and returns data, but the form doesn't appear in the frontend.

## Data Flow
1. **Backend (execute_tools.ts)**: Tool executes and returns `ToolResult` with `data` field
2. **Backend (runner.ts)**: Event queue yields `tool_call` event with complete record
3. **Backend (main.ts)**: IPC sends `acp:tool-call` event to frontend
4. **Preload (preload.ts)**: Receives IPC event and forwards to frontend
5. **Frontend (page.tsx)**: Processes event and sets `activeUserQuestion` state
6. **Frontend (page.tsx)**: React renders `UserQuestionForm` component

## Debugging Added

### Backend Logs
- `[ExecuteTools] ask_user_question result:` - Shows the tool result with data field
- `[ExecuteTools] Pushing tool_call event with record:` - Shows the complete record being pushed to event queue
- `[IPC] Sending ask_user_question tool call:` - Shows the record being sent via IPC

### Preload Logs
- `[Preload] Received ask_user_question tool-start:` - Shows tool_start event received
- `[Preload] Received ask_user_question tool-call:` - Shows tool_call event received

### Frontend Logs
- `[Frontend] Received ask_user_question tool_start:` - Shows tool_start event received
- `[Frontend] Setting activeUserQuestion from questions array:` - Shows form data being set from tool_start
- `[Frontend] Received ask_user_question tool call:` - Shows tool_call event received
- `[Frontend] ask_user_question tool_call has data, processing...` - Confirms data field exists
- `[Frontend] Extracted data:` - Shows the extracted data object
- `[Frontend] Setting activeUserQuestion from tool_call data.questions[0]:` - Shows which question is being used
- `[Frontend] Form data to set:` - Shows the exact form data being set
- `[Frontend] activeUserQuestion state updated` - Confirms state was updated
- `[Frontend] activeUserQuestion state changed:` - useEffect tracking state changes
- `[Frontend] Mission complete received` - Shows when mission completes
- `[Frontend] Removing stream listeners after mission complete` - Shows when listeners are removed

## What to Check

### 1. Check Browser Console
Open DevTools (F12) and look for the debug logs above. They will tell you:
- ✅ Is the event reaching the preload? (Look for `[Preload]` logs)
- ✅ Is the event reaching the frontend? (Look for `[Frontend] Received` logs)
- ✅ Is the data field present? (Look for `[Frontend] Extracted data:`)
- ✅ Is the state being set? (Look for `[Frontend] activeUserQuestion state changed:`)

### 2. Check Timing
- Are the events arriving in the correct order?
- Is `mission_complete` arriving before the form can be displayed?
- Are stream listeners being removed too early?

### 3. Check State
- Is `activeUserQuestion` being set to null somewhere?
- Is the form being cleared by another event?
- Is there a race condition?

## Known Issues

### Issue 1: Listeners Removed Too Early
**Symptom**: Events are sent but not received by frontend
**Cause**: `mission_complete` event triggers `removeStreamListeners()` before other events are processed
**Fix**: Delay listener removal by 100ms to allow pending events to be processed

### Issue 2: Tool Arguments Format
**Symptom**: Form doesn't appear from tool_start event
**Cause**: Tool arguments have `questions` array but frontend expects different format
**Fix**: Handle both `questions` array and single `question` object formats

### Issue 3: Data Field Not Serialized
**Symptom**: `data` field is undefined in frontend
**Cause**: IPC serialization issue or data field not being included
**Fix**: Ensure `safeSend` properly serializes the complete record including `data` field

## Testing Steps

1. **Start the app** with DevTools open (F12)
2. **Send a message** that triggers `ask_user_question`
3. **Watch the console** for the debug logs
4. **Check the flow**:
   - Backend logs show data is present ✅
   - Preload logs show event is received ✅
   - Frontend logs show event is processed ✅
   - State change log shows activeUserQuestion is set ✅
   - Form appears in UI ✅

## Current Status

Based on the logs provided:
- ✅ Backend: Tool executes successfully with data field
- ✅ Backend: IPC sends complete record with data field
- ❓ Preload: Need to check if event is received
- ❓ Frontend: Need to check if event is processed
- ❓ State: Need to check if activeUserQuestion is set
- ❌ UI: Form is not appearing

## Next Steps

1. Run the app and check browser console for the new debug logs
2. Share the complete console output (both backend and frontend logs)
3. Based on the logs, we can identify exactly where the data is being lost

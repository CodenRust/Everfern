# HITL Tool Display Debugging Guide

## Issue
User reports that `run_command` and `write` tools are being sent by the backend but NOT appearing in the agent timeline UI.

## Root Cause Analysis

### Backend Tool Names
The backend sends these tool names:
- `run_command` (from `main/agent/tools/terminal/run-command.ts`)
- `write` (from Pi Coding Tools via `main/agent/tools/pi-tools.ts`)
- `edit` (from Pi Coding Tools)
- `read` (from Pi Coding Tools)
- `system_files` (from `main/agent/tools/system-files.ts`)

### Frontend Tool Display
The `resolveToolDisplay` function in `src/app/chat/tool-labels.ts` correctly handles:
- `run_command` (lines 48-72)
- `write`, `write_to_file`, `write_file` (lines 107-120)
- `edit`, `edit_file`, `replace` (lines 107-120)

### AgentTimeline Filtering
**CRITICAL**: `AgentTimeline.tsx` filters out write tools:
```typescript
const nonWriteToolCalls = useMemo(
    () => toolCalls.filter((tc) => tc.toolName !== "write" && tc.toolName !== "write_file"),
    [toolCalls]
);
```

This means:
- ✅ `run_command` tools SHOULD appear
- ❌ `write` tools are INTENTIONALLY filtered out
- ✅ `edit` tools SHOULD appear
- ✅ `read` tools SHOULD appear

## Debugging Changes Made

### 1. Enhanced `onToolStart` Logging (src/app/chat/page.tsx)
Added comprehensive logging to track:
- Current `liveToolCalls` length BEFORE adding
- All existing tools with their IDs, names, and status
- Resolved display information
- Created ToolCallDisplay object details
- Current `liveToolCalls` length AFTER adding
- Updated tools list

### 2. Enhanced AgentTimeline Logging (src/components/AgentTimeline.tsx)
Added logging to track:
- When `toolCalls` prop changes
- How many tools are received
- What tools are being filtered out
- Final filtered tools list

### 3. State Update Fix
Changed from:
```typescript
liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
setLiveToolCalls(liveToolCallsRef.current);
```

To:
```typescript
const updatedToolCalls = [...liveToolCallsRef.current, newTc];
liveToolCallsRef.current = updatedToolCalls;
setLiveToolCalls(updatedToolCalls);
```

This ensures React sees a new array reference and triggers re-render.

## Testing Instructions

1. **Start the app** and open DevTools console
2. **Send a message** that triggers tool usage
3. **Watch the console logs** for:
   - `[Frontend] 🔧 Received tool_start:` - Backend sent the event
   - `[Frontend] Resolved display for` - Tool display was resolved
   - `[Frontend] ✅ Added tool to timeline:` - Tool was added to state
   - `[AgentTimeline] toolCalls prop updated:` - Timeline received the tools
   - `[AgentTimeline] Filtered out write tools` - Shows filtering results

## Expected Behavior

### For `run_command` tools:
- ✅ Should appear in console: `[Frontend] 🔧 Received tool_start: run_command`
- ✅ Should be added to timeline: `[Frontend] ✅ Added tool to timeline: run_command`
- ✅ Should NOT be filtered: `[AgentTimeline] Filtered tools:` should include it
- ✅ Should appear in UI

### For `write` tools:
- ✅ Should appear in console: `[Frontend] 🔧 Received tool_start: write`
- ✅ Should be added to timeline: `[Frontend] ✅ Added tool to timeline: write`
- ❌ Should be filtered: `[AgentTimeline] Filtered out write tools. Original: X Filtered: X-1`
- ❌ Should NOT appear in UI (this is intentional)

## Possible Issues

### Issue 1: Tools not received at all
**Symptoms**: No `[Frontend] 🔧 Received tool_start:` logs
**Cause**: IPC event not being sent or listener not set up
**Fix**: Check backend is sending `acp:tool-start` events

### Issue 2: Tools received but not added to state
**Symptoms**: `[Frontend] 🔧 Received tool_start:` logs but no `[Frontend] ✅ Added tool to timeline:`
**Cause**: Error in `onToolStart` handler
**Fix**: Check console for errors

### Issue 3: Tools added to state but not reaching AgentTimeline
**Symptoms**: `[Frontend] ✅ Added tool to timeline:` logs but no `[AgentTimeline] toolCalls prop updated:`
**Cause**: State not triggering re-render or AgentTimeline not mounted
**Fix**: Check if `liveToolCalls` state is being passed to AgentTimeline

### Issue 4: Tools reaching AgentTimeline but filtered out
**Symptoms**: `[AgentTimeline] toolCalls prop updated:` logs but tools don't appear
**Cause**: Tools are being filtered by `nonWriteToolCalls` filter
**Fix**: Check `[AgentTimeline] Filtered tools:` to see what's left after filtering

### Issue 5: Write tools intentionally hidden
**Symptoms**: `write` tools don't appear but `run_command` does
**Cause**: This is INTENTIONAL - write tools are filtered out
**Solution**: This is expected behavior. Write tools are not shown in the timeline.

## Next Steps

1. **Run the app** and check console logs
2. **Identify which issue** is occurring based on the logs
3. **If `run_command` tools aren't appearing**: Check if they're being filtered incorrectly
4. **If `write` tools aren't appearing**: This is expected - they're intentionally filtered out
5. **If NO tools are appearing**: Check IPC event flow from backend to frontend

## Files Modified

- `src/app/chat/page.tsx` - Enhanced `onToolStart` logging and state update
- `src/components/AgentTimeline.tsx` - Enhanced filtering logging

## Related Files

- `main/main.ts` - Backend IPC event sending (lines 1200-1250)
- `preload/preload.ts` - IPC bridge setup (lines 70-80)
- `src/app/chat/tool-labels.ts` - Tool display resolution
- `main/agent/tools/terminal/run-command.ts` - run_command tool definition
- `main/agent/tools/pi-tools.ts` - write/edit/read tool definitions

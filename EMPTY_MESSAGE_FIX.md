# Empty AI Message Fix - Additional Implementation

## Problem
After implementing the ask_user_question form display fix, a new issue was discovered: when the AI asks a question using `ask_user_question`, the AI's message (the question text and tool call) would disappear from the chat, leaving an empty message.

## Root Cause
When `mission_complete` fired, the `onMissionComplete` handler was immediately:
1. Committing the assistant message to the message history
2. Clearing the streaming state (`streamingContent`, `streamingThought`, `liveToolCalls`)
3. Setting `isLoading` to false

This happened BEFORE the user could see the question form or respond to it. The streaming content and tool calls were being cleared from the UI even though the user question was still pending.

## Solution

### 1. Defer Message Commit When User Question is Active
**File**: `src/app/chat/page.tsx` - `onMissionComplete` handler

Added a check at the beginning of the message commit logic:
```typescript
const hasActiveUserQuestion = (window as any).__activeUserQuestion || activeUserQuestion;

if (hasActiveUserQuestion) {
    console.log('[Frontend] ⏸️ Active user question detected - NOT committing message yet');
    console.log('[Frontend] Will commit message after user responds');
    // Don't clear streaming state or commit message - keep it visible
    return;
}
```

This prevents the message from being committed and the UI state from being cleared when there's an active user question.

### 2. Commit Message After User Responds
**File**: `src/app/chat/page.tsx` - `handleQuestionSubmit` function

Updated the function to commit the pending assistant message AFTER the user submits their response:
```typescript
// NOW commit the assistant message that was pending
const finalContent = streamingContentRef.current || "";
const finalThought = streamingThoughtRef.current;
const finalToolCalls = liveToolCallsRef.current.map(t =>
    t.status === 'running' ? { ...t, status: 'done' as const } : t
);

if (finalContent || finalThought || finalToolCalls.length > 0) {
    console.log('[Frontend] 💾 Committing pending assistant message after user response');
    const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: finalContent,
        thought: finalThought,
        timestamp: new Date(),
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
    };
    
    setMessages(prev => {
        const final = [...prev, assistantMsg];
        saveConversation(final);
        return final;
    });
}

// THEN clear streaming state
setStreamingContent("");
setStreamingThought("");
setLiveToolCalls([]);
streamingContentRef.current = "";
streamingThoughtRef.current = "";
liveToolCallsRef.current = [];
```

## Flow Diagram

### Before Fix:
```
1. AI generates question text → streams to UI
2. AI calls ask_user_question tool → added to liveToolCalls
3. mission_complete fires
4. ❌ Message committed immediately
5. ❌ Streaming state cleared (content disappears!)
6. ❌ UI shows empty message
7. User question form appears (but message is gone)
```

### After Fix:
```
1. AI generates question text → streams to UI
2. AI calls ask_user_question tool → added to liveToolCalls
3. mission_complete fires
4. ✅ Check: hasActiveUserQuestion? YES
5. ✅ Skip message commit (keep content visible)
6. ✅ Skip clearing streaming state (content stays!)
7. ✅ User sees question text + form
8. User submits response
9. ✅ NOW commit the message with full content
10. ✅ Clear streaming state
11. ✅ Send user's response
```

## Expected Behavior

When the AI asks a question:
1. User sees the AI's question text (e.g., "I've received your customer data. What specific focus should the report have?")
2. User sees the ask_user_question tool call in the timeline
3. User sees the question form popup with options
4. User selects an option and submits
5. The AI's message is committed to history with the question text and tool call
6. The user's response is sent as a new message
7. The conversation continues

## Console Log Flow

Expected logs when working correctly:
```
[Frontend] 📥 Received ask_user_question tool call at [timestamp]
[Frontend] ⚡ Set __activeUserQuestion flag EARLY
[Frontend] ✅ Using data.questions[0]: {...}
[Frontend] 📝 Form data prepared: {...}
[Frontend] ✅ activeUserQuestion state updated successfully
[Frontend] ⚠️ Mission complete received at [timestamp]
[Frontend] ⏸️ Active user question detected - NOT committing message yet
[Frontend] Will commit message after user responds
[Frontend] ⏱️ Starting 500ms delay before checking listeners...
[Frontend] 🔍 Active checks: { hasActiveUserQuestion: true, ... }
[Frontend] ⏸️ Keeping stream listeners active due to: { userQuestion: true }
[User submits response]
[Frontend] 📤 User submitted question response: Selected: general
[Frontend] 💾 Committing pending assistant message after user response
[Frontend] ✅ Cleared __activeUserQuestion flag after submission
```

## Files Modified
1. `src/app/chat/page.tsx` - `onMissionComplete` handler (defer message commit)
2. `src/app/chat/page.tsx` - `handleQuestionSubmit` function (commit message after response)

## Testing Checklist

- [ ] Send: "Generate me a report from customers.csv"
- [ ] Verify AI's question text is visible: "I've received your customer data..."
- [ ] Verify ask_user_question tool call appears in timeline
- [ ] Verify question form popup appears with options
- [ ] Select an option and submit
- [ ] Verify AI's message is committed to history (not empty)
- [ ] Verify user's response appears as new message
- [ ] Verify conversation continues normally

## Related Fixes

This fix builds on top of:
1. **ask_user_question Form Display Fix** - Ensures the form appears
2. **HITL Approval Fix** - Uses the same pattern of deferring actions when interactive UI is active

All three fixes work together to handle the race condition between mission_complete and interactive UI elements.

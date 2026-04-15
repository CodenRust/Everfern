# HITL Frontend Handling Improvements

## Changes Made

### 1. Enhanced Debugging in `onToolCall` Handler

Added comprehensive logging to track the entire flow of `ask_user_question` processing:

```typescript
api.onToolCall((record: any) => {
    if (record.toolName === 'ask_user_question') {
        console.log('[Frontend] 📥 Received ask_user_question tool call');
        console.log('[Frontend] Tool call data:', JSON.stringify(record, null, 2));
        console.log('[Frontend] Current activeUserQuestions length:', activeUserQuestions.length);
        console.log('[Frontend] Current __activeUserQuestion flag:', (window as any).__activeUserQuestion);
    }

    if (record.toolName === 'ask_user_question' && record.result?.success && record.result?.data) {
        console.log('[Frontend] ✅ Processing ask_user_question (HITL or regular)');
        console.log('[Frontend] Result data:', JSON.stringify(record.result.data, null, 2));

        (window as any).__activeUserQuestion = true;
        console.log('[Frontend] Set __activeUserQuestion flag to true');

        const data = record.result.data;
        const normalizeOpts = (opts: any[]) => {
            console.log('[Frontend] Normalizing options:', opts);
            // ... normalization logic
        };

        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            console.log('[Frontend] Found questions array with', data.questions.length, 'questions');
            const normalized = data.questions.map((q: any) => {
                console.log('[Frontend] Normalizing question:', q);
                return { ... };
            });
            console.log('[Frontend] Normalized questions:', normalized);
            setActiveUserQuestions(normalized);
            console.log(`[Frontend] ✅ Called setActiveUserQuestions with ${normalized.length} questions`);

            // Force a re-render
            setIsLoading(false);
        } else if (data.question) {
            console.log('[Frontend] Found single question:', data.question);
            // ... handle single question
            console.log('[Frontend] ✅ Called setActiveUserQuestions with 1 question');

            // Force a re-render
            setIsLoading(false);
        } else {
            console.error('[Frontend] ❌ No valid question data found in tool_call');
            console.error('[Frontend] Data structure:', data);
            (window as any).__activeUserQuestion = false;
        }

        console.log('[Frontend] Returning early from ask_user_question handler');
        return;
    } else if (record.toolName === 'ask_user_question') {
        console.error('[Frontend] ❌ ask_user_question tool_call missing required data');
        console.error('[Frontend] Record:', JSON.stringify(record, null, 2));
    }
});
```

### 2. Added useEffect Hook for State Monitoring

Added a dedicated useEffect to monitor `activeUserQuestions` state changes:

```typescript
// Debug: Log when activeUserQuestions changes
useEffect(() => {
    console.log('[Frontend] activeUserQuestions changed:', activeUserQuestions);
    console.log('[Frontend] activeUserQuestions.length:', activeUserQuestions.length);
    if (activeUserQuestions.length > 0) {
        console.log('[Frontend] ✅ Approval form should be visible now');
        console.log('[Frontend] First question:', activeUserQuestions[0]);
    } else {
        console.log('[Frontend] ⚠️ No active questions - form will not show');
    }
}, [activeUserQuestions]);
```

### 3. Force Re-render After Setting Questions

Added `setIsLoading(false)` after setting questions to force a React re-render:

```typescript
setActiveUserQuestions(normalized);
setIsLoading(false); // Force re-render
```

## Debugging Flow

With these improvements, you can now trace the entire HITL approval flow:

### Expected Log Sequence (Success Case)

```
1. [Frontend] 📥 Received ask_user_question tool call
2. [Frontend] Tool call data: { toolName: "ask_user_question", ... }
3. [Frontend] Current activeUserQuestions length: 0
4. [Frontend] Current __activeUserQuestion flag: undefined
5. [Frontend] ✅ Processing ask_user_question (HITL or regular)
6. [Frontend] Result data: { questions: [...] }
7. [Frontend] Set __activeUserQuestion flag to true
8. [Frontend] Found questions array with 1 questions
9. [Frontend] Normalizing question: { question: "...", options: [...] }
10. [Frontend] Normalizing options: [...]
11. [Frontend] Normalized questions: [{ question: "...", options: [...] }]
12. [Frontend] ✅ Called setActiveUserQuestions with 1 questions
13. [Frontend] Returning early from ask_user_question handler
14. [Frontend] activeUserQuestions changed: [{ question: "...", options: [...] }]
15. [Frontend] activeUserQuestions.length: 1
16. [Frontend] ✅ Approval form should be visible now
17. [Frontend] First question: { question: "...", options: [...] }
```

### Failure Case Indicators

**If tool call is missing data:**
```
[Frontend] ❌ ask_user_question tool_call missing required data
[Frontend] Record: { ... }
```

**If data structure is invalid:**
```
[Frontend] ❌ No valid question data found in tool_call
[Frontend] Data structure: { ... }
```

**If state doesn't update:**
```
[Frontend] ✅ Called setActiveUserQuestions with 1 questions
[Frontend] activeUserQuestions changed: []  // ❌ Still empty!
[Frontend] ⚠️ No active questions - form will not show
```

## Troubleshooting Guide

### Issue: Form Not Showing

**Check these logs in order:**

1. **Is the tool call received?**
   - Look for: `[Frontend] 📥 Received ask_user_question tool call`
   - If missing: Backend isn't sending the event

2. **Does it have valid data?**
   - Look for: `[Frontend] ✅ Processing ask_user_question`
   - If missing: Check `record.result.success` and `record.result.data`

3. **Is the flag set?**
   - Look for: `[Frontend] Set __activeUserQuestion flag to true`
   - If missing: Handler isn't running

4. **Are questions normalized?**
   - Look for: `[Frontend] Normalized questions: [...]`
   - Check the structure matches expected format

5. **Is state updated?**
   - Look for: `[Frontend] ✅ Called setActiveUserQuestions with N questions`
   - Then: `[Frontend] activeUserQuestions changed: [...]`
   - If second log shows empty array: React state update failed

6. **Should form be visible?**
   - Look for: `[Frontend] ✅ Approval form should be visible now`
   - If you see: `[Frontend] ⚠️ No active questions` - state is empty

### Common Issues

**Issue 1: State Update Doesn't Trigger Re-render**
- **Symptom**: `setActiveUserQuestions` called but form doesn't show
- **Solution**: Added `setIsLoading(false)` to force re-render
- **Check**: Look for state change in useEffect log

**Issue 2: Tool Call Missing Data**
- **Symptom**: `[Frontend] ❌ ask_user_question tool_call missing required data`
- **Solution**: Check backend is sending `result.success` and `result.data`
- **Check**: Inspect the full record structure in logs

**Issue 3: Invalid Data Structure**
- **Symptom**: `[Frontend] ❌ No valid question data found`
- **Solution**: Ensure data has either `questions` array or single `question`
- **Check**: Look at `[Frontend] Data structure:` log

**Issue 4: Race Condition with mission_complete**
- **Symptom**: Form shows briefly then disappears
- **Solution**: `__activeUserQuestion` flag prevents clearing
- **Check**: Verify flag is set before mission_complete fires

## Testing Checklist

- [ ] Backend sends `ask_user_question` tool call
- [ ] Frontend receives tool call (log appears)
- [ ] Tool call has valid `result.success` and `result.data`
- [ ] Data has either `questions` array or single `question`
- [ ] Options are normalized correctly
- [ ] `setActiveUserQuestions` is called
- [ ] useEffect detects state change
- [ ] Form renders in UI
- [ ] User can interact with form
- [ ] Approval/rejection works correctly

## Files Modified

1. **src/app/chat/page.tsx**:
   - Enhanced `onToolCall` handler with comprehensive logging
   - Added useEffect hook to monitor `activeUserQuestions` changes
   - Added `setIsLoading(false)` to force re-render after setting questions
   - Added error logging for invalid data structures

## Next Steps

If the form still doesn't show after these improvements:

1. **Check the logs** - Follow the troubleshooting guide above
2. **Verify data structure** - Ensure backend sends correct format
3. **Check React DevTools** - Inspect `activeUserQuestions` state
4. **Check DOM** - Use browser inspector to see if form element exists
5. **Check CSS** - Verify form isn't hidden by styles

The comprehensive logging should pinpoint exactly where the flow breaks.

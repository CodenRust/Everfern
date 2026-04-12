# System Prompt Loading Hang Fix

## Issue
After implementing async skills and prompt loading, the system was getting stuck at "Compiling system messages..." because `getSlimSystemPromptAsync()` was calling `loadSkillsAsync()` again, loading skills a second time unnecessarily.

## Root Cause
- Skills were being loaded in `AgentRunner` constructor via `initializeSkills()`
- Then `getSlimSystemPromptAsync()` was calling `loadSkillsAsync()` again
- This double-loading was causing delays and potential race conditions

## Solution
1. **Modified `getSlimSystemPromptAsync()`** to accept optional pre-loaded skills parameter
   - Added `preloadedSkills?: any[]` parameter
   - Uses pre-loaded skills if provided, otherwise loads them asynchronously
   - Avoids redundant skills loading

2. **Updated `runStream()` in AgentRunner** to pass pre-loaded skills
   - Ensures skills are loaded before calling `getSlimSystemPromptAsync()`
   - Passes `this.skills` to avoid loading skills twice
   - Added check to load skills if not yet loaded

## Changes Made

### `main/agent/runner/system-prompt.ts`
```typescript
export async function getSlimSystemPromptAsync(
  platform: string = 'win32', 
  conversationId?: string, 
  sessionCreatedPaths: string[] = [],
  preloadedSkills?: any[]  // NEW: Accept pre-loaded skills
): Promise<string> {
  // ...
  // Skills - use pre-loaded skills if provided, otherwise load asynchronously
  const skills = preloadedSkills || await loadSkillsAsync();
  // ...
}
```

### `main/agent/runner/runner.ts`
```typescript
// Ensure skills are loaded before building system prompt
if (this.skills.length === 0) {
  console.log('[AgentRunner] Skills not yet loaded, loading now...');
  this.skills = await loadSkillsAsync();
}

// Pre-load system prompt with pre-loaded skills
const preloadedPrompt = await getSlimSystemPromptAsync(
  platform, 
  conversationId, 
  [], 
  this.skills  // Pass pre-loaded skills
);
```

## Benefits
- **No redundant loading**: Skills are loaded only once
- **Faster startup**: Eliminates duplicate async operations
- **Better performance**: Reduces I/O operations
- **Cleaner code**: Explicit dependency management

## Testing
The system now:
1. Loads skills once during runner initialization
2. Passes pre-loaded skills to system prompt assembly
3. Completes "Compiling system messages..." step quickly
4. No longer hangs or shows empty messages in frontend

## Status
✅ Fixed and tested

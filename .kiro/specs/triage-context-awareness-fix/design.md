# Triage Context Awareness Bugfix Design

## Overview

This bugfix addresses the loss of conversation context when users respond with short affirmative messages ("yes", "ok", "proceed") after uploading files or stating clear intents. The triage system currently treats these affirmations in isolation, causing misclassification and incorrect routing to specialized agents. The fix implements context-aware intent classification that recognizes affirmative responses as continuations of previous intents rather than new independent requests.

The approach involves enhancing both the AI classification method (`classifyIntentAI`) and the heuristic fallback method (`classifyIntentHeuristic`) to analyze conversation history for context signals such as recent file uploads, previous intents, and explicit user requests. When a short affirmative message is detected, the system will inherit the previous message's intent rather than treating it as a standalone "conversation" intent.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when short affirmative responses ("yes", "ok", "proceed") follow messages with clear intent signals (file uploads, explicit requests), causing context loss
- **Property (P)**: The desired behavior when short affirmations are received - the system should maintain the previous intent and route to the appropriate specialist agent
- **Preservation**: Existing intent classification behavior for substantive messages, greetings, and standalone affirmations that must remain unchanged by the fix
- **classifyIntent**: The unified function in `main/agent/runner/triage.ts` that orchestrates intent classification using AI or heuristic methods
- **classifyIntentAI**: The AI-powered classification method that uses the LLM to determine user intent based on input and conversation history
- **classifyIntentHeuristic**: The fallback heuristic method that uses pattern matching and keyword scoring to classify intent
- **Context Signal**: Indicators in conversation history that suggest a continuation of previous intent (e.g., file uploads, previous "analyze" intent, explicit requests)
- **Short Affirmative**: Brief confirmatory messages like "yes", "ok", "okay", "proceed", "continue", "sure", "go ahead" (typically < 10 characters)
- **Intent Inheritance**: The mechanism by which a short affirmative message adopts the intent from the previous user message

## Bug Details

### Bug Condition

The bug manifests when a user provides a short affirmative response following a message that contains clear intent signals (such as file uploads or explicit requests). The `classifyIntent` function, along with its underlying methods `classifyIntentAI` and `classifyIntentHeuristic`, fails to recognize the affirmation as a continuation of the previous intent, instead treating it as an isolated "conversation" intent.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { currentMessage: string, conversationHistory: Message[] }
  OUTPUT: boolean
  
  RETURN isShortAffirmative(input.currentMessage)
         AND hasPreviousContextSignal(input.conversationHistory)
         AND NOT intentInherited(input.currentMessage, input.conversationHistory)
END FUNCTION

FUNCTION isShortAffirmative(message)
  RETURN message.length < 10
         AND message IN ['yes', 'ok', 'okay', 'proceed', 'continue', 'sure', 'go ahead', 'yep', 'yeah']
END FUNCTION

FUNCTION hasPreviousContextSignal(history)
  previousUserMessage := getLastUserMessage(history, offset=1)
  RETURN hasFileAttachment(previousUserMessage)
         OR hasExplicitIntent(previousUserMessage)
         OR previousIntentWasNonConversational(history)
END FUNCTION
```

### Examples

- **Example 1**: User uploads `sales_data.csv` and says "Can you analyze this?". System correctly classifies as "analyze" and routes to DATA_ANALYST. User then responds "yes" to proceed. **Bug**: System classifies "yes" as "conversation" and routes to WEB_EXPLORER instead of maintaining "analyze" intent.

- **Example 2**: User says "I need to fix the authentication bug in auth.ts". System classifies as "fix" intent. User responds "ok, proceed" when asked for confirmation. **Bug**: System classifies "ok, proceed" as "conversation" instead of maintaining "fix" intent.

- **Example 3**: User uploads `report.csv` with message "Here's the data". System classifies as "analyze". User responds "continue" when prompted. **Bug**: System loses "analyze" context and misroutes the request.

- **Edge Case**: User says "hello" at the start of a new conversation. **Expected**: System correctly classifies as "conversation" intent (no previous context to inherit).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Substantive messages with clear intent signals (e.g., "analyze this CSV file") must continue to be classified correctly based on message content
- Greetings at conversation start (e.g., "hello", "hi") must continue to be classified as "conversation" intent
- Short affirmative responses without any prior context or file uploads must continue to be classified as "conversation" intent
- Messages with explicit coding, research, or task keywords must continue to be classified according to existing heuristics and AI classification
- File uploads with explicit instructions in the same message must continue to be classified correctly (e.g., "analyze" for CSV with analysis request)
- AI classification timeout/failure fallback to heuristic classification must continue to work
- Heuristic classification of multi-action patterns and complex requests must continue to score and classify appropriately

**Scope:**
All inputs that do NOT involve short affirmative responses following context-rich messages should be completely unaffected by this fix. This includes:
- First messages in a conversation
- Substantive multi-word requests
- Messages with explicit intent keywords
- Standalone greetings or closures

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Insufficient Context Analysis in AI Classification**: The `classifyIntentAI` function receives conversation history but the prompt may not emphasize context inheritance for short affirmations. The AI may treat each message independently rather than recognizing continuation patterns.

2. **Fast-Path Bypass in Heuristic Classification**: The `classifyIntent` function has a fast-path that immediately returns heuristic classification for messages < 5 characters or matching simple patterns like "yes", "ok". This bypass prevents context analysis from occurring.
   ```typescript
   if (/^(hi|hello|hey|thanks|thank you|bye|goodbye|ok|okay|yes|no)$/.test(normalized) || normalized.length < 5) {
     return classifyIntentHeuristic(userInput);
   }
   ```

3. **No Context Signal Detection in Heuristic Method**: The `classifyIntentHeuristic` function only analyzes the current message content using keyword scoring. It has no mechanism to check conversation history for file uploads, previous intents, or other context signals.

4. **Missing Intent Inheritance Logic**: Neither classification method implements logic to detect short affirmatives and inherit intent from previous messages. There is no function to extract context signals from conversation history.

## Correctness Properties

Property 1: Bug Condition - Context-Aware Intent Inheritance

_For any_ input where a short affirmative message follows a message with clear intent signals (file uploads, explicit requests, non-conversational previous intent), the fixed classification functions SHALL inherit the previous message's intent rather than classifying the affirmation as "conversation", ensuring correct routing to the appropriate specialist agent.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Non-Affirmative Message Classification

_For any_ input that is NOT a short affirmative following a context-rich message (substantive requests, greetings, standalone affirmations, messages with explicit keywords), the fixed classification functions SHALL produce exactly the same classification results as the original functions, preserving all existing intent detection behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `main/agent/runner/triage.ts`

**Functions**: `classifyIntent`, `classifyIntentAI`, `classifyIntentHeuristic`

**Specific Changes**:

1. **Add Context Signal Detection Helper Functions**:
   - `isShortAffirmative(message: string): boolean` - Detects if message is a short affirmation
   - `extractPreviousIntent(history: any[]): IntentType | null` - Extracts intent from previous user message
   - `hasFileAttachment(message: any): boolean` - Checks if message contains file uploads
   - `hasExplicitIntentKeywords(message: any): boolean` - Checks if message has clear intent signals

2. **Modify `classifyIntent` Fast-Path Logic**:
   - Before returning heuristic classification for short messages, check if it's an affirmative
   - If affirmative and history exists, attempt context inheritance
   - Only use fast-path if no context signals are present

3. **Enhance `classifyIntentAI` Prompt**:
   - Add explicit instructions to recognize short affirmatives as continuations
   - Emphasize checking conversation history for file uploads and previous intents
   - Provide examples of context inheritance in the prompt

4. **Enhance `classifyIntentHeuristic` with Context Awareness**:
   - Accept `history` parameter (currently not used)
   - Before scoring keywords, check if message is short affirmative
   - If affirmative, analyze history for context signals and inherit previous intent
   - Return inherited intent with high confidence if context signals found

5. **Update `createTriageNode` to Pass Full History**:
   - Ensure `state.messages` is passed to `classifyIntent` (already done)
   - Verify message format is compatible with new helper functions

### Implementation Pseudocode

```typescript
// New helper functions
FUNCTION isShortAffirmative(message: string): boolean
  normalized := message.toLowerCase().trim()
  affirmatives := ['yes', 'ok', 'okay', 'proceed', 'continue', 'sure', 'go ahead', 'yep', 'yeah']
  RETURN normalized IN affirmatives OR (normalized.length < 10 AND containsAffirmativePattern(normalized))
END FUNCTION

FUNCTION extractPreviousIntent(history: Message[]): IntentType | null
  previousUserMsg := getLastUserMessage(history, offset=1)
  IF previousUserMsg IS NULL THEN RETURN NULL
  
  // Check for file attachments
  IF hasFileAttachment(previousUserMsg) THEN
    IF hasCSVOrDataFile(previousUserMsg) THEN RETURN 'analyze'
    IF hasCodeFile(previousUserMsg) THEN RETURN 'coding'
  END IF
  
  // Check for explicit intent keywords in previous message
  content := extractContent(previousUserMsg)
  IF containsAnalyzeKeywords(content) THEN RETURN 'analyze'
  IF containsFixKeywords(content) THEN RETURN 'fix'
  IF containsCodingKeywords(content) THEN RETURN 'coding'
  
  RETURN NULL
END FUNCTION

// Modified classifyIntent
FUNCTION classifyIntent(userInput: string, client: AIClient, history: Message[]): IntentClassification
  normalized := userInput.toLowerCase().trim()
  
  // Check for short affirmative with context
  IF isShortAffirmative(normalized) AND history.length > 0 THEN
    previousIntent := extractPreviousIntent(history)
    IF previousIntent IS NOT NULL THEN
      RETURN {
        intent: previousIntent,
        confidence: 0.95,
        reasoning: "Short affirmative detected - inheriting previous intent: " + previousIntent
      }
    END IF
  END IF
  
  // Original fast-path for greetings (excluding affirmatives)
  IF isGreeting(normalized) OR (normalized.length < 5 AND NOT isShortAffirmative(normalized)) THEN
    RETURN classifyIntentHeuristic(userInput, history)
  END IF
  
  // Continue with AI classification
  IF client EXISTS THEN
    RETURN classifyIntentAI(client, userInput, history)
  END IF
  
  RETURN classifyIntentHeuristic(userInput, history)
END FUNCTION

// Enhanced classifyIntentAI prompt
FUNCTION classifyIntentAI(client: AIClient, userInput: string, history: Message[]): IntentClassification
  // Add to prompt:
  "SPECIAL RULE - Context Inheritance:
   If the user input is a short affirmative response (yes, ok, proceed, continue, etc.) 
   AND the conversation history shows a recent file upload or clear intent in the previous message,
   you MUST inherit that previous intent rather than classifying as 'conversation'.
   
   Examples:
   - Previous: [USER uploads sales.csv] 'Can you analyze this?'
     Current: 'yes'
     Classification: 'analyze' (inherit from previous context)
   
   - Previous: [USER] 'Fix the auth bug'
     Current: 'ok proceed'
     Classification: 'fix' (inherit from previous context)"
  
  // Rest of AI classification logic...
END FUNCTION

// Enhanced classifyIntentHeuristic
FUNCTION classifyIntentHeuristic(userInput: string, history: Message[]): IntentClassification
  normalized := userInput.toLowerCase().trim()
  
  // Check for context inheritance before keyword scoring
  IF isShortAffirmative(normalized) AND history.length > 0 THEN
    previousIntent := extractPreviousIntent(history)
    IF previousIntent IS NOT NULL THEN
      RETURN {
        intent: previousIntent,
        confidence: 0.90,
        reasoning: "Heuristic: Short affirmative - inherited " + previousIntent + " from previous message"
      }
    END IF
  END IF
  
  // Original keyword scoring logic...
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate multi-turn conversations with file uploads followed by short affirmative responses. Run these tests on the UNFIXED code to observe misclassification and incorrect routing.

**Test Cases**:
1. **CSV Upload + Affirmation Test**: Simulate uploading a CSV file with "analyze this", then responding "yes" (will fail on unfixed code - expects "analyze", gets "conversation")
2. **Fix Request + Affirmation Test**: Simulate "fix the auth bug" followed by "ok proceed" (will fail on unfixed code - expects "fix", gets "conversation")
3. **Code File Upload + Affirmation Test**: Simulate uploading a .ts file with "review this code", then "continue" (will fail on unfixed code - expects "coding", gets "conversation")
4. **Standalone Affirmation Test**: Simulate "yes" without any prior context (should pass on unfixed code - expects "conversation", gets "conversation")

**Expected Counterexamples**:
- Short affirmatives following file uploads are classified as "conversation" instead of inheriting "analyze" or "coding" intent
- Short affirmatives following explicit requests are classified as "conversation" instead of inheriting "fix", "build", or other intents
- Possible causes: fast-path bypass, no context analysis in heuristic method, insufficient AI prompt guidance

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := classifyIntent_fixed(input.currentMessage, client, input.conversationHistory)
  ASSERT result.intent == extractPreviousIntent(input.conversationHistory)
  ASSERT result.confidence >= 0.85
  ASSERT result.reasoning CONTAINS "inherit"
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT classifyIntent_original(input) = classifyIntent_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for substantive messages, greetings, and complex requests, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Substantive Message Preservation**: Observe that "analyze this CSV file" is classified as "analyze" on unfixed code, then verify this continues after fix
2. **Greeting Preservation**: Observe that "hello" at conversation start is classified as "conversation" on unfixed code, then verify this continues after fix
3. **Keyword-Rich Message Preservation**: Observe that messages with explicit coding/research/task keywords are classified correctly on unfixed code, then verify this continues after fix
4. **Multi-Action Pattern Preservation**: Observe that complex requests with multiple actions are scored correctly on unfixed code, then verify this continues after fix

### Unit Tests

- Test `isShortAffirmative` with various affirmative phrases and edge cases
- Test `extractPreviousIntent` with different conversation histories (file uploads, explicit requests, no context)
- Test `hasFileAttachment` with messages containing different file types
- Test context inheritance logic in `classifyIntent` with affirmatives following various intents
- Test fast-path bypass for greetings (should not trigger context inheritance)
- Test standalone affirmatives without context (should classify as "conversation")

### Property-Based Tests

- Generate random conversation histories with file uploads and verify affirmatives inherit correct intent
- Generate random substantive messages and verify classification remains unchanged after fix
- Generate random greeting messages and verify they continue to classify as "conversation"
- Test that all non-affirmative inputs produce identical results before and after fix

### Integration Tests

- Test full triage flow: upload CSV → respond "yes" → verify DATA_ANALYST routing
- Test full triage flow: request fix → respond "ok" → verify correct specialist routing
- Test full triage flow: greeting → substantive request → verify no false inheritance
- Test that visual feedback and event queue updates reflect correct intent classification

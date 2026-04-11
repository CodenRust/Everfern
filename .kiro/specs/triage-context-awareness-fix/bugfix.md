# Bugfix Requirements Document

## Introduction

The triage system currently loses conversation context when users respond with short affirmative messages like "yes", "ok", or "proceed" after uploading files for analysis. This causes misclassification of intent and incorrect routing to specialized agents. For example, when a user uploads a CSV file and responds "yes" to proceed, the system classifies this as a general directive and routes to WEB_EXPLORER instead of maintaining the "analyze" intent and routing to DATA_ANALYST.

This bug impacts user experience by breaking the natural flow of multi-turn interactions where users confirm or affirm actions related to previously uploaded content or stated intents.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user uploads a file (e.g., CSV) in one message and responds with a short affirmation ("yes", "ok", "proceed", "continue") in the next message THEN the system loses the previous context and misclassifies the affirmation as a general directive

1.2 WHEN the triage system receives a short affirmative response following a file upload THEN it classifies the intent as "conversation" or "task" instead of maintaining the previous "analyze" intent

1.3 WHEN the intent is misclassified for an affirmative response after file upload THEN the system routes to WEB_EXPLORER instead of the appropriate specialist (e.g., DATA_ANALYST)

1.4 WHEN the AI classification method (classifyIntentAI) receives a short affirmative message THEN it treats the message in isolation without properly weighting the conversation history context

1.5 WHEN the heuristic classification method (classifyIntentHeuristic) receives a short affirmative message THEN it returns "conversation" intent with high confidence without considering previous messages

### Expected Behavior (Correct)

2.1 WHEN a user uploads a file (e.g., CSV) in one message and responds with a short affirmation ("yes", "ok", "proceed", "continue") in the next message THEN the system SHALL maintain the previous context and preserve the "analyze" intent

2.2 WHEN the triage system receives a short affirmative response following a file upload THEN it SHALL recognize this as confirmation to proceed with the previously identified intent (e.g., "analyze")

2.3 WHEN the intent is correctly maintained for an affirmative response after file upload THEN the system SHALL route to the appropriate specialist agent (e.g., DATA_ANALYST for CSV files)

2.4 WHEN the AI classification method (classifyIntentAI) receives a short affirmative message THEN it SHALL analyze the conversation history to determine if this is a continuation of a previous intent

2.5 WHEN the heuristic classification method (classifyIntentHeuristic) receives a short affirmative message THEN it SHALL check for context signals (e.g., recent file uploads, previous intents) before defaulting to "conversation" intent

2.6 WHEN a short affirmative message follows a message with clear intent signals (file upload, specific request) THEN the system SHALL inherit the previous message's intent rather than treating the affirmation as a new independent request

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user provides a substantive message with clear intent signals (e.g., "analyze this CSV file") THEN the system SHALL CONTINUE TO classify the intent correctly based on the message content

3.2 WHEN a user starts a new conversation with a greeting (e.g., "hello", "hi") THEN the system SHALL CONTINUE TO classify it as "conversation" intent

3.3 WHEN a user provides a short affirmative response without any prior context or file uploads THEN the system SHALL CONTINUE TO classify it as "conversation" intent

3.4 WHEN the triage system processes messages with explicit coding, research, or task keywords THEN it SHALL CONTINUE TO classify them correctly according to existing heuristics and AI classification

3.5 WHEN a user uploads a file with an explicit instruction in the same message (e.g., "Here's a CSV, analyze it") THEN the system SHALL CONTINUE TO classify it as "analyze" intent and route to DATA_ANALYST

3.6 WHEN the AI classification times out or fails THEN the system SHALL CONTINUE TO fall back to heuristic classification

3.7 WHEN the heuristic classification encounters multi-action patterns or complex requests THEN it SHALL CONTINUE TO score and classify them appropriately

# Bugfix Requirements Document

## Introduction

The agent orchestration system is completing missions prematurely before specialist nodes finish their work. Tasks are ending at 78-124 seconds with the flow: "Entering: VALIDATION" → "Entering: HITL" → "Mission COMPLETED", even when the actual work is incomplete. This occurs because the validation node routes directly to END when no tool calls are pending, incorrectly assuming the task is complete.

The bug impacts task reliability and user experience, as users see "Mission COMPLETED" while their requested work remains unfinished.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a specialist node (data_analyst, coding_specialist, web_explorer, computer_use_agent) completes execution without generating tool calls THEN the system routes from action_validation directly to END, prematurely completing the mission

1.2 WHEN a specialist node provides a text response without tool calls THEN the system interprets this as task completion and terminates the graph execution

1.3 WHEN the validation node evaluates `!hasTools` condition THEN the system routes to END without checking if the actual task objective has been achieved

1.4 WHEN a mission reaches END node prematurely THEN the system logs "Mission COMPLETED" and stops execution, leaving requested work incomplete

1.5 WHEN the agent needs multiple iterations to complete a complex task THEN the system terminates after the first specialist response if no tools are generated

### Expected Behavior (Correct)

2.1 WHEN a specialist node completes execution without generating tool calls THEN the system SHALL evaluate whether the task objective has been achieved before routing to END

2.2 WHEN a specialist node provides a text response without tool calls THEN the system SHALL check if the response indicates task completion or requires further iteration

2.3 WHEN the validation node evaluates completion THEN the system SHALL verify the task is actually complete by checking task objectives, not just the absence of tool calls

2.4 WHEN a mission objective is not yet achieved THEN the system SHALL route back to global_planner for next iteration instead of routing to END

2.5 WHEN the agent needs multiple iterations to complete a complex task THEN the system SHALL continue iterating through the graph until the task objective is satisfied or max iterations is reached

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a specialist node generates tool calls THEN the system SHALL CONTINUE TO route through validation → (hitl_approval if high-risk OR multi_tool_orchestrator) → global_planner

3.2 WHEN high-risk tool calls are detected THEN the system SHALL CONTINUE TO route to hitl_approval for human approval

3.3 WHEN tool execution completes successfully THEN the system SHALL CONTINUE TO route back to global_planner for next iteration

3.4 WHEN max iterations limit is reached THEN the system SHALL CONTINUE TO terminate the mission to prevent infinite loops

3.5 WHEN a read-only task (question, research, conversation) completes THEN the system SHALL CONTINUE TO finalize appropriately without requiring tool execution

3.6 WHEN mission tracker events are emitted THEN the system SHALL CONTINUE TO update the frontend timeline in real-time

3.7 WHEN the graph reaches a legitimate completion state THEN the system SHALL CONTINUE TO emit mission_complete event and drain the event queue before sending 'done'

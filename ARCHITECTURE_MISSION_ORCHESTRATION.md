/**
 * ARCHITECTURE: OpenClaw-Style Mission Orchestration for EverFern
 * 
 * PROBLEM:
 * Frontend displayed "Done" while backend tasks were still running because:
 *   1. Backend sent 'done' event after graph completed, not after all results streamed
 *   2. No structured task lifecycle tracking
 *   3. IPC communication wasn't synchronized with actual mission completion
 * 
 * SOLUTION: Multi-layer task lifecycle management
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    OVERALL FLOW                                 │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * BACKEND (AgentRunner → LangGraph)
 * ─────────────────────────────────
 * 1. Initialize MissionTracker(missionId)
 *    └─ Add initial steps for each phase
 * 
 * 2. Build LangGraph with missionTracker reference
 *    └─ Each node updates tracker on start/end
 * 
 * 3. Execute graph while collecting events
 *    └─ Events: chunk, tool_call, mission_step_update, mission_phase_change
 * 
 * 4. On graph completion (reaches END):
 *    └─ missionTracker.complete() → mission_complete event
 * 
 * 5. Drain event queue while mission incomplete
 *    ├─ Keep draining events from graph
 *    ├─ Keep draining events from mission tracker
 *    └─ Wait until queue empty AND mission.isComplete
 * 
 * 6. Send final 'done' event
 * 
 * FRONTEND (React)
 * ────────────────
 * 1. Start loading, initialize mission UI
 * 
 * 2. Listen to IPC events:
 *    ├─ acp:stream-chunk → streaming content
 *    ├─ acp:tool-start/call → live tool calls
 *    ├─ acp:mission-step-update → timeline progress
 *    └─ acp:mission-phase-change → phase indicator
 * 
 * 3. Display Mission Timeline in real-time
 *    └─ Shows all steps with status badges
 * 
 * 4. WAIT for acp:mission-complete event
 *    └─ Only then finalize message and set isLoading = false
 * 
 * 5. Fallback: 2-minute timeout if no mission_complete
 *    └─ Edge case handling for recovery
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    DATA STRUCTURES                              │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * MissionStep:
 *   {
 *     id: "step:triage" | "step:planning" | "step:tool_group_1" ...
 *     name: "Analyzing Intent"
 *     description: "Classifying user request..."
 *     phase: "triage" | "planning" | "execution" | "validation" | "completion"
 *     status: "pending" | "in-progress" | "completed" | "failed" | "skipped"
 *     startTime: number (ms)
 *     endTime: number (ms)
 *     duration: number (ms)
 *     toolCalls: ["web_search", "read_file"]
 *     result: "Found 3 relevant sources"
 *     error?: "Tool failed: 429 rate limit"
 *     metadata?: { parallelGroup: 1, attempts: 2 }
 *   }
 * 
 * MissionTimeline:
 *   {
 *     missionId: "conv-123"
 *     startTime: 1712000000000
 *     currentPhase: "execution"
 *     steps: MissionStep[]
 *     completedSteps: 5
 *     totalSteps: 8
 *     progress: 62.5%
 *     isComplete: false
 *     finalResult?: "Task completed successfully"
 *     error?: string
 *   }
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    ORCHESTRATION PATTERN                        │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * node.ts pattern:
 * ```typescript
 * export const createSomeNode = (
 *   runner: AgentRunner, 
 *   eventQueue: StreamEvent[],
 *   missionTracker?: MissionTracker
 * ) => {
 *   return async (state: GraphStateType) => {
 *     const stepId = `step:${state.taskPhase}`;
 *     
 *     // Start phase
 *     missionTracker?.startStep(stepId);
 *     runner.telemetry.transition(state.taskPhase);
 *     
 *     try {
 *       // Do work...
 *       const result = await doSomething();
 *       
 *       // Complete step
 *       missionTracker?.completeStep(stepId, JSON.stringify(result));
 *       
 *       return { /* new state */ };
 *     } catch (error) {
 *       missionTracker?.failStep(stepId, error.message);
 *       throw error;
 *     }
 *   };
 * };
 * ```
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    KEY CHANGES                                  │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * 1. LIFECYCLE MANAGEMENT:
 *    Old: Linear stream → done flag
 *    New: Graph completion → mission_complete event → frontend action
 * 
 * 2. EVENT SYNCHRONIZATION:
 *    Old: Send done after graph.invoke() returns
 *    New: Send done after all events drained AND mission.isComplete
 * 
 * 3. FRONTEND STATE:
 *    Old: onStreamChunk({ done: true })
 *    New: onMissionComplete({ timeline, steps })
 * 
 * 4. VISIBILITY:
 *    Old: User sees "Done" with no progress indication
 *    New: MissionTimeline component shows real-time step execution
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    IMPLEMENTATION STATUS                        │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * COMPLETED:
 *  ✅ MissionTracker class with lifecycle management
 *  ✅ IPC bridge updates for mission events
 *  ✅ Frontend MissionTimeline component
 *  ✅ LangGraph state extension
 *  ✅ Runner.ts async generator update
 *  ✅ Frontend event handlers and state management
 * 
 * TODO:
 *  ⚠️  Update all graph nodes to accept/use missionTracker
 *      - createTriageNode needs parameter
 *      - createPlannerNode needs parameter
 *      - All specialist nodes need parameter
 *      - createValidationNode needs parameter
 *      - createExecuteToolsNode needs parameter
 * 
 *  ⚠️  Update graph.ts buildGraph call site to pass tracker
 * 
 *  ✅ Frontend properly waits for mission_complete
 *  ✅ Fallback timeout implemented
 * 
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    TESTING STRATEGY                             │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * 1. Compile check: Verify all types resolve
 * 2. Runtime: Execute simple query, observe:
 *    - MissionTimeline appears during execution
 *    - Steps update in real-time
 *    - Progress bar fills up
 *    - "Done" only appears when mission_complete event fires
 * 3. Edge cases:
 *    - Network timeout → mission fails, shows error
 *    - Tool failure → step marked failed
 *    - Long-running task → fallback timer engages
 */

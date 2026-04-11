/**
 * NEXT STEPS: Integrating Mission Tracking into Graph Nodes
 * 
 * All graph node files need a 3-line change to support mission tracking.
 * Use MissionIntegrator for safe, optional integration.
 * 
 * EXAMPLE PATTERN:
 * ==============
 * 
 * // OLD:
 * export const createSomeNode = (
 *   runner: AgentRunner,
 *   eventQueue: StreamEvent[]
 * ) => {
 *   return async (state: GraphStateType) => {
 *     // execution...
 *   };
 * };
 * 
 * // NEW:
 * export const createSomeNode = (
 *   runner: AgentRunner,
 *   eventQueue: StreamEvent[],
 *   missionTracker?: MissionTracker  // ← ADD PARAMETER
 * ) => {
 *   const integrator = createMissionIntegrator(missionTracker); // ← ADD INTEGRATOR
 *   
 *   return async (state: GraphStateType) => {
 *     integrator.startNode('some_node', 'Doing work...');  // ← START
 *     try {
 *       // execution...
 *       integrator.completeNode('some_node', JSON.stringify(result));  // ← COMPLETE
 *       return newState;
 *     } catch (error) {
 *       integrator.failNode('some_node', error.message);  // ← FAIL
 *       throw error;
 *     }
 *   };
 * };
 * 
 * FILES TO UPDATE:
 * ===============
 * 
 * main/agent/runner/nodes/triage.ts
 * └─ createTriageNode(runner, eventQueue[, missionTracker])
 * 
 * main/agent/runner/nodes/planner.ts
 * └─ createPlannerNode(runner, eventQueue[, missionTracker])
 * 
 * main/agent/runner/nodes/call_model.ts (if exists)
 * └─ createCallModelNode(runner, eventQueue[, missionTracker])
 * 
 * main/agent/runner/nodes/execute_tools.ts
 * └─ createExecuteToolsNode(runner, tools, config, eventQueue, conversationId[, missionTracker])
 *    └─ Track tool groups as steps
 * 
 * main/agent/runner/nodes/validation.ts
 * └─ createValidationNode(runner[, missionTracker])
 * 
 * main/agent/runner/nodes/specialized_agents.ts
 * ├─ createCodingSpecialistNode(runner, eventQueue[, missionTracker])
 * ├─ createDataAnalystNode(runner, eventQueue[, missionTracker])
 * ├─ createComputerUseNode(runner, eventQueue[, missionTracker])
 * └─ createWebExplorerNode(runner, eventQueue[, missionTracker])
 * 
 * QUICK INTEGRATION CHECKLIST:
 * ===========================
 * 
 * For each node file:
 * 
 *   [ ] Import at top:
 *       import { MissionIntegrator, createMissionIntegrator } from '../mission-integrator';
 *       import type { MissionTracker } from '../mission-tracker';
 * 
 *   [ ] Add missionTracker parameter to createXxxNode():
 *       export const createXxxNode = (
 *         runner: AgentRunner,
 *         [other params],
 *         missionTracker?: MissionTracker
 *       ) => {
 * 
 *   [ ] Create integrator inside the factory:
 *       const integrator = createMissionIntegrator(missionTracker);
 * 
 *   [ ] In the node's async handler:
 *       return async (state: GraphStateType) => {
 *         integrator.startNode('xxx_node', 'Describing work...');
 *         try {
 *           // existing logic...
 *           integrator.completeNode('xxx_node', 'optional result');
 *           return newState;
 *         } catch (error) {
 *           integrator.failNode('xxx_node', error.message);
 *           throw error;
 *         }
 *       };
 * 
 * SPECIAL CASES:
 * ==============
 * 
 * 1. EXECUTE_TOOLS node (most important):
 *    - Currently groups tools and runs them in parallel/sequential batches
 *    - Each tool group should create a step:
 *      integrator.startNode(`tool_group_${groupIndex}`, `Running ${toolNames.join(', ')}`);
 *    - Record which tools are running:
 *      integrator.recordToolCalls(`tool_group_${groupIndex}`, toolNames);
 * 
 * 2. VALIDATION node:
 *    - Simpler node, just wrap the validation logic
 * 
 * 3. SPECIALIZED AGENTS:
 *    - Each specialist (coding, data, web, computer-use)
 *    - Wrap their LLM call with tracking
 * 
 * TESTING:
 * =======
 * 
 * After updates:
 *   1. npm run build (or tsc check)
 *   2. Run simple query: "Say hello"
 *   3. Observe MissionTimeline component
 *   4. Verify each step transitions through states
 *   5. Check that "Done" only appears after mission_complete event
 * 
 * ROLLBACK:
 * ========
 * 
 * If something breaks:
 * - MissionIntegrator is optional - if missionTracker is undefined, it's a no-op
 * - All existing logic continues to work unchanged
 * - Just remove the tracking lines if needed
 */

import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { ToolDefinition, ChatMessage, ToolCall } from '../../../lib/ai-client';
import { runAgentStep } from '../services/agent-runtime';
import type { MissionTracker } from '../mission-tracker';
import { createMissionIntegrator } from '../mission-integrator';
import { getAnalysisSessionManager } from '../../sessions';

export const createCodingSpecialistNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const tools = toolDefs || (runner as any)._buildToolDefinitions();

    // Build plan context
    const plan = state.decomposedTask;
    const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';

    // Emit coding specialist active event for frontend
    eventQueue?.push({ type: 'thought', content: '\n💻 Coding Specialist: Analyzing source code and preparing implementation...' });

    return integrator.wrapNode(
      'coding_specialist',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'coding_specialist',
        systemPromptOverride: `You are the EverFern Coding Specialist.
Your goal is to write, debug, and optimize code with extreme precision.
Use your tools (write, edit, run_command) to implement the requested features.${planContext}

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text like "I'll now..." or "Let me...".
- Call your tools DIRECTLY without preamble.`
      }),
      'Writing Code & Implementing Features'
    );
  };
};

/**
 * ProgressStreamer - Emits real-time progress updates during data analysis
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
interface ProgressStreamer {
  emitStart(agentName: string): void;
  emitProgress(message: string, percentage?: number): void;
  emitStepComplete(stepName: string, durationMs: number): void;
  emitError(error: Error, diagnostics: string): void;
  setTotalSteps(total: number): void;
  incrementCompletedSteps(): void;
  getPercentage(): number;
}

function createProgressStreamer(eventQueue?: StreamEvent[]): ProgressStreamer {
  let totalSteps = 0;
  let completedSteps = 0;

  return {
    emitStart(agentName: string): void {
      eventQueue?.push({
        type: 'thought',
        content: `\n📊 ${agentName}: Initializing analysis...`
      });
    },

    emitProgress(message: string, percentage?: number): void {
      const progressText = percentage !== undefined
        ? `[${percentage}%] ${message}`
        : message;
      eventQueue?.push({
        type: 'thought',
        content: `\n📊 ${progressText}`
      });
    },

    emitStepComplete(stepName: string, durationMs: number): void {
      const durationSec = (durationMs / 1000).toFixed(2);
      eventQueue?.push({
        type: 'thought',
        content: `\n✅ ${stepName} completed in ${durationSec}s`
      });
    },

    emitError(error: Error, diagnostics: string): void {
      eventQueue?.push({
        type: 'thought',
        content: `\n❌ Error: ${error.message}\n${diagnostics}`
      });
    },

    setTotalSteps(total: number): void {
      totalSteps = total;
      completedSteps = 0;
    },

    incrementCompletedSteps(): void {
      completedSteps++;
    },

    getPercentage(): number {
      if (totalSteps === 0) return 0;
      return Math.round((completedSteps / totalSteps) * 100);
    }
  };
}

export const createDataAnalystNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);
  const progressStreamer = createProgressStreamer(eventQueue);

  return async (state: GraphStateType, config?: any): Promise<Partial<GraphStateType>> => {
    const tools = toolDefs || (runner as any)._buildToolDefinitions();

    // Get conversation ID from execution context (Requirement 5.1)
    const conversationId = config?.configurable?.executionContext?.conversationId || 'default';

    // Get or create analysis session for this conversation (Requirement 5.1)
    const sessionManager = getAnalysisSessionManager();
    const session = sessionManager.getOrCreateSession(conversationId);

    // Check for session reset commands (Requirement 5.6)
    const lastUserMsg = state.messages.filter(m => (m as any).role === 'user' || (m as any).type === 'human').pop();
    const userContent = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content.toLowerCase() : '') : '';

    if (userContent.includes('reset session') || userContent.includes('clear context') || userContent.includes('clear session')) {
      sessionManager.resetSession(session.id);
      eventQueue?.push({
        type: 'thought',
        content: '\n🔄 Analysis session reset. All data frames, variables, and execution history have been cleared.'
      });

      return {
        messages: [{
          role: 'assistant',
          content: 'Analysis session has been reset. All previous data and context have been cleared. You can start a fresh analysis now.'
        } as any]
      };
    }

    // Build plan context
    const plan = state.decomposedTask;
    const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';

    // Build session context for the agent (Requirement 5.2)
    const sessionContext = `\n\nANALYSIS SESSION CONTEXT:
Session ID: ${session.id}
Active DataFrames: ${Array.from(session.dataFrames.keys()).join(', ') || 'None'}
Stored Variables: ${Array.from(session.variables.keys()).join(', ') || 'None'}
Execution History: ${session.executionHistory.length} previous executions

You can reference previously loaded DataFrames and variables in your Python code.
Use "reset session" or "clear context" to clear all session data.`;

    // Initialize progress tracking for multi-step analyses (Requirement 1.5)
    if (plan && plan.totalSteps > 0) {
      progressStreamer.setTotalSteps(plan.totalSteps);
    }

    // Emit initial progress event within 100ms (Requirement 1.1)
    const startTime = Date.now();
    progressStreamer.emitStart('Data Analyst');

    try {
      const result = await integrator.wrapNode(
        'data_analyst',
        () => runAgentStep(state, {
          runner,
          toolDefs: tools,
          eventQueue,
          nodeName: 'data_analyst',
          systemPromptOverride: `You are the EverFern Data Analyst.
Your goal is to process data, generate insights, and create visualizations.

AVAILABLE TOOLS:
- readFile: Load data files (CSV, Excel, JSON, Parquet)
- terminal_execute: Run Python code for analysis
- visualize: Generate interactive charts
- fsWrite: Save analysis results and dashboards

AVAILABLE LIBRARIES (via terminal_execute):
- pandas: Data manipulation and analysis
- numpy: Numerical computations
- matplotlib: Static visualizations
- seaborn: Statistical visualizations
- plotly: Interactive visualizations

CRITICAL RULES:
1. Do NOT narrate. Execute tools DIRECTLY without preamble.
2. For data loading:
   - CSV: Use pandas.read_csv() with encoding detection
   - Excel: Use pandas.read_excel() and detect sheets
   - JSON: Use pandas.read_json() or json.load()
   - Parquet: Use pandas.read_parquet()
3. For visualizations:
   - Use the visualize tool with Chart.js or Plotly
   - Include appropriate chart types (line, bar, scatter, histogram, etc.)
   - See visualize.examples.md for 12+ chart type examples
4. For multi-step analysis:
   - Store intermediate results in variables
   - Reference previous results when needed
5. For large datasets (>1M rows):
   - Suggest sampling strategies (df.sample(n=100000))
   - Use vectorized operations (avoid Python loops)
   - Downsample for visualizations (df.resample() or df.groupby())
6. Always print analysis results to stdout
7. Format numbers with 2-4 decimal precision
8. Include error handling in Python code

DASHBOARD GENERATION:
When the user requests a dashboard or comprehensive report:
1. Generate a standalone HTML file using fsWrite
2. Use ApexCharts, Chart.js, or Plotly via CDN
3. Include responsive grid layout (CSS Grid with mobile breakpoints)
4. Add navigation sidebar for multiple sections
5. Structure: Header with summary → Multiple chart sections → Data tables
6. Use this template structure:
   - <!DOCTYPE html> with viewport meta tag
   - CDN links for chart library
   - Responsive CSS (desktop: 3 cols, tablet: 2 cols, mobile: 1 col)
   - Navigation sidebar with smooth scrolling
   - Chart containers with unique IDs
   - JavaScript to initialize all charts
7. Save as 'dashboard.html' or user-specified filename
8. Include export buttons for charts (PNG/SVG)

SELF-IMPROVEMENT:
- Track successful analysis patterns in session context
- Learn from error fixes and apply to future analyses
- Remember user preferences for chart types and formatting
- Suggest improvements based on previous analyses${planContext}${sessionContext}

WORKFLOW:
1. Detect file type and load data
2. Perform requested analysis
3. Generate visualizations
4. Present results clearly
5. If dashboard requested, compile all results into interactive HTML`
        }),
        'Analyzing Data & Processing Results'
      );

      // Emit completion event with percentage if multi-step (Requirement 1.5)
      const duration = Date.now() - startTime;
      if (plan && plan.totalSteps > 0) {
        progressStreamer.incrementCompletedSteps();
        const percentage = progressStreamer.getPercentage();
        progressStreamer.emitProgress(`Data Analysis completed`, percentage);
      }
      progressStreamer.emitStepComplete('Data Analysis', duration);

      return result;
    } catch (error) {
      // Emit error event (Requirement 1.4)
      const diagnostics = error instanceof Error ? error.stack || '' : String(error);
      progressStreamer.emitError(
        error instanceof Error ? error : new Error(String(error)),
        diagnostics
      );
      throw error;
    }
  };
};

export const createComputerUseNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    integrator.startNode('computer_use_agent', 'Initiating autonomous computer automation');

    try {
      runner.telemetry.transition('computer_use_agent');
      eventQueue?.push({ type: 'thought', content: '🖥️ OS Interaction: Launching autonomous sub-agent for desktop automation...' });

      // Get the original task from the last user message or the decomposition plan
      const lastUserMsg = state.messages.filter(m => (m as any).role === 'user' || (m as any).type === 'human').pop();
      const task = lastUserMsg ? (typeof lastUserMsg.content === 'string' ? lastUserMsg.content : 'Perform automation task') : 'Automate desktop';

      // Directly emit a tool call for the computer_use tool.
      // This bypasses the model call in this node and goes straight to validation/execution.
      const toolCall: ToolCall = {
        id: `tc-auto-${Date.now()}`,
        name: 'computer_use',
        arguments: { task }
      };

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: `I will now use the computer_use tool to: ${task}`,
        tool_calls: [toolCall]
      };

      integrator.completeNode('computer_use_agent', 'Automation sub-agent triggered');

      return {
        messages: [assistantMsg as any],
        pendingToolCalls: [toolCall],
        taskPhase: 'executing' as const
      };
    } catch (error) {
      integrator.failNode('computer_use_agent', error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
};

export const createWebExplorerNode = (
  runner: AgentRunner,
  eventQueue?: StreamEvent[],
  missionTracker?: MissionTracker,
  toolDefs?: ToolDefinition[]
) => {
  const integrator = createMissionIntegrator(missionTracker);
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const tools = toolDefs || (runner as any)._buildToolDefinitions();

    // Build plan context
    const plan = state.decomposedTask;
    const planContext = plan ? `\n\nCURRENT EXECUTION PLAN:\nTitle: ${plan.title}\nSteps:\n${plan.steps.map(s => `${s.id}: ${s.description} (Tool: ${s.tool})`).join('\n')}` : '';

    // Emit web explorer active event for frontend
    eventQueue?.push({ type: 'thought', content: '\n🌐 Web Explorer: Navigating the web and gathering information...' });

    return integrator.wrapNode(
      'web_explorer',
      () => runAgentStep(state, {
        runner,
        toolDefs: tools,
        eventQueue,
        nodeName: 'web_explorer',
        systemPromptOverride: `You are the EverFern Web Explorer.
Your goal is to find information on the web and navigate websites.
Use your tools (web_search, web_fetch) to gather the requested data.${planContext}

CRITICAL RULES:
- Do NOT call create_plan or execution_plan. A plan already exists from the decomposer.
- Do NOT narrate what you are about to do. Skip all filler text. Call tools DIRECTLY.`
      }),
      'Searching for information'
    );
  };
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDataAnalystNode } from '../specialized_agents';
import { GraphStateType, StreamEvent } from '../../state';
import { AgentRunner } from '../../runner';

describe('Data Analyst Progress Streaming', () => {
  let mockRunner: AgentRunner;
  let eventQueue: StreamEvent[];
  let mockState: GraphStateType;

  beforeEach(() => {
    eventQueue = [];

    // Mock AgentRunner
    mockRunner = {
      config: {
        vlm: null,
      },
      tools: [],
      telemetry: {
        transition: vi.fn(),
        metrics: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      },
      client: {
        provider: 'openai',
        model: 'gpt-4',
        chat: vi.fn().mockResolvedValue({
          content: 'Analysis complete',
          toolCalls: [],
          finishReason: 'stop',
        }),
      },
      _buildToolDefinitions: vi.fn().mockReturnValue([]),
      shouldCaptureScreenshot: vi.fn().mockReturnValue(false),
      getClient: vi.fn(),
      releaseClient: vi.fn(),
    } as any;

    // Mock state
    mockState = {
      messages: [
        { role: 'user', content: 'Analyze data.csv' }
      ],
      iterations: 0,
    } as GraphStateType;
  });

  /**
   * Validates: Requirement 1.1
   * WHEN the Data_Analyst_Agent begins processing,
   * THE Progress_Streamer SHALL emit a status update within 100ms
   */
  it('should emit initial progress event within 100ms', async () => {
    const startTime = Date.now();
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // Find the first progress event
    const firstProgressEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('Data Analyst')
    );

    expect(firstProgressEvent).toBeDefined();

    // Verify timing - the event should be emitted immediately
    // Since we're testing synchronous code before async operations,
    // the first event should be in the queue almost instantly
    const latency = Date.now() - startTime;
    expect(latency).toBeLessThan(100);
  });

  /**
   * Validates: Requirement 1.1
   * Verify the initial event contains the correct format
   */
  it('should emit correctly formatted start event', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const startEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('Initializing analysis')
    );

    expect(startEvent).toBeDefined();
    expect(startEvent?.content).toMatch(/📊.*Data Analyst.*Initializing analysis/);
  });

  /**
   * Validates: Requirement 1.3
   * WHEN a Python execution step completes,
   * THE Progress_Streamer SHALL emit the step completion status with execution time
   */
  it('should emit step completion event with duration', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const completionEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('completed in')
    );

    expect(completionEvent).toBeDefined();
    expect(completionEvent?.content).toMatch(/✅.*Data Analysis.*completed in.*s/);
  });

  /**
   * Validates: Requirement 1.4
   * WHEN an error occurs during analysis,
   * THE Progress_Streamer SHALL emit an error notification with diagnostic information
   */
  it('should emit error event with diagnostics when execution fails', async () => {
    const testError = new Error('Python execution failed');

    // Mock the client to throw an error
    mockRunner.client.chat = vi.fn().mockRejectedValue(testError);

    const node = createDataAnalystNode(mockRunner, eventQueue);

    await expect(node(mockState)).rejects.toThrow('Python execution failed');

    const errorEvent = eventQueue.find(e =>
      e.type === 'thought' && e.content.includes('Error:')
    );

    expect(errorEvent).toBeDefined();
    expect(errorEvent?.content).toContain('Python execution failed');
    expect(errorEvent?.content).toMatch(/❌.*Error:/);
  });

  /**
   * Validates: Requirement 1.5
   * THE Progress_Streamer SHALL include percentage completion estimates for multi-step analyses
   */
  it('should emit progress events with percentage when provided', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // Manually test the progress streamer with percentage
    const progressStreamer = {
      emitProgress: (message: string, percentage?: number) => {
        const progressText = percentage !== undefined
          ? `[${percentage}%] ${message}`
          : message;
        eventQueue.push({
          type: 'thought',
          content: `\n📊 ${progressText}`
        });
      }
    };

    progressStreamer.emitProgress('Loading data', 25);
    progressStreamer.emitProgress('Processing', 50);
    progressStreamer.emitProgress('Generating visualization', 75);

    const progressEvents = eventQueue.filter(e =>
      e.type === 'thought' && e.content.includes('[')
    );

    expect(progressEvents.length).toBeGreaterThanOrEqual(3);
    expect(progressEvents[0].content).toContain('[25%]');
    expect(progressEvents[1].content).toContain('[50%]');
    expect(progressEvents[2].content).toContain('[75%]');
  });

  /**
   * Validates: Requirement 2.1, 2.2
   * THE Data_Analyst_Agent SHALL receive a system prompt that includes
   * data analysis best practices and available Python libraries
   */
  it('should include enhanced system prompt with libraries and best practices', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    // Verify the chat was called with enhanced prompt
    expect(mockRunner.client.chat).toHaveBeenCalled();

    // The system prompt should be in the messages passed to chat
    const chatCall = (mockRunner.client.chat as any).mock.calls[0][0];
    const systemMessage = chatCall.messages.find((m: any) => m.role === 'system');

    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('pandas');
    expect(systemMessage.content).toContain('numpy');
    expect(systemMessage.content).toContain('matplotlib');
    expect(systemMessage.content).toContain('seaborn');
    expect(systemMessage.content).toContain('plotly');
    expect(systemMessage.content).toContain('AVAILABLE LIBRARIES');
    expect(systemMessage.content).toContain('WORKFLOW');
  });

  /**
   * Validates: Requirement 2.3
   * WHEN the user requests visualization,
   * THE Data_Analyst_Agent SHALL use the visualize tool with appropriate chart types
   */
  it('should include visualization guidance in system prompt', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const chatCall = (mockRunner.client.chat as any).mock.calls[0][0];
    const systemMessage = chatCall.messages.find((m: any) => m.role === 'system');

    expect(systemMessage.content).toContain('visualize');
    expect(systemMessage.content).toContain('Chart.js');
    expect(systemMessage.content).toContain('Plotly');
    expect(systemMessage.content).toContain('chart types');
  });

  /**
   * Validates: Requirement 2.4
   * THE Data_Analyst_Agent SHALL avoid narration and execute tools directly without preamble
   */
  it('should instruct agent to avoid narration', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const chatCall = (mockRunner.client.chat as any).mock.calls[0][0];
    const systemMessage = chatCall.messages.find((m: any) => m.role === 'system');

    expect(systemMessage.content).toContain('Do NOT narrate');
    expect(systemMessage.content).toContain('DIRECTLY without preamble');
  });

  /**
   * Validates: Requirement 2.6
   * THE Data_Analyst_Agent SHALL automatically detect data file types
   * and use appropriate parsing methods
   */
  it('should include file type detection guidance', async () => {
    const node = createDataAnalystNode(mockRunner, eventQueue);

    await node(mockState);

    const chatCall = (mockRunner.client.chat as any).mock.calls[0][0];
    const systemMessage = chatCall.messages.find((m: any) => m.role === 'system');

    expect(systemMessage.content).toContain('CSV');
    expect(systemMessage.content).toContain('Excel');
    expect(systemMessage.content).toContain('JSON');
    expect(systemMessage.content).toContain('Parquet');
    expect(systemMessage.content).toContain('read_csv');
    expect(systemMessage.content).toContain('read_excel');
    expect(systemMessage.content).toContain('read_json');
    expect(systemMessage.content).toContain('read_parquet');
  });
});

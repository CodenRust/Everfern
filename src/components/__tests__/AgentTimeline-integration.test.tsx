import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentTimeline from '../AgentTimeline';
import type { SubAgentProgressEvent } from '@/app/chat/types';
import type { ToolCallDisplay } from '../AgentTimeline';

describe('AgentTimeline Integration Tests', () => {
  describe('Search Results Display', () => {
    it('should display search results with SearchResultCard components', async () => {
      const user = userEvent.setup();
      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'search-tool-1',
          toolName: 'remote_web_search',
          status: 'done',
          label: 'Web search',
          args: {
            query: 'React testing best practices'
          },
          data: {
            results: [
              {
                title: 'React Testing Library Documentation',
                url: 'https://testing-library.com/docs/react-testing-library/intro/',
                snippet: 'Simple and complete testing utilities that encourage good testing practices.',
                domain: 'testing-library.com',
                publishedDate: '2024-01-15'
              },
              {
                title: 'Jest Testing Framework',
                url: 'https://jestjs.io/docs/getting-started',
                snippet: 'Jest is a delightful JavaScript Testing Framework with a focus on simplicity.',
                domain: 'jestjs.io'
              }
            ]
          },
          output: 'Search completed successfully'
        }
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          isLive={false}
        />
      );

      // Check that the search tool is displayed
      expect(screen.getByText('Web search')).toBeInTheDocument();

      // The tool should auto-expand, but if not, click to expand
      const expandButton = screen.getByText('Web search');
      if (!screen.queryByText('React Testing Library Documentation')) {
        await user.click(expandButton);
      }

      // Check that search results are displayed
      expect(screen.getByText('React Testing Library Documentation')).toBeInTheDocument();
      expect(screen.getByText('Jest Testing Framework')).toBeInTheDocument();

      // Check that domains are displayed
      expect(screen.getByText('testing-library.com')).toBeInTheDocument();
      expect(screen.getByText('jestjs.io')).toBeInTheDocument();

      // Check that snippets are displayed
      expect(screen.getByText(/Simple and complete testing utilities/)).toBeInTheDocument();
      expect(screen.getByText(/Jest is a delightful JavaScript Testing Framework/)).toBeInTheDocument();

      // Check that result count is displayed
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    it('should display query pills for search tools', async () => {
      const user = userEvent.setup();
      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'search-tool-2',
          toolName: 'remote_web_search',
          status: 'done',
          label: 'Web search',
          args: {
            queries: ['React hooks', 'useState examples']
          },
          output: 'Search completed'
        }
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          isLive={false}
        />
      );

      // The tool should auto-expand, but if not, click to expand
      const expandButton = screen.getByText('Web search');
      if (!screen.queryByText('Querying')) {
        await user.click(expandButton);
      }

      // Check that query pills are displayed
      expect(screen.getByText('Querying')).toBeInTheDocument();
      expect(screen.getByText('React hooks')).toBeInTheDocument();
      expect(screen.getByText('useState examples')).toBeInTheDocument();
    });
  });

  describe('Single Sub-Agent Progress Display', () => {
    it('should display complete progress flow for a single sub-agent execution', () => {
      // Create a complete sequence of progress events for a single sub-agent
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 3,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:01.000Z').toISOString(),
          content: 'I need to analyze the screen to find the target element',
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:02.000Z').toISOString(),
          action: {
            type: 'left_click',
            params: { coordinate: [100, 200] },
            description: 'Click at (100, 200)',
          },
        },
        {
          type: 'screenshot',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:03.000Z').toISOString(),
          screenshot: {
            base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            width: 1920,
            height: 1080,
          },
        },
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:04.000Z').toISOString(),
          stepNumber: 2,
          totalSteps: 3,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:05.000Z').toISOString(),
          content: 'Now I need to type the search query',
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:06.000Z').toISOString(),
          action: {
            type: 'type',
            params: { text: 'Hello World' },
            description: 'Type "Hello World"',
          },
        },
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:07.000Z').toISOString(),
          stepNumber: 3,
          totalSteps: 3,
        },
        {
          type: 'complete',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:08.000Z').toISOString(),
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'done',
          durationMs: 8000,
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify all step indicators are present
      expect(screen.getByText(/STEP 1\/3/i)).toBeInTheDocument();
      expect(screen.getByText(/STEP 2\/3/i)).toBeInTheDocument();
      expect(screen.getByText(/STEP 3\/3/i)).toBeInTheDocument();

      // Verify reasoning content is displayed
      expect(screen.getByText(/I need to analyze the screen to find the target element/i)).toBeInTheDocument();
      expect(screen.getByText(/Now I need to type the search query/i)).toBeInTheDocument();

      // Verify actions are displayed
      expect(screen.getByText(/Action: Click at \(100, 200\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Type "Hello World"/i)).toBeInTheDocument();

      // Verify screenshot is present
      expect(screen.getByText(/Screenshot \(1920x1080\)/i)).toBeInTheDocument();

      // Verify completion indicator
      expect(screen.getByText(/Sub-agent completed/i)).toBeInTheDocument();

      // Verify tool call is displayed
      expect(screen.getByText(/Computer use/i)).toBeInTheDocument();
    });

    it('should display progress for running sub-agent with live indicators', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          stepNumber: 5,
          totalSteps: 40,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          content: 'Currently analyzing the screen', // Non-empty content to avoid SVG animation issues in jsdom
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      const { container } = render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify step indicator shows current step
      expect(screen.getByText(/STEP 5\/40/i)).toBeInTheDocument();

      // Verify reasoning content is displayed
      expect(screen.getByText(/Currently analyzing the screen/i)).toBeInTheDocument();

      // Verify pulsing animation elements are present (checking for animated dots)
      const dots = container.querySelectorAll('[style*="border-radius: 50%"]');
      expect(dots.length).toBeGreaterThan(0);
    });

    it('should display all action types with correct icons', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          action: {
            type: 'left_click',
            params: { coordinate: [100, 200] },
            description: 'Left click',
          },
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          action: {
            type: 'type',
            params: { text: 'test' },
            description: 'Type text',
          },
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          action: {
            type: 'scroll_down',
            params: { amount: 100 },
            description: 'Scroll down',
          },
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          action: {
            type: 'wait',
            params: { duration: 1000 },
            description: 'Wait 1 second',
          },
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'done',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify all action types are displayed with correct icons
      expect(screen.getByText('🖱️')).toBeInTheDocument(); // Mouse action
      expect(screen.getByText('⌨️')).toBeInTheDocument(); // Keyboard action
      expect(screen.getByText('📜')).toBeInTheDocument(); // Scroll action
      expect(screen.getByText('⏱️')).toBeInTheDocument(); // Wait action

      // Verify action descriptions
      expect(screen.getByText(/Action: Left click/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Type text/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Scroll down/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Wait 1 second/i)).toBeInTheDocument();
    });
  });

  describe('Multiple Concurrent Sub-Agents Progress Display', () => {
    it('should display progress for multiple concurrent sub-agents separately', () => {
      // Create progress events for two concurrent sub-agents
      const subAgent1Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 2,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:01.000Z').toISOString(),
          content: 'Sub-agent 1 is analyzing the first task',
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:02.000Z').toISOString(),
          action: {
            type: 'left_click',
            params: { coordinate: [100, 100] },
            description: 'Click button A',
          },
        },
      ];

      const subAgent2Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:00.500Z').toISOString(),
          stepNumber: 1,
          totalSteps: 3,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:01.500Z').toISOString(),
          content: 'Sub-agent 2 is working on the second task',
        },
        {
          type: 'action',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:02.500Z').toISOString(),
          action: {
            type: 'type',
            params: { text: 'Search query' },
            description: 'Type search query',
          },
        },
      ];

      const subAgentProgress = new Map([
        ['tool-1', subAgent1Events],
        ['tool-2', subAgent2Events],
      ]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
        {
          id: 'tool-2',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify both sub-agents' step indicators are present
      expect(screen.getByText(/STEP 1\/2/i)).toBeInTheDocument();
      expect(screen.getByText(/STEP 1\/3/i)).toBeInTheDocument();

      // Verify both sub-agents' reasoning is displayed
      expect(screen.getByText(/Sub-agent 1 is analyzing the first task/i)).toBeInTheDocument();
      expect(screen.getByText(/Sub-agent 2 is working on the second task/i)).toBeInTheDocument();

      // Verify both sub-agents' actions are displayed
      expect(screen.getByText(/Action: Click button A/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Type search query/i)).toBeInTheDocument();

      // Verify both tool calls are displayed
      const computerUseElements = screen.getAllByText(/Computer use/i);
      expect(computerUseElements.length).toBe(2);
    });

    it('should group events by toolCallId correctly', () => {
      // Create interleaved events from two sub-agents
      const subAgent1Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 2,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:02.000Z').toISOString(),
          content: 'First sub-agent reasoning',
        },
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:04.000Z').toISOString(),
          stepNumber: 2,
          totalSteps: 2,
        },
      ];

      const subAgent2Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:01.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 2,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:03.000Z').toISOString(),
          content: 'Second sub-agent reasoning',
        },
        {
          type: 'step',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:05.000Z').toISOString(),
          stepNumber: 2,
          totalSteps: 2,
        },
      ];

      const subAgentProgress = new Map([
        ['tool-1', subAgent1Events],
        ['tool-2', subAgent2Events],
      ]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'done',
        },
        {
          id: 'tool-2',
          toolName: 'computer_use',
          status: 'done',
        },
      ];

      const { container } = render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify events are grouped by toolCallId (each sub-agent's events appear together)
      expect(screen.getByText(/First sub-agent reasoning/i)).toBeInTheDocument();
      expect(screen.getByText(/Second sub-agent reasoning/i)).toBeInTheDocument();

      // Verify both sub-agents show step 1 and step 2
      const stepIndicators = container.textContent;
      expect(stepIndicators).toContain('STEP 1/2');
      expect(stepIndicators).toContain('STEP 2/2');
    });

    it('should handle different completion states for concurrent sub-agents', () => {
      const subAgent1Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 1,
        },
        {
          type: 'complete',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
        },
      ];

      const subAgent2Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-2',
          timestamp: new Date().toISOString(),
          stepNumber: 2,
          totalSteps: 5,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-2',
          timestamp: new Date().toISOString(),
          content: 'Working on the next step', // Non-empty content to avoid SVG animation issues
        },
      ];

      const subAgentProgress = new Map([
        ['tool-1', subAgent1Events],
        ['tool-2', subAgent2Events],
      ]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'done',
        },
        {
          id: 'tool-2',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify first sub-agent shows completion
      expect(screen.getByText(/Sub-agent completed/i)).toBeInTheDocument();

      // Verify second sub-agent shows active progress
      expect(screen.getByText(/STEP 2\/5/i)).toBeInTheDocument();
      expect(screen.getByText(/Working on the next step/i)).toBeInTheDocument();
    });

    it('should display progress for many concurrent sub-agents', () => {
      // Create 5 concurrent sub-agents
      const subAgentProgress = new Map<string, SubAgentProgressEvent[]>();
      const toolCalls: ToolCallDisplay[] = [];

      for (let i = 1; i <= 5; i++) {
        const toolId = `tool-${i}`;
        const events: SubAgentProgressEvent[] = [
          {
            type: 'step',
            toolCallId: toolId,
            timestamp: new Date().toISOString(),
            stepNumber: i,
            totalSteps: 10,
          },
          {
            type: 'reasoning',
            toolCallId: toolId,
            timestamp: new Date().toISOString(),
            content: `Sub-agent ${i} is processing task ${i}`,
          },
        ];

        subAgentProgress.set(toolId, events);
        toolCalls.push({
          id: toolId,
          toolName: 'computer_use',
          status: 'running',
        });
      }

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify all 5 sub-agents are displayed
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(new RegExp(`STEP ${i}/10`, 'i'))).toBeInTheDocument();
        expect(screen.getByText(new RegExp(`Sub-agent ${i} is processing task ${i}`, 'i'))).toBeInTheDocument();
      }

      // Verify all tool calls are displayed
      const computerUseElements = screen.getAllByText(/Computer use/i);
      expect(computerUseElements.length).toBe(5);
    });
  });

  describe('Abort Indicator', () => {
    it('should display abort indicator when sub-agent is aborted', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 10,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:01.000Z').toISOString(),
          content: 'Starting to process the task',
        },
        {
          type: 'abort',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:02.000Z').toISOString(),
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'error',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify abort indicator is displayed
      expect(screen.getByText(/Aborted by user/i)).toBeInTheDocument();

      // Verify the abort symbol is present
      expect(screen.getByText(/⊗/)).toBeInTheDocument();

      // Verify previous progress is still visible
      expect(screen.getByText(/STEP 1\/10/i)).toBeInTheDocument();
      expect(screen.getByText(/Starting to process the task/i)).toBeInTheDocument();
    });

    it('should display abort indicator for one sub-agent while others continue', () => {
      const subAgent1Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 1,
          totalSteps: 5,
        },
        {
          type: 'abort',
          toolCallId: 'tool-1',
          timestamp: new Date('2024-01-15T10:00:01.000Z').toISOString(),
        },
      ];

      const subAgent2Events: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:00.000Z').toISOString(),
          stepNumber: 3,
          totalSteps: 5,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:02.000Z').toISOString(),
          content: 'Continuing to work on the task',
        },
        {
          type: 'complete',
          toolCallId: 'tool-2',
          timestamp: new Date('2024-01-15T10:00:03.000Z').toISOString(),
        },
      ];

      const subAgentProgress = new Map([
        ['tool-1', subAgent1Events],
        ['tool-2', subAgent2Events],
      ]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'error',
        },
        {
          id: 'tool-2',
          toolName: 'computer_use',
          status: 'done',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify first sub-agent shows abort
      expect(screen.getByText(/Aborted by user/i)).toBeInTheDocument();

      // Verify second sub-agent shows completion
      expect(screen.getByText(/Sub-agent completed/i)).toBeInTheDocument();
      expect(screen.getByText(/Continuing to work on the task/i)).toBeInTheDocument();
    });

    it('should display abort indicator with correct styling', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'abort',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'error',
        },
      ];

      const { container } = render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify abort message is displayed
      const abortMessage = screen.getByText(/Aborted by user/i);
      expect(abortMessage).toBeInTheDocument();

      // Verify the abort indicator has error styling (red color)
      const abortElement = abortMessage.closest('span');
      expect(abortElement).toHaveStyle({ color: '#ef4444' });
    });
  });

  describe('Visual Nesting and Layout', () => {
    it('should apply visual nesting styles to sub-agent progress', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 1,
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      const { container } = render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify sub-agent progress is rendered with visual nesting
      expect(screen.getByText(/STEP 1\/1/i)).toBeInTheDocument();

      // Check for nested container with proper styling (indented, background, border)
      const nestedContainers = container.querySelectorAll('[style*="margin-left: 20px"]');
      expect(nestedContainers.length).toBeGreaterThan(0);

      // Verify background color is applied
      const styledContainers = container.querySelectorAll('[style*="background-color"]');
      expect(styledContainers.length).toBeGreaterThan(0);
    });

    it('should maintain proper timeline structure with mixed content', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 2,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          content: 'Analyzing the situation',
        },
        {
          type: 'action',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          action: {
            type: 'left_click',
            params: {},
            description: 'Click button',
          },
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
          thought="I need to use the computer to complete this task"
        />
      );

      // Verify all elements are present in the timeline
      expect(screen.getByText(/I need to use the computer to complete this task/i)).toBeInTheDocument();
      expect(screen.getByText(/Computer use/i)).toBeInTheDocument();
      expect(screen.getByText(/STEP 1\/2/i)).toBeInTheDocument();
      expect(screen.getByText(/Analyzing the situation/i)).toBeInTheDocument();
      expect(screen.getByText(/Action: Click button/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty progress events gracefully', () => {
      const subAgentProgress = new Map([['tool-1', []]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify tool call is displayed even without progress events
      expect(screen.getByText(/Computer use/i)).toBeInTheDocument();
    });

    it('should handle tool calls without progress events', () => {
      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'done',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={new Map()}
        />
      );

      // Verify tool call is displayed
      expect(screen.getByText(/Computer use/i)).toBeInTheDocument();
    });

    it('should handle progress events with missing optional fields', () => {
      const progressEvents: SubAgentProgressEvent[] = [
        {
          type: 'step',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          stepNumber: 1,
          totalSteps: 1,
        },
        {
          type: 'reasoning',
          toolCallId: 'tool-1',
          timestamp: new Date().toISOString(),
          content: 'Reasoning without metadata',
        },
      ];

      const subAgentProgress = new Map([['tool-1', progressEvents]]);

      const toolCalls: ToolCallDisplay[] = [
        {
          id: 'tool-1',
          toolName: 'computer_use',
          status: 'running',
        },
      ];

      render(
        <AgentTimeline
          toolCalls={toolCalls}
          subAgentProgress={subAgentProgress}
        />
      );

      // Verify events are displayed correctly
      expect(screen.getByText(/STEP 1\/1/i)).toBeInTheDocument();
      expect(screen.getByText(/Reasoning without metadata/i)).toBeInTheDocument();
    });
  });
});

/**
 * Unit tests for PythonExecutor
 * Tests error parsing, timeout handling, and execution flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PythonExecutor } from '../python-executor';
import { CommandRegistry } from '../terminal/registry';

// Mock CommandRegistry
vi.mock('../terminal/registry', () => {
  const mockExecute = vi.fn();
  const mockTerminate = vi.fn();

  return {
    CommandRegistry: {
      getInstance: vi.fn(() => ({
        execute: mockExecute,
        terminate: mockTerminate
      }))
    }
  };
});

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn()
}));

describe('PythonExecutor', () => {
  let executor: PythonExecutor;
  let mockRegistry: any;

  beforeEach(() => {
    executor = new PythonExecutor();
    mockRegistry = CommandRegistry.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('execute()', () => {
    it('should execute Python code successfully', async () => {
      // Mock successful execution with slight delay
      mockRegistry.execute.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'python_123',
              command: 'python -c "print(42)"',
              cwd: '/home/user',
              status: 'completed',
              output: '42\n',
              exitCode: 0,
              startTime: Date.now()
            });
          }, 10);
        });
      });

      const result = await executor.execute('print(42)');

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('42');
      expect(result.error).toBeUndefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle syntax errors with line numbers', async () => {
      const syntaxErrorOutput = `  File "<string>", line 2
    print("missing closing quote)
                                ^
SyntaxError: unterminated string literal (detected at line 2)`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'failed',
        output: syntaxErrorOutput,
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute('print("missing closing quote)');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('syntax');
      expect(result.error?.line).toBe(2);
      expect(result.error?.traceback).toContain('SyntaxError');
    });

    it('should handle runtime errors', async () => {
      const runtimeErrorOutput = `Traceback (most recent call last):
  File "<string>", line 1, in <module>
ZeroDivisionError: division by zero`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "1/0"',
        cwd: '/home/user',
        status: 'failed',
        output: runtimeErrorOutput,
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute('1/0');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('runtime');
      expect(result.error?.message).toContain('division by zero');
      expect(result.error?.traceback).toContain('ZeroDivisionError');
    });

    it('should detect library missing errors', async () => {
      const libraryErrorOutput = `Traceback (most recent call last):
  File "<string>", line 1, in <module>
ModuleNotFoundError: No module named 'pandas'`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "import pandas"',
        cwd: '/home/user',
        status: 'failed',
        output: libraryErrorOutput,
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute('import pandas');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('library_missing');
      expect(result.error?.message).toContain('pandas');
      expect(result.error?.traceback).toContain('ModuleNotFoundError');
    });

    it('should handle timeout by terminating process', async () => {
      // Mock long-running execution
      mockRegistry.execute.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'python_123',
              command: 'python -c "..."',
              cwd: '/home/user',
              status: 'completed',
              output: 'Done',
              exitCode: 0,
              startTime: Date.now()
            });
          }, 5000); // 5 seconds
        });
      });

      const result = await executor.execute('import time; time.sleep(10)', 100); // 100ms timeout

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('timeout');
      expect(result.error?.message).toContain('exceeded timeout');
      expect(mockRegistry.terminate).toHaveBeenCalled();
    });

    it('should extract line numbers from tracebacks', async () => {
      const errorWithLine = `Traceback (most recent call last):
  File "<string>", line 5, in <module>
NameError: name 'undefined_var' is not defined`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'failed',
        output: errorWithLine,
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute('undefined_var');

      expect(result.success).toBe(false);
      expect(result.error?.line).toBe(5);
      expect(result.error?.type).toBe('runtime');
    });
  });

  describe('executeWithProgress()', () => {
    it('should emit progress updates during execution', async () => {
      vi.useFakeTimers();

      const progressMessages: string[] = [];
      const onProgress = (msg: string) => progressMessages.push(msg);

      // Mock execution that takes 5 seconds
      mockRegistry.execute.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'python_123',
              command: 'python -c "..."',
              cwd: '/home/user',
              status: 'completed',
              output: 'Done',
              exitCode: 0,
              startTime: Date.now()
            });
          }, 5000);
        });
      });

      const resultPromise = executor.executeWithProgress('print(42)', onProgress);

      // Fast-forward time to trigger progress updates
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages[0]).toContain('Starting Python execution');
      expect(result.success).toBe(true);

      vi.useRealTimers();
    });

    it('should emit completion message on success', async () => {
      const progressMessages: string[] = [];
      const onProgress = (msg: string) => progressMessages.push(msg);

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "print(42)"',
        cwd: '/home/user',
        status: 'completed',
        output: '42\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.executeWithProgress('print(42)', onProgress);

      expect(result.success).toBe(true);
      expect(progressMessages.some(msg => msg.includes('completed'))).toBe(true);
    });

    it('should emit error message on failure', async () => {
      const progressMessages: string[] = [];
      const onProgress = (msg: string) => progressMessages.push(msg);

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "1/0"',
        cwd: '/home/user',
        status: 'failed',
        output: 'ZeroDivisionError: division by zero',
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.executeWithProgress('1/0', onProgress);

      expect(result.success).toBe(false);
      expect(progressMessages.some(msg => msg.includes('failed'))).toBe(true);
    });
  });

  describe('Error Categorization', () => {
    it('should categorize ImportError as library_missing', async () => {
      const importErrorOutput = `Traceback (most recent call last):
  File "<string>", line 1, in <module>
ImportError: No module named 'numpy'`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "import numpy"',
        cwd: '/home/user',
        status: 'failed',
        output: importErrorOutput,
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute('import numpy');

      expect(result.error?.type).toBe('library_missing');
      expect(result.error?.message).toContain('numpy');
    });

    it('should categorize various runtime errors correctly', async () => {
      const testCases = [
        {
          output: 'KeyError: "column_name"',
          expectedMessage: 'column_name'
        },
        {
          output: 'ValueError: invalid literal for int()',
          expectedMessage: 'Invalid value'
        },
        {
          output: 'TypeError: unsupported operand type(s)',
          expectedMessage: 'Type mismatch'
        }
      ];

      for (const testCase of testCases) {
        mockRegistry.execute.mockResolvedValue({
          id: 'python_123',
          command: 'python -c "..."',
          cwd: '/home/user',
          status: 'failed',
          output: testCase.output,
          exitCode: 1,
          startTime: Date.now()
        });

        const result = await executor.execute('test code');

        expect(result.error?.type).toBe('runtime');
        expect(result.error?.message).toContain(testCase.expectedMessage);
      }
    });
  });

  describe('Plot Detection and Capture', () => {
    it('should detect plt.savefig() calls', async () => {
      const codeWithPlot = `
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.savefig('test.png')
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'completed',
        output: '__KIRO_PLOT_PATHS__:/tmp/kiro-plots/plot_123_0_test.png\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithPlot);

      expect(result.success).toBe(true);
      expect(result.plotPaths).toBeDefined();
      expect(result.plotPaths?.length).toBeGreaterThan(0);
    });

    it('should detect fig.savefig() calls', async () => {
      const codeWithFigure = `
import matplotlib.pyplot as plt
fig, ax = plt.subplots()
ax.plot([1, 2, 3])
fig.savefig('figure.png')
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'completed',
        output: '__KIRO_PLOT_PATHS__:/tmp/kiro-plots/plot_123_0_figure.png\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithFigure);

      expect(result.success).toBe(true);
      expect(result.plotPaths).toBeDefined();
      expect(result.plotPaths?.length).toBeGreaterThan(0);
    });

    it('should capture multiple plot paths', async () => {
      const codeWithMultiplePlots = `
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.savefig('plot1.png')
plt.clf()
plt.plot([4, 5, 6])
plt.savefig('plot2.png')
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'completed',
        output: '__KIRO_PLOT_PATHS__:/tmp/kiro-plots/plot_123_0_plot1.png|/tmp/kiro-plots/plot_123_1_plot2.png\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithMultiplePlots);

      expect(result.success).toBe(true);
      expect(result.plotPaths).toBeDefined();
      expect(result.plotPaths?.length).toBe(2);
      expect(result.plotPaths?.[0]).toContain('plot1.png');
      expect(result.plotPaths?.[1]).toContain('plot2.png');
    });

    it('should not inject plot capture for code without savefig', async () => {
      const codeWithoutPlot = `
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.show()
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'completed',
        output: 'Plot displayed\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithoutPlot);

      expect(result.success).toBe(true);
      expect(result.plotPaths).toBeUndefined();
    });

    it('should clean plot markers from stdout', async () => {
      const codeWithPlot = `
import matplotlib.pyplot as plt
print("Creating plot...")
plt.plot([1, 2, 3])
plt.savefig('test.png')
print("Plot saved!")
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'completed',
        output: 'Creating plot...\n__KIRO_PLOT_PATHS__:/tmp/kiro-plots/plot_123_0_test.png\nPlot saved!\n',
        exitCode: 0,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithPlot);

      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain('__KIRO_PLOT_PATHS__');
      expect(result.stdout).toContain('Creating plot...');
      expect(result.stdout).toContain('Plot saved!');
    });

    it('should return plot paths even on execution failure', async () => {
      const codeWithPlotAndError = `
import matplotlib.pyplot as plt
plt.plot([1, 2, 3])
plt.savefig('test.png')
raise ValueError("Test error")
`;

      mockRegistry.execute.mockResolvedValue({
        id: 'python_123',
        command: 'python -c "..."',
        cwd: '/home/user',
        status: 'failed',
        output: '__KIRO_PLOT_PATHS__:/tmp/kiro-plots/plot_123_0_test.png\nValueError: Test error',
        exitCode: 1,
        startTime: Date.now()
      });

      const result = await executor.execute(codeWithPlotAndError);

      expect(result.success).toBe(false);
      expect(result.plotPaths).toBeDefined();
      expect(result.plotPaths?.length).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });
  });
});

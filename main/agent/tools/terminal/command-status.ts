import type { AgentTool, ToolResult } from '../../runner/types';
import { CommandRegistry } from './registry';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

// Track last read positions for each command to show only new output
const lastReadPositions = new Map<string, number>();

export const commandStatusTool: AgentTool = {
  name: 'command_status',
  description: `Get the status of a previously executed terminal command by its ID. Returns the current status (running, done), NEW output since last check, and any error if present. Useful for monitoring long-running commands.`,
  parameters: {
    type: 'object',
    properties: {
      CommandId: {
        type: 'string',
        description: 'ID of the command to get status for',
      },
      OutputCharacterCount: {
        type: 'number',
        description: 'Maximum number of characters to return. Defaults to 4000.',
      },
      WaitDurationSeconds: {
        type: 'number',
        description: 'Number of seconds to wait for new output before returning status.',
      },
      ShowFullOutput: {
        type: 'boolean',
        description: 'If true, shows full output instead of just new output since last check.',
      },
    },
    required: ['CommandId', 'WaitDurationSeconds'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const id = String(args.CommandId || '');
      const waitSec = Number(args.WaitDurationSeconds || 0);
      const chars = Number(args.OutputCharacterCount || 4000);
      const showFull = Boolean(args.ShowFullOutput || false);

      const registry = CommandRegistry.getInstance();
      const record = registry.getCommand(id);

      if (!record) {
        // Clean up tracking for non-existent command
        lastReadPositions.delete(id);
        return { success: false, output: `Command ${id} not found or expired.` };
      }

      const initialBufferLength = record.outputBuffer.length;
      const lastReadPos = lastReadPositions.get(id) || 0;

      // Wait for new output or completion
      const waitMs = waitSec * 1000;
      let elapsedTime = 0;
      const pollInterval = 200;
      let hasNewOutput = false;

      console.log(`[CommandStatus] Checking ${id}, waiting ${waitSec}s, last read pos: ${lastReadPos}, current buffer: ${initialBufferLength}`);

      while (elapsedTime < waitMs) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsedTime += pollInterval;

        const currentLength = record.outputBuffer.length;

        // Check if we have new output or if command completed
        if (currentLength > lastReadPos || record.status === 'done') {
          hasNewOutput = true;
          // Wait a bit more to collect any additional output
          if (elapsedTime < waitMs / 2) {
            await new Promise((r) => setTimeout(r, Math.min(500, waitMs - elapsedTime)));
          }
          break;
        }
      }

      const statusStr = record.status === 'running' ? 'RUNNING' : 'DONE';
      const currentBufferLength = record.outputBuffer.length;

      let outputToShow: string;
      let outputDescription: string;

      if (showFull) {
        // Show full output
        outputToShow = stripAnsi(record.outputBuffer);
        outputDescription = "Full command output";
        // Update read position to current end
        lastReadPositions.set(id, currentBufferLength);
      } else {
        // Show only new output since last check
        const newOutput = record.outputBuffer.slice(lastReadPos);
        outputToShow = stripAnsi(newOutput);
        outputDescription = hasNewOutput ? "New output since last check" : "No new output";
        // Update read position to current end
        lastReadPositions.set(id, currentBufferLength);
      }

      // Truncate if too long
      if (outputToShow.length > chars) {
        const truncated = outputToShow.slice(-chars);
        outputToShow = `[...truncated to last ${chars} chars...]\n${truncated}`;
      }

      const exitMsg = record.status === 'done' ? `\nExit code: ${record.exitCode ?? 'Unknown'}` : '';
      const outputStats = `\nBuffer size: ${currentBufferLength} chars, New: ${currentBufferLength - lastReadPos} chars`;

      // Clean up tracking if command is done
      if (record.status === 'done') {
        lastReadPositions.delete(id);
      }

      return {
        success: true,
        output: `Status: ${statusStr}${outputStats}\n${outputDescription}:\n${outputToShow.trim() || '(No output)'}${exitMsg}`
      };
    } catch (err: any) {
      const msg = err.message ?? String(err);
      return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
    }
  },
};

import type { AgentTool, ToolResult } from '../../runner/types';
import { CommandRegistry } from './registry';

// Strips ANSI for clean output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

export const runCommandTool: AgentTool = {
  name: 'run_command',
  description: `PROPOSE a command to run on behalf of the user. Operating System: windows. Shell: pwsh.
**NEVER PROPOSE A cd COMMAND**.
If the command completes before WaitMsBeforeAsync, its full output is returned.
If the command remains running, this tool returns a CommandId which you MUST use with command_status to monitor its output.`,
  parameters: {
    type: 'object',
    properties: {
      CommandLine: {
        type: 'string',
        description: 'The exact command line string to execute.',
      },
      Cwd: {
        type: 'string',
        description: 'The current working directory for the command',
      },
      SafeToAutoRun: {
        type: 'boolean',
        description: 'Set to true if safe to run WITHOUT approval. (Unused locally but required by schema)',
      },
      WaitMsBeforeAsync: {
        type: 'number',
        description: 'Time to wait (ms) before pushing to background. Range: 500-10000ms.',
      },
    },
    required: ['CommandLine', 'Cwd', 'WaitMsBeforeAsync', 'SafeToAutoRun'],
  },
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    try {
      const commandLine = String(args.CommandLine || '');
      const cwd = String(args.Cwd || '');
      const waitMs = Math.max(500, Math.min(10000, Number(args.WaitMsBeforeAsync || 2000)));

      const registry = CommandRegistry.getInstance();
      
      // Use the singleton persistent terminal
      const id = CommandRegistry.PERSISTENT_ID;
      const existing = registry.getCommand(id);
      
      const beforeBufferLength = existing?.outputBuffer.length || 0;

      // Start or get the terminal
      registry.spawnCommand('', cwd, true);
      
      // If we have a command to run, pipe it in
      if (commandLine) {
        // Append a newline to execute
        registry.writeInput(id, commandLine + '\n');
      }

      // Wait for output to accumulate or timeout
      let elapsedTime = 0;
      const pollInterval = 200;
      let lastBufferLength = beforeBufferLength;
      
      while (elapsedTime < waitMs) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsedTime += pollInterval;
        
        const currentBuffer = registry.getCommand(id)?.outputBuffer || '';
        if (currentBuffer.length > lastBufferLength) {
          // If output is still streaming, wait a bit more (but respect waitMs)
          lastBufferLength = currentBuffer.length;
          // If the last line looks like a prompt, we might be done early
          const lastLines = currentBuffer.split('\n').slice(-3).join('\n');
          if (lastLines.includes('> ') || lastLines.includes('$ ')) {
             // Heuristic: common prompt indicators
             break;
          }
        }
      }

      const record = registry.getCommand(id);
      if (!record) {
        return { success: false, output: 'Persistent terminal failed to initialize.' };
      }

      // Return the new output since the last call or start
      const newOutput = record.outputBuffer.slice(beforeBufferLength);
      const out = stripAnsi(newOutput).trim() || '(No new output yet)';
      
      return { 
        success: true, 
        output: `[Main Terminal] Session: ${id}\n\n${out}\n\n(Terminal session remains active. You can run more commands in this session.)` 
      };
    } catch (err: any) {
      const msg = err.message ?? String(err);
      return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
    }
  },
};

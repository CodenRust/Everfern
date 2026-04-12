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
      let noChangeCount = 0;
      let lastBufferLength = beforeBufferLength;
      
      // Use WaitMsBeforeAsync as the minimum wait time
      const maxWait = Math.max(waitMs, 30000); 
      
      while (elapsedTime < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval));
        elapsedTime += pollInterval;
        
        const currentBuffer = registry.getCommand(id)?.outputBuffer || '';
        const currentLength = currentBuffer.length;
        
        // Check if we see a prompt (command completed)
        const lastLines = currentBuffer.split('\n').slice(-3).join('\n');
        const hasPrompt = lastLines.includes('> ') || lastLines.includes('$ ') || lastLines.includes('PS ');
        
        // If output hasn't changed AND we see a prompt, command is complete
        if (currentLength === lastBufferLength && hasPrompt) {
          noChangeCount++;
          // Wait for 3 consecutive polls (600ms) with no change AND a prompt before declaring complete
          if (noChangeCount >= 3) {
            console.log('[RunCommand] Output stabilized with prompt detected, command complete');
            break;
          }
        } else if (currentLength > lastBufferLength) {
          // Output is still coming, reset counter
          noChangeCount = 0;
        } else {
          // No change but no prompt yet, increment counter
          noChangeCount++;
        }
        
        // Only break early if we've waited at least the minimum time AND output is stable
        if (elapsedTime >= waitMs && noChangeCount >= 3 && hasPrompt) {
          console.log('[RunCommand] Minimum wait time reached and output stable, returning');
          break;
        }
        
        lastBufferLength = currentLength;
      }

      const record = registry.getCommand(id);
      if (!record) {
        return { success: false, output: 'Persistent terminal failed to initialize.' };
      }

      // Return the new output since the last call or start
      const newOutput = record.outputBuffer.slice(beforeBufferLength);
      const out = stripAnsi(newOutput).trim();
      
      console.log('[RunCommand] Returning output, length:', out.length, 'elapsed:', elapsedTime, 'ms');
      
      // CRITICAL: Always return output to AI, even if empty
      if (!out) {
        return { 
          success: true, 
          output: `[Command Executed]\nCommand: ${commandLine}\nOutput: (No output captured - command may still be running. Use command_status to check for output.)\n\n(Terminal session remains active. You can run more commands in this session.)` 
        };
      }
      
      return { 
        success: true, 
        output: `[Command Executed]\nCommand: ${commandLine}\n\n${out}\n\n(Terminal session remains active. You can run more commands in this session.)` 
      };
    } catch (err: any) {
      const msg = err.message ?? String(err);
      return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
    }
  },
};

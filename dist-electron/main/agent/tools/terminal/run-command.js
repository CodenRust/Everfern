"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommandTool = void 0;
const registry_1 = require("./registry");
// Strips ANSI for clean output
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}
exports.runCommandTool = {
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
    execute: async (args) => {
        try {
            const commandLine = String(args.CommandLine || '');
            const cwd = String(args.Cwd || '');
            const waitMs = Math.max(500, Math.min(10000, Number(args.WaitMsBeforeAsync || 2000)));
            const registry = registry_1.CommandRegistry.getInstance();
            // Use the singleton persistent terminal
            const id = registry_1.CommandRegistry.PERSISTENT_ID;
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
            const pollInterval = 100; // Reduced from 200ms for more responsive polling
            let noChangeCount = 0;
            let lastBufferLength = beforeBufferLength;
            let lastSignificantChange = 0;
            // Use WaitMsBeforeAsync as the minimum wait time, but allow longer for slow commands
            const minWait = waitMs;
            const maxWait = Math.max(waitMs * 3, 60000); // Allow up to 60 seconds for very slow commands
            console.log(`[RunCommand] Starting command: "${commandLine}", minWait: ${minWait}ms, maxWait: ${maxWait}ms`);
            while (elapsedTime < maxWait) {
                await new Promise((r) => setTimeout(r, pollInterval));
                elapsedTime += pollInterval;
                const currentBuffer = registry.getCommand(id)?.outputBuffer || '';
                const currentLength = currentBuffer.length;
                // Check if we see a prompt (command completed)
                const lastLines = currentBuffer.split('\n').slice(-5).join('\n'); // Check more lines
                const hasPrompt = /(?:^|\n)(?:PS\s+[^>]*>|C:\\[^>]*>|\$\s|\w+@\w+.*\$)\s*$/m.test(lastLines);
                // Track when we last saw significant output change
                if (currentLength > lastBufferLength + 10) { // More than 10 chars = significant
                    lastSignificantChange = elapsedTime;
                    noChangeCount = 0;
                    console.log(`[RunCommand] Output growing: ${currentLength} chars (+${currentLength - lastBufferLength})`);
                }
                else if (currentLength === lastBufferLength) {
                    noChangeCount++;
                }
                else {
                    noChangeCount = 0; // Small changes reset counter but don't update lastSignificantChange
                }
                // Early completion detection (only after minimum wait time)
                if (elapsedTime >= minWait) {
                    // If we have a clear prompt and no output for a while, command is done
                    if (hasPrompt && noChangeCount >= 5) { // 500ms of no change
                        console.log('[RunCommand] Prompt detected and output stable, command complete');
                        break;
                    }
                    // If no significant output change for a long time, likely done
                    if (elapsedTime - lastSignificantChange > 3000 && currentLength > beforeBufferLength) {
                        console.log('[RunCommand] No significant output change for 3s, assuming complete');
                        break;
                    }
                }
                // For very long-running commands, provide intermediate results
                if (elapsedTime >= minWait * 2 && currentLength > lastBufferLength + 100) {
                    console.log('[RunCommand] Long-running command with substantial output, returning intermediate results');
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
            // Enhanced output handling
            if (!out) {
                // Check if the process is still running
                const isRunning = record.status === 'running';
                const statusMsg = isRunning
                    ? "Command may still be running or produced no output. Use command_status to check for more output."
                    : "Command completed with no output.";
                return {
                    success: true,
                    output: `[Command Executed]\nCommand: ${commandLine}\nOutput: (No output captured)\nStatus: ${statusMsg}\n\n(Terminal session remains active. You can run more commands in this session.)`
                };
            }
            // Check if command might still be running
            const mightBeRunning = elapsedTime >= maxWait || (record.status === 'running' && !out.includes('PS ') && !out.includes('C:\\'));
            const statusNote = mightBeRunning
                ? "\n\n[Note: Command may still be running. Use command_status to check for additional output.]"
                : "";
            return {
                success: true,
                output: `[Command Executed]\nCommand: ${commandLine}\n\n${out}${statusNote}\n\n(Terminal session remains active. You can run more commands in this session.)`
            };
        }
        catch (err) {
            const msg = err.message ?? String(err);
            return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
        }
    },
};

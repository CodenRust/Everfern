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
            const pollInterval = 200;
            let lastBufferLength = beforeBufferLength;
            // Let WaitMsBeforeAsync be the minimum, but we can poll up to 60s if we want to ensure completion
            const maxWait = Math.max(waitMs, 30000);
            while (elapsedTime < maxWait) {
                await new Promise((r) => setTimeout(r, pollInterval));
                elapsedTime += pollInterval;
                const currentBuffer = registry.getCommand(id)?.outputBuffer || '';
                // If output hasn't changed for a while, or if we see a prompt, we break
                // Heuristic: common prompt indicators
                const lastLines = currentBuffer.split('\n').slice(-3).join('\n');
                if (lastLines.includes('> ') || lastLines.includes('$ ')) {
                    // Wait an extra tick to capture any final output just in case
                    await new Promise((r) => setTimeout(r, 200));
                    break;
                }
                lastBufferLength = currentBuffer.length;
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
        }
        catch (err) {
            const msg = err.message ?? String(err);
            return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
        }
    },
};

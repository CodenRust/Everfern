"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommandInputTool = void 0;
const registry_1 = require("./registry");
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}
exports.sendCommandInputTool = {
    name: 'send_command_input',
    description: `Send standard input to a running command or to terminate a command. Use this to interact with REPLs, interactive commands, and long-running processes. The command must have been created by a previous run_command call.`,
    parameters: {
        type: 'object',
        properties: {
            CommandId: {
                type: 'string',
                description: 'The command ID from a previous run_command call.',
            },
            Input: {
                type: 'string',
                description: 'The input to send to the command\'s stdin. Include newline characters (e.g. \n) if needed to submit commands.',
            },
            Terminate: {
                type: 'boolean',
                description: 'Whether to terminate the command. Exactly one of input and terminate must be specified.',
            },
            SafeToAutoRun: {
                type: 'boolean',
                description: 'Set to true if safe to run WITHOUT user approval.',
            },
            WaitMs: {
                type: 'number',
                description: 'Amount of time to wait for output after sending input.',
            },
        },
        required: ['CommandId', 'SafeToAutoRun'],
    },
    execute: async (args) => {
        try {
            const id = String(args.CommandId || '');
            const input = typeof args.Input === 'string' ? args.Input : undefined;
            const terminate = Boolean(args.Terminate);
            const waitMs = Number(args.WaitMs || 1000);
            const registry = registry_1.CommandRegistry.getInstance();
            const record = registry.getCommand(id);
            if (!record || record.status !== 'running') {
                return { success: false, output: `Process ${id} not found or no longer running.` };
            }
            if (terminate) {
                const success = registry.terminate(id);
                if (success) {
                    return { success: true, output: `Process ${id} terminated.` };
                }
                else {
                    return { success: false, output: `Failed to terminate Process ${id}.` };
                }
            }
            else if (input !== undefined) {
                const success = registry.writeInput(id, input);
                if (!success) {
                    return { success: false, output: `Process ${id} stdin not available.` };
                }
                // Wait
                if (waitMs > 0) {
                    await new Promise(r => setTimeout(r, waitMs));
                }
                const out = stripAnsi(record.outputBuffer).slice(-2000).trim() || '(No output)';
                return { success: true, output: `Input sent. Current output:\n${out}` };
            }
            else {
                return { success: false, output: 'Must provide either Input or Terminate=true' };
            }
        }
        catch (err) {
            const msg = err.message ?? String(err);
            return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
        }
    },
};

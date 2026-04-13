"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commandStatusTool = void 0;
const registry_1 = require("./registry");
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}
exports.commandStatusTool = {
    name: 'command_status',
    description: `Get the status of a previously executed terminal command by its ID. Returns the current status (running, done), output lines as specified by output priority, and any error if present. Do not try to check the status of any IDs other than Background command IDs.`,
    parameters: {
        type: 'object',
        properties: {
            CommandId: {
                type: 'string',
                description: 'ID of the command to get status for',
            },
            OutputCharacterCount: {
                type: 'number',
                description: 'Number of characters to view. Make this as small as possible to avoid excessive memory usage.',
            },
            WaitDurationSeconds: {
                type: 'number',
                description: 'Number of seconds to wait for command completion before getting the status.',
            },
        },
        required: ['CommandId', 'WaitDurationSeconds'],
    },
    execute: async (args) => {
        try {
            const id = String(args.CommandId || '');
            const waitSec = Number(args.WaitDurationSeconds || 0);
            const chars = Number(args.OutputCharacterCount || 2000);
            const registry = registry_1.CommandRegistry.getInstance();
            const record = registry.getCommand(id);
            if (!record) {
                return { success: false, output: `Process ${id} not found or expired.` };
            }
            // Wait if requested
            const waitMs = waitSec * 1000;
            let elapsedTime = 0;
            const pollInterval = 250;
            while (elapsedTime < waitMs && record.status === 'running') {
                await new Promise((r) => setTimeout(r, pollInterval));
                elapsedTime += pollInterval;
            }
            const statusStr = record.status === 'running' ? 'RUNNING' : 'DONE';
            let out = stripAnsi(record.outputBuffer);
            if (out.length > chars) {
                out = out.slice(-chars);
            }
            const exitMsg = record.status === 'done' ? `\nExit code: ${record.exitCode ?? 'Unknown'}` : '';
            return {
                success: true,
                output: `Status: ${statusStr}\nOutput delta since last status check:\n${out.trim() || '(No output)'}${exitMsg}`
            };
        }
        catch (err) {
            const msg = err.message ?? String(err);
            return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
        }
    },
};

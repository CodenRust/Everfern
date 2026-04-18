/**
 * EverFern Desktop — Pi Coding Tools Adapter
 *
 * Wraps @mariozechner/pi-coding-agent standard tools into EverFern's AgentTool schema.
 * Dynamically loads the ESM package to sidestep CJS runtime errors (ERR_PACKAGE_PATH_NOT_EXPORTED).
 */

import type { AgentTool, ToolResult } from '../runner/types';

// Strip ANSI escape sequences (color codes, cursor movement, etc.)
// These garble the chat UI and confuse the model's context window.
function stripAnsi(str: string): string {
  // Covers: SGR params, cursor movement, erase, scroll, OSC, etc.
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

// Helper to convert pi-coding-agent tool into EverFern AgentTool
function adaptTool(
  definition: { name: string; description: string; parameters: any },
  executor: (toolCallId: string, params: any) => Promise<any>,
  customName?: string
): AgentTool {
  const name = customName ?? definition.name;
  return {
    name,
    description: definition.description,
    parameters: definition.parameters as any, // Note: AgentTool expects JSON schema format.
    execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
      try {
        const fakeId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const result = await executor(fakeId, args);

        let outputText = '';
        if (result.content && Array.isArray(result.content)) {
          outputText = result.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        } else if (typeof result.output === 'string') {
          outputText = result.output;
        } else {
          outputText = JSON.stringify(result);
        }

        if (result.isError) {
          return { success: false, output: stripAnsi(outputText), error: stripAnsi(outputText) };
        }
        return { success: true, output: stripAnsi(outputText) };
      } catch (err: any) {
        const msg = err.message ?? String(err);
        return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
      }
    },
  };
}

let loadedCodingTools: AgentTool[] | null = null;

export async function getPiCodingTools(): Promise<AgentTool[]> {
  if (loadedCodingTools) return loadedCodingTools;

  // Use a Function to prevent TS from transpiling this into require()
  // Since the pi package is pure ESM (type: module, no require exports).
  const loader = new Function('return import("@mariozechner/pi-coding-agent")');
  const m = await loader();

  loadedCodingTools = [
    adaptTool(m.readToolDefinition, m.readTool.execute),
    adaptTool(m.writeToolDefinition, m.writeTool.execute),
    adaptTool(m.editToolDefinition, m.editTool.execute),
    adaptTool(m.findToolDefinition, m.findTool.execute),
    adaptTool(m.grepToolDefinition, m.grepTool.execute),
    adaptTool(m.lsToolDefinition, m.lsTool.execute),
    adaptTool(m.bashToolDefinition, m.bashTool.execute, 'executePwsh'),
  ];

  return loadedCodingTools;
}

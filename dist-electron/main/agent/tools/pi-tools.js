"use strict";
/**
 * EverFern Desktop — Pi Coding Tools Adapter
 *
 * Wraps @mariozechner/pi-coding-agent standard tools into EverFern's AgentTool schema.
 * Dynamically loads the ESM package to sidestep CJS runtime errors (ERR_PACKAGE_PATH_NOT_EXPORTED).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPiCodingTools = getPiCodingTools;
// Strip ANSI escape sequences (color codes, cursor movement, etc.)
// These garble the chat UI and confuse the model's context window.
function stripAnsi(str) {
    // Covers: SGR params, cursor movement, erase, scroll, OSC, etc.
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}
// Helper to convert pi-coding-agent tool into EverFern AgentTool
function adaptTool(definition, executor, customName) {
    let name = customName ?? definition.name;
    let description = definition.description;
    let parameters = definition.parameters;
    // Enhance descriptions to enforce engineering standards from SYSTEM_PROMPT
    if (name === 'read') {
        description = `[EXPLORE-FIRST] ${description} Mandatory before any edit. For large files, use start_line/end_line to maintain context efficiency.`;
        if (parameters.properties) {
            parameters.properties.start_line = { type: 'number', description: 'Start line to read (1-indexed, inclusive)' };
            parameters.properties.end_line = { type: 'number', description: 'End line to read (1-indexed, inclusive)' };
        }
    }
    else if (name === 'edit') {
        description = `[SURGICAL-EDIT] ${description} ALWAYS PREFERRED over 'write' for existing files. Identify exact lines to change and provide minimal targeted diffs.`;
    }
    else if (name === 'write') {
        description = `[DISCIPLINED-WRITE] ${description} Use ONLY for new files or total structural rewrites. NEVER use for minor changes to existing files; use 'edit' instead.`;
    }
    else if (name === 'grep' || name === 'find') {
        description = `[REPO-TRIAGE] ${description} Use for mandatory triage and convention matching before writing any code.`;
    }
    return {
        name,
        description,
        parameters,
        execute: async (args, onUpdate, emitEvent, toolCallId) => {
            try {
                const id = toolCallId ?? `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const result = await executor(id, args);
                let outputText = '';
                if (result.content && Array.isArray(result.content)) {
                    outputText = result.content
                        .filter((c) => c.type === 'text')
                        .map((c) => c.text)
                        .join('\n');
                }
                else if (typeof result.output === 'string') {
                    outputText = result.output;
                }
                else {
                    outputText = JSON.stringify(result);
                }
                if (result.isError) {
                    return { success: false, output: stripAnsi(outputText), error: stripAnsi(outputText) };
                }
                return { success: true, output: stripAnsi(outputText) };
            }
            catch (err) {
                const msg = err.message ?? String(err);
                return { success: false, output: stripAnsi(msg), error: stripAnsi(msg) };
            }
        },
    };
}
let loadedCodingTools = null;
// File read cache: path → { content, mtime }
const fileReadCache = new Map();
// Wrap executor with caching for read operations
function withReadCache(executor) {
    return async (toolCallId, params) => {
        const path = params.path;
        if (!path)
            return executor(toolCallId, params);
        try {
            const fs = require('fs');
            const stat = fs.statSync(path);
            const cached = fileReadCache.get(path);
            if (cached && cached.mtime === stat.mtimeMs) {
                return { content: [{ type: 'text', text: cached.content }] };
            }
            const result = await executor(toolCallId, params);
            if (result.content && !result.isError) {
                const content = Array.isArray(result.content)
                    ? result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
                    : '';
                if (content) {
                    fileReadCache.set(path, { content, mtime: stat.mtimeMs });
                }
            }
            return result;
        }
        catch (err) {
            return executor(toolCallId, params);
        }
    };
}
async function getPiCodingTools() {
    if (loadedCodingTools)
        return loadedCodingTools;
    // Use a Function to prevent TS from transpiling this into require()
    // Since the pi package is pure ESM (type: module, no require exports).
    const loader = new Function('return import("@mariozechner/pi-coding-agent")');
    const m = await loader();
    loadedCodingTools = [
        adaptTool(m.readToolDefinition, withReadCache(m.readTool.execute)),
        adaptTool(m.writeToolDefinition, m.writeTool.execute),
        adaptTool(m.editToolDefinition, m.editTool.execute),
        adaptTool(m.findToolDefinition, m.findTool.execute),
        adaptTool(m.grepToolDefinition, m.grepTool.execute),
        adaptTool(m.lsToolDefinition, m.lsTool.execute),
        adaptTool(m.bashToolDefinition, m.bashTool.execute, 'executePwsh'),
    ];
    return loadedCodingTools;
}

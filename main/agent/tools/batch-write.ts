import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentTool, ToolResult } from '../runner/types';

interface FileEntry {
  path: string;
  content: string;
}

export const batchWriteTool: AgentTool = {
  name: 'batch_write',
  description: 'Write MULTIPLE files in a single tool call. ALWAYS use this when creating or scaffolding a project with multiple files (e.g. Next.js app with pages, components, configs). Provide an array of {path, content} objects — all files are written in parallel. Much faster than calling write() repeatedly.',
  parameters: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description: 'Array of files to create. Each entry has a `path` (relative or absolute file path) and `content` (file contents as string).',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (absolute, or relative to workspace)' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['path', 'content'],
        },
      },
      root: {
        type: 'string',
        description: 'Optional root directory. If provided, all paths are resolved relative to this directory.',
      },
    },
    required: ['files'],
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void): Promise<ToolResult> {
    const files = args.files as FileEntry[];
    const root = args.root ? String(args.root) : undefined;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return { success: false, output: 'batch_write: files array is required and must not be empty', error: 'invalid_args' };
    }

    const results: string[] = [];
    let errors: string[] = [];

    await Promise.all(files.map(async (file, i) => {
      try {
        let filePath = file.path;
        if (root) {
          filePath = path.resolve(root, filePath);
        } else {
          filePath = path.resolve(filePath);
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf8');
        results.push(`[${i + 1}/${files.length}] ✓ ${file.path}`);
        onUpdate?.(`Wrote ${file.path}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${i + 1}/${files.length}] ✗ ${file.path}: ${msg}`);
      }
    }));

    const output = results.join('\n') + (errors.length > 0 ? '\n\nErrors:\n' + errors.join('\n') : '');
    const success = errors.length === 0;

    return {
      success,
      output,
      data: { written: results.length, errors: errors.length, total: files.length },
    };
  },
};

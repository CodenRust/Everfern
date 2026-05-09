"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchWriteTool = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.batchWriteTool = {
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
    async execute(args, onUpdate) {
        const files = args.files;
        const root = args.root ? String(args.root) : undefined;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return { success: false, output: 'batch_write: files array is required and must not be empty', error: 'invalid_args' };
        }
        const results = [];
        let errors = [];
        await Promise.all(files.map(async (file, i) => {
            try {
                let filePath = file.path;
                if (root) {
                    filePath = path.resolve(root, filePath);
                }
                else {
                    filePath = path.resolve(filePath);
                }
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, file.content, 'utf8');
                results.push(`[${i + 1}/${files.length}] ✓ ${file.path}`);
                onUpdate?.(`Wrote ${file.path}`);
            }
            catch (err) {
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presentFilesTool = void 0;
exports.presentFilesTool = {
    name: 'present_files',
    description: 'Present final output files (artifacts, reports, spreadsheets) to the user. ' +
        'Surfaces them as interactive cards. Mandatory final step after work.',
    parameters: {
        type: 'object',
        properties: {
            files: {
                type: 'array',
                description: 'List of files to present to the user.',
                items: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file.' },
                        description: { type: 'string', description: 'Short summary of what this file contains.' },
                        type: {
                            type: 'string',
                            enum: ['document', 'spreadsheet', 'presentation', 'code', 'image', 'other'],
                            description: 'General category for UI rendering.'
                        },
                        title: { type: 'string', description: 'Title for the file.' }
                    },
                    required: ['path']
                }
            },
            paths: {
                type: 'array',
                description: 'Alternative format: list of file paths to present.',
                items: { type: 'string' }
            },
            title: {
                type: 'string',
                description: 'Optional title for the presentation.'
            }
        },
        required: ['files']
    },
    async execute(args, onUpdate) {
        // Handle different input formats
        let files = [];
        if (Array.isArray(args.files)) {
            files = args.files;
        }
        else if (Array.isArray(args.paths)) {
            // Alternative format: just paths
            files = args.paths.map((p) => ({ path: p }));
        }
        else if (args.files && typeof args.files === 'object') {
            // Single file object
            files = [args.files];
        }
        else {
            return {
                success: false,
                output: 'present_files requires a "files" array parameter with at least one file.',
                error: 'Invalid arguments: expected { files: [{ path: string, description: string }] }'
            };
        }
        if (files.length === 0) {
            return {
                success: false,
                output: 'No files provided to present.',
                error: 'Empty files array'
            };
        }
        const formatted = files
            .filter((f) => f && f.path)
            .map((f) => {
            const desc = f.description || f.title || `File: ${f.path.split(/[\\/]/).pop()}`;
            return `📄 **${desc}**\n   Path: \`${f.path}\``;
        }).join('\n\n');
        const count = files.filter((f) => f && f.path).length;
        onUpdate?.(`🎁 Presenting ${count} artifact${count !== 1 ? 's' : ''} to the user...`);
        return {
            success: true,
            output: `Files presented to the user:\n\n${formatted}\n\nTask complete.`,
            data: {
                files: files.filter((f) => f && f.path),
                type: 'present_files',
                title: args.title
            }
        };
    }
};

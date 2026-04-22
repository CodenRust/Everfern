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
exports.todoWriteTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os_1 = require("os");
exports.todoWriteTool = {
    name: 'todo_write',
    description: 'Maintain a structured task list in task.md. ' +
        'Use this for all multi-step tasks to track progress. ' +
        'States: pending, in_progress, completed. ' +
        'Mark as completed ONLY after full verification.',
    parameters: {
        type: 'object',
        properties: {
            tasks: {
                type: 'array',
                description: 'Complete list of tasks for the current goal.',
                items: {
                    type: 'object',
                    properties: {
                        description: { type: 'string', description: 'What needs to be done.' },
                        status: {
                            type: 'string',
                            enum: ['pending', 'in_progress', 'completed'],
                            description: 'Current state of the task.'
                        }
                    },
                    required: ['description', 'status']
                }
            },
            planPath: {
                type: 'string',
                description: 'Optional absolute path to the planning directory where task.md should reside. Defaults to ~/.everfern/tasks if not provided.'
            }
        },
        required: ['tasks']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        const tasks = args.tasks;
        let planPath = args.planPath;
        if (!tasks || !Array.isArray(tasks)) {
            return { success: false, output: 'Tasks must be an array.', error: 'invalid_args' };
        }
        // If planPath is not provided, use a default location
        if (!planPath || typeof planPath !== 'string') {
            const homedir = (0, os_1.homedir)();
            planPath = path.join(homedir, '.everfern', 'tasks');
            console.warn('[TodoWrite] planPath not provided, using default:', planPath);
        }
        try {
            // Ensure directory exists
            if (!fs.existsSync(planPath)) {
                fs.mkdirSync(planPath, { recursive: true });
            }
            const taskFile = path.join(planPath, 'task.md');
            // Generate Markdown content
            const lines = ['# Task List', ''];
            tasks.forEach(t => {
                const icon = t.status === 'completed' ? '[x]' : t.status === 'in_progress' ? '[/]' : '[ ]';
                lines.push(`- ${icon} ${t.description}`);
            });
            fs.writeFileSync(taskFile, lines.join('\n'), 'utf8');
            return {
                success: true,
                output: `✅ Updated task.md with ${tasks.length} tasks matching current progress.`,
                data: { path: taskFile, tasks }
            };
        }
        catch (err) {
            return { success: false, output: `Failed to write task.md: ${err.message}`, error: err.code };
        }
    }
};

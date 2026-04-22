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
exports.createPreviewTool = createPreviewTool;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * show_preview tool
 *
 * Writes HTML/CSS/JS content to the artifacts directory and signals the UI to preview it.
 */
function createPreviewTool(chatId, onShow) {
    return {
        name: 'show_preview',
        description: 'Renders a beautiful, interactive HTML preview in a dedicated pane. Use this to show landing pages, dashboards, reports, or any web-based UI you create.',
        parameters: {
            type: 'object',
            properties: {
                filename: {
                    type: 'string',
                    description: 'The name of the file (e.g., dashboard.html)'
                },
                content: {
                    type: 'string',
                    description: 'The full HTML content, including CSS and JS.'
                }
            },
            required: ['filename', 'content']
        },
        async execute(args, onUpdate, emitEvent, toolCallId) {
            const { filename, content } = args;
            const artifactDir = path.join(os.homedir(), '.everfern', 'artifacts', chatId);
            if (!fs.existsSync(artifactDir)) {
                fs.mkdirSync(artifactDir, { recursive: true });
            }
            const filePath = path.join(artifactDir, filename);
            fs.writeFileSync(filePath, content, 'utf8');
            // Signal the UI to show the artifact
            if (onShow) {
                onShow(filename);
            }
            return {
                success: true,
                output: `Preview generated successfully at ${filePath}. The interactive pane has been opened for the user.`,
                data: { filename, path: filePath }
            };
        }
    };
}

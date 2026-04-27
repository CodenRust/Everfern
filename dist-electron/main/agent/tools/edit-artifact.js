"use strict";
/**
 * EverFern Desktop — Edit Artifact Tool
 *
 * Enables the AI agent to edit existing HTML artifacts.
 * Supports natural language references, targeted modifications,
 * and atomic updates with comprehensive error handling.
 */
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
exports.editArtifactTool = void 0;
const artifact_resolver_1 = require("./artifact-resolver");
const artifact_parser_1 = require("./artifact-parser");
const artifact_editor_1 = require("./artifact-editor");
const artifacts_1 = require("../../store/artifacts");
const cheerio = __importStar(require("cheerio"));
exports.editArtifactTool = {
    name: 'edit_artifact',
    description: 'Edit existing HTML artifacts (dashboards, reports, charts, galleries). ' +
        'Reference artifacts naturally ("the artifact", "sales dashboard") or by exact filename. ' +
        'Supports adding content, removing elements, modifying elements, updating styles/scripts, and changing metadata. ' +
        'Changes are applied atomically and the updated artifact is auto-presented.',
    parameters: {
        type: 'object',
        properties: {
            reference: {
                type: 'string',
                description: 'Natural language reference to artifact (e.g., "the artifact", "sales dashboard"). ' +
                    'Use "the", "that", "this", or "it" to reference the most recent artifact.'
            },
            filename: {
                type: 'string',
                description: 'Exact filename of artifact to edit (e.g., "sales-dashboard.html"). ' +
                    'Takes priority over reference parameter.'
            },
            addContent: {
                type: 'string',
                description: 'HTML content to add to the artifact body. ' +
                    'Use Tailwind classes for styling.'
            },
            removeSelector: {
                type: 'string',
                description: 'CSS selector for elements to remove (e.g., ".old-section", "#deprecated").'
            },
            modifySelector: {
                type: 'string',
                description: 'CSS selector for elements to modify. Must be used with modifyContent.'
            },
            modifyContent: {
                type: 'string',
                description: 'New HTML content for elements matching modifySelector.'
            },
            updateStyles: {
                type: 'string',
                description: 'CSS to add or update. Accumulates with existing custom styles.'
            },
            updateScript: {
                type: 'string',
                description: 'JavaScript to add or update. Accumulates with existing custom scripts.'
            },
            title: {
                type: 'string',
                description: 'New title for the artifact.'
            },
            description: {
                type: 'string',
                description: 'New description for the artifact (metadata only).'
            }
        },
        required: []
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const sessionId = 'default';
            const operations = {
                reference: args.reference ? String(args.reference) : undefined,
                filename: args.filename ? String(args.filename) : undefined,
                addContent: args.addContent ? String(args.addContent) : undefined,
                removeSelector: args.removeSelector ? String(args.removeSelector) : undefined,
                modifySelector: args.modifySelector ? String(args.modifySelector) : undefined,
                modifyContent: args.modifyContent ? String(args.modifyContent) : undefined,
                updateStyles: args.updateStyles ? String(args.updateStyles) : undefined,
                updateScript: args.updateScript ? String(args.updateScript) : undefined,
                title: args.title ? String(args.title) : undefined,
                description: args.description ? String(args.description) : undefined
            };
            // Validate that at least one edit operation is provided
            const hasEditOperation = !!(operations.addContent ||
                operations.removeSelector ||
                (operations.modifySelector && operations.modifyContent) ||
                operations.updateStyles ||
                operations.updateScript ||
                operations.title);
            if (!hasEditOperation) {
                return {
                    success: false,
                    output: '❌ No edit operations specified. Please provide at least one of: ' +
                        'addContent, removeSelector, modifySelector+modifyContent, updateStyles, updateScript, or title.',
                    error: 'NO_EDIT_OPERATIONS'
                };
            }
            // Phase 1: Artifact Resolution
            onUpdate?.('🔍 Resolving artifact reference...');
            const resolver = new artifact_resolver_1.ArtifactResolver();
            let artifactRef;
            try {
                artifactRef = resolver.resolve(sessionId, operations.reference, operations.filename);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    success: false,
                    output: `❌ ${msg}`,
                    error: 'AMBIGUOUS_REFERENCE'
                };
            }
            if (!artifactRef) {
                const available = resolver.listArtifacts(sessionId);
                const availableList = available.length > 0
                    ? '\n\nAvailable artifacts:\n' + available.map(a => `- ${a.title || a.filename}`).join('\n')
                    : '\n\nNo artifacts found in this session.';
                return {
                    success: false,
                    output: `❌ Artifact not found: '${operations.reference || operations.filename}'${availableList}`,
                    error: 'ARTIFACT_NOT_FOUND'
                };
            }
            // Phase 2: Loading and Parsing
            onUpdate?.(`📖 Loading artifact: ${artifactRef.title || artifactRef.filename}...`);
            const htmlContent = (0, artifacts_1.readArtifact)(sessionId, artifactRef.filename);
            if (!htmlContent) {
                return {
                    success: false,
                    output: `❌ Failed to read artifact file: ${artifactRef.filename}`,
                    error: 'FILE_READ_ERROR'
                };
            }
            const parser = new artifact_parser_1.ArtifactParser();
            let parsed;
            try {
                parsed = parser.parse(htmlContent);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    success: false,
                    output: `❌ Failed to parse artifact HTML: ${msg}\n` +
                        'The artifact file may be corrupted or contain invalid HTML.',
                    error: 'PARSE_ERROR'
                };
            }
            // Phase 3: Edit Application
            onUpdate?.('✏️ Applying edits...');
            const editor = new artifact_editor_1.ArtifactEditor();
            // Validate selectors before applying edits
            if (operations.removeSelector) {
                const count = parsed.dom(operations.removeSelector).length;
                if (count === 0) {
                    return {
                        success: false,
                        output: `❌ Invalid CSS selector: '${operations.removeSelector}'\n` +
                            'No elements found matching this selector.',
                        error: 'INVALID_SELECTOR'
                    };
                }
            }
            if (operations.modifySelector) {
                const count = parsed.dom(operations.modifySelector).length;
                if (count === 0) {
                    return {
                        success: false,
                        output: `❌ Invalid CSS selector: '${operations.modifySelector}'\n` +
                            'No elements found matching this selector.',
                        error: 'INVALID_SELECTOR'
                    };
                }
            }
            const { parsed: updatedParsed, changes } = editor.applyEdits(parsed, operations);
            // Phase 4: Serialization and Persistence
            onUpdate?.('💾 Saving updated artifact...');
            const updatedHTML = parser.serialize(updatedParsed);
            // Validate HTML structure before writing
            try {
                cheerio.load(updatedHTML);
            }
            catch (err) {
                return {
                    success: false,
                    output: '❌ Generated invalid HTML. Edit operation aborted.\n' +
                        'The original artifact remains unchanged.',
                    error: 'INVALID_HTML_GENERATED'
                };
            }
            // Write atomically
            const writeResult = (0, artifacts_1.writeArtifactAtomic)(sessionId, artifactRef.filename, updatedHTML);
            if (!writeResult.success) {
                return {
                    success: false,
                    output: `❌ Failed to save artifact: ${writeResult.error}\n` +
                        'The original artifact remains unchanged.',
                    error: 'WRITE_ERROR'
                };
            }
            // Update timestamp
            (0, artifacts_1.updateArtifactTimestamp)(sessionId, artifactRef.filename);
            // Update most recent artifact
            resolver.setMostRecent(sessionId, artifactRef.filename);
            // Phase 5: Feedback and Presentation
            onUpdate?.(`✅ Artifact updated: ${updatedParsed.title}`);
            const changesList = changes.map(c => `  • ${c}`).join('\n');
            const output = `✅ Artifact updated: **${updatedParsed.title}**\n\n` +
                `📝 Changes made:\n${changesList}\n\n` +
                `📁 Saved to: \`${artifactRef.path}\`\n` +
                `🎁 Auto-presented to user.`;
            // Emit presentation event
            emitEvent?.({
                type: 'edit_artifact',
                path: artifactRef.path,
                title: updatedParsed.title,
                changes
            });
            return {
                success: true,
                output,
                data: {
                    type: 'edit_artifact',
                    path: artifactRef.path,
                    title: updatedParsed.title,
                    changes
                }
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                output: `❌ Unexpected error: ${msg}`,
                error: msg
            };
        }
    }
};

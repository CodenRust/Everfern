"use strict";
/**
 * EverFern Desktop — Artifact Creator Tool
 *
 * Creates HTML artifacts from AI output (dashboards, reports, visualizations).
 * Files are auto-saved to .everfern/artifacts folder for easy presentation.
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
exports.createSiteTool = exports.createArtifactTool = void 0;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const ARTIFACTS_DIR = () => path.join(os.homedir(), '.everfern', 'artifacts');
function ensureArtifactsDir(sessionId) {
    const dir = path.join(ARTIFACTS_DIR(), sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
function getTemplateHead(template, title) {
    // ALWAYS include Tailwind CDN + Google Fonts (as per user requirement)
    const baseAssets = `
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  `;
    const templates = {
        slides: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css"><script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>` + baseAssets,
    };
    return templates[template] || templates.blank;
}
function wrapInHtml(spec) {
    const title = spec.title || 'EverFern Artifact';
    const head = getTemplateHead(spec.template || 'blank', title);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${head}
  ${spec.css ? `<style>${spec.css}</style>` : ''}
</head>
<body>
  ${spec.html || ''}
  ${spec.js ? `<script>${spec.js}</script>` : ''}
</body>
</html>`;
}
exports.createArtifactTool = {
    name: 'create_artifact',
    description: 'Create HTML artifacts (dashboards, reports, charts, galleries) that display in the UI. ' +
        'Files are auto-saved to .everfern/artifacts and auto-presented. Use this instead of showing temp files.',
    parameters: {
        type: 'object',
        properties: {
            html: { type: 'string', description: 'HTML content to render (body content).' },
            title: { type: 'string', description: 'Title for the artifact.' },
            description: { type: 'string', description: 'Description shown to user.' },
            template: { type: 'string', enum: ['blank', 'dashboard', 'report', 'chart', 'gallery', 'slides'], description: 'Template to use (adds appropriate CSS/JS).' },
            css: { type: 'string', description: 'Custom CSS to inject.' },
            js: { type: 'string', description: 'Custom JavaScript to inject.' }
        },
        required: ['html']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const sessionId = 'default';
            const artifactsDir = ensureArtifactsDir(sessionId);
            const htmlContent = wrapInHtml({
                html: String(args.html || ''),
                title: String(args.title || ''),
                description: String(args.description || ''),
                template: String(args.template || 'blank'),
                css: args.css ? String(args.css) : undefined,
                js: args.js ? String(args.js) : undefined
            });
            const safeTitle = String(args.title || 'artifact')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            const filename = `${safeTitle}.html`;
            const filePath = path.join(artifactsDir, filename);
            fs.writeFileSync(filePath, htmlContent, 'utf-8');
            onUpdate?.(`🎨 Created artifact: ${filename}`);
            return {
                success: true,
                output: `✅ Artifact created: **${args.title || filename}**\n` +
                    `📁 Saved to: \`${filePath}\`\n` +
                    `🎁 Auto-presented to user.`,
                data: {
                    type: 'create_artifact',
                    path: filePath,
                    title: args.title,
                    description: args.description
                }
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                output: `Failed to create artifact: ${msg}`,
                error: msg
            };
        }
    }
};
exports.createSiteTool = {
    name: 'create_site',
    description: 'Create full websites from templates. ' +
        'Faster than manually creating files - uses templates for common site types.',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Name/slug for the site.'
            },
            type: {
                type: 'string',
                enum: ['portfolio', 'blog', 'landing', 'dashboard', 'docs'],
                description: 'Type of site to create.'
            },
            title: {
                type: 'string',
                description: 'Site title.'
            },
            description: {
                type: 'string',
                description: 'Site description.'
            }
        },
        required: ['name', 'type']
    },
    async execute(args, onUpdate, emitEvent, toolCallId) {
        try {
            const sessionId = 'default';
            const name = String(args.name || 'site');
            const type = String(args.type || 'landing');
            const title = String(args.title || name);
            const description = String(args.description || '');
            const sitesDir = path.join(os.homedir(), '.everfern', 'sites', sessionId, name);
            fs.mkdirSync(sitesDir, { recursive: true });
            const baseHtml = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>body{font-family:'Inter',sans-serif}</style>
</head>
<body>${content}</body>
</html>`;
            const templates = {
                blank: baseHtml(`<div class="min-h-screen flex items-center justify-center"><h1 class="text-2xl text-gray-400">Empty Page - Specialized design required</h1></div>`),
                dashboard: baseHtml(`<div class="flex min-h-screen bg-gray-50"><div class="flex-1 p-8 text-center"><h1 class="text-xl text-gray-400">Dashboard Skeleton Generated. Please use a sub-agent to populate with real data and creative UI components.</h1></div></div>`),
                landing: baseHtml(`<div class="min-h-screen flex items-center justify-center bg-gray-900 text-white"><h1 class="text-4xl font-bold">New Project: ${title}</h1></div>`)
            };
            const content = templates[type] || templates.landing;
            const indexPath = path.join(sitesDir, 'index.html');
            fs.writeFileSync(indexPath, content, 'utf-8');
            onUpdate?.(`🌐 Created ${type} site: ${name}`);
            return {
                success: true,
                output: `✅ Site created: **${name}** (${type})\n📁 Location: \`${sitesDir}\`\n🎁 Auto-presented to user.`,
                data: { type: 'create_site', path: sitesDir, name, siteType: type }
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, output: `Failed to create site: ${msg}`, error: msg };
        }
    }
};

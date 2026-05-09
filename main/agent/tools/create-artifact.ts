/**
 * EverFern Desktop — Artifact Creator Tool
 *
 * Creates HTML artifacts from AI output (dashboards, reports, visualizations).
 * Files are auto-saved to .everfern/artifacts folder for easy presentation.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { AgentTool, ToolResult } from '../runner/types';

const ARTIFACTS_DIR = () => path.join(os.homedir(), '.everfern', 'artifacts');

interface ArtifactSpec {
  /** HTML content or template */
  html?: string;
  /** Title for the artifact */
  title?: string;
  /** Description for the user */
  description?: string;
  /** CSS to inject */
  css?: string;
  /** JavaScript to inject */
  js?: string;
  /** Template type - defaults to 'blank' */
  template?: 'blank' | 'dashboard' | 'report' | 'chart' | 'gallery' | 'slides';
}

function ensureArtifactsDir(sessionId: string): string {
  const dir = path.join(ARTIFACTS_DIR(), sessionId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getTemplateHead(template: string, title: string): string {
  // ALWAYS include Tailwind CDN + Google Fonts Figtree (as per system prompt requirement)
  const baseAssets = `
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
  `;

  const slidesExtra = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css"><script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>`;

  const templates: Record<string, string> = {
    blank: baseAssets,
    dashboard: baseAssets,
    report: baseAssets,
    chart: baseAssets,
    gallery: baseAssets,
    slides: slidesExtra + baseAssets,
  };
  return templates[template] ?? baseAssets;
}

/**
 * If the agent passes a full HTML document (<!DOCTYPE html>...) as the html arg,
 * extract just the <body> content so we don't double-wrap it.
 * Also strips any <head> CDN links the agent included — our wrapper provides them.
 */
function extractBodyContent(html: string): string {
  const trimmed = html.trim();
  if (!trimmed.toLowerCase().startsWith('<!doctype') && !trimmed.toLowerCase().startsWith('<html')) {
    return html; // already body-only content
  }
  // Extract <body>...</body>
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }
  // No <body> tag — strip outer wrappers best-effort
  return trimmed
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .trim();
}

function wrapInHtml(spec: ArtifactSpec): string {
  const title = spec.title || 'EverFern Artifact';
  const head = getTemplateHead(spec.template || 'blank', title);
  const bodyContent = extractBodyContent(spec.html || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${head}
  ${spec.css ? `<style>${spec.css}</style>` : ''}
</head>
<body class="font-['Figtree']" style="font-family:'Figtree',sans-serif">
  ${bodyContent}
  ${spec.js ? `<script>${spec.js}<\/script>` : ''}
</body>
</html>`;
}

export const createArtifactTool = (runner?: any): AgentTool => ({
  name: 'create_artifact',
  description:
    'Create HTML artifacts (dashboards, reports, charts, galleries) that display in the UI. ' +
    'The tool auto-injects Tailwind CSS, Figtree font, and Chart.js — DO NOT include these CDN links yourself. ' +
    'Pass ONLY the body content in the html field (no <!DOCTYPE>, <html>, or <head> tags). ' +
    'Use Tailwind utility classes for ALL styling. Never write custom CSS unless absolutely necessary. ' +
    'Files are auto-saved to .everfern/artifacts and auto-presented.',

  parameters: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'Body content ONLY — no <!DOCTYPE>, <html>, <head>, or <body> tags. ' +
          'Tailwind CSS, Figtree font, and Chart.js are already injected. ' +
          'Use Tailwind classes for all styling (e.g. class="p-8 bg-gray-900 text-white rounded-xl").'
      },
      title: { type: 'string', description: 'Title for the artifact.' },
      description: { type: 'string', description: 'Description shown to user.' },
      template: { type: 'string', enum: ['blank', 'dashboard', 'report', 'chart', 'gallery', 'slides'], description: 'Template to use.' },
      css: { type: 'string', description: 'Additional CSS to inject (use sparingly — prefer Tailwind classes).' },
      js: { type: 'string', description: 'Custom JavaScript to inject (Chart.js is already available as Chart).' }
    },
    required: ['html']
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
    try {
      const sessionId = runner?.currentConversationId || 'default';
      
      // If we have a project context, save to the project's .everfern/artifacts folder
      // otherwise fallback to the global ~/.everfern/artifacts folder
      let artifactsDir: string;
      if (runner?.workspaceDir) {
        artifactsDir = path.join(runner.workspaceDir, '.everfern', 'artifacts');
        console.log(`[CreateArtifact] Saving to project directory: ${artifactsDir}`);
      } else {
        artifactsDir = path.join(ARTIFACTS_DIR(), sessionId);
        console.log(`[CreateArtifact] Saving to global artifacts directory: ${artifactsDir}`);
      }
      
      fs.mkdirSync(artifactsDir, { recursive: true });

      const htmlContent = wrapInHtml({
        html: String(args.html || ''),
        title: String(args.title || ''),
        description: String(args.description || ''),
        template: String(args.template || 'blank') as any,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Failed to create artifact: ${msg}`,
        error: msg
      };
    }
  }
});



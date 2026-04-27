"use strict";
/**
 * EverFern Desktop — Artifact Parser
 *
 * Parses and serializes HTML artifacts using Cheerio.
 * Extracts body content, custom CSS, and custom JavaScript.
 * Detects template type and preserves structure.
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
exports.ArtifactParser = void 0;
const cheerio = __importStar(require("cheerio"));
const beautify = __importStar(require("js-beautify"));
class ArtifactParser {
    /**
     * Parses HTML artifact into structured representation.
     * @throws Error if HTML is malformed
     */
    parse(html) {
        try {
            // Load HTML with Cheerio
            const $ = cheerio.load(html, {
                decodeEntities: false,
                xmlMode: false
            });
            // Extract metadata
            const title = $('title').text() || 'Untitled';
            const template = this.detectTemplate($);
            // Extract custom CSS (exclude CDN links)
            let customCSS = '';
            $('style').each((_, el) => {
                const content = $(el).html();
                if (content) {
                    customCSS += content + '\n';
                }
            });
            // Extract custom JavaScript (exclude CDN scripts)
            let customJS = '';
            $('script').each((_, el) => {
                const src = $(el).attr('src');
                // Only include scripts without src attribute (inline scripts)
                if (!src) {
                    const content = $(el).html();
                    if (content) {
                        customJS += content + '\n';
                    }
                }
            });
            // Extract body content
            const bodyContent = this.extractBodyContent($);
            return {
                template,
                title,
                bodyContent: bodyContent.trim(),
                customCSS: customCSS.trim(),
                customJS: customJS.trim(),
                dom: $
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to parse artifact HTML: ${msg}`);
        }
    }
    /**
     * Serializes parsed artifact back to complete HTML document.
     */
    serialize(parsed) {
        const head = this.getTemplateHead(parsed.template, parsed.title);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${parsed.title}</title>
  ${head}
  ${parsed.customCSS ? `<style>${parsed.customCSS}</style>` : ''}
</head>
<body class="font-['Figtree']" style="font-family:'Figtree',sans-serif">
  ${parsed.bodyContent}
  ${parsed.customJS ? `<script>${parsed.customJS}</script>` : ''}
</body>
</html>`;
        return this.formatHTML(html);
    }
    /**
     * Extracts body content from DOM.
     */
    extractBodyContent($) {
        const bodyHtml = $('body').html();
        return bodyHtml || '';
    }
    /**
     * Detects template type from HTML structure.
     */
    detectTemplate($) {
        // Check for Reveal.js (slides)
        if ($('script[src*="reveal.js"]').length > 0) {
            return 'slides';
        }
        // Check for Chart.js usage in scripts
        const scriptText = $('script').text();
        if (scriptText.includes('new Chart') || scriptText.includes('Chart.')) {
            return 'chart';
        }
        // Check for grid layouts (dashboard)
        if ($('[class*="grid"]').length > 3) {
            return 'dashboard';
        }
        // Check for article/section tags (report)
        if ($('article').length > 0 || $('section').length > 2) {
            return 'report';
        }
        // Check for image grids (gallery)
        if ($('img').length > 5 && $('[class*="grid"]').length > 0) {
            return 'gallery';
        }
        // Default to blank
        return 'blank';
    }
    /**
     * Gets template head with CDN dependencies.
     */
    getTemplateHead(template, title) {
        const baseAssets = `
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
  `;
        const slidesExtra = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css"><script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>`;
        const templates = {
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
     * Formats HTML with proper indentation.
     */
    formatHTML(html) {
        return beautify.html(html, {
            indent_size: 2,
            wrap_line_length: 0,
            preserve_newlines: true,
            max_preserve_newlines: 2
        });
    }
}
exports.ArtifactParser = ArtifactParser;

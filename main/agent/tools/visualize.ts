/**
 * EverFern Desktop — Inline Visualization Tool
 * 
 * Generates interactive HTML/SVG/JS visualizations (charts, diagrams, animations)
 * that render directly within the chat message context.
 */

import type { AgentTool, ToolResult } from '../runner/types';

export const visualizeTool: AgentTool = {
  name: 'visualize',
  description:
    'Generate an inline visualization (charts, diagrams, animations) using HTML/SVG/JS. ' +
    'The output will be rendered directly in the chat context. Ideal for quick visual reports, ' +
    'data trends, and interactive flowcharts. Always uses the Figtree font.',

  parameters: {
    type: 'object',
    properties: {
      html: { 
        type: 'string', 
        description: 'HTML or SVG content. For charts, you can use libraries like Chart.js or D3 via CDN.' 
      },
      css: { 
        type: 'string', 
        description: 'CSS styles for the visualization.' 
      },
      js: { 
        type: 'string', 
        description: 'JavaScript for interactivity or animations.' 
      },
      title: { 
        type: 'string', 
        description: 'A brief title for the visualization.' 
      },
      height: { 
        type: 'number', 
        description: 'Recommended height in pixels (default: 300).' 
      }
    },
    required: ['html']
  },

  async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
    try {
      const title = String(args.title || 'Visual Report');
      
      onUpdate?.(`📊 Generating visualization: ${title}`);
      
      return {
        success: true,
        output: `✅ Visualization generated: **${title}**\n🎁 Rendered inline in chat.`,
        data: {
          type: 'visualize',
          html: args.html,
          css: args.css,
          js: args.js,
          title: args.title,
          height: args.height || 300
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: `Failed to generate visualization: ${msg}`,
        error: msg
      };
    }
  }
};

import { AgentTool, ToolResult } from '../runner/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * show_preview tool
 * 
 * Writes HTML/CSS/JS content to the artifacts directory and signals the UI to preview it.
 */
export function createPreviewTool(chatId: string, onShow?: (name: string) => void): AgentTool {
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
    async execute(args: Record<string, unknown>, onUpdate?: (msg: string) => void, emitEvent?: (event: any) => void, toolCallId?: string): Promise<ToolResult> {
      const { filename, content } = args as { filename: string; content: string };
      
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

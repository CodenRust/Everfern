import { AgentTool } from './types';
import { plannerTool, updateStepTool, executionPlanTool } from '../tools/planner';
import { createComputerUseTool } from '../tools/computer-use';
import { getPiCodingTools } from '../tools/pi-tools';
import { systemFilesTool } from '../tools/system-files';
import { memorySaveTool } from '../tools/memory-save';
import { memorySearchTool } from '../tools/memory-search';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { todoWriteTool } from '../tools/todo-write';
import { askUserTool } from '../tools/ask-user';
import { skillTool } from '../tools/skill-tool';
import { presentFilesTool } from '../tools/present-files';
import { createWorkspaceRequestTool, allowFileDeleteTool } from '../tools/control-plane';
import { terminalTool, terminalStatusTool } from '../tools/terminal';
import { searchMcpRegistryTool, connectMcpServerTool, listMcpToolsTool } from '../tools/mcp-registry-tool';
import { createArtifactTool, createSiteTool } from '../tools/create-artifact';
import { mcpRegistry } from '../tools/mcp';
import { AIClient } from '../../lib/ai-client';
import * as os from 'os';

export const getBaseTools = (runner: any): AgentTool[] => {
  const platform = os.platform();
  const config = runner.config;

  // Static tools
  const tools: AgentTool[] = [
      terminalTool,
      terminalStatusTool,
      plannerTool,
      updateStepTool,
      executionPlanTool,
      createComputerUseTool(
        runner.client,
        platform,
        config.visionModel,
        config.showuiUrl,
        config.ollamaBaseUrl,
        config.checkPermission,
        config.requestPermission,
        config.vlm
      ),
      systemFilesTool,
      memorySaveTool,
      memorySearchTool,
      webSearchTool,
      todoWriteTool,
      askUserTool,
      skillTool,
      presentFilesTool,
      webFetchTool,
      createWorkspaceRequestTool(config.requestPermission),
      allowFileDeleteTool,
      searchMcpRegistryTool,
      connectMcpServerTool,
      listMcpToolsTool,
      createArtifactTool,
      createSiteTool
    ];

    // Add dynamically connected MCP tools
    const mcpTools = mcpRegistry.listAllTools().map(name => mcpRegistry.getTool(name)).filter(Boolean) as AgentTool[];
    tools.push(...mcpTools);

    return tools;
};

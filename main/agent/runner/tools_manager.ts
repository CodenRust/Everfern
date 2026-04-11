import { AgentTool } from './types';
import { plannerTool, updateStepTool, executionPlanTool } from '../tools/planner';
import { createComputerUseTool } from '../tools/computer-use';
import { getPiCodingTools } from '../tools/pi-tools';
import { systemFilesTool } from '../tools/system-files';
import { memorySaveTool } from '../tools/memory-save';
import { memorySearchTool } from '../tools/memory-search';
import { webSearchTool } from '../tools/web-search';
import { webFetchTool } from '../tools/web-fetch';
import { runCommandTool } from '../tools/terminal/run-command';
import { commandStatusTool } from '../tools/terminal/command-status';
import { sendCommandInputTool } from '../tools/terminal/send-command-input';
import { todoWriteTool } from '../tools/todo-write';
import { askUserTool } from '../tools/ask-user';
import { skillTool } from '../tools/skill-tool';
import { presentFilesTool } from '../tools/present-files';
import { createWorkspaceRequestTool, allowFileDeleteTool } from '../tools/control-plane';
import { AIClient } from '../../lib/ai-client';
import * as os from 'os';

export const getBaseTools = (runner: any): AgentTool[] => {
  const platform = os.platform();
  const config = runner.config;
  return [
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
      runCommandTool,
      commandStatusTool,
      sendCommandInputTool,
      todoWriteTool,
      askUserTool,
      skillTool,
      presentFilesTool,
      webFetchTool,
      createWorkspaceRequestTool(config.requestPermission),
      allowFileDeleteTool
    ];
};

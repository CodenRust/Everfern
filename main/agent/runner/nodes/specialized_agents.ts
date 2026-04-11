import { GraphStateType, StreamEvent } from '../state';
import { AgentRunner } from '../runner';
import { runAgentStep } from '../services/agent-runtime';

export const createCodingSpecialistNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const toolDefs = runner._buildToolDefinitions();
    return runAgentStep(state, {
      runner,
      toolDefs,
      eventQueue,
      nodeName: 'coding_specialist',
      systemPromptOverride: `You are the EverFern Coding Specialist. 
Your goal is to write, debug, and optimize code with extreme precision. 
Use your tools (write, edit, run_command) to implement the requested features.`
    });
  };
};

export const createDataAnalystNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const toolDefs = runner._buildToolDefinitions();
    return runAgentStep(state, {
      runner,
      toolDefs,
      eventQueue,
      nodeName: 'data_analyst',
      systemPromptOverride: `You are the EverFern Data Analyst. 
Your goal is to process data, generate reports, and provide insights. 
Use your tools (read, web_fetch, write) to analyze datasets and present results.`
    });
  };
};

export const createComputerUseNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const toolDefs = runner._buildToolDefinitions();
    return runAgentStep(state, {
      runner,
      toolDefs,
      eventQueue,
      nodeName: 'computer_use_agent',
      systemPromptOverride: `You are the EverFern OS Interaction Agent. 
Your goal is to navigate the operating system and interact with desktop applications. 
Use the 'computer_use' tool to achieve your goals.`
    });
  };
};

export const createWebExplorerNode = (runner: AgentRunner, eventQueue?: StreamEvent[]) => {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    const toolDefs = runner._buildToolDefinitions();
    return runAgentStep(state, {
      runner,
      toolDefs,
      eventQueue,
      nodeName: 'web_explorer',
      systemPromptOverride: `You are the EverFern Web Explorer. 
Your goal is to find information on the web and navigate websites. 
Use your tools (web_search, web_fetch) to gather the requested data.`
    });
  };
};

/**
 * EverFern Desktop — Tool Extensions
 * 
 * Registers all tools with metadata for the OpenClaw-style tool system.
 */

import { registerTool, toolRegistry, getHighRiskTools } from '../helpers/tool-registry';
import type { AgentTool } from '../runner/types';

// File tools
export function registerFileTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'file',
            riskLevel: tool.name === 'delete' ? 'high' : 'moderate'
        });
    }
}

// Terminal tools
export function registerTerminalTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'terminal',
            riskLevel: tool.name === 'bash' || tool.name === 'exec' ? 'high' : 'moderate'
        });
    }
}

// Web tools
export function registerWebTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'web',
            riskLevel: 'safe',
            parallelizable: true
        });
    }
}

// Memory tools
export function registerMemoryTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'memory',
            riskLevel: 'safe'
        });
    }
}

// Planning tools
export function registerPlanningTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'planning',
            riskLevel: 'safe'
        });
    }
}

// Agent tools
export function registerAgentTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'agent',
            riskLevel: 'moderate'
        });
    }
}

// System tools
export function registerSystemTools(tools: AgentTool[]): void {
    for (const tool of tools) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'system',
            riskLevel: tool.name.includes('delete') || tool.name.includes('exec') ? 'critical' : 'moderate',
            requiresApproval: tool.name.includes('delete') || tool.name.includes('exec')
        });
    }
}

// Initialize all tool registrations
export function initializeToolRegistry(allTools: AgentTool[]): void {
    const byCategory: Record<string, AgentTool[]> = {
        file: [],
        terminal: [],
        web: [],
        memory: [],
        planning: [],
        agent: [],
        system: [],
        control: []
    };

    for (const tool of allTools) {
        const name = tool.name.toLowerCase();
        
        if (name.includes('read') || name.includes('write') || name.includes('edit') || name.includes('delete') || name.includes('file')) {
            byCategory.file.push(tool);
        } else if (name.includes('run') || name.includes('command') || name.includes('bash') || name.includes('terminal')) {
            byCategory.terminal.push(tool);
        } else if (name.includes('web') || name.includes('search') || name.includes('fetch') || name.includes('http')) {
            byCategory.web.push(tool);
        } else if (name.includes('memory') || name.includes('save') || name.includes('search')) {
            byCategory.memory.push(tool);
        } else if (name.includes('plan') || name.includes('todo')) {
            byCategory.planning.push(tool);
        } else if (name.includes('agent') || name.includes('spawn')) {
            byCategory.agent.push(tool);
        } else if (name.includes('system') || name.includes('permission') || name.includes('control')) {
            byCategory.system.push(tool);
        } else {
            byCategory.control.push(tool);
        }
    }

    registerFileTools(byCategory.file);
    registerTerminalTools(byCategory.terminal);
    registerWebTools(byCategory.web);
    registerMemoryTools(byCategory.memory);
    registerPlanningTools(byCategory.planning);
    registerAgentTools(byCategory.agent);
    registerSystemTools(byCategory.system);

    for (const tool of byCategory.control) {
        registerTool(tool, {
            name: tool.name,
            description: tool.description,
            category: 'control',
            riskLevel: 'moderate'
        });
    }

    console.log(`[ToolRegistry] Initialized with ${toolRegistry.getToolCount()} tools across ${toolRegistry.getCategories().length} categories`);
    console.log(`[ToolRegistry] High-risk tools: ${getHighRiskTools().map(t => t.tool.name).join(', ')}`);
}

"use strict";
/**
 * EverFern Desktop — Tool Extensions
 *
 * Registers all tools with metadata for the OpenClaw-style tool system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFileTools = registerFileTools;
exports.registerTerminalTools = registerTerminalTools;
exports.registerWebTools = registerWebTools;
exports.registerMemoryTools = registerMemoryTools;
exports.registerPlanningTools = registerPlanningTools;
exports.registerAgentTools = registerAgentTools;
exports.registerSystemTools = registerSystemTools;
exports.initializeToolRegistry = initializeToolRegistry;
const tool_registry_1 = require("../helpers/tool-registry");
// File tools
function registerFileTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'file',
            riskLevel: tool.name === 'delete' ? 'high' : 'moderate'
        });
    }
}
// Terminal tools
function registerTerminalTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'terminal',
            riskLevel: tool.name === 'bash' || tool.name === 'exec' ? 'high' : 'moderate'
        });
    }
}
// Web tools
function registerWebTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'web',
            riskLevel: 'safe',
            parallelizable: true
        });
    }
}
// Memory tools
function registerMemoryTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'memory',
            riskLevel: 'safe'
        });
    }
}
// Planning tools
function registerPlanningTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'planning',
            riskLevel: 'safe'
        });
    }
}
// Agent tools
function registerAgentTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'agent',
            riskLevel: 'moderate'
        });
    }
}
// System tools
function registerSystemTools(tools) {
    for (const tool of tools) {
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'system',
            riskLevel: tool.name.includes('delete') || tool.name.includes('exec') ? 'critical' : 'moderate',
            requiresApproval: tool.name.includes('delete') || tool.name.includes('exec')
        });
    }
}
// Initialize all tool registrations
function initializeToolRegistry(allTools) {
    const byCategory = {
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
        }
        else if (name.includes('run') || name.includes('command') || name.includes('bash') || name.includes('terminal')) {
            byCategory.terminal.push(tool);
        }
        else if (name.includes('web') || name.includes('search') || name.includes('fetch') || name.includes('http')) {
            byCategory.web.push(tool);
        }
        else if (name.includes('memory') || name.includes('save') || name.includes('search')) {
            byCategory.memory.push(tool);
        }
        else if (name.includes('plan') || name.includes('todo')) {
            byCategory.planning.push(tool);
        }
        else if (name.includes('agent') || name.includes('spawn')) {
            byCategory.agent.push(tool);
        }
        else if (name.includes('system') || name.includes('permission') || name.includes('control')) {
            byCategory.system.push(tool);
        }
        else {
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
        (0, tool_registry_1.registerTool)(tool, {
            name: tool.name,
            description: tool.description,
            category: 'control',
            riskLevel: 'moderate'
        });
    }
    console.log(`[ToolRegistry] Initialized with ${tool_registry_1.toolRegistry.getToolCount()} tools across ${tool_registry_1.toolRegistry.getCategories().length} categories`);
    console.log(`[ToolRegistry] High-risk tools: ${(0, tool_registry_1.getHighRiskTools)().map(t => t.tool.name).join(', ')}`);
}

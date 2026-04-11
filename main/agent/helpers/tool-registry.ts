/**
 * EverFern Desktop — Tool Registry
 * 
 * Central registry for all agent tools with metadata,
 * versioning, and categorization.
 */

import type { AgentTool, ToolResult } from '../runner/types';

export interface ToolMetadata {
    name: string;
    description: string;
    category: ToolCategory;
    riskLevel: RiskLevel;
    requiresApproval: boolean;
    parallelizable: boolean;
    version: string;
    deprecated?: boolean;
    replacement?: string;
}

export type ToolCategory = 
    | 'file' 
    | 'terminal' 
    | 'web' 
    | 'memory' 
    | 'planning' 
    | 'agent' 
    | 'system' 
    | 'control';

export type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export interface ToolRegistration {
    tool: AgentTool;
    metadata: ToolMetadata;
    aliases?: string[];
}

class ToolRegistry {
    private tools = new Map<string, ToolRegistration>();
    private aliases = new Map<string, string>();

    register(registration: ToolRegistration): void {
        const { tool } = registration;
        
        if (this.tools.has(tool.name)) {
            console.warn(`[ToolRegistry] Tool "${tool.name}" already registered, skipping`);
            return;
        }

        this.tools.set(tool.name, registration);
        
        for (const alias of registration.aliases || []) {
            this.aliases.set(alias, tool.name);
        }

        console.log(`[ToolRegistry] Registered: ${tool.name} (${registration.metadata.category})`);
    }

    get(name: string): AgentTool | undefined {
        const realName = this.aliases.get(name) || name;
        return this.tools.get(realName)?.tool;
    }

    getMetadata(name: string): ToolMetadata | undefined {
        const realName = this.aliases.get(name) || name;
        return this.tools.get(realName)?.metadata;
    }

    getAll(): AgentTool[] {
        return Array.from(this.tools.values()).map(r => r.tool);
    }

    getByCategory(category: ToolCategory): ToolRegistration[] {
        return Array.from(this.tools.values()).filter(
            r => r.metadata.category === category
        );
    }

    getByRiskLevel(level: RiskLevel): ToolRegistration[] {
        return Array.from(this.tools.values()).filter(
            r => r.metadata.riskLevel === level
        );
    }

    has(name: string): boolean {
        const realName = this.aliases.get(name) || name;
        return this.tools.has(realName);
    }

    unregister(name: string): boolean {
        const realName = this.aliases.get(name) || name;
        const registration = this.tools.get(realName);
        
        if (!registration) return false;

        for (const alias of registration.aliases || []) {
            this.aliases.delete(alias);
        }

        return this.tools.delete(realName);
    }

    getCategories(): ToolCategory[] {
        const categories = new Set<ToolCategory>();
        for (const reg of this.tools.values()) {
            categories.add(reg.metadata.category);
        }
        return Array.from(categories);
    }

    getToolCount(): number {
        return this.tools.size;
    }

    listTools(): { name: string; category: ToolCategory; riskLevel: RiskLevel }[] {
        return Array.from(this.tools.values()).map(r => ({
            name: r.tool.name,
            category: r.metadata.category,
            riskLevel: r.metadata.riskLevel
        }));
    }
}

export const toolRegistry = new ToolRegistry();

export function registerTool(tool: AgentTool, metadata: Partial<ToolMetadata> & { name: string; description: string; category: ToolCategory }) {
    const fullMetadata: ToolMetadata = {
        name: metadata.name,
        description: metadata.description,
        category: metadata.category,
        riskLevel: metadata.riskLevel || 'moderate',
        requiresApproval: metadata.riskLevel === 'high' || metadata.riskLevel === 'critical',
        parallelizable: metadata.parallelizable ?? true,
        version: metadata.version || '1.0.0',
        deprecated: metadata.deprecated,
        replacement: metadata.replacement,
    };

    toolRegistry.register({
        tool,
        metadata: fullMetadata,
        aliases: metadata.name.includes('_') ? [metadata.name.replace(/_/g, '-')] : undefined
    });
}

export function getToolsByCategory(category: ToolCategory): AgentTool[] {
    return toolRegistry.getByCategory(category).map(r => r.tool);
}

export function getHighRiskTools(): ToolRegistration[] {
    return toolRegistry.getByRiskLevel('high').concat(
        toolRegistry.getByRiskLevel('critical')
    );
}

export function filterParallelizableTools(tools: AgentTool[]): AgentTool[] {
    return tools.filter(tool => {
        const meta = toolRegistry.getMetadata(tool.name);
        return meta?.parallelizable ?? true;
    });
}

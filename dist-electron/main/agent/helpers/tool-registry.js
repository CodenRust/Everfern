"use strict";
/**
 * EverFern Desktop — Tool Registry
 *
 * Central registry for all agent tools with metadata,
 * versioning, and categorization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolRegistry = void 0;
exports.registerTool = registerTool;
exports.getToolsByCategory = getToolsByCategory;
exports.getHighRiskTools = getHighRiskTools;
exports.filterParallelizableTools = filterParallelizableTools;
class ToolRegistry {
    tools = new Map();
    aliases = new Map();
    register(registration) {
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
    get(name) {
        const realName = this.aliases.get(name) || name;
        return this.tools.get(realName)?.tool;
    }
    getMetadata(name) {
        const realName = this.aliases.get(name) || name;
        return this.tools.get(realName)?.metadata;
    }
    getAll() {
        return Array.from(this.tools.values()).map(r => r.tool);
    }
    getByCategory(category) {
        return Array.from(this.tools.values()).filter(r => r.metadata.category === category);
    }
    getByRiskLevel(level) {
        return Array.from(this.tools.values()).filter(r => r.metadata.riskLevel === level);
    }
    has(name) {
        const realName = this.aliases.get(name) || name;
        return this.tools.has(realName);
    }
    unregister(name) {
        const realName = this.aliases.get(name) || name;
        const registration = this.tools.get(realName);
        if (!registration)
            return false;
        for (const alias of registration.aliases || []) {
            this.aliases.delete(alias);
        }
        return this.tools.delete(realName);
    }
    getCategories() {
        const categories = new Set();
        for (const reg of this.tools.values()) {
            categories.add(reg.metadata.category);
        }
        return Array.from(categories);
    }
    getToolCount() {
        return this.tools.size;
    }
    listTools() {
        return Array.from(this.tools.values()).map(r => ({
            name: r.tool.name,
            category: r.metadata.category,
            riskLevel: r.metadata.riskLevel
        }));
    }
}
exports.toolRegistry = new ToolRegistry();
function registerTool(tool, metadata) {
    const fullMetadata = {
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
    exports.toolRegistry.register({
        tool,
        metadata: fullMetadata,
        aliases: metadata.name.includes('_') ? [metadata.name.replace(/_/g, '-')] : undefined
    });
}
function getToolsByCategory(category) {
    return exports.toolRegistry.getByCategory(category).map(r => r.tool);
}
function getHighRiskTools() {
    return exports.toolRegistry.getByRiskLevel('high').concat(exports.toolRegistry.getByRiskLevel('critical'));
}
function filterParallelizableTools(tools) {
    return tools.filter(tool => {
        const meta = exports.toolRegistry.getMetadata(tool.name);
        return meta?.parallelizable ?? true;
    });
}

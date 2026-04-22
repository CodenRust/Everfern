"use strict";
/**
 * EverFern — MCP Tool Integration
 *
 * Supports MCP servers via:
 * - Command (local process): `node ~/mcp-servers/gmail/index.js`
 * - Docker: `docker run -i ghcr.io/modelcontextprotocol/server-filesystem /data`
 * - Stdio: Direct stdio communication
 *
 * Convert MCP tools to EverFern tools and register them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MCP_CONFIGS = exports.mcpRegistry = void 0;
exports.initMCPTools = initMCPTools;
exports.shutdownMCPTools = shutdownMCPTools;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
class MCPConnection {
    config;
    client = null;
    connected = false;
    process = null;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        try {
            if (this.config.command) {
                return await this.connectCommand();
            }
            else if (this.config.docker) {
                return await this.connectDocker();
            }
            return false;
        }
        catch (error) {
            console.error(`[MCP] Failed to connect: ${this.config.name}`, error);
            return false;
        }
    }
    async connectCommand() {
        const { command, args = [], env = {} } = this.config;
        if (!command)
            return false;
        const parts = command.split(/\s+/);
        const cmd = parts[0];
        const cmdArgs = args.length > 0 ? args : parts.slice(1);
        const cleanEnv = {};
        for (const [key, value] of Object.entries({ ...process.env, ...env })) {
            if (value !== undefined) {
                cleanEnv[key] = value;
            }
        }
        const transport = new stdio_js_1.StdioClientTransport({
            command: cmd,
            args: cmdArgs,
            env: cleanEnv
        });
        this.client = new index_js_1.Client({ name: this.config.name, version: '1.0.0' }, { capabilities: {} });
        try {
            await this.client.connect(transport);
            this.connected = true;
            console.log(`[MCP] Connected: ${this.config.name}`);
            return true;
        }
        catch (error) {
            console.error(`[MCP] Init failed: ${this.config.name}`, error);
            return false;
        }
    }
    async connectDocker() {
        const { docker, env = {} } = this.config;
        if (!docker)
            return false;
        const dockerParts = docker.split(/\s+/).filter(Boolean);
        const image = dockerParts[0];
        const dockerArgs = dockerParts.slice(1);
        const transport = new stdio_js_1.StdioClientTransport({
            command: 'docker',
            args: ['run', '--rm', '-i', ...dockerArgs, image],
            env: { ...process.env, ...env }
        });
        this.client = new index_js_1.Client({ name: this.config.name, version: '1.0.0' }, { capabilities: {} });
        try {
            await this.client.connect(transport);
            this.connected = true;
            console.log(`[MCP] Connected (Docker): ${this.config.name}`);
            return true;
        }
        catch (error) {
            console.error(`[MCP] Docker init failed: ${this.config.name}`, error);
            return false;
        }
    }
    async disconnect() {
        if (this.client) {
            try {
                await this.client.close();
            }
            catch { }
        }
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.connected = false;
        this.client = null;
        console.log(`[MCP] Disconnected: ${this.config.name}`);
    }
    async listTools() {
        if (!this.connected || !this.client)
            return [];
        try {
            const response = await this.client.request({ method: 'tools/list' }, types_js_1.ListToolsResultSchema);
            return (response.tools || []).map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            }));
        }
        catch (error) {
            console.error(`[MCP] List tools failed: ${this.config.name}`, error);
            return [];
        }
    }
    async callTool(toolName, args) {
        if (!this.connected || !this.client) {
            throw new Error(`MCP not connected: ${this.config.name}`);
        }
        try {
            const response = await this.client.request({
                method: 'tools/call',
                params: { name: toolName, arguments: args }
            }, types_js_1.CallToolResultSchema);
            if (response.content?.[0]?.type === 'text') {
                return response.content[0].text;
            }
            return JSON.stringify(response.content);
        }
        catch (error) {
            console.error(`[MCP] Call tool failed: ${toolName}`, error);
            throw error;
        }
    }
}
class MCPToolRegistry {
    connections = new Map();
    tools = new Map();
    async registerServer(config) {
        const conn = new MCPConnection(config);
        const success = await conn.connect();
        if (!success) {
            console.warn(`[MCP] Failed to register: ${config.name}`);
            return 0;
        }
        this.connections.set(config.name, conn);
        const tools = await conn.listTools();
        for (const tool of tools) {
            const fullName = `${config.name}/${tool.name}`;
            this.tools.set(fullName, { connection: conn, config: tool });
        }
        console.log(`[MCP] Registered ${tools.length} tools from ${config.name}`);
        return tools.length;
    }
    async disconnectAll() {
        for (const conn of this.connections.values()) {
            await conn.disconnect();
        }
        this.connections.clear();
        this.tools.clear();
    }
    getTool(name) {
        const toolEntry = this.tools.get(name);
        if (!toolEntry)
            return undefined;
        const { connection, config } = toolEntry;
        return {
            name: name,
            description: config.description,
            parameters: config.inputSchema,
            async execute(args, onUpdate, emitEvent, toolCallId) {
                try {
                    onUpdate?.(`Calling MCP tool: ${name}`);
                    const result = await connection.callTool(config.name, args);
                    return {
                        success: true,
                        output: typeof result === 'string' ? result : JSON.stringify(result)
                    };
                }
                catch (error) {
                    return {
                        success: false,
                        output: `Error: ${error}`
                    };
                }
            }
        };
    }
    listAllTools() {
        return Array.from(this.tools.keys());
    }
    getServers() {
        return Array.from(this.connections.keys());
    }
}
exports.mcpRegistry = new MCPToolRegistry();
exports.DEFAULT_MCP_CONFIGS = [
    {
        name: 'everfern-test',
        command: 'python test-mcp-server.py'
    },
];
async function initMCPTools() {
    for (const config of exports.DEFAULT_MCP_CONFIGS) {
        try {
            await exports.mcpRegistry.registerServer(config);
        }
        catch (error) {
            console.error(`[MCP] Failed to init ${config.name}:`, error);
        }
    }
}
async function shutdownMCPTools() {
    await exports.mcpRegistry.disconnectAll();
}

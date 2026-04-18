"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMcpToolsTool = exports.connectMcpServerTool = exports.searchMcpRegistryTool = void 0;
const mcp_1 = require("./mcp");
/**
 * MCP Registry Tool
 * Allows the agent to search for available MCP connectors and services.
 */
exports.searchMcpRegistryTool = {
    name: 'search_mcp_registry',
    description: 'Search the MCP Registry for available connectors, apps, and services. Use this to find tools for Gmail, Slack, Google Drive, etc.',
    parameters: {
        type: 'object',
        properties: {
            keyword: {
                type: 'string',
                description: 'The service or app to search for (e.g., "spotify", "gmail", "slack")'
            }
        },
        required: ['keyword']
    },
    execute: async (args, onUpdate) => {
        const keyword = args.keyword.toLowerCase();
        onUpdate?.(`Searching MCP Registry for: ${keyword}...`);
        // In a real implementation, this would query a remote or local database of available MCP servers.
        // For now, we'll provide a curated list of popular MCP servers that the user can "install" or "connect".
        const registry = [
            {
                name: 'spotify',
                description: 'Control Spotify playback, search tracks, and manage playlists.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-spotify'
            },
            {
                name: 'gmail',
                description: 'Read, search, and send emails via Gmail API.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-gmail'
            },
            {
                name: 'google-drive',
                description: 'List, read, and manage files in Google Drive.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-google-drive'
            },
            {
                name: 'slack',
                description: 'Send messages and search history in Slack channels.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-slack'
            },
            {
                name: 'github',
                description: 'Manage issues, pull requests, and repositories on GitHub.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-github'
            },
            {
                name: 'postgres',
                description: 'Read and write to PostgreSQL databases.',
                status: 'available',
                command: 'npx -y @modelcontextprotocol/server-postgres'
            }
        ];
        const matches = registry.filter(item => item.name.includes(keyword) ||
            item.description.toLowerCase().includes(keyword));
        if (matches.length === 0) {
            return {
                success: true,
                output: `No MCP connectors found for "${keyword}". Try a different keyword or use browser automation.`
            };
        }
        let output = `Found ${matches.length} MCP connectors for "${keyword}":\n\n`;
        for (const match of matches) {
            output += `### ${match.name.toUpperCase()}\n`;
            output += `- **Description**: ${match.description}\n`;
            output += `- **Status**: ${match.status}\n`;
            output += `- **To Connect**: Use \`connect_mcp_server({ name: "${match.name}", command: "${match.command}" })\`\n\n`;
        }
        return {
            success: true,
            output
        };
    }
};
/**
 * Connect MCP Server Tool
 * Allows the agent to dynamically connect to a new MCP server.
 */
exports.connectMcpServerTool = {
    name: 'connect_mcp_server',
    description: 'Dynamically connect to an MCP server using a command or docker image.',
    parameters: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'A unique name for this connection' },
            command: { type: 'string', description: 'The command to run the MCP server (e.g., "npx ...")' },
            docker: { type: 'string', description: 'The docker image to run (if not using command)' },
            args: { type: 'array', items: { type: 'string' }, description: 'Arguments for the command' },
            env: { type: 'object', description: 'Environment variables for the server' }
        },
        required: ['name']
    },
    execute: async (args, onUpdate) => {
        const { name, command, docker, args: cmdArgs, env } = args;
        onUpdate?.(`Connecting to MCP server: ${name}...`);
        try {
            const toolCount = await mcp_1.mcpRegistry.registerServer({
                name,
                command,
                docker,
                args: cmdArgs,
                env
            });
            if (toolCount > 0) {
                return {
                    success: true,
                    output: `Successfully connected to ${name}. Registered ${toolCount} new tools.\n\nUse \`list_mcp_tools()\` to see available tools from this server.`
                };
            }
            else {
                return {
                    success: false,
                    output: `Failed to connect to ${name}. No tools were registered. Check the server logs or command.`
                };
            }
        }
        catch (error) {
            return {
                success: false,
                output: `Error connecting to MCP server: ${error}`
            };
        }
    }
};
/**
 * List MCP Tools Tool
 * Shows all currently registered MCP tools.
 */
exports.listMcpToolsTool = {
    name: 'list_mcp_tools',
    description: 'List all currently connected MCP servers and their available tools.',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    execute: async (args, onUpdate) => {
        const tools = mcp_1.mcpRegistry.listAllTools();
        const servers = mcp_1.mcpRegistry.getServers();
        if (servers.length === 0) {
            return {
                success: true,
                output: "No MCP servers are currently connected. Use `search_mcp_registry` to find connectors."
            };
        }
        let output = `Connected MCP Servers (${servers.length}): ${servers.join(', ')}\n\n`;
        output += `Available MCP Tools (${tools.length}):\n`;
        for (const toolName of tools) {
            const tool = mcp_1.mcpRegistry.getTool(toolName);
            output += `- **${toolName}**: ${tool?.description || 'No description'}\n`;
        }
        return {
            success: true,
            output
        };
    }
};

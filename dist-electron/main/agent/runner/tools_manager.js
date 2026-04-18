"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseTools = void 0;
const planner_1 = require("../tools/planner");
const computer_use_1 = require("../tools/computer-use");
const system_files_1 = require("../tools/system-files");
const memory_save_1 = require("../tools/memory-save");
const memory_search_1 = require("../tools/memory-search");
const web_search_1 = require("../tools/web-search");
const web_fetch_1 = require("../tools/web-fetch");
const todo_write_1 = require("../tools/todo-write");
const ask_user_1 = require("../tools/ask-user");
const skill_tool_1 = require("../tools/skill-tool");
const present_files_1 = require("../tools/present-files");
const control_plane_1 = require("../tools/control-plane");
const terminal_1 = require("../tools/terminal");
const mcp_registry_tool_1 = require("../tools/mcp-registry-tool");
const mcp_1 = require("../tools/mcp");
const os = __importStar(require("os"));
const getBaseTools = (runner) => {
    const platform = os.platform();
    const config = runner.config;
    // Static tools
    const tools = [
        terminal_1.terminalTool,
        terminal_1.terminalStatusTool,
        planner_1.plannerTool,
        planner_1.updateStepTool,
        planner_1.executionPlanTool,
        (0, computer_use_1.createComputerUseTool)(runner.client, platform, config.visionModel, config.showuiUrl, config.ollamaBaseUrl, config.checkPermission, config.requestPermission, config.vlm),
        system_files_1.systemFilesTool,
        memory_save_1.memorySaveTool,
        memory_search_1.memorySearchTool,
        web_search_1.webSearchTool,
        todo_write_1.todoWriteTool,
        ask_user_1.askUserTool,
        skill_tool_1.skillTool,
        present_files_1.presentFilesTool,
        web_fetch_1.webFetchTool,
        (0, control_plane_1.createWorkspaceRequestTool)(config.requestPermission),
        control_plane_1.allowFileDeleteTool,
        mcp_registry_tool_1.searchMcpRegistryTool,
        mcp_registry_tool_1.connectMcpServerTool,
        mcp_registry_tool_1.listMcpToolsTool
    ];
    // Add dynamically connected MCP tools
    const mcpTools = mcp_1.mcpRegistry.listAllTools().map(name => mcp_1.mcpRegistry.getTool(name)).filter(Boolean);
    tools.push(...mcpTools);
    return tools;
};
exports.getBaseTools = getBaseTools;

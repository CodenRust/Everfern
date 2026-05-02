"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIPC = setupIPC;
const system_1 = require("./system");
const agent_1 = require("./agent");
const history_1 = require("./history");
const store_handlers_1 = require("./store-handlers");
const tool_settings_handlers_1 = require("./tool-settings-handlers");
const chat_title_generator_1 = require("../lib/chat-title-generator");
const projects_1 = require("./projects");
function setupIPC(historyStore) {
    (0, system_1.registerSystemHandlers)();
    (0, agent_1.registerAgentHandlers)();
    (0, history_1.registerHistoryHandlers)(historyStore);
    (0, store_handlers_1.registerStoreHandlers)();
    (0, tool_settings_handlers_1.registerToolSettingsHandlers)();
    (0, chat_title_generator_1.registerChatTitleHandler)();
    (0, projects_1.registerProjectsHandlers)();
}

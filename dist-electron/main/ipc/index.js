"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupIPC = setupIPC;
const system_1 = require("./system");
const agent_1 = require("./agent");
const history_1 = require("./history");
const store_handlers_1 = require("./store-handlers");
function setupIPC(historyStore) {
    (0, system_1.registerSystemHandlers)();
    (0, agent_1.registerAgentHandlers)();
    (0, history_1.registerHistoryHandlers)(historyStore);
    (0, store_handlers_1.registerStoreHandlers)();
}

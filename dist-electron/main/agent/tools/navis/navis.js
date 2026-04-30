"use strict";
/**
 * Navis — Everfern In-House AI Browser Agent
 *
 * Autonomous browser automation engine for complex web tasks.
 * Built from scratch with clean architecture:
 *   - BrowserSession: lifecycle management
 *   - ElementCapture: DOM snapshot with NAVIS.md format
 *   - ActionExecutor: typed action dispatching
 *   - Orchestrator: AI-driven main loop with JSON schema
 *
 * Powered by NAVIS.md system prompt from main/agent/prompts/NAVIS.md
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavisLogger = exports.NavisOrchestrator = exports.NAVIS_DECISION_SCHEMA = exports.createNavisTool = void 0;
var tool_1 = require("./tool");
Object.defineProperty(exports, "createNavisTool", { enumerable: true, get: function () { return tool_1.createNavisTool; } });
var orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "NAVIS_DECISION_SCHEMA", { enumerable: true, get: function () { return orchestrator_1.NAVIS_DECISION_SCHEMA; } });
Object.defineProperty(exports, "NavisOrchestrator", { enumerable: true, get: function () { return orchestrator_1.NavisOrchestrator; } });
var logger_1 = require("./logger");
Object.defineProperty(exports, "NavisLogger", { enumerable: true, get: function () { return logger_1.NavisLogger; } });

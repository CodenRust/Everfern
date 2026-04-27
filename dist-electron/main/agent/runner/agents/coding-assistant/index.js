"use strict";
/**
 * AI Coding Assistant - Main Entry Point
 *
 * A hands-off coding tool that works like Windsurf/Cursor for Kiro.
 * Intelligently understands any codebase and provides context-aware assistance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAssistantEngine = exports.resetContextManager = exports.getContextManager = exports.resetIntelligentSuggestionsEngine = exports.getIntelligentSuggestionsEngine = exports.resetCodebaseAnalyzer = exports.getCodebaseAnalyzer = void 0;
var codebase_analyzer_1 = require("./codebase-analyzer");
Object.defineProperty(exports, "getCodebaseAnalyzer", { enumerable: true, get: function () { return codebase_analyzer_1.getCodebaseAnalyzer; } });
Object.defineProperty(exports, "resetCodebaseAnalyzer", { enumerable: true, get: function () { return codebase_analyzer_1.resetCodebaseAnalyzer; } });
var intelligent_suggestions_1 = require("./intelligent-suggestions");
Object.defineProperty(exports, "getIntelligentSuggestionsEngine", { enumerable: true, get: function () { return intelligent_suggestions_1.getIntelligentSuggestionsEngine; } });
Object.defineProperty(exports, "resetIntelligentSuggestionsEngine", { enumerable: true, get: function () { return intelligent_suggestions_1.resetIntelligentSuggestionsEngine; } });
var context_manager_1 = require("./context-manager");
Object.defineProperty(exports, "getContextManager", { enumerable: true, get: function () { return context_manager_1.getContextManager; } });
Object.defineProperty(exports, "resetContextManager", { enumerable: true, get: function () { return context_manager_1.resetContextManager; } });
// Core assistant functionality
var assistant_engine_1 = require("./core/assistant-engine");
Object.defineProperty(exports, "AIAssistantEngine", { enumerable: true, get: function () { return assistant_engine_1.AIAssistantEngine; } });

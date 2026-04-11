"use strict";
/**
 * EverFern Desktop — Context Engine
 * Unified exports for the context-engine subsystem.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextEngineStats = exports.HybridContextEngine = exports.VectorContextEngine = exports.DefaultContextEngine = exports.setDefaultContextEngine = exports.listContextEngineIds = exports.resolveContextEngine = exports.registerContextEngine = void 0;
var registry_1 = require("./registry");
Object.defineProperty(exports, "registerContextEngine", { enumerable: true, get: function () { return registry_1.registerContextEngine; } });
Object.defineProperty(exports, "resolveContextEngine", { enumerable: true, get: function () { return registry_1.resolveContextEngine; } });
Object.defineProperty(exports, "listContextEngineIds", { enumerable: true, get: function () { return registry_1.listContextEngineIds; } });
Object.defineProperty(exports, "setDefaultContextEngine", { enumerable: true, get: function () { return registry_1.setDefaultContextEngine; } });
var default_1 = require("./default");
Object.defineProperty(exports, "DefaultContextEngine", { enumerable: true, get: function () { return default_1.DefaultContextEngine; } });
var vector_1 = require("./vector");
Object.defineProperty(exports, "VectorContextEngine", { enumerable: true, get: function () { return vector_1.VectorContextEngine; } });
Object.defineProperty(exports, "HybridContextEngine", { enumerable: true, get: function () { return vector_1.HybridContextEngine; } });
Object.defineProperty(exports, "getContextEngineStats", { enumerable: true, get: function () { return vector_1.getContextEngineStats; } });

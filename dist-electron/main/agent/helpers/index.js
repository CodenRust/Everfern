"use strict";
/**
 * EverFern Desktop — Agent Helpers
 *
 * OpenClaw-style helpers for the agent system.
 */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyThinkingToRequest = exports.buildThinkingParams = exports.getModelThinkingCapabilities = void 0;
__exportStar(require("./pi-helpers"), exports);
__exportStar(require("./char-estimator"), exports);
__exportStar(require("./context-guard"), exports);
__exportStar(require("./tool-registry"), exports);
__exportStar(require("./extensions"), exports);
__exportStar(require("./file-type-detector"), exports);
__exportStar(require("./result-presenter"), exports);
var thinking_1 = require("./thinking");
Object.defineProperty(exports, "getModelThinkingCapabilities", { enumerable: true, get: function () { return thinking_1.getModelThinkingCapabilities; } });
Object.defineProperty(exports, "buildThinkingParams", { enumerable: true, get: function () { return thinking_1.buildThinkingParams; } });
Object.defineProperty(exports, "applyThinkingToRequest", { enumerable: true, get: function () { return thinking_1.applyThinkingToRequest; } });

"use strict";
/**
 * EverFern Desktop — Context Engine Registry
 *
 * Adapted from openclaw/src/context-engine/registry.ts
 *
 * Factory-based registry for pluggable context engine implementations.
 * Engines are registered by ID and resolved per-session.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerContextEngine = registerContextEngine;
exports.setDefaultContextEngine = setDefaultContextEngine;
exports.resolveContextEngine = resolveContextEngine;
exports.listContextEngineIds = listContextEngineIds;
// ── Registry State ───────────────────────────────────────────────────
const registry = new Map();
let _defaultId = 'default';
// ── Registration ─────────────────────────────────────────────────────
/**
 * Register a context engine factory under a given ID.
 * Override existing registrations with `force: true`.
 */
function registerContextEngine(id, factory, options = {}) {
    if (registry.has(id) && !options.force) {
        console.warn(`[ContextEngine] Registry: engine "${id}" already registered. Use force:true to override.`);
        return;
    }
    registry.set(id, factory);
    console.log(`[ContextEngine] Registered engine: "${id}"`);
}
/**
 * Set the default engine ID to use when none is specified.
 */
function setDefaultContextEngine(id) {
    _defaultId = id;
}
/**
 * Resolve and instantiate a context engine by ID.
 * Falls back to the default engine if the ID is not found.
 */
function resolveContextEngine(id) {
    const targetId = id ?? _defaultId;
    const factory = registry.get(targetId) ?? registry.get(_defaultId);
    if (!factory) {
        throw new Error(`[ContextEngine] No engine registered for id "${targetId}" and no default is set. ` +
            `Call registerContextEngine("default", ...) during app startup.`);
    }
    return factory();
}
/**
 * List all registered engine IDs.
 */
function listContextEngineIds() {
    return [...registry.keys()];
}

"use strict";
/**
 * EverFern Desktop — Agent Extensions
 *
 * Pluggable extensions that modify agent behavior:
 * - Context pruning strategies
 * - Compaction instructions
 * - Session management hooks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extensionManager = void 0;
exports.initializeExtensions = initializeExtensions;
class ExtensionManager {
    extensions = new Map();
    hooks = new Map();
    initialized = false;
    async register(extension) {
        if (this.extensions.has(extension.name)) {
            console.warn(`[ExtensionManager] Extension "${extension.name}" already registered`);
            return;
        }
        const ctx = this.createContext();
        if (extension.initialize) {
            await extension.initialize(ctx);
        }
        for (const [hookName, hookFn] of Object.entries(extension.hooks)) {
            if (hookFn) {
                this.registerHook(hookName, hookFn);
            }
        }
        this.extensions.set(extension.name, extension);
        console.log(`[ExtensionManager] Registered extension: ${extension.name} v${extension.version}`);
    }
    createContext() {
        return {
            config: { maxIterations: 100, contextWindowTokens: 128000 },
            registerHook: (name, fn) => this.registerHook(name, fn)
        };
    }
    registerHook(name, fn) {
        const existing = this.hooks.get(name) || [];
        this.hooks.set(name, [...existing, fn]);
    }
    async runHooks(name, params) {
        const hooks = this.hooks.get(name) || [];
        let result = {};
        for (const hook of hooks) {
            try {
                const hookResult = await hook(params);
                if (hookResult.blocked) {
                    return hookResult;
                }
                if (hookResult.skipDefaultBehavior) {
                    return hookResult;
                }
                result = { ...result, ...hookResult };
            }
            catch (error) {
                console.error(`[ExtensionManager] Hook "${name}" failed:`, error);
            }
        }
        return result;
    }
    unregister(name) {
        const ext = this.extensions.get(name);
        if (!ext)
            return false;
        if (ext.dispose) {
            ext.dispose();
        }
        return this.extensions.delete(name);
    }
    listExtensions() {
        return Array.from(this.extensions.values()).map(e => ({
            name: e.name,
            version: e.version
        }));
    }
}
exports.extensionManager = new ExtensionManager();
async function initializeExtensions() {
    if (exports.extensionManager) {
        await exports.extensionManager.runHooks('beforeModel', {});
    }
}

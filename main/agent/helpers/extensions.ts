/**
 * EverFern Desktop — Agent Extensions
 * 
 * Pluggable extensions that modify agent behavior:
 * - Context pruning strategies
 * - Compaction instructions
 * - Session management hooks
 */

import type { Message } from '../helpers/char-estimator';
import type { ContextGuard } from '../helpers/context-guard';

export type ExtensionHook = 'beforeTool' | 'afterTool' | 'beforeModel' | 'afterModel' | 
    'onContextOverflow' | 'onCompaction' | 'beforeResponse' | 'afterResponse';

export interface Extension {
    name: string;
    version: string;
    hooks: Partial<Record<ExtensionHook, ExtensionHookFn>>;
    initialize?(ctx: ExtensionContext): Promise<void> | void;
    dispose?(): void;
}

export type ExtensionHookFn = (params: HookParams) => HookResult | Promise<HookResult>;

export interface HookParams {
    messages?: Message[];
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: string;
    response?: string;
    contextGuard?: ContextGuard;
    iteration?: number;
    [key: string]: unknown;
}

export interface HookResult {
    messages?: Message[];
    response?: string;
    blocked?: boolean;
    blockReason?: string;
    skipDefaultBehavior?: boolean;
}

interface ExtensionContext {
    config: AgentConfig;
    registerHook(name: ExtensionHook, fn: ExtensionHookFn): void;
}

interface AgentConfig {
    maxIterations: number;
    contextWindowTokens: number;
}

class ExtensionManager {
    private extensions = new Map<string, Extension>();
    private hooks = new Map<ExtensionHook, ExtensionHookFn[]>();
    private initialized = false;

    async register(extension: Extension): Promise<void> {
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
                this.registerHook(hookName as ExtensionHook, hookFn);
            }
        }

        this.extensions.set(extension.name, extension);
        console.log(`[ExtensionManager] Registered extension: ${extension.name} v${extension.version}`);
    }

    private createContext(): ExtensionContext {
        return {
            config: { maxIterations: 100, contextWindowTokens: 128000 },
            registerHook: (name, fn) => this.registerHook(name, fn)
        };
    }

    registerHook(name: ExtensionHook, fn: ExtensionHookFn): void {
        const existing = this.hooks.get(name) || [];
        this.hooks.set(name, [...existing, fn]);
    }

    async runHooks(name: ExtensionHook, params: HookParams): Promise<HookResult> {
        const hooks = this.hooks.get(name) || [];
        let result: HookResult = {};

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
            } catch (error) {
                console.error(`[ExtensionManager] Hook "${name}" failed:`, error);
            }
        }

        return result;
    }

    unregister(name: string): boolean {
        const ext = this.extensions.get(name);
        if (!ext) return false;

        if (ext.dispose) {
            ext.dispose();
        }

        return this.extensions.delete(name);
    }

    listExtensions(): { name: string; version: string }[] {
        return Array.from(this.extensions.values()).map(e => ({
            name: e.name,
            version: e.version
        }));
    }
}

export const extensionManager = new ExtensionManager();

export async function initializeExtensions(): Promise<void> {
    if (extensionManager) {
        await extensionManager.runHooks('beforeModel', {});
    }
}

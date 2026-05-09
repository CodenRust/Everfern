"use strict";
/**
 * EverFern Desktop — Tool Policy Pipeline
 *
 * Multi-stage policy enforcement for tool calls.
 * Implements OpenClaw-style allowlist/deny/owner-only policies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.builtInPolicies = void 0;
exports.createToolPolicyPipeline = createToolPolicyPipeline;
exports.createDefaultPolicyPipeline = createDefaultPolicyPipeline;
exports.getDefaultToolPolicyPipeline = getDefaultToolPolicyPipeline;
function createToolPolicyPipeline() {
    const policies = [];
    async function check(ctx) {
        for (const policy of policies) {
            const result = await policy.check(ctx);
            if (result !== 'allow') {
                console.log(`[ToolPolicy] ${policy.name}: ${ctx.toolName} → ${result}`);
                return result;
            }
        }
        return 'allow';
    }
    function checkSync(ctx) {
        for (const policy of policies) {
            const result = policy.check(ctx);
            if (result !== 'allow' && result !== Promise.resolve('allow')) {
                console.log(`[ToolPolicy] ${policy.name}: ${ctx.toolName} → ${result}`);
                return result;
            }
        }
        return 'allow';
    }
    return {
        get policies() { return [...policies]; },
        addPolicy(policy) {
            policies.push(policy);
            policies.sort((a, b) => b.priority - a.priority);
            console.log(`[ToolPolicy] Added policy: ${policy.name}`);
        },
        removePolicy(name) {
            const idx = policies.findIndex(p => p.name === name);
            if (idx !== -1) {
                policies.splice(idx, 1);
                console.log(`[ToolPolicy] Removed policy: ${name}`);
            }
        },
        check,
        checkSync
    };
}
// Pre-built policies
exports.builtInPolicies = {
    // Deny high-risk tools by default
    createDenyPolicy(deniedTools) {
        return {
            name: 'deny_high_risk',
            priority: 100,
            check: (ctx) => {
                if (deniedTools.includes(ctx.toolName)) {
                    return 'deny';
                }
                return 'allow';
            }
        };
    },
    // Allow only specific tools
    createAllowlistPolicy(allowedTools) {
        return {
            name: 'allowlist',
            priority: 90,
            check: (ctx) => {
                if (!allowedTools.includes(ctx.toolName)) {
                    return 'deny';
                }
                return 'allow';
            }
        };
    },
    // Owner-only tools (require user confirmation)
    createOwnerOnlyPolicy(ownerOnlyTools) {
        return {
            name: 'owner_only',
            priority: 80,
            check: (ctx) => {
                // High-risk command patterns for terminal/bash
                const dangerousCommands = [
                    'del ', 'rm ', 'rmdir ', 'rd ', 'format ', 'mkfs ', 'dd ',
                    '> /dev/', 'shred ', 'wipe ', 'mount ', 'umount '
                ];
                const isDangerousTerminal = (cmd) => {
                    const lower = cmd.toLowerCase();
                    return dangerousCommands.some(d => lower.includes(d));
                };
                // Smart check for terminal/bash tools
                if (['terminal_execute', 'executePwsh', 'bash', 'exec'].includes(ctx.toolName)) {
                    const command = String(ctx.args.command || ctx.args.code || ctx.args.script || '');
                    if (isDangerousTerminal(command)) {
                        console.log(`[ToolPolicy] Dangerous command detected: "${command}" → Requiring approval`);
                        return 'owner_only';
                    }
                    return 'allow';
                }
                if (ownerOnlyTools.includes(ctx.toolName)) {
                    return 'owner_only';
                }
                return 'allow';
            }
        };
    },
    // Model compatibility check
    createModelCompatibilityPolicy(requiredCapabilities) {
        return {
            name: 'model_compatibility',
            priority: 70,
            check: (ctx) => {
                if (!ctx.model)
                    return 'allow';
                const modelCaps = requiredCapabilities[ctx.model];
                if (!modelCaps)
                    return 'allow'; // Unknown model, allow
                if (!modelCaps.includes(ctx.toolName)) {
                    console.log(`[ToolPolicy] Model ${ctx.model} may not support ${ctx.toolName}`);
                    return 'deny';
                }
                return 'allow';
            }
        };
    },
    // Provider-specific filtering
    createProviderFilterPolicy(providerDenials) {
        return {
            name: 'provider_filter',
            priority: 60,
            check: (ctx) => {
                if (!ctx.provider)
                    return 'allow';
                const denied = providerDenials[ctx.provider];
                if (denied && denied.includes(ctx.toolName)) {
                    return 'deny';
                }
                return 'allow';
            }
        };
    }
};
// Default policy configuration
function createDefaultPolicyPipeline() {
    const pipeline = createToolPolicyPipeline();
    // Add default policies
    pipeline.addPolicy(exports.builtInPolicies.createDenyPolicy([
        'rm_rf', 'format', 'drop_database', 'delete_all'
    ]));
    // Updated: edit and write require approval, but terminal is now "smart" (only dangerous cmds)
    pipeline.addPolicy(exports.builtInPolicies.createOwnerOnlyPolicy([
        'edit', 'write', 'write_file', 'write_to_file', 'apply_patch', 'system_files', 'delete'
    ]));
    return pipeline;
}
// Singleton
let defaultPipeline = null;
function getDefaultToolPolicyPipeline() {
    if (!defaultPipeline) {
        defaultPipeline = createDefaultPolicyPipeline();
    }
    return defaultPipeline;
}

"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolApprovalStore = exports.ToolApprovalStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const POLICIES_FILE_PATH = path.join(os.homedir(), '.everfern', 'tool-approvals.json');
class ToolApprovalStore {
    policies = [];
    constructor() {
        this.policies = this.load();
    }
    load() {
        if (!fs.existsSync(POLICIES_FILE_PATH)) {
            return [];
        }
        try {
            const raw = fs.readFileSync(POLICIES_FILE_PATH, 'utf-8');
            return JSON.parse(raw);
        }
        catch (err) {
            console.warn('[ToolApprovalStore] ⚠️ Malformed tool-approvals.json — resetting to empty:', err);
            return [];
        }
    }
    save() {
        const dir = path.dirname(POLICIES_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(POLICIES_FILE_PATH, JSON.stringify(this.policies, null, 2), 'utf-8');
    }
    /**
     * Add a new auto-approval policy
     */
    addPolicy(policy) {
        const newPolicy = {
            ...policy,
            id: Math.random().toString(36).substring(2, 11),
            createdAt: new Date().toISOString(),
        };
        // Avoid duplicates
        const exists = this.policies.some(p => p.type === newPolicy.type &&
            p.toolName === newPolicy.toolName &&
            p.pattern === newPolicy.pattern);
        if (!exists) {
            this.policies.push(newPolicy);
            this.save();
        }
        return newPolicy;
    }
    /**
     * Check if a tool call matches any auto-approval policy
     */
    isApproved(toolName, args) {
        const cmdTools = ['terminal_execute', 'executePwsh', 'run_command', 'bash'];
        for (const policy of this.policies) {
            if (policy.toolName !== toolName)
                continue;
            if (cmdTools.includes(toolName)) {
                const cmd = args.command || args.CommandLine || args.cmd || '';
                if (typeof cmd !== 'string')
                    continue;
                if (policy.type === 'exact' && cmd === policy.pattern)
                    return true;
                if (policy.type === 'prefix' && cmd.startsWith(policy.pattern))
                    return true;
            }
            else {
                // For non-command tools, we currently only support exact match of tool name
                // (though individual tool arguments could be supported in the future)
                if (policy.type === 'exact')
                    return true;
            }
        }
        return false;
    }
    /**
     * List all policies
     */
    getPolicies() {
        return [...this.policies];
    }
    /**
     * Delete a policy by ID
     */
    deletePolicy(id) {
        this.policies = this.policies.filter(p => p.id !== id);
        this.save();
    }
}
exports.ToolApprovalStore = ToolApprovalStore;
exports.toolApprovalStore = new ToolApprovalStore();

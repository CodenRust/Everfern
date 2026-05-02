import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Tool Approval Policy
 */
export interface ToolApprovalPolicy {
  id: string;
  type: 'exact' | 'prefix';
  toolName: string;
  pattern: string;
  createdAt: string;
}

const POLICIES_FILE_PATH = path.join(os.homedir(), '.everfern', 'tool-approvals.json');

export class ToolApprovalStore {
  private policies: ToolApprovalPolicy[] = [];

  constructor() {
    this.policies = this.load();
  }

  private load(): ToolApprovalPolicy[] {
    if (!fs.existsSync(POLICIES_FILE_PATH)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(POLICIES_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[ToolApprovalStore] ⚠️ Malformed tool-approvals.json — resetting to empty:', err);
      return [];
    }
  }

  private save(): void {
    const dir = path.dirname(POLICIES_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(POLICIES_FILE_PATH, JSON.stringify(this.policies, null, 2), 'utf-8');
  }

  /**
   * Add a new auto-approval policy
   */
  addPolicy(policy: Omit<ToolApprovalPolicy, 'id' | 'createdAt'>): ToolApprovalPolicy {
    const newPolicy: ToolApprovalPolicy = {
      ...policy,
      id: Math.random().toString(36).substring(2, 11),
      createdAt: new Date().toISOString(),
    };
    
    // Avoid duplicates
    const exists = this.policies.some(p => 
      p.type === newPolicy.type && 
      p.toolName === newPolicy.toolName && 
      p.pattern === newPolicy.pattern
    );
    
    if (!exists) {
      this.policies.push(newPolicy);
      this.save();
    }
    
    return newPolicy;
  }

  /**
   * Check if a tool call matches any auto-approval policy
   */
  isApproved(toolName: string, args: Record<string, any>): boolean {
    const cmdTools = ['terminal_execute', 'executePwsh', 'run_command', 'bash'];
    
    for (const policy of this.policies) {
      if (policy.toolName !== toolName) continue;
      
      if (cmdTools.includes(toolName)) {
        const cmd = args.command || args.CommandLine || args.cmd || '';
        if (typeof cmd !== 'string') continue;
        
        if (policy.type === 'exact' && cmd === policy.pattern) return true;
        if (policy.type === 'prefix' && cmd.startsWith(policy.pattern)) return true;
      } else {
        // For non-command tools, we currently only support exact match of tool name
        // (though individual tool arguments could be supported in the future)
        if (policy.type === 'exact') return true;
      }
    }
    
    return false;
  }

  /**
   * List all policies
   */
  getPolicies(): ToolApprovalPolicy[] {
    return [...this.policies];
  }

  /**
   * Delete a policy by ID
   */
  deletePolicy(id: string): void {
    this.policies = this.policies.filter(p => p.id !== id);
    this.save();
  }
}

export const toolApprovalStore = new ToolApprovalStore();

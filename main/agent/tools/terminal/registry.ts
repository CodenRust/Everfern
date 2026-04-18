import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

export interface CommandInfo {
  id: string;
  command: string;
  cwd: string;
  pid?: number;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  output: string;
  exitCode?: number;
  startTime: number;
}

export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, CommandInfo> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  private constructor() {}

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  public async execute(id: string, command: string, cwd: string = os.homedir()): Promise<CommandInfo> {
    const info: CommandInfo = {
      id,
      command,
      cwd,
      status: 'running',
      output: '',
      startTime: Date.now()
    };
    this.commands.set(id, info);

    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : 'bash';
    const args = isWin ? ['-NoProfile', '-Command', command] : ['-c', command];

    const proc = spawn(shell, args, { cwd, shell: false });
    this.processes.set(id, proc);
    info.pid = proc.pid;

    proc.stdout?.on('data', (data) => {
      info.output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      info.output += data.toString();
    });

    return new Promise((resolve) => {
      proc.on('close', (code) => {
        info.status = code === 0 ? 'completed' : 'failed';
        info.exitCode = code ?? -1;
        this.processes.delete(id);
        resolve(info);
      });

      proc.on('error', (err) => {
        info.status = 'failed';
        info.output += `\nError: ${err.message}`;
        this.processes.delete(id);
        resolve(info);
      });
    });
  }

  public listCommands(): CommandInfo[] {
    return Array.from(this.commands.values());
  }

  public terminate(id: string): boolean {
    const proc = this.processes.get(id);
    if (proc) {
      proc.kill();
      const info = this.commands.get(id);
      if (info) info.status = 'terminated';
      this.processes.delete(id);
      return true;
    }
    return false;
  }
}

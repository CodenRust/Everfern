import { ChildProcess, spawn } from 'child_process';
import crypto from 'crypto';
import os from 'os';

export interface CommandRecord {
  id: string;
  process: ChildProcess;
  outputBuffer: string;
  commandLine: string;
  status: 'running' | 'done';
  exitCode?: number | null;
}

export interface CommandRecordInfo {
  id: string;
  commandLine: string;
  status: 'running' | 'done';
  exitCode?: number | null;
  bufferSize: number;
}

export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, CommandRecord> = new Map();
  private MAX_BUFFER_SIZE = 64000; // Increased for long-lived sessions
  public static readonly PERSISTENT_ID = 'agent-terminal';

  private constructor() {}

  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  spawnCommand(commandLine: string, cwd: string, persistent = false): string {
    const id = persistent ? CommandRegistry.PERSISTENT_ID : crypto.randomUUID();

    // If persistent and already exists, just return the ID (caller should use writeInput/command_status)
    const existing = this.commands.get(id);
    if (persistent && existing && existing.status === 'running') {
      return id;
    }

    const isWin = os.platform() === 'win32';

    // For Windows, try pwsh.exe first, fallback to powershell.exe, then cmd.exe
    let shell: string;
    let args: string[];

    if (isWin) {
      // Try to find PowerShell Core (pwsh) first, then Windows PowerShell, then cmd
      const possibleShells = ['pwsh.exe', 'powershell.exe', 'cmd.exe'];
      shell = possibleShells[0]; // Start with pwsh.exe

      // Persistent terminal starts a raw shell; one-off starts with -Command/-c
      if (persistent) {
        args = shell === 'cmd.exe' ? ['/k'] : ['-NoExit', '-NoLogo'];
      } else {
        args = shell === 'cmd.exe' ? ['/c', commandLine] : ['-Command', commandLine];
      }
    } else {
      shell = '/bin/bash';
      args = persistent ? ['-i'] : ['-c', commandLine];
    }

    let child: ChildProcess;
    let shellUsed = shell;

    try {
      child = spawn(shell, args, {
        cwd,
        shell: false,
        env: { ...process.env, COLUMNS: '120', ROWS: '40' }
      });
    } catch (err: any) {
      // If pwsh.exe fails on Windows, try powershell.exe
      if (isWin && shell === 'pwsh.exe' && err.code === 'ENOENT') {
        console.log('[Terminal] pwsh.exe not found, trying powershell.exe');
        shell = 'powershell.exe';
        shellUsed = shell;
        args = persistent ? ['-NoExit', '-NoLogo'] : ['-Command', commandLine];

        try {
          child = spawn(shell, args, {
            cwd,
            shell: false,
            env: { ...process.env, COLUMNS: '120', ROWS: '40' }
          });
        } catch (err2: any) {
          // If powershell.exe also fails, try cmd.exe
          if (err2.code === 'ENOENT') {
            console.log('[Terminal] powershell.exe not found, trying cmd.exe');
            shell = 'cmd.exe';
            shellUsed = shell;
            args = persistent ? ['/k'] : ['/c', commandLine];

            child = spawn(shell, args, {
              cwd,
              shell: false,
              env: { ...process.env, COLUMNS: '120', ROWS: '40' }
            });
          } else {
            throw err2;
          }
        }
      } else {
        throw err;
      }
    }

    const record: CommandRecord = {
      id,
      process: child,
      outputBuffer: '',
      commandLine: persistent ? `Persistent Shell (${shellUsed})` : commandLine,
      status: 'running',
    };

    const appendOutput = (data: Buffer | string) => {
      record.outputBuffer += data.toString();
      if (record.outputBuffer.length > this.MAX_BUFFER_SIZE) {
        record.outputBuffer = record.outputBuffer.slice(-this.MAX_BUFFER_SIZE);
      }
    };

    child.stdout?.on('data', appendOutput);
    child.stderr?.on('data', appendOutput);

    child.on('close', (code) => {
      record.status = 'done';
      record.exitCode = code;
    });

    child.on('error', (err) => {
      appendOutput(`\n[Process Error]: ${err.message}`);
      record.status = 'done';
    });

    this.commands.set(id, record);
    console.log(`[Terminal] Spawned ${shellUsed} with PID ${child.pid}`);
    return id;
  }

  getCommand(id: string): CommandRecord | undefined {
    return this.commands.get(id);
  }

  listCommands(): CommandRecordInfo[] {
    return Array.from(this.commands.values()).map(record => ({
      id: record.id,
      commandLine: record.commandLine,
      status: record.status,
      exitCode: record.exitCode,
      bufferSize: record.outputBuffer.length,
    }));
  }

  writeInput(id: string, input: string): boolean {
    const record = this.commands.get(id);
    if (record && record.status === 'running' && record.process.stdin) {
      // Append the input we sent so the AI sees what it typed
      record.outputBuffer += `\n>> ${input}\n`;
      record.process.stdin.write(input);
      return true;
    }
    return false;
  }

  terminate(id: string): boolean {
    const record = this.commands.get(id);
    if (record && record.status === 'running') {
      record.outputBuffer += `\n[Process Terminated]\n`;
      try {
        record.process.kill();
      } catch (e) {}
      record.status = 'done';
      return true;
    }
    return false;
  }
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandRegistry = void 0;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
class CommandRegistry {
    static instance;
    commands = new Map();
    MAX_BUFFER_SIZE = 64000; // Increased for long-lived sessions
    static PERSISTENT_ID = 'agent-terminal';
    constructor() { }
    static getInstance() {
        if (!CommandRegistry.instance) {
            CommandRegistry.instance = new CommandRegistry();
        }
        return CommandRegistry.instance;
    }
    spawnCommand(commandLine, cwd, persistent = false) {
        const id = persistent ? CommandRegistry.PERSISTENT_ID : crypto_1.default.randomUUID();
        // If persistent and already exists, just return the ID (caller should use writeInput/command_status)
        const existing = this.commands.get(id);
        if (persistent && existing && existing.status === 'running') {
            return id;
        }
        const isWin = os_1.default.platform() === 'win32';
        const shell = isWin ? 'pwsh.exe' : '/bin/bash';
        // Persistent terminal starts a raw shell; one-off starts with -Command/-c
        const args = persistent
            ? (isWin ? ['-NoExit', '-NoLogo'] : ['-i'])
            : (isWin ? ['-Command', commandLine] : ['-c', commandLine]);
        const child = (0, child_process_1.spawn)(shell, args, {
            cwd,
            shell: false,
            env: { ...process.env, COLUMNS: '120', ROWS: '40' }
        });
        const record = {
            id,
            process: child,
            outputBuffer: '',
            commandLine: persistent ? 'Persistent Shell' : commandLine,
            status: 'running',
        };
        const appendOutput = (data) => {
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
        return id;
    }
    getCommand(id) {
        return this.commands.get(id);
    }
    listCommands() {
        return Array.from(this.commands.values()).map(record => ({
            id: record.id,
            commandLine: record.commandLine,
            status: record.status,
            exitCode: record.exitCode,
            bufferSize: record.outputBuffer.length,
        }));
    }
    writeInput(id, input) {
        const record = this.commands.get(id);
        if (record && record.status === 'running' && record.process.stdin) {
            // Append the input we sent so the AI sees what it typed
            record.outputBuffer += `\n>> ${input}\n`;
            record.process.stdin.write(input);
            return true;
        }
        return false;
    }
    terminate(id) {
        const record = this.commands.get(id);
        if (record && record.status === 'running') {
            record.outputBuffer += `\n[Process Terminated]\n`;
            try {
                record.process.kill();
            }
            catch (e) { }
            record.status = 'done';
            return true;
        }
        return false;
    }
}
exports.CommandRegistry = CommandRegistry;

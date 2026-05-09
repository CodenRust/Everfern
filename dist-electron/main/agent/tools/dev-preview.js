"use strict";
/**
 * Dev Preview Tool - Start dev servers and preview applications
 * Like Cursor's preview feature
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
exports.startDevServer = startDevServer;
exports.stopDevServer = stopDevServer;
exports.stopAllServers = stopAllServers;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const activeServers = new Map();
async function startDevServer(options) {
    const { projectPath, command = 'npm run dev', port = 3000 } = options;
    if (!fs.existsSync(projectPath)) {
        return {
            success: false,
            message: `Project path does not exist: ${projectPath}`,
        };
    }
    // Check if already running
    if (activeServers.has(projectPath)) {
        const server = activeServers.get(projectPath);
        return {
            success: true,
            message: `Dev server already running at ${server.url}`,
            url: server.url,
            port: server.port,
        };
    }
    try {
        console.log(`[DevPreview] Starting dev server in ${projectPath}...`);
        // Start dev server
        const child = (0, child_process_1.spawn)(command, [], {
            cwd: projectPath,
            shell: true,
            env: { ...process.env, PORT: String(port) },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        let started = false;
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (!started) {
                    child.kill();
                    resolve({
                        success: false,
                        message: 'Dev server failed to start within 30 seconds',
                    });
                }
            }, 30000);
            child.stdout?.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log(`[DevPreview] ${text.trim()}`);
                // Detect common "ready" patterns
                if (text.includes('ready') ||
                    text.includes('Local:') ||
                    text.includes('running on') ||
                    text.includes('dev server running')) {
                    started = true;
                    clearTimeout(timeout);
                    const urlMatch = text.match(/https?:\/\/[^\s]+/);
                    const url = urlMatch ? urlMatch[0] : `http://localhost:${port}`;
                    activeServers.set(projectPath, {
                        process: child,
                        port,
                        url,
                    });
                    resolve({
                        success: true,
                        message: `Dev server started at ${url}`,
                        url,
                        port,
                    });
                }
            });
            child.stderr?.on('data', (data) => {
                const text = data.toString();
                console.error(`[DevPreview] Error: ${text.trim()}`);
            });
            child.on('error', (err) => {
                clearTimeout(timeout);
                resolve({
                    success: false,
                    message: `Failed to start dev server: ${err.message}`,
                });
            });
            child.on('exit', (code) => {
                if (!started) {
                    clearTimeout(timeout);
                    resolve({
                        success: false,
                        message: `Dev server exited with code ${code}. Output: ${output.slice(0, 200)}`,
                    });
                }
            });
        });
    }
    catch (err) {
        return {
            success: false,
            message: `Failed to start dev server: ${err.message}`,
        };
    }
}
function stopDevServer(projectPath) {
    const server = activeServers.get(projectPath);
    if (!server) {
        return {
            success: false,
            message: `No dev server running for ${projectPath}`,
        };
    }
    try {
        server.process.kill();
        activeServers.delete(projectPath);
        return {
            success: true,
            message: `Stopped dev server at ${server.url}`,
        };
    }
    catch (err) {
        return {
            success: false,
            message: `Failed to stop server: ${err.message}`,
        };
    }
}
function stopAllServers() {
    for (const [path, server] of activeServers.entries()) {
        try {
            server.process.kill();
            console.log(`[DevPreview] Stopped server: ${server.url}`);
        }
        catch { }
    }
    activeServers.clear();
}
// Auto-stop all on process exit
process.on('exit', stopAllServers);
process.on('SIGINT', () => {
    stopAllServers();
    process.exit(0);
});

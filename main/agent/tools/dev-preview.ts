/**
 * Dev Preview Tool - Start dev servers and preview applications
 * Like Cursor's preview feature
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DevServer {
  process: ChildProcess;
  port: number;
  url: string;
}

const activeServers = new Map<string, DevServer>();

export interface DevPreviewOptions {
  projectPath: string;
  command?: string;
  port?: number;
}

export interface DevPreviewResult {
  success: boolean;
  message: string;
  url?: string;
  port?: number;
}

export async function startDevServer(options: DevPreviewOptions): Promise<DevPreviewResult> {
  const { projectPath, command = 'npm run dev', port = 3000 } = options;
  
  if (!fs.existsSync(projectPath)) {
    return {
      success: false,
      message: `Project path does not exist: ${projectPath}`,
    };
  }
  
  // Check if already running
  if (activeServers.has(projectPath)) {
    const server = activeServers.get(projectPath)!;
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
    const child = spawn(command, [], {
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
      
      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.log(`[DevPreview] ${text.trim()}`);
        
        // Detect common "ready" patterns
        if (
          text.includes('ready') ||
          text.includes('Local:') ||
          text.includes('running on') ||
          text.includes('dev server running')
        ) {
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
      
      child.stderr?.on('data', (data: Buffer) => {
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
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to start dev server: ${err.message}`,
    };
  }
}

export function stopDevServer(projectPath: string): DevPreviewResult {
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
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to stop server: ${err.message}`,
    };
  }
}

export function stopAllServers(): void {
  for (const [path, server] of activeServers.entries()) {
    try {
      server.process.kill();
      console.log(`[DevPreview] Stopped server: ${server.url}`);
    } catch {}
  }
  activeServers.clear();
}

// Auto-stop all on process exit
process.on('exit', stopAllServers);
process.on('SIGINT', () => {
  stopAllServers();
  process.exit(0);
});

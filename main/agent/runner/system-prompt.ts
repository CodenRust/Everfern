import * as fs from 'fs';
import * as path from 'path';
import { homedir as osHomedir, userInfo as osUserInfo } from 'os';
import { loadSkills, loadSkillsAsync, formatSkillsForPrompt } from './skills-loader';

// ─────────────────────────────────────────────
// SYSTEM PROMPT CACHING
// ─────────────────────────────────────────────

interface CachedPrompt {
  prompt: string;
  timestamp: number;
  cacheKey: string;
}

class SystemPromptCache {
  private cache = new Map<string, CachedPrompt>();
  private maxAge = 300000; // 5 minutes
  private maxSize = 50;

  private generateCacheKey(
    platform: string,
    conversationId: string | undefined,
    sessionCreatedPaths: string[]
  ): string {
    const safeConvId = conversationId || 'current';
    // Create cache key based on parameters that affect prompt content
    const pathsHash = sessionCreatedPaths.join(',');
    return `${platform}:${safeConvId}:${pathsHash.length}`;
  }

  get(
    platform: string,
    conversationId: string | undefined,
    sessionCreatedPaths: string[]
  ): string | null {
    const key = this.generateCacheKey(platform, conversationId, sessionCreatedPaths);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.prompt;
  }

  set(
    platform: string,
    conversationId: string | undefined,
    sessionCreatedPaths: string[],
    prompt: string
  ): void {
    const key = this.generateCacheKey(platform, conversationId, sessionCreatedPaths);
    
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      prompt,
      timestamp: Date.now(),
      cacheKey: key
    });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

const promptCache = new SystemPromptCache();

// Cleanup cache every 2 minutes
setInterval(() => promptCache.cleanup(), 120000);

// ─────────────────────────────────────────────
// ASSEMBLY
// ─────────────────────────────────────────────

/**
 * Load and assemble system prompt asynchronously using fs.promises for non-blocking I/O
 * This function should be used before graph building to avoid blocking the event loop
 * 
 * @param platform - Operating system platform
 * @param conversationId - Conversation ID
 * @param sessionCreatedPaths - Session created paths
 * @param preloadedSkills - Optional pre-loaded skills to avoid loading them again
 */
export async function getSlimSystemPromptAsync(
  platform: string = 'win32', 
  conversationId?: string, 
  sessionCreatedPaths: string[] = [],
  preloadedSkills?: any[]
): Promise<string> {
  const safeConvId = conversationId && typeof conversationId === 'string' ? conversationId : 'current';
  
  const homedir = osHomedir();
  const homedirNorm = homedir.replace(/\\/g, '/');
  const user = osUserInfo();

  const planPath = `${homedirNorm}/.everfern/chat/plan/${safeConvId}/`;
  const artifactPath = `${homedirNorm}/.everfern/artifacts/${safeConvId}/`;
  const execPath = `${homedirNorm}/.everfern/exec/${safeConvId}/`;
  const sitePath = `${homedirNorm}/.everfern/sites/${safeConvId}/`;
  const uploadsPath = `${homedirNorm}/.everfern/attachments/`;

  // Read the Markdown file asynchronously
  let promptMd = '';
  const searchPaths = [
    path.join(__dirname, 'prompts', 'SYSTEM_PROMPT.md'),
    path.join(__dirname, '..', '..', 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md'), // Fallback from dist-electron
    path.join(process.cwd(), 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md'),
    path.join(process.cwd(), 'apps', 'desktop', 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md')
  ];

  for (const mdPath of searchPaths) {
    try {
      // Use async access to check if file exists
      await fs.promises.access(mdPath);
      promptMd = await fs.promises.readFile(mdPath, 'utf8');
      console.log(`[SystemPrompt] ✅ Successfully loaded prompt asynchronously from: ${mdPath}`);
      break;
    } catch (err) {
      // Continue to next path
    }
  }

  if (!promptMd) {
    console.error('[SystemPrompt] ❌ Failed to read SYSTEM_PROMPT.md from any search path.');
    promptMd = '# EverFern System Prompt\n(Error loading full prompt file - check logs)';
  }

  // OS Info
  const osInfo =
    platform === 'win32'
      ? '**OS**: Windows. Internal VM sandbox. Use PowerShell/cmd idioms. Paths use forward slashes internally (C:/Users/...). Raw strings for Python: r"C:\\\\Users\\\\..." .'
      : platform === 'darwin'
        ? '**OS**: macOS. Internal VM sandbox. Use ls, ps, /Applications/, standard Unix paths.'
        : '**OS**: Linux. Internal VM sandbox. Use ls, ps, standard Unix paths.';

  // Session File Registry
  const sessionRegistry = sessionCreatedPaths.length > 0
    ? sessionCreatedPaths.map(p => `- \`${p}\``).join('\n')
    : '_No files created in this session memory yet._';

  // Skills - use pre-loaded skills if provided, otherwise load asynchronously
  const skills = preloadedSkills || await loadSkillsAsync();
  const skillsTable = formatSkillsForPrompt(skills);
  const pluginsTable = '_All skills are loaded dynamically above._';

  // State Context
  const workspaceMounted = 'false';

  // Replace placeholders
  let finalPrompt = promptMd
    .replace(/{{OS_INFO}}/g, osInfo)
    .replace(/{{HOME_DIR}}/g, homedirNorm)
    .replace(/{{SESSION_ID}}/g, safeConvId)
    .replace(/{{PLAN_PATH}}/g, planPath)
    .replace(/{{EXEC_PATH}}/g, execPath)
    .replace(/{{ARTIFACT_PATH}}/g, artifactPath)
    .replace(/{{SITE_PATH}}/g, sitePath)
    .replace(/{{UPLOADS_PATH}}/g, uploadsPath)
    .replace(/{{SESSION_FILES}}/g, sessionRegistry)
    .replace(/{{SKILLS}}/g, skillsTable)
    .replace(/{{PLUGIN_SKILLS}}/g, pluginsTable)
    .replace(/{{CURRENT_DATE}}/g, new Date().toISOString().split('T')[0])
    .replace(/{{WORKSPACE_MOUNTED}}/g, workspaceMounted)
    .replace(/{{USER_NAME}}/g, user.username)
    .replace(/{{USER_EMAIL}}/g, 'noreply@everfern.com')
    .replace(/{{OTHER_TOOLS}}/g, ''); 

  return finalPrompt;
}

/**
 * Returns the full assembled system prompt by reading the MD file and injecting context.
 * Uses caching for better performance.
 * 
 * @param preloadedPrompt - Optional pre-loaded prompt content to skip file I/O
 */
export function getSlimSystemPrompt(
  platform: string = 'win32', 
  conversationId?: string, 
  sessionCreatedPaths: string[] = [],
  preloadedPrompt?: string
): string {
  // If pre-loaded prompt is provided, use it directly
  if (preloadedPrompt) {
    return preloadedPrompt;
  }
  
  const safeConvId = conversationId && typeof conversationId === 'string' ? conversationId : 'current';
  
  // Check cache first
  const cached = promptCache.get(platform, conversationId, sessionCreatedPaths);
  if (cached) {
    return cached;
  }

  const homedir = osHomedir();
  const homedirNorm = homedir.replace(/\\/g, '/');
  const user = osUserInfo();

  const planPath = `${homedirNorm}/.everfern/chat/plan/${safeConvId}/`;
  const artifactPath = `${homedirNorm}/.everfern/artifacts/${safeConvId}/`;
  const execPath = `${homedirNorm}/.everfern/exec/${safeConvId}/`;
  const sitePath = `${homedirNorm}/.everfern/sites/${safeConvId}/`;
  const uploadsPath = `${homedirNorm}/.everfern/attachments/`;
  const skillsPath = `${homedirNorm}/.everfern/skills/`;

  // Read the Markdown file (cache this separately if needed)
  let promptMd = '';
  const searchPaths = [
    path.join(__dirname, 'prompts', 'SYSTEM_PROMPT.md'),
    path.join(__dirname, '..', '..', 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md'), // Fallback from dist-electron
    path.join(process.cwd(), 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md'),
    path.join(process.cwd(), 'apps', 'desktop', 'main', 'agent', 'prompts', 'SYSTEM_PROMPT.md')
  ];

  for (const mdPath of searchPaths) {
    try {
      if (fs.existsSync(mdPath)) {
        promptMd = fs.readFileSync(mdPath, 'utf8');
        console.log(`[SystemPrompt] ✅ Successfully loaded prompt from: ${mdPath}`);
        break;
      }
    } catch (err) {
      // Continue to next path
    }
  }

  if (!promptMd) {
    console.error('[SystemPrompt] ❌ Failed to read SYSTEM_PROMPT.md from any search path.');
    promptMd = '# EverFern System Prompt\n(Error loading full prompt file - check logs)';
  }

  // OS Info
  const osInfo =
    platform === 'win32'
      ? '**OS**: Windows. Internal VM sandbox. Use PowerShell/cmd idioms. Paths use forward slashes internally (C:/Users/...). Raw strings for Python: r"C:\\\\Users\\\\..." .'
      : platform === 'darwin'
        ? '**OS**: macOS. Internal VM sandbox. Use ls, ps, /Applications/, standard Unix paths.'
        : '**OS**: Linux. Internal VM sandbox. Use ls, ps, standard Unix paths.';

  // Session File Registry
  const sessionRegistry = sessionCreatedPaths.length > 0
    ? sessionCreatedPaths.map(p => `- \`${p}\``).join('\n')
    : '_No files created in this session memory yet._';

  // Skills (load once and cache if needed)
  const skills = loadSkills();
  const skillsTable = formatSkillsForPrompt(skills);
  const pluginsTable = '_All skills are loaded dynamically above._';

  // State Context (can be improved by checking actual manager state)
  const workspaceMounted = 'false';

  // Replace placeholders
  let finalPrompt = promptMd
    .replace(/{{OS_INFO}}/g, osInfo)
    .replace(/{{HOME_DIR}}/g, homedirNorm)
    .replace(/{{SESSION_ID}}/g, safeConvId)
    .replace(/{{PLAN_PATH}}/g, planPath)
    .replace(/{{EXEC_PATH}}/g, execPath)
    .replace(/{{ARTIFACT_PATH}}/g, artifactPath)
    .replace(/{{SITE_PATH}}/g, sitePath)
    .replace(/{{UPLOADS_PATH}}/g, uploadsPath)
    .replace(/{{SESSION_FILES}}/g, sessionRegistry)
    .replace(/{{SKILLS}}/g, skillsTable)
    .replace(/{{PLUGIN_SKILLS}}/g, pluginsTable)
    .replace(/{{CURRENT_DATE}}/g, new Date().toISOString().split('T')[0])
    .replace(/{{WORKSPACE_MOUNTED}}/g, workspaceMounted)
    .replace(/{{USER_NAME}}/g, user.username)
    .replace(/{{USER_EMAIL}}/g, 'noreply@everfern.com')
    .replace(/{{OTHER_TOOLS}}/g, ''); 

  // Cache the result
  promptCache.set(platform, conversationId, sessionCreatedPaths, finalPrompt);

  return finalPrompt;
}

// ─────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────

/**
 * Build the messages array with dynamic system prompt injected.
 * 
 * @param preloadedPrompt - Optional pre-loaded prompt content to skip file I/O
 */
export function buildSystemMessages(
  history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
  userInput: string | any[],
  platform: string = 'win32',
  conversationId?: string,
  sessionCreatedPaths: string[] = [],
  preloadedPrompt?: string
): { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }>; slimmed: boolean } {
  const systemPrompt = getSlimSystemPrompt(platform, conversationId, sessionCreatedPaths, preloadedPrompt);
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userInput },
    ],
    slimmed: false,
  };
}

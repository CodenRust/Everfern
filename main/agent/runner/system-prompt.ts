import * as fs from 'fs';
import * as path from 'path';
import { homedir as osHomedir, userInfo as osUserInfo } from 'os';
import { loadSkills, formatSkillsForPrompt } from './skills-loader';

// ─────────────────────────────────────────────
// ASSEMBLY
// ─────────────────────────────────────────────

/**
 * Returns the full assembled system prompt by reading the MD file and injecting context.
 */
export function getSlimSystemPrompt(
  platform: string = 'win32', 
  conversationId?: string, 
  sessionCreatedPaths: string[] = []
): string {
  const homedir = osHomedir();
  const homedirNorm = homedir.replace(/\\/g, '/');
  const safeConvId = conversationId && typeof conversationId === 'string' ? conversationId : 'current';
  const user = osUserInfo();

  const planPath = `${homedirNorm}/.everfern/chat/plan/${safeConvId}/`;
  const artifactPath = `${homedirNorm}/.everfern/artifacts/${safeConvId}/`;
  const execPath = `${homedirNorm}/.everfern/exec/${safeConvId}/`;
  const sitePath = `${homedirNorm}/.everfern/sites/${safeConvId}/`;
  const uploadsPath = `${homedirNorm}/.everfern/attachments/`;
  const skillsPath = `${homedirNorm}/.everfern/skills/`;

  // Read the Markdown file
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

  // Skills
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

  return finalPrompt;
}

// ─────────────────────────────────────────────
// MESSAGE BUILDER
// ─────────────────────────────────────────────

/**
 * Build the messages array with dynamic system prompt injected.
 */
export function buildSystemMessages(
  history: Array<{ role: 'user' | 'assistant'; content: string | any[] }>,
  userInput: string | any[],
  platform: string = 'win32',
  conversationId?: string,
  sessionCreatedPaths: string[] = []
): { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }>; slimmed: boolean } {
  const systemPrompt = getSlimSystemPrompt(platform, conversationId, sessionCreatedPaths);
  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userInput },
    ],
    slimmed: false,
  };
}

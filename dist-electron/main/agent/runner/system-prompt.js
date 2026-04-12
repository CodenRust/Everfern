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
exports.getSlimSystemPromptAsync = getSlimSystemPromptAsync;
exports.getSlimSystemPrompt = getSlimSystemPrompt;
exports.buildSystemMessages = buildSystemMessages;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os_1 = require("os");
const skills_loader_1 = require("./skills-loader");
class SystemPromptCache {
    cache = new Map();
    maxAge = 300000; // 5 minutes
    maxSize = 50;
    generateCacheKey(platform, conversationId, sessionCreatedPaths) {
        const safeConvId = conversationId || 'current';
        // Create cache key based on parameters that affect prompt content
        const pathsHash = sessionCreatedPaths.join(',');
        return `${platform}:${safeConvId}:${pathsHash.length}`;
    }
    get(platform, conversationId, sessionCreatedPaths) {
        const key = this.generateCacheKey(platform, conversationId, sessionCreatedPaths);
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        // Check if cache entry is still valid
        if (Date.now() - cached.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }
        return cached.prompt;
    }
    set(platform, conversationId, sessionCreatedPaths, prompt) {
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
    cleanup() {
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
async function getSlimSystemPromptAsync(platform = 'win32', conversationId, sessionCreatedPaths = [], preloadedSkills) {
    const safeConvId = conversationId && typeof conversationId === 'string' ? conversationId : 'current';
    const homedir = (0, os_1.homedir)();
    const homedirNorm = homedir.replace(/\\/g, '/');
    const user = (0, os_1.userInfo)();
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
        }
        catch (err) {
            // Continue to next path
        }
    }
    if (!promptMd) {
        console.error('[SystemPrompt] ❌ Failed to read SYSTEM_PROMPT.md from any search path.');
        promptMd = '# EverFern System Prompt\n(Error loading full prompt file - check logs)';
    }
    // OS Info
    const osInfo = platform === 'win32'
        ? '**OS**: Windows. Internal VM sandbox. Use PowerShell/cmd idioms. Paths use forward slashes internally (C:/Users/...). Raw strings for Python: r"C:\\\\Users\\\\..." .'
        : platform === 'darwin'
            ? '**OS**: macOS. Internal VM sandbox. Use ls, ps, /Applications/, standard Unix paths.'
            : '**OS**: Linux. Internal VM sandbox. Use ls, ps, standard Unix paths.';
    // Session File Registry
    const sessionRegistry = sessionCreatedPaths.length > 0
        ? sessionCreatedPaths.map(p => `- \`${p}\``).join('\n')
        : '_No files created in this session memory yet._';
    // Skills - use pre-loaded skills if provided, otherwise load asynchronously
    const skills = preloadedSkills || await (0, skills_loader_1.loadSkillsAsync)();
    const skillsTable = (0, skills_loader_1.formatSkillsForPrompt)(skills);
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
function getSlimSystemPrompt(platform = 'win32', conversationId, sessionCreatedPaths = [], preloadedPrompt) {
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
    const homedir = (0, os_1.homedir)();
    const homedirNorm = homedir.replace(/\\/g, '/');
    const user = (0, os_1.userInfo)();
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
        }
        catch (err) {
            // Continue to next path
        }
    }
    if (!promptMd) {
        console.error('[SystemPrompt] ❌ Failed to read SYSTEM_PROMPT.md from any search path.');
        promptMd = '# EverFern System Prompt\n(Error loading full prompt file - check logs)';
    }
    // OS Info
    const osInfo = platform === 'win32'
        ? '**OS**: Windows. Internal VM sandbox. Use PowerShell/cmd idioms. Paths use forward slashes internally (C:/Users/...). Raw strings for Python: r"C:\\\\Users\\\\..." .'
        : platform === 'darwin'
            ? '**OS**: macOS. Internal VM sandbox. Use ls, ps, /Applications/, standard Unix paths.'
            : '**OS**: Linux. Internal VM sandbox. Use ls, ps, standard Unix paths.';
    // Session File Registry
    const sessionRegistry = sessionCreatedPaths.length > 0
        ? sessionCreatedPaths.map(p => `- \`${p}\``).join('\n')
        : '_No files created in this session memory yet._';
    // Skills (load once and cache if needed)
    const skills = (0, skills_loader_1.loadSkills)();
    const skillsTable = (0, skills_loader_1.formatSkillsForPrompt)(skills);
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
function buildSystemMessages(history, userInput, platform = 'win32', conversationId, sessionCreatedPaths = [], preloadedPrompt) {
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

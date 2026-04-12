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
exports.loadSkillsAsync = loadSkillsAsync;
exports.loadSkills = loadSkills;
exports.formatSkillsForPrompt = formatSkillsForPrompt;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const skills_sync_1 = require("../../lib/skills-sync");
/**
 * Load skills asynchronously using fs.promises for non-blocking I/O
 * This function should be used during initialization to avoid blocking the event loop
 */
async function loadSkillsAsync() {
    const skillsDir = (0, skills_sync_1.getSkillsPath)();
    const skills = [];
    console.log(`[SkillsLoader] 📂 Loading skills asynchronously from: ${skillsDir}`);
    try {
        // Check if directory exists using async access
        try {
            await fs.promises.access(skillsDir);
        }
        catch {
            console.warn(`[SkillsLoader] ⚠️ Skills directory does not exist: ${skillsDir}`);
            return skills;
        }
        const loadSkillFiles = async (currentPath, depth = 0) => {
            const indent = '  '.repeat(depth);
            console.log(`[SkillsLoader] ${indent}📁 Scanning directory: ${currentPath}`);
            const items = await fs.promises.readdir(currentPath);
            console.log(`[SkillsLoader] ${indent}   Found ${items.length} items`);
            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stat = await fs.promises.stat(itemPath);
                if (stat.isDirectory()) {
                    console.log(`[SkillsLoader] ${indent}   📁 [DIR] ${item}`);
                    await loadSkillFiles(itemPath, depth + 1);
                }
                else if (item === 'SKILL.md' || (item.endsWith('.md') && item.includes('SKILL'))) {
                    console.log(`[SkillsLoader] ${indent}   📄 [SKILL] ${item}`);
                    try {
                        const content = await fs.promises.readFile(itemPath, 'utf-8');
                        console.log(`[SkillsLoader] ${indent}      Parsing SKILL.md (${content.length} bytes)...`);
                        // Improved YAML frontmatter parser - handle quoted multiline descriptions
                        const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
                        if (match) {
                            const frontmatter = match[1];
                            console.log(`[SkillsLoader] ${indent}      Found YAML frontmatter (${frontmatter.length} bytes)`);
                            // Extract name: handle various YAML formats
                            const nameMatch = frontmatter.match(/(?:^|##\s*)name:\s*["']?([^"'\n]+)["']?/m);
                            console.log(`[SkillsLoader] ${indent}      Name match: ${nameMatch ? nameMatch[1] : 'NOT FOUND'}`);
                            // Extract description: handle quoted strings (single or double quotes)
                            let description = '';
                            // Try double quotes first
                            let descMatch = frontmatter.match(/description:\s*"([^"]*)"/m);
                            if (!descMatch) {
                                // Try single quotes
                                descMatch = frontmatter.match(/description:\s*'([^']*)'/m);
                            }
                            if (!descMatch) {
                                // Try unquoted (up to newline)
                                descMatch = frontmatter.match(/description:\s*([^\n]+)/m);
                            }
                            if (descMatch && descMatch[1]) {
                                description = descMatch[1].trim();
                            }
                            console.log(`[SkillsLoader] ${indent}      Description: ${description.slice(0, 50)}...`);
                            if (nameMatch && nameMatch[1] && description) {
                                const skillName = nameMatch[1].trim();
                                const skillPath = itemPath.replace(/\\/g, '/');
                                console.log(`[SkillsLoader] ${indent}      ✅ Added skill: ${skillName}`);
                                skills.push({
                                    name: skillName,
                                    description: description,
                                    path: skillPath
                                });
                            }
                            else {
                                console.warn(`[SkillsLoader] ${indent}      ❌ Missing name or description in frontmatter`);
                            }
                        }
                        else {
                            console.warn(`[SkillsLoader] ${indent}      ❌ No YAML frontmatter found`);
                        }
                    }
                    catch (err) {
                        console.error(`[SkillsLoader] ${indent}      ❌ Error parsing skill at ${itemPath}:`, err);
                    }
                }
            }
        };
        await loadSkillFiles(skillsDir);
        console.log(`[SkillsLoader] ✅ Async skill loading complete: Found ${skills.length} skills`);
        for (const skill of skills) {
            console.log(`[SkillsLoader]    • ${skill.name}`);
        }
        return skills;
    }
    catch (error) {
        console.error('[SkillsLoader] ❌ Error loading skills asynchronously:', error);
        return [];
    }
}
/**
 * Load skills synchronously (DEPRECATED - use loadSkillsAsync instead)
 * This function performs blocking file I/O and should not be called during graph compilation
 * @deprecated Use loadSkillsAsync() instead to avoid blocking the event loop
 */
function loadSkills() {
    const skillsDir = (0, skills_sync_1.getSkillsPath)();
    const skills = [];
    console.log(`[SkillsLoader] 📂 Loading skills from: ${skillsDir}`);
    try {
        if (!fs.existsSync(skillsDir)) {
            console.warn(`[SkillsLoader] ⚠️ Skills directory does not exist: ${skillsDir}`);
            return skills;
        }
        const loadSkillFiles = (currentPath, depth = 0) => {
            const indent = '  '.repeat(depth);
            console.log(`[SkillsLoader] ${indent}📁 Scanning directory: ${currentPath}`);
            const items = fs.readdirSync(currentPath);
            console.log(`[SkillsLoader] ${indent}   Found ${items.length} items`);
            for (const item of items) {
                const itemPath = path.join(currentPath, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    console.log(`[SkillsLoader] ${indent}   📁 [DIR] ${item}`);
                    loadSkillFiles(itemPath, depth + 1);
                }
                else if (item === 'SKILL.md' || (item.endsWith('.md') && item.includes('SKILL'))) {
                    console.log(`[SkillsLoader] ${indent}   📄 [SKILL] ${item}`);
                    try {
                        const content = fs.readFileSync(itemPath, 'utf-8');
                        console.log(`[SkillsLoader] ${indent}      Parsing SKILL.md (${content.length} bytes)...`);
                        // Improved YAML frontmatter parser - handle quoted multiline descriptions
                        const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
                        if (match) {
                            const frontmatter = match[1];
                            console.log(`[SkillsLoader] ${indent}      Found YAML frontmatter (${frontmatter.length} bytes)`);
                            // Extract name: handle various YAML formats
                            const nameMatch = frontmatter.match(/(?:^|##\s*)name:\s*["']?([^"'\n]+)["']?/m);
                            console.log(`[SkillsLoader] ${indent}      Name match: ${nameMatch ? nameMatch[1] : 'NOT FOUND'}`);
                            // Extract description: handle quoted strings (single or double quotes)
                            let description = '';
                            // Try double quotes first
                            let descMatch = frontmatter.match(/description:\s*"([^"]*)"/m);
                            if (!descMatch) {
                                // Try single quotes
                                descMatch = frontmatter.match(/description:\s*'([^']*)'/m);
                            }
                            if (!descMatch) {
                                // Try unquoted (up to newline)
                                descMatch = frontmatter.match(/description:\s*([^\n]+)/m);
                            }
                            if (descMatch && descMatch[1]) {
                                description = descMatch[1].trim();
                            }
                            console.log(`[SkillsLoader] ${indent}      Description: ${description.slice(0, 50)}...`);
                            if (nameMatch && nameMatch[1] && description) {
                                const skillName = nameMatch[1].trim();
                                const skillPath = itemPath.replace(/\\/g, '/');
                                console.log(`[SkillsLoader] ${indent}      ✅ Added skill: ${skillName}`);
                                skills.push({
                                    name: skillName,
                                    description: description,
                                    path: skillPath
                                });
                            }
                            else {
                                console.warn(`[SkillsLoader] ${indent}      ❌ Missing name or description in frontmatter`);
                            }
                        }
                        else {
                            console.warn(`[SkillsLoader] ${indent}      ❌ No YAML frontmatter found`);
                        }
                    }
                    catch (err) {
                        console.error(`[SkillsLoader] ${indent}      ❌ Error parsing skill at ${itemPath}:`, err);
                    }
                }
            }
        };
        loadSkillFiles(skillsDir);
        console.log(`[SkillsLoader] ✅ Skill loading complete: Found ${skills.length} skills`);
        for (const skill of skills) {
            console.log(`[SkillsLoader]    • ${skill.name}`);
        }
        return skills;
    }
    catch (error) {
        console.error('[SkillsLoader] ❌ Error loading skills:', error);
        return [];
    }
}
function formatSkillsForPrompt(skills) {
    if (!skills || !Array.isArray(skills) || skills.length === 0)
        return '';
    let prompt = `\n\n## Available Skills & How to Use Them

You have access to the following specialized skills. Each skill provides domain-specific procedures for handling specific file types or tasks.

### MANDATORY SKILL CALLING PROCEDURE:
1. **Detect** if your task matches any skill (check descriptions below)
2. **Invoke** by passing the skill name in your tool call JSON parameter: "skill": "skillName"
3. **Read** the skill's SKILL.md file using read_file
4. **Follow** the skill's exact procedures before implementing

### Skills Available:

`;
    for (const skill of skills) {
        if (!skill || !skill.name || !skill.description || !skill.path) {
            continue;
        }
        prompt += `**${skill.name}**\n`;
        prompt += `- File Path: ${skill.path}\n`;
        prompt += `- When to Use: ${skill.description}\n`;
        prompt += `- JSON Parameter: "skill": "${skill.name}"\n\n`;
    }
    prompt += `### EXAMPLE SKILL INVOCATION:\n{\n  "tool": "run_command",\n  "skill": "xlsx",\n  "CommandLine": "python analyze_spreadsheet.py",\n  "Cwd": "C:/Users/srini/.everfern/exec",\n  "WaitMsBeforeAsync": 8000,\n  "SafeToAutoRun": true\n}\n\nAfter invoking with a skill parameter, immediately read that skill's SKILL.md file to understand its procedures, then follow those procedures exactly.\n`;
    return prompt;
}

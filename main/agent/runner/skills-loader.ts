import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSkillsPath, validateAndCorrectSkillPath } from '../../lib/skills-sync';

export interface Skill {
  name: string;
  description: string;
  path: string;
}

export function loadSkills(): Skill[] {
  const skillsDir = getSkillsPath();
  const skills: Skill[] = [];

  console.log(`[SkillsLoader] 📂 Loading skills from: ${skillsDir}`);

  try {
    if (!fs.existsSync(skillsDir)) {
      console.warn(`[SkillsLoader] ⚠️ Skills directory does not exist: ${skillsDir}`);
      return skills;
    }

    const loadSkillFiles = (currentPath: string, depth = 0) => {
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
        } else if (item === 'SKILL.md' || (item.endsWith('.md') && item.includes('SKILL'))) {
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
              } else {
                console.warn(`[SkillsLoader] ${indent}      ❌ Missing name or description in frontmatter`);
              }
            } else {
              console.warn(`[SkillsLoader] ${indent}      ❌ No YAML frontmatter found`);
            }
          } catch (err) {
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
  } catch (error) {
    console.error('[SkillsLoader] ❌ Error loading skills:', error);
    return [];
  }
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  if (!skills || !Array.isArray(skills) || skills.length === 0) return '';

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

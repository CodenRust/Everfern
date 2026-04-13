"use strict";
/**
 * EverFern Skills Sync & Path Validation
 *
 * Automatically syncs built-in skills to ~/.everfern/skills/ on app startup
 * and provides path validation with spelling correction capabilities.
 *
 * Uses a content-hash dirty-check so the expensive wipe+copy is skipped
 * when the source skills have not changed since the last sync.
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
exports.syncBuiltInSkills = syncBuiltInSkills;
exports.validateAndCorrectSkillPath = validateAndCorrectSkillPath;
exports.getCustomSkillsPath = getCustomSkillsPath;
exports.getSkillsPath = getSkillsPath;
exports.mergeCustomSkills = mergeCustomSkills;
exports.listCustomSkills = listCustomSkills;
exports.saveCustomSkill = saveCustomSkill;
exports.deleteCustomSkill = deleteCustomSkill;
exports.ensureSkillsDirectoryExists = ensureSkillsDirectoryExists;
exports.listAvailableSkills = listAvailableSkills;
exports.resolveSkillPath = resolveSkillPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
// ── Levenshtein Distance for Spelling Correction ────────────────────────
function levenshteinDistance(a, b) {
    const lenA = a.length;
    const lenB = b.length;
    const matrix = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(0));
    for (let i = 0; i <= lenA; i++)
        matrix[i][0] = i;
    for (let j = 0; j <= lenB; j++)
        matrix[0][j] = j;
    for (let i = 1; i <= lenA; i++) {
        for (let j = 1; j <= lenB; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, // deletion
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[lenA][lenB];
}
// ── Version-hash helpers ────────────────────────────────────────────────
const SYNC_VERSION_FILE = '.sync-version';
/**
 * Walk `dir` and produce a deterministic hash string from every file's
 * relative path + size + last-modified time.  Changes to any file will
 * produce a different hash.
 */
function computeDirHash(dir) {
    const entries = [];
    function walk(current, prefix) {
        const items = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
        for (const item of items) {
            const rel = prefix ? `${prefix}/${item.name}` : item.name;
            if (item.isDirectory()) {
                walk(path.join(current, item.name), rel);
            }
            else {
                const stat = fs.statSync(path.join(current, item.name));
                entries.push(`${rel}:${stat.size}:${stat.mtimeMs}`);
            }
        }
    }
    try {
        walk(dir, '');
    }
    catch {
        return '';
    }
    return crypto.createHash('sha1').update(entries.join('\n')).digest('hex');
}
function readSyncVersion(skillsDir) {
    try {
        return fs.readFileSync(path.join(skillsDir, SYNC_VERSION_FILE), 'utf-8').trim();
    }
    catch {
        return '';
    }
}
function writeSyncVersion(skillsDir, hash) {
    try {
        fs.writeFileSync(path.join(skillsDir, SYNC_VERSION_FILE), hash, 'utf-8');
    }
    catch {
        // non-critical
    }
}
// ── Recursively copy directory ──────────────────────────────────────────
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
// ── Traverse directory and collect all skill paths ───────────────────────
function getAllSkillPaths(skillsDir, prefix = '') {
    const results = [];
    if (!fs.existsSync(skillsDir)) {
        return results;
    }
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(skillsDir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            results.push(...getAllSkillPaths(fullPath, relPath));
        }
        else {
            results.push({
                name: entry.name,
                relPath,
                fullPath
            });
        }
    }
    return results;
}
// ── Sync built-in skills to ~/.everfern/skills ──────────────────────────
function syncBuiltInSkills() {
    try {
        const configDir = path.join(os.homedir(), '.everfern');
        const skillsDir = path.join(configDir, 'skills');
        // Ensure directories exist
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        // Try multiple possible locations for built-in skills
        const possibleLocations = [
            // Location 1: dist-electron/main/skills (compiled production)
            path.join(__dirname, '..', 'skills'),
            // Location 2: main/skills (source/dev)
            path.join(__dirname, '..', '..', 'main', 'skills'),
            // Location 3: ../../../main/skills (if lib is nested differently)
            path.join(__dirname, '..', '..', '..', 'main', 'skills'),
            // Location 4: Absolute path from app root
            path.join(__dirname, '..', '..', '..', '..', '..', 'apps', 'desktop', 'main', 'skills'),
        ];
        let builtInSkillsDir = null;
        console.log(`[SkillsSync] 🔍 Searching for built-in skills directory...`);
        for (const loc of possibleLocations) {
            console.log(`[SkillsSync]    Checking: ${loc}`);
            if (fs.existsSync(loc)) {
                console.log(`[SkillsSync]    ✅ Found: ${loc}`);
                builtInSkillsDir = loc;
                break;
            }
        }
        if (!builtInSkillsDir) {
            console.warn(`[SkillsSync] ⚠️ Built-in skills directory not found in any of these locations:`);
            for (const loc of possibleLocations) {
                console.warn(`[SkillsSync]    - ${loc}`);
            }
            console.warn(`[SkillsSync] ℹ️ Skills will need to be manually placed in: ${skillsDir}`);
            return;
        }
        // ── Dirty-check: skip wipe+copy if source hasn't changed ───────────
        const sourceHash = computeDirHash(builtInSkillsDir);
        const cachedHash = readSyncVersion(skillsDir);
        if (sourceHash && sourceHash === cachedHash && fs.existsSync(skillsDir)) {
            console.log(`[SkillsSync] ✅ Skills already up-to-date (hash ${sourceHash.slice(0, 8)}…) — skipping sync`);
            return;
        }
        console.log(`[SkillsSync] 📦 Syncing built-in skills`);
        console.log(`[SkillsSync]    From: ${builtInSkillsDir}`);
        console.log(`[SkillsSync]    To:   ${skillsDir}`);
        // Clear existing skills and copy fresh
        if (fs.existsSync(skillsDir)) {
            console.log(`[SkillsSync] 🔄 Clearing existing skills`);
            fs.rmSync(skillsDir, { recursive: true, force: true });
        }
        // Copy all built-in skills
        copyDirRecursive(builtInSkillsDir, skillsDir);
        // Persist the hash so the next startup can skip the sync
        writeSyncVersion(skillsDir, sourceHash);
        // Log synced skills
        const syncedSkills = getAllSkillPaths(skillsDir);
        console.log(`[SkillsSync] ✅ Skills synced successfully (${syncedSkills.length} files)`);
        // Group by skill
        const skillGroups = new Map();
        for (const skill of syncedSkills) {
            const skillName = skill.relPath.split('/')[0];
            skillGroups.set(skillName, (skillGroups.get(skillName) || 0) + 1);
        }
        const skillEntries = Array.from(skillGroups.entries());
        for (const [skillName, count] of skillEntries) {
            console.log(`[SkillsSync]    • ${skillName} (${count} files)`);
        }
    }
    catch (error) {
        console.error(`[SkillsSync] ❌ Error syncing skills:`, error);
    }
}
function validateAndCorrectSkillPath(providedPath, threshold = 0.7) {
    try {
        const configDir = path.join(os.homedir(), '.everfern');
        const skillsDir = path.join(configDir, 'skills');
        const homeDir = os.homedir();
        console.log(`[PathValidation] 🔍 Validating path: ${providedPath}`);
        // ── Extract relative path from absolute paths ──────────────────────
        let relativeProvided = providedPath;
        // If path is absolute, try to extract the relative skill path
        if (providedPath.includes('.everfern/skills')) {
            const parts = providedPath.split('.everfern/skills/');
            if (parts.length > 1) {
                relativeProvided = parts[parts.length - 1];
                console.log(`[PathValidation] 📍 Extracted relative path: ${relativeProvided}`);
            }
        }
        // Normalize the path
        const normalizedPath = relativeProvided.replace(/\\/g, '/').toLowerCase();
        // Check if path exists exactly
        const absolutePath = path.join(skillsDir, relativeProvided);
        if (fs.existsSync(absolutePath)) {
            console.log(`[PathValidation] ✅ Path is valid`);
            return { isValid: true };
        }
        console.log(`[PathValidation] ⚠️ Path not found: ${absolutePath}`);
        // ── Try to fix truncated usernames in absolute paths ──────────────────
        if (providedPath.includes('Users/') && !providedPath.includes(path.basename(homeDir))) {
            const username = path.basename(homeDir);
            const truncated = username.slice(-3); // Last few chars of username
            if (providedPath.includes(`Users/${truncated}/`)) {
                const corrected = providedPath.replace(`Users/${truncated}/`, `Users/${username}/`);
                console.log(`[PathValidation] 🔧 Detected truncated username "${truncated}", corrected to "${username}"`);
                // Recursively try with corrected path
                return validateAndCorrectSkillPath(corrected, threshold);
            }
        }
        // Get all available skills
        const allSkills = getAllSkillPaths(skillsDir);
        const availablePaths = allSkills.map(s => s.relPath.toLowerCase());
        // Find closest matches using Levenshtein distance
        const matches = [];
        for (const availPath of availablePaths) {
            const distance = levenshteinDistance(normalizedPath, availPath);
            const maxLen = Math.max(normalizedPath.length, availPath.length);
            const score = 1 - (distance / maxLen);
            if (score >= threshold) {
                matches.push({ path: availPath, distance, score });
            }
        }
        // Sort by score (highest first)
        matches.sort((a, b) => b.score - a.score);
        if (matches.length > 0) {
            const bestMatch = matches[0];
            const suggestions = matches.map(m => m.path);
            console.log(`[PathValidation] 🎯 Found corrections:`);
            for (const suggestion of suggestions.slice(0, 3)) {
                console.log(`[PathValidation]    • ${suggestion}`);
            }
            return {
                isValid: false,
                correctedPath: bestMatch.path,
                suggestions: suggestions.slice(0, 5),
                confidence: bestMatch.score
            };
        }
        console.log(`[PathValidation] ❌ No corrections found`);
        console.log(`[PathValidation] 📋 Available skills:`);
        const skillsGrouped = new Map();
        for (const skillPath of availablePaths) {
            const skillName = skillPath.split('/')[0];
            if (!skillsGrouped.has(skillName)) {
                skillsGrouped.set(skillName, []);
            }
            skillsGrouped.get(skillName).push(skillPath);
        }
        const skillsGroupedEntries = Array.from(skillsGrouped.entries());
        for (const [skillName, paths] of skillsGroupedEntries) {
            console.log(`[PathValidation]    • ${skillName}/`);
            for (const p of paths.slice(0, 3)) {
                console.log(`[PathValidation]      - ${p}`);
            }
            if (paths.length > 3) {
                console.log(`[PathValidation]      ... and ${paths.length - 3} more`);
            }
        }
        return { isValid: false, suggestions: availablePaths.slice(0, 5) };
    }
    catch (error) {
        console.error(`[PathValidation] ❌ Validation error:`, error);
        return { isValid: false };
    }
}
// ── Custom Skills Directory ─────────────────────────────────────────
function getCustomSkillsPath() {
    return path.join(os.homedir(), '.everfern', 'custom_skills');
}
function getSkillsPath() {
    return path.join(os.homedir(), '.everfern', 'skills');
}
// ── Merge custom skills to main skills directory ───────────────────
function mergeCustomSkills() {
    try {
        const customDir = getCustomSkillsPath();
        const skillsDir = getSkillsPath();
        if (!fs.existsSync(customDir)) {
            console.log('[SkillsSync] ℹ️ No custom_skills directory found');
            return;
        }
        if (!fs.existsSync(skillsDir)) {
            fs.mkdirSync(skillsDir, { recursive: true });
        }
        const customEntries = fs.readdirSync(customDir, { withFileTypes: true });
        let mergedCount = 0;
        for (const entry of customEntries) {
            const srcPath = path.join(customDir, entry.name);
            const destPath = path.join(skillsDir, entry.name);
            if (entry.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                const subEntries = fs.readdirSync(srcPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                    fs.copyFileSync(path.join(srcPath, subEntry.name), path.join(destPath, subEntry.name));
                    mergedCount++;
                }
            }
            else {
                fs.copyFileSync(srcPath, destPath);
                mergedCount++;
            }
        }
        console.log(`[SkillsSync] ✅ Merged ${mergedCount} custom skills to runtime skills directory`);
    }
    catch (error) {
        console.error('[SkillsSync] ❌ Error merging custom skills:', error);
    }
}
// ── List custom skills ─────────────────────────────────────────────────
function listCustomSkills() {
    const customDir = getCustomSkillsPath();
    const skills = [];
    try {
        if (!fs.existsSync(customDir)) {
            return skills;
        }
        const entries = fs.readdirSync(customDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillPath = path.join(customDir, entry.name);
                const skillMdPath = path.join(skillPath, 'SKILL.md');
                if (fs.existsSync(skillMdPath)) {
                    const content = fs.readFileSync(skillMdPath, 'utf-8');
                    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
                    if (match) {
                        const frontmatter = match[1];
                        const nameMatch = frontmatter.match(/^name:\s*["']?([^"'\n]+)["']?/m);
                        let descMatch = frontmatter.match(/^description:\s*"([^"]*)"/m);
                        if (!descMatch) {
                            descMatch = frontmatter.match(/^description:\s*'([^']*)'/m);
                        }
                        if (!descMatch) {
                            descMatch = frontmatter.match(/^description:\s*([^\n]+)/m);
                        }
                        skills.push({
                            name: nameMatch?.[1]?.trim() || entry.name,
                            path: skillPath,
                            description: descMatch?.[1]?.trim() || ''
                        });
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('[SkillsSync] ❌ Error listing custom skills:', error);
    }
    return skills;
}
function saveCustomSkill(data) {
    try {
        const customDir = getCustomSkillsPath();
        if (!fs.existsSync(customDir)) {
            fs.mkdirSync(customDir, { recursive: true });
        }
        const sanitizedName = data.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        const skillDir = path.join(customDir, sanitizedName);
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }
        const skillMdContent = `---
name: ${data.name}
description: "${data.description}"
---

${data.content}
`;
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf-8');
        console.log(`[SkillsSync] ✅ Saved custom skill: ${data.name}`);
        return { success: true };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[SkillsSync] ❌ Error saving custom skill:', errorMsg);
        return { success: false, error: errorMsg };
    }
}
// ── Delete a custom skill ────────────────────────────────────────────
function deleteCustomSkill(name) {
    try {
        const customDir = getCustomSkillsPath();
        const skillDir = path.join(customDir, name);
        if (!fs.existsSync(skillDir)) {
            return { success: false, error: 'Skill not found' };
        }
        fs.rmSync(skillDir, { recursive: true, force: true });
        console.log(`[SkillsSync] ✅ Deleted custom skill: ${name}`);
        return { success: true };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[SkillsSync] ❌ Error deleting custom skill:', errorMsg);
        return { success: false, error: errorMsg };
    }
}
// ── Ensure skills directory exists (even if empty) ──────────────────
function ensureSkillsDirectoryExists() {
    const skillsDir = getSkillsPath();
    if (!fs.existsSync(skillsDir)) {
        console.log(`[SkillsSync] 📁 Creating skills directory: ${skillsDir}`);
        fs.mkdirSync(skillsDir, { recursive: true });
    }
    return skillsDir;
}
// ── List all available skills ──────────────────────────────────────────
function listAvailableSkills() {
    try {
        const skillsDir = getSkillsPath();
        if (!fs.existsSync(skillsDir)) {
            return [];
        }
        const allSkills = getAllSkillPaths(skillsDir);
        const skillNames = new Set();
        for (const skill of allSkills) {
            const skillName = skill.relPath.split('/')[0];
            skillNames.add(skillName);
        }
        return Array.from(skillNames).sort();
    }
    catch (error) {
        console.error(`[SkillsSync] ❌ Error listing skills:`, error);
        return [];
    }
}
// ── Resolve skill path with auto-correction ──────────────────────────────
function resolveSkillPath(providedPath) {
    try {
        const skillsDir = getSkillsPath();
        // If the provided path is already absolute and contains the skills directory,
        // extract the relative portion to prevent double-joining.
        let relativePath = providedPath;
        const normalizedProvided = providedPath.replace(/\\/g, '/');
        if (normalizedProvided.includes('.everfern/skills/')) {
            const parts = normalizedProvided.split('.everfern/skills/');
            if (parts.length > 1) {
                relativePath = parts[parts.length - 1];
            }
        }
        const absolutePath = path.join(skillsDir, relativePath);
        // Try exact match first
        if (fs.existsSync(absolutePath)) {
            return absolutePath;
        }
        // Try validation and correction
        const validation = validateAndCorrectSkillPath(relativePath);
        if (validation.isValid) {
            return path.join(skillsDir, relativePath);
        }
        if (validation.correctedPath) {
            const correctedAbsPath = path.join(skillsDir, validation.correctedPath);
            console.log(`[PathResolution] 🔁 Auto-correcting path:`);
            console.log(`[PathResolution]    From: ${providedPath}`);
            console.log(`[PathResolution]    To:   ${validation.correctedPath}`);
            console.log(`[PathResolution]    Confidence: ${(validation.confidence * 100).toFixed(1)}%`);
            if (fs.existsSync(correctedAbsPath)) {
                return correctedAbsPath;
            }
        }
        return null;
    }
    catch (error) {
        console.error(`[PathResolution] ❌ Error resolving path:`, error);
        return null;
    }
}

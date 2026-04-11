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
exports.listSites = listSites;
exports.readSiteFile = readSiteFile;
exports.writeSiteFile = writeSiteFile;
exports.deleteSite = deleteSite;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const SITES_DIR = path.join(os.homedir(), '.everfern', 'sites');
/**
 * Lists all generated sites/reports.
 */
function listSites(chatId) {
    if (!fs.existsSync(SITES_DIR))
        return [];
    const results = [];
    try {
        const dirs = chatId ? [chatId] : fs.readdirSync(SITES_DIR).filter(f => fs.statSync(path.join(SITES_DIR, f)).isDirectory());
        for (const dir of dirs) {
            const dirPath = path.join(SITES_DIR, dir);
            if (!fs.existsSync(dirPath))
                continue;
            const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                if (!fs.existsSync(filePath))
                    continue;
                const stats = fs.statSync(filePath);
                results.push({
                    id: file,
                    chatId: dir,
                    name: file,
                    lastEdited: stats.mtimeMs,
                    size: stats.size,
                    path: filePath
                });
            }
        }
    }
    catch (e) {
        console.error('[SitesStore] List failed:', e);
    }
    return results.sort((a, b) => b.lastEdited - a.lastEdited);
}
/**
 * Reads a site file (usually index.html).
 */
function readSiteFile(chatId, filename) {
    const p = path.join(SITES_DIR, chatId, filename);
    if (!fs.existsSync(p))
        return null;
    try {
        return fs.readFileSync(p, 'utf-8');
    }
    catch {
        return null;
    }
}
/**
 * Writes a file to a site project.
 */
function writeSiteFile(chatId, filename, content) {
    try {
        const dir = path.join(SITES_DIR, chatId);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
        return { success: true };
    }
    catch (e) {
        return { success: false, error: String(e) };
    }
}
/**
 * Deletes a site project or file.
 */
function deleteSite(chatId, filename) {
    try {
        const p = filename ? path.join(SITES_DIR, chatId, filename) : path.join(SITES_DIR, chatId);
        if (fs.existsSync(p)) {
            if (fs.statSync(p).isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
            }
            else {
                fs.unlinkSync(p);
            }
        }
        return { success: true };
    }
    catch {
        return { success: false };
    }
}

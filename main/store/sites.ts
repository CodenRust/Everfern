import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SiteMeta {
  id: string; // filename or foldername
  chatId: string;
  name: string;
  lastEdited: number;
  size: number;
  path: string;
}

const SITES_DIR = path.join(os.homedir(), '.everfern', 'sites');

/**
 * Lists all generated sites/reports.
 */
export function listSites(chatId?: string): SiteMeta[] {
  if (!fs.existsSync(SITES_DIR)) return [];

  const results: SiteMeta[] = [];
  try {
    const dirs = chatId ? [chatId] : fs.readdirSync(SITES_DIR).filter(f => fs.statSync(path.join(SITES_DIR, f)).isDirectory());
    for (const dir of dirs) {
      const dirPath = path.join(SITES_DIR, dir);
      if (!fs.existsSync(dirPath)) continue;
      const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (!fs.existsSync(filePath)) continue;
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
  } catch (e) {
    console.error('[SitesStore] List failed:', e);
  }
  return results.sort((a, b) => b.lastEdited - a.lastEdited);
}

/**
 * Reads a site file (usually index.html).
 */
export function readSiteFile(chatId: string, filename: string): string | null {
  const p = path.join(SITES_DIR, chatId, filename);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Writes a file to a site project.
 */
export function writeSiteFile(chatId: string, filename: string, content: string): { success: boolean; error?: string } {
  try {
    const dir = path.join(SITES_DIR, chatId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Deletes a site project or file.
 */
export function deleteSite(chatId: string, filename?: string): { success: boolean } {
  try {
    const p = filename ? path.join(SITES_DIR, chatId, filename) : path.join(SITES_DIR, chatId);
    if (fs.existsSync(p)) {
      if (fs.statSync(p).isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
      } else {
        fs.unlinkSync(p);
      }
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

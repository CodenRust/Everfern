import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PLAN_BASE = path.join(os.homedir(), '.everfern', 'chat', 'plan');

function planDir(chatId: string): string {
  return path.join(PLAN_BASE, chatId);
}

function ensurePlanDir(chatId: string): void {
  const dir = planDir(chatId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Write a plan file for a given chat. */
export function writePlan(chatId: string, filename: string, content: string): { success: boolean; error?: string } {
  try {
    ensurePlanDir(chatId);
    fs.writeFileSync(path.join(planDir(chatId), filename), content, 'utf-8');
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Read a plan file. Returns null if not found. */
export function readPlan(chatId: string, filename: string): string | null {
  const p = path.join(planDir(chatId), filename);
  if (!fs.existsSync(p)) return null;
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/** Check whether any plan files exist for a chat. Returns the list of filenames. */
export function listPlans(chatId: string): string[] {
  const dir = planDir(chatId);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir).filter(f => !f.startsWith('.') && fs.statSync(path.join(dir, f)).isFile());
  } catch {
    return [];
  }
}

/** Delete a single plan file. */
export function deletePlan(chatId: string, filename: string): { success: boolean } {
  try {
    const p = path.join(planDir(chatId), filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { success: true };
  } catch {
    return { success: false };
  }
}

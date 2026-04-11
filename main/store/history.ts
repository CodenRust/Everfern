/**
 * EverFern Desktop — Chat History Store
 * 
 * Persists conversation history to ~/.everfern/store/conversations/
 * Each conversation is saved as a separate JSON file.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Conversation, ConversationSummary } from '../acp/types';

const CONVERSATIONS_DIR = path.join(os.homedir(), '.everfern', 'conversations');
const TIMELINE_DIR = path.join(os.homedir(), '.everfern', 'timeline');

function ensureDir(): void {
  if (!fs.existsSync(CONVERSATIONS_DIR)) {
    fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(TIMELINE_DIR)) {
    fs.mkdirSync(TIMELINE_DIR, { recursive: true });
  }
}

export class ChatHistoryStore {
  constructor() {
    ensureDir();
  }

  /**
   * List all conversations (summary only, no messages).
   * Sorted by updatedAt descending (newest first).
   */
  list(): ConversationSummary[] {
    ensureDir();
    try {
      const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
      const summaries: ConversationSummary[] = [];

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(CONVERSATIONS_DIR, file), 'utf-8');
          const conv: Conversation = JSON.parse(raw);
          summaries.push({
            id: conv.id,
            title: conv.title,
            provider: conv.provider,
            messageCount: conv.messages.length,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          });
        } catch {
          // Skip corrupted files
        }
      }

      return summaries.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (err) {
      console.error('[History] Failed to list conversations:', err);
      return [];
    }
  }

  /**
   * Load a full conversation by ID.
   */
  load(id: string): Conversation | null {
    try {
      const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const conv: Conversation = JSON.parse(raw);
      
      const timelineFolderPath = path.join(TIMELINE_DIR, id);
      if (fs.existsSync(timelineFolderPath)) {
        conv.messages.forEach(msg => {
          if (msg.hasTimeline && msg.id) {
            const tlPath = path.join(timelineFolderPath, `${msg.id}.json`);
            if (fs.existsSync(tlPath)) {
              try {
                const tlRaw = fs.readFileSync(tlPath, 'utf-8');
                const tlData = JSON.parse(tlRaw);
                msg.thought = tlData.thought;
                msg.toolCalls = tlData.toolCalls;
              } catch (e) {
                console.warn(`[History] Failed to parse timeline data for ${msg.id}`);
              }
            }
          }
        });
      }
      return conv;
    } catch (err) {
      console.error(`[History] Failed to load conversation ${id}:`, err);
      return null;
    }
  }

  /**
   * Save a conversation (create or update).
   */
  save(conversation: Conversation): { success: boolean; error?: string } {
    ensureDir();
    try {
      const clonedConv: Conversation = JSON.parse(JSON.stringify(conversation));
      let hasAnyTimeline = false;
      const timelineFolderPath = path.join(TIMELINE_DIR, clonedConv.id);

      clonedConv.messages.forEach((msg) => {
        if (msg.thought || (msg.toolCalls && msg.toolCalls.length > 0)) {
          if (!hasAnyTimeline) {
            hasAnyTimeline = true;
            if (!fs.existsSync(timelineFolderPath)) fs.mkdirSync(timelineFolderPath, { recursive: true });
          }
          if (!msg.id) msg.id = `msg-${Date.now()}-${Math.random().toString(36).substring(2,9)}`;
          
          const tlData = {
            thought: msg.thought,
            toolCalls: msg.toolCalls
          };
          const tlPath = path.join(timelineFolderPath, `${msg.id}.json`);
          fs.writeFileSync(tlPath, JSON.stringify(tlData, null, 2));

          msg.hasTimeline = true;
          delete msg.thought;
          delete msg.toolCalls;
        }
      });

      const filePath = path.join(CONVERSATIONS_DIR, `${clonedConv.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(clonedConv, null, 2));

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[History] Failed to save conversation:`, msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a conversation by ID.
   */
  delete(id: string): { success: boolean; error?: string } {
    try {
      const filePath = path.join(CONVERSATIONS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const timelineFolderPath = path.join(TIMELINE_DIR, id);
      if (fs.existsSync(timelineFolderPath)) {
        fs.rmSync(timelineFolderPath, { recursive: true, force: true });
      }
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[History] Failed to delete conversation ${id}:`, msg);
      return { success: false, error: msg };
    }
  }
}

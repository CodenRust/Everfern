import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AIClient } from '../lib/ai-client';
import { ChatMessage } from '../acp/types';

const MEMORY_FILE_PATH = path.join(os.homedir(), '.everfern', 'MEMORY.md');

/**
 * Non-blocking memory reflection.
 * Spawns an anonymous background task to analyze the mission and update MEMORY.md.
 */
export function reflectAndRemember(
  history: ChatMessage[],
  userInput: string,
  response: string,
  client: AIClient
): void {
  // Fire and forget - do not await
  (async () => {
    try {
      const recentContext = history.slice(-5);
      const prompt = `Analyze this interaction and extract key learnings for your long-term memory.
Focus on:
1. User preferences (coding style, tools, languages).
2. Project-specific architecture or quirks.
3. What worked well vs. what failed.

Interaction:
User: "${userInput}"
Assistant: "${response.substring(0, 1000)}..."

Current Memory Content:
${fs.existsSync(MEMORY_FILE_PATH) ? fs.readFileSync(MEMORY_FILE_PATH, 'utf-8') : 'Empty'}

Respond with ONLY the new memory entries in Markdown format (bullets). 
If nothing new/important was learned, respond with "NO_NEW_MEMORY".`;

      const analysis = await client.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });

      const content = typeof analysis.content === 'string' ? analysis.content : '';
      if (content.includes('NO_NEW_MEMORY')) return;

      const timestamp = new Date().toISOString().split('T')[0];
      const entry = `\n\n### ${timestamp}\n${content}`;

      const dir = path.dirname(MEMORY_FILE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.appendFileSync(MEMORY_FILE_PATH, entry);
      console.log('[Memory] 🧠 Self-improvement logged to MEMORY.md');
    } catch (err) {
      console.error('[Memory] ❌ Reflection failed:', err);
    }
  })();
}

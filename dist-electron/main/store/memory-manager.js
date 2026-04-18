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
exports.reflectAndRemember = reflectAndRemember;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const MEMORY_FILE_PATH = path.join(os.homedir(), '.everfern', 'MEMORY.md');
/**
 * Non-blocking memory reflection.
 * Spawns an anonymous background task to analyze the mission and update MEMORY.md.
 */
function reflectAndRemember(history, userInput, response, client) {
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
            if (content.includes('NO_NEW_MEMORY'))
                return;
            const timestamp = new Date().toISOString().split('T')[0];
            const entry = `\n\n### ${timestamp}\n${content}`;
            const dir = path.dirname(MEMORY_FILE_PATH);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(MEMORY_FILE_PATH, entry);
            console.log('[Memory] 🧠 Self-improvement logged to MEMORY.md');
        }
        catch (err) {
            console.error('[Memory] ❌ Reflection failed:', err);
        }
    })();
}

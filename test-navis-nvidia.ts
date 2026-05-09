/**
 * NAVIS Test with NVIDIA NIM API + Mistral Small
 * 
 * Tests the improved NAVIS browser tool with:
 * - Provider: nvidia (NVIDIA NIM API)
 * - Model: mistralai/mistral-small-4-119b-2603
 * - API Key: Read from ~/.everfern/keys/nvidia.key
 */

import { AIClient } from './main/lib/ai-client';
import { NavisOrchestrator, NAVIS_DECISION_SCHEMA } from './main/agent/tools/navis/orchestrator';
import { NavisLogger } from './main/agent/tools/navis/logger';
import * as fs from 'fs';
import * as path from 'path';

// Read API key from system
const keyPath = path.join(process.env.USERPROFILE || '', '.everfern', 'keys', 'nvidia.key');
const nvidiaApiKey = fs.readFileSync(keyPath, 'utf-8').trim();

console.log('[Test] Starting NAVIS test with NVIDIA NIM + Mistral Small...');
console.log(`[Test] API Key loaded: ${nvidiaApiKey ? 'YES (length: ' + nvidiaApiKey.length + ')' : 'NO'}`);

// Create AI client with NVIDIA NIM
const client = new AIClient({
  provider: 'nvidia',
  apiKey: nvidiaApiKey,
  model: 'mistralai/mistral-small-4-119b-2603',
  temperature: 0.3,
  maxTokens: 4096,
});

console.log(`[Test] AI Client created - Provider: nvidia, Model: mistralai/mistral-small-4-119b-2603`);

// Create logger
const logger = new NavisLogger();
logger.on((event) => {
  console.log(`[NAVIS ${event.type}]`, event);
});

// Create NAVIS orchestrator
const navis = new NavisOrchestrator(client, logger);

// Test task: Navigate to a simple page and interact
const testTask = 'Navigate to https://example.com and tell me what you see on the page';

console.log(`[Test] Running NAVIS with task: "${testTask}"`);

navis.run({
  task: testTask,
  maxSteps: 5,
  maxActionsPerStep: 3,
  headless: false, // Show browser for debugging
  startUrl: 'https://example.com',
  onProgress: (msg) => console.log(`[Progress]`, msg),
}).then(result => {
  console.log('\n[Test] === NAVIS Test Complete ===');
  console.log(`[Test] Success: ${result.success}`);
  console.log(`[Test] Output: ${result.output}`);
  console.log(`[Test] Steps: ${result.steps}`);
  
  if (!result.success) {
    console.error(`[Test] FAILED: ${result.output}`);
    process.exit(1);
  }
  
  console.log('[Test] ✅ NAVIS with Mistral Small via NVIDIA NIM works!');
  process.exit(0);
}).catch(err => {
  console.error('[Test] Error:', err);
  process.exit(1);
});

/**
 * Integration test to verify graph building performance after async optimization
 */

import { describe, test, expect } from 'vitest';
import { getSlimSystemPromptAsync } from '../system-prompt';
import { loadSkillsAsync } from '../skills-loader';

describe('Graph Build Performance - Async Optimization', () => {
  test('loadSkillsAsync() completes without blocking', async () => {
    const startTime = Date.now();
    const skills = await loadSkillsAsync();
    const loadTime = Date.now() - startTime;
    
    console.log(`[Performance Test] loadSkillsAsync() completed in ${loadTime}ms`);
    console.log(`[Performance Test] Loaded ${skills.length} skills`);
    
    // Verify skills were loaded
    expect(Array.isArray(skills)).toBe(true);
    
    // Async loading should complete reasonably fast
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
  });
  
  test('getSlimSystemPromptAsync() completes without blocking', async () => {
    const startTime = Date.now();
    const prompt = await getSlimSystemPromptAsync('win32', 'test-conv', []);
    const loadTime = Date.now() - startTime;
    
    console.log(`[Performance Test] getSlimSystemPromptAsync() completed in ${loadTime}ms`);
    console.log(`[Performance Test] Prompt length: ${prompt.length} chars`);
    
    // Verify prompt was loaded
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    
    // Async loading should complete reasonably fast
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
  });
  
  test('Pre-loading both skills and prompt is fast', async () => {
    const startTime = Date.now();
    
    // Pre-load both in parallel
    const [skills, prompt] = await Promise.all([
      loadSkillsAsync(),
      getSlimSystemPromptAsync('win32', 'test-conv', [])
    ]);
    
    const totalTime = Date.now() - startTime;
    
    console.log(`[Performance Test] Pre-loading completed in ${totalTime}ms`);
    console.log(`[Performance Test] Skills: ${skills.length}, Prompt: ${prompt.length} chars`);
    
    // Verify both were loaded
    expect(Array.isArray(skills)).toBe(true);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    
    // Parallel loading should be fast
    expect(totalTime).toBeLessThan(5000); // 5 seconds max
  });
});

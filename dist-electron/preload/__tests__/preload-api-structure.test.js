"use strict";
/**
 * API structure tests for preload bridge
 *
 * These tests verify the API structure without requiring Electron runtime.
 * Validates: Requirements 4.1
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Preload API Structure', () => {
    (0, vitest_1.it)('should have onSubAgentProgress method signature documented', () => {
        // This test verifies that the method signature is correctly defined
        // by checking the TypeScript type definition exists in the file
        const fs = require('fs');
        const path = require('path');
        const preloadPath = path.join(__dirname, '../preload.ts');
        const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
        // Verify the method is defined in the acp object
        (0, vitest_1.expect)(preloadContent).toContain('onSubAgentProgress:');
        (0, vitest_1.expect)(preloadContent).toContain("ipcRenderer.on('acp:sub-agent-progress'");
        // Verify the TypeScript type definition exists
        (0, vitest_1.expect)(preloadContent).toContain('onSubAgentProgress: (cb: (event: any) => void) => void;');
        // Verify cleanup is implemented
        (0, vitest_1.expect)(preloadContent).toContain("removeAllListeners('acp:sub-agent-progress')");
    });
    (0, vitest_1.it)('should have correct method signature in TypeScript types', () => {
        const fs = require('fs');
        const path = require('path');
        const preloadPath = path.join(__dirname, '../preload.ts');
        const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
        // Verify the method accepts a callback parameter
        (0, vitest_1.expect)(preloadContent).toMatch(/onSubAgentProgress:\s*\(cb:\s*\(event:\s*any\)\s*=>\s*void\)\s*=>\s*void/);
    });
    (0, vitest_1.it)('should register listener on correct IPC channel', () => {
        const fs = require('fs');
        const path = require('path');
        const preloadPath = path.join(__dirname, '../preload.ts');
        const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
        // Verify the correct IPC channel name is used
        (0, vitest_1.expect)(preloadContent).toContain("'acp:sub-agent-progress'");
    });
    (0, vitest_1.it)('should include documentation comment', () => {
        const fs = require('fs');
        const path = require('path');
        const preloadPath = path.join(__dirname, '../preload.ts');
        const preloadContent = fs.readFileSync(preloadPath, 'utf-8');
        // Verify documentation exists
        (0, vitest_1.expect)(preloadContent).toContain('Register a callback for sub-agent progress events');
        (0, vitest_1.expect)(preloadContent).toContain('SubAgentProgressEvent');
    });
});

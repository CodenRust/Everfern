/**
 * Unit tests for Analysis Session Manager
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    AnalysisSessionManagerImpl,
    SerializedDataFrame,
    ExecutionRecord
} from '../analysis-session';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('AnalysisSessionManager', () => {
    let manager: AnalysisSessionManagerImpl;
    const testConversationId = 'test-conversation-123';

    beforeEach(() => {
        manager = new AnalysisSessionManagerImpl();
    });

    afterEach(() => {
        // Clean up test sessions
        const sessionDir = path.join(os.tmpdir(), 'everfern-analysis-sessions');
        if (fs.existsSync(sessionDir)) {
            try {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Session Creation and Retrieval', () => {
        it('should create a new session for a conversation', () => {
            const session = manager.getOrCreateSession(testConversationId);

            expect(session).toBeDefined();
            expect(session.id).toBeDefined();
            expect(session.conversationId).toBe(testConversationId);
            expect(session.dataFrames).toBeInstanceOf(Map);
            expect(session.variables).toBeInstanceOf(Map);
            expect(session.executionHistory).toEqual([]);
        });

        it('should return the same session for the same conversation', () => {
            const session1 = manager.getOrCreateSession(testConversationId);
            const session2 = manager.getOrCreateSession(testConversationId);

            expect(session1.id).toBe(session2.id);
        });

        it('should update lastAccessedAt when retrieving session', () => {
            const session1 = manager.getOrCreateSession(testConversationId);
            const firstAccessTime = session1.lastAccessedAt;

            // Wait a bit
            vi.useFakeTimers();
            vi.advanceTimersByTime(100);

            const session2 = manager.getOrCreateSession(testConversationId);
            const secondAccessTime = session2.lastAccessedAt;

            expect(secondAccessTime).toBeGreaterThanOrEqual(firstAccessTime);
            vi.useRealTimers();
        });
    });

    describe('DataFrame Storage and Retrieval', () => {
        it('should store and retrieve a DataFrame', () => {
            const session = manager.getOrCreateSession(testConversationId);

            const testDataFrame: SerializedDataFrame = {
                name: 'test_df',
                shape: [100, 5],
                columns: ['col1', 'col2', 'col3', 'col4', 'col5'],
                dtypes: { col1: 'int64', col2: 'float64', col3: 'object' },
                pickledData: Buffer.from('mock-pickled-data')
            };

            manager.storeDataFrame(session.id, 'test_df', testDataFrame);
            const retrieved = manager.retrieveDataFrame(session.id, 'test_df');

            expect(retrieved).toBeDefined();
            expect(retrieved?.name).toBe('test_df');
            expect(retrieved?.shape).toEqual([100, 5]);
            expect(retrieved?.columns).toEqual(['col1', 'col2', 'col3', 'col4', 'col5']);
        });

        it('should return null for non-existent DataFrame', () => {
            const session = manager.getOrCreateSession(testConversationId);
            const retrieved = manager.retrieveDataFrame(session.id, 'non_existent');

            expect(retrieved).toBeNull();
        });

        it('should throw error when storing DataFrame for non-existent session', () => {
            const testDataFrame: SerializedDataFrame = {
                name: 'test_df',
                shape: [100, 5],
                columns: ['col1', 'col2', 'col3', 'col4', 'col5'],
                dtypes: {},
                pickledData: Buffer.from('mock-pickled-data')
            };

            expect(() => {
                manager.storeDataFrame('non-existent-session', 'test_df', testDataFrame);
            }).toThrow();
        });
    });

    describe('Variable Storage and Retrieval', () => {
        it('should store and retrieve variables', () => {
            const session = manager.getOrCreateSession(testConversationId);

            manager.storeVariable(session.id, 'test_var', 42);
            manager.storeVariable(session.id, 'test_string', 'hello');
            manager.storeVariable(session.id, 'test_array', [1, 2, 3]);

            expect(manager.retrieveVariable(session.id, 'test_var')).toBe(42);
            expect(manager.retrieveVariable(session.id, 'test_string')).toBe('hello');
            expect(manager.retrieveVariable(session.id, 'test_array')).toEqual([1, 2, 3]);
        });

        it('should return undefined for non-existent variable', () => {
            const session = manager.getOrCreateSession(testConversationId);
            expect(manager.retrieveVariable(session.id, 'non_existent')).toBeUndefined();
        });
    });

    describe('Execution History Tracking', () => {
        it('should track execution history', () => {
            const session = manager.getOrCreateSession(testConversationId);

            const record1: ExecutionRecord = {
                timestamp: Date.now(),
                code: 'print("hello")',
                result: {
                    success: true,
                    stdout: 'hello\n',
                    stderr: '',
                    executionTimeMs: 50
                }
            };

            const record2: ExecutionRecord = {
                timestamp: Date.now(),
                code: 'df.head()',
                result: {
                    success: true,
                    stdout: 'DataFrame output',
                    stderr: '',
                    executionTimeMs: 100
                }
            };

            manager.addExecutionRecord(session.id, record1);
            manager.addExecutionRecord(session.id, record2);

            const history = manager.getExecutionHistory(session.id);

            expect(history).toHaveLength(2);
            expect(history[0].code).toBe('print("hello")');
            expect(history[1].code).toBe('df.head()');
        });

        it('should return empty array for session with no history', () => {
            const session = manager.getOrCreateSession(testConversationId);
            const history = manager.getExecutionHistory(session.id);

            expect(history).toEqual([]);
        });

        it('should return empty array for non-existent session', () => {
            const history = manager.getExecutionHistory('non-existent-session');
            expect(history).toEqual([]);
        });
    });

    describe('Session Reset', () => {
        it('should clear all session data on reset', () => {
            const session = manager.getOrCreateSession(testConversationId);

            // Add some data
            const testDataFrame: SerializedDataFrame = {
                name: 'test_df',
                shape: [100, 5],
                columns: ['col1', 'col2'],
                dtypes: {},
                pickledData: Buffer.from('mock-pickled-data')
            };
            manager.storeDataFrame(session.id, 'test_df', testDataFrame);
            manager.storeVariable(session.id, 'test_var', 42);
            manager.addExecutionRecord(session.id, {
                timestamp: Date.now(),
                code: 'test',
                result: { success: true, stdout: '', stderr: '', executionTimeMs: 10 }
            });

            // Reset
            manager.resetSession(session.id);

            // Verify data is cleared
            const updatedSession = manager.getOrCreateSession(testConversationId);
            expect(updatedSession.dataFrames.size).toBe(0);
            expect(updatedSession.variables.size).toBe(0);
            expect(updatedSession.executionHistory).toEqual([]);
        });
    });

    describe('Session Cleanup', () => {
        it('should clean up inactive sessions', () => {
            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            // Create a session
            const session = manager.getOrCreateSession(testConversationId);
            expect(manager.getActiveSessions()).toHaveLength(1);

            // Advance time by 31 minutes (past the 30-minute threshold)
            vi.advanceTimersByTime(31 * 60 * 1000);

            // Run cleanup
            manager.cleanupInactiveSessions(30 * 60 * 1000);

            // Session should be cleaned up
            expect(manager.getActiveSessions()).toHaveLength(0);

            vi.useRealTimers();
        });

        it('should not clean up active sessions', () => {
            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            // Create a session
            const session = manager.getOrCreateSession(testConversationId);

            // Advance time by 20 minutes (within threshold)
            vi.advanceTimersByTime(20 * 60 * 1000);

            // Run cleanup
            manager.cleanupInactiveSessions(30 * 60 * 1000);

            // Session should still exist
            expect(manager.getActiveSessions()).toHaveLength(1);

            vi.useRealTimers();
        });

        it('should use custom inactivity threshold', () => {
            vi.useFakeTimers();
            const now = Date.now();
            vi.setSystemTime(now);

            const session = manager.getOrCreateSession(testConversationId);

            // Advance time by 6 minutes
            vi.advanceTimersByTime(6 * 60 * 1000);

            // Run cleanup with 5-minute threshold
            manager.cleanupInactiveSessions(5 * 60 * 1000);

            // Session should be cleaned up
            expect(manager.getActiveSessions()).toHaveLength(0);

            vi.useRealTimers();
        });
    });
});

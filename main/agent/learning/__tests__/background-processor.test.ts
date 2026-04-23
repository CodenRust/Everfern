/**
 * Unit tests for Background Processor
 */

import { BackgroundProcessor } from '../background-processor';
import { LearningTask } from '../types';

describe('BackgroundProcessor', () => {
  let processor: BackgroundProcessor;

  beforeEach(() => {
    processor = new BackgroundProcessor({
      maxConcurrency: 2,
      resourceLimits: {
        maxCpuPercent: 5,
        maxMemoryMB: 100
      },
      idleThresholdMs: 1000,
      queueCleanupIntervalMs: 5000,
      performanceMonitoringIntervalMs: 500
    });
  });

  afterEach(async () => {
    await processor.shutdown();
  });

  describe('Task Queueing', () => {
    it('should queue learning tasks successfully', async () => {
      const task: LearningTask = {
        id: 'test-task-1',
        type: 'analyze',
        priority: 1,
        data: { test: 'data' },
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      await processor.queueLearningTask(task);

      const status = processor.getQueueStatus();
      expect(status.totalTasks).toBe(1);
      expect(status.pendingTasks).toBe(1);
    });

    it('should not queue duplicate tasks', async () => {
      const task: LearningTask = {
        id: 'duplicate-task',
        type: 'analyze',
        priority: 1,
        data: { test: 'data' },
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      await processor.queueLearningTask(task);
      await processor.queueLearningTask(task); // Duplicate

      const status = processor.getQueueStatus();
      expect(status.totalTasks).toBe(1);
    });

    it('should prioritize tasks correctly', () => {
      const tasks: LearningTask[] = [
        {
          id: 'low-priority',
          type: 'analyze',
          priority: 1,
          data: {},
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(Date.now() - 1000)
        },
        {
          id: 'high-priority',
          type: 'synthesize',
          priority: 5,
          data: {},
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date()
        },
        {
          id: 'medium-priority',
          type: 'store',
          priority: 3,
          data: {},
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(Date.now() - 500)
        }
      ];

      const prioritized = processor.prioritizeTasks(tasks);

      expect(prioritized[0].id).toBe('high-priority');
      expect(prioritized[1].id).toBe('medium-priority');
      expect(prioritized[2].id).toBe('low-priority');
    });
  });

  describe('Resource Management', () => {
    it('should track resource usage', () => {
      const usage = processor.getResourceUsage();

      expect(usage).toHaveProperty('cpuPercent');
      expect(usage).toHaveProperty('memoryMB');
      expect(usage).toHaveProperty('timestamp');
      expect(typeof usage.cpuPercent).toBe('number');
      expect(typeof usage.memoryMB).toBe('number');
    });

    it('should update resource limits', () => {
      const newLimits = {
        maxCpuPercent: 10,
        maxMemoryMB: 200
      };

      processor.setResourceLimits(newLimits);

      // Resource limits are updated internally
      // We can verify through debug info
      const debugInfo = processor.getDebugInfo();
      expect(debugInfo.config.resourceLimits).toEqual(newLimits);
    });

    it('should detect idle state correctly', () => {
      // Initially should not be idle (just created)
      expect(processor.isIdle()).toBe(false);

      // Update user activity to simulate idle state
      processor.updateUserActivity();

      // Should still not be idle immediately
      expect(processor.isIdle()).toBe(false);
    });
  });

  describe('Queue Status', () => {
    it('should provide accurate queue status', async () => {
      const task1: LearningTask = {
        id: 'status-test-1',
        type: 'analyze',
        priority: 1,
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      const task2: LearningTask = {
        id: 'status-test-2',
        type: 'synthesize',
        priority: 2,
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      await processor.queueLearningTask(task1);
      await processor.queueLearningTask(task2);

      const status = processor.getQueueStatus();

      expect(status.totalTasks).toBe(2);
      expect(status.pendingTasks).toBe(2);
      expect(status.processingTasks).toBe(0);
      expect(status.completedTasks).toBe(0);
      expect(status.failedTasks).toBe(0);
    });
  });

  describe('User Activity Tracking', () => {
    it('should update user activity timestamp', () => {
      const beforeUpdate = Date.now();
      processor.updateUserActivity();

      // Check that activity was updated (through debug info)
      const debugInfo = processor.getDebugInfo();
      const activityTime = debugInfo.lastUserActivity.getTime();

      expect(activityTime).toBeGreaterThanOrEqual(beforeUpdate);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid tasks', async () => {
      const invalidTask = {
        // Missing required fields
        type: 'analyze',
        priority: 1,
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      } as LearningTask;

      await expect(processor.queueLearningTask(invalidTask)).rejects.toThrow();
    });

    it('should handle shutdown gracefully', async () => {
      const task: LearningTask = {
        id: 'shutdown-test',
        type: 'analyze',
        priority: 1,
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date()
      };

      await processor.queueLearningTask(task);

      // Shutdown should complete without errors
      await expect(processor.shutdown()).resolves.not.toThrow();

      // Should reject new tasks after shutdown
      await expect(processor.queueLearningTask(task)).rejects.toThrow('shutting down');
    });
  });

  describe('Debug Information', () => {
    it('should provide comprehensive debug information', () => {
      const debugInfo = processor.getDebugInfo();

      expect(debugInfo).toHaveProperty('config');
      expect(debugInfo).toHaveProperty('queue');
      expect(debugInfo).toHaveProperty('resourceUsage');
      expect(debugInfo).toHaveProperty('isIdle');
      expect(debugInfo).toHaveProperty('lastUserActivity');
      expect(debugInfo).toHaveProperty('completedTasksCount');
      expect(debugInfo).toHaveProperty('failedTasksCount');
      expect(debugInfo).toHaveProperty('isShuttingDown');

      expect(typeof debugInfo.isIdle).toBe('boolean');
      expect(typeof debugInfo.isShuttingDown).toBe('boolean');
    });
  });
});

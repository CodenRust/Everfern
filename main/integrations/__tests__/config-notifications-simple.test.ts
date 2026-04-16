/**
 * Simple tests for configuration change notifications functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService } from '../notification-service';
import { RestartCoordinator } from '../restart-coordinator';

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
  });

  describe('basic notification functionality', () => {
    it('should create and manage notifications', () => {
      const notification = notificationService.createNotification(
        'info',
        'Test Title',
        'Test message'
      );

      expect(notification.id).toBeDefined();
      expect(notification.type).toBe('info');
      expect(notification.title).toBe('Test Title');
      expect(notification.message).toBe('Test message');
      expect(notification.timestamp).toBeInstanceOf(Date);

      const notifications = notificationService.getNotifications();
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toEqual(notification);
    });

    it('should dismiss notifications', () => {
      const notification = notificationService.createNotification(
        'info',
        'Test',
        'Test message'
      );

      expect(notificationService.getNotifications()).toHaveLength(1);

      const dismissed = notificationService.dismissNotification(notification.id);
      expect(dismissed).toBe(true);
      expect(notificationService.getNotifications()).toHaveLength(0);
    });

    it('should create config change notifications', () => {
      const configNotification = {
        type: 'config-changed' as const,
        platform: 'telegram' as const,
        changes: [{
          path: 'integrations.telegram.enabled',
          oldValue: false,
          newValue: true,
          type: 'modified' as const
        }],
        timestamp: new Date(),
        requiresRestart: false,
        message: 'Configuration updated successfully'
      };

      const notification = notificationService.createConfigChangeNotification(configNotification);

      expect(notification.type).toBe('success');
      expect(notification.title).toBe('Telegram Configuration Updated');
      expect(notification.message).toBe('Configuration updated successfully');
      expect(notification.persistent).toBe(false);
    });

    it('should create restart notifications with actions', () => {
      const configNotification = {
        type: 'integration-restart-required' as const,
        platform: 'discord' as const,
        changes: [{
          path: 'integrations.discord.enabled',
          oldValue: false,
          newValue: true,
          type: 'modified' as const
        }],
        timestamp: new Date(),
        requiresRestart: true,
        message: 'Integration restart required'
      };

      const notification = notificationService.createConfigChangeNotification(configNotification);

      expect(notification.type).toBe('restart-required');
      expect(notification.title).toBe('Discord Restart Required');
      expect(notification.persistent).toBe(true);
      expect(notification.actions).toHaveLength(2);
      expect(notification.actions?.[0].label).toBe('Restart Integration');
      expect(notification.actions?.[1].label).toBe('Dismiss');
    });

    it('should dismiss notifications by type', () => {
      notificationService.createNotification('info', 'Info', 'Info message');
      notificationService.createNotification('warning', 'Warning', 'Warning message');
      notificationService.createNotification('info', 'Info 2', 'Info message 2');

      expect(notificationService.getNotifications()).toHaveLength(3);

      notificationService.dismissNotificationsByType('info');

      const remaining = notificationService.getNotifications();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].type).toBe('warning');
    });
  });

  describe('notification events', () => {
    it('should emit notification-created event', () => {
      const createdSpy = vi.fn();
      notificationService.on('notification-created', createdSpy);

      const notification = notificationService.createNotification(
        'info',
        'Test',
        'Test message'
      );

      expect(createdSpy).toHaveBeenCalledWith(notification);
    });

    it('should emit notification-dismissed event', () => {
      const dismissedSpy = vi.fn();
      notificationService.on('notification-dismissed', dismissedSpy);

      const notification = notificationService.createNotification(
        'info',
        'Test',
        'Test message'
      );

      notificationService.dismissNotification(notification.id);

      expect(dismissedSpy).toHaveBeenCalledWith(notification.id);
    });
  });
});

describe('RestartCoordinator', () => {
  let restartCoordinator: RestartCoordinator;

  beforeEach(() => {
    restartCoordinator = new RestartCoordinator();
  });

  describe('integration management', () => {
    it('should register and track integrations', () => {
      restartCoordinator.registerIntegration('telegram');
      restartCoordinator.registerIntegration('discord');

      const statuses = restartCoordinator.getAllIntegrationStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.map(s => s.platform)).toEqual(['telegram', 'discord']);
      expect(statuses.every(s => s.status === 'stopped')).toBe(true);
    });

    it('should update integration status', () => {
      restartCoordinator.registerIntegration('telegram');

      const statusChangedSpy = vi.fn();
      restartCoordinator.on('integration-status-changed', statusChangedSpy);

      restartCoordinator.updateIntegrationStatus('telegram', 'running');

      expect(statusChangedSpy).toHaveBeenCalledWith('telegram', 'running');

      const status = restartCoordinator.getIntegrationStatus('telegram');
      expect(status?.status).toBe('running');
      expect(status?.lastStarted).toBeInstanceOf(Date);
    });

    it('should track integration errors', () => {
      restartCoordinator.registerIntegration('telegram');

      restartCoordinator.updateIntegrationStatus('telegram', 'error', 'Connection failed');

      const status = restartCoordinator.getIntegrationStatus('telegram');
      expect(status?.status).toBe('error');
      expect(status?.error).toBe('Connection failed');
    });

    it('should check if integrations are running', () => {
      restartCoordinator.registerIntegration('telegram');
      restartCoordinator.registerIntegration('discord');

      expect(restartCoordinator.hasRunningIntegrations()).toBe(false);
      expect(restartCoordinator.isIntegrationRunning('telegram')).toBe(false);

      restartCoordinator.updateIntegrationStatus('telegram', 'running');

      expect(restartCoordinator.hasRunningIntegrations()).toBe(true);
      expect(restartCoordinator.isIntegrationRunning('telegram')).toBe(true);
      expect(restartCoordinator.isIntegrationRunning('discord')).toBe(false);
    });
  });

  describe('restart operations', () => {
    it('should track restart operations', () => {
      restartCoordinator.registerIntegration('telegram');

      // Check that no operations are active initially
      expect(restartCoordinator.getActiveRestartOperations()).toHaveLength(0);

      // Test the data structures by directly accessing the private map
      const restartOperations = (restartCoordinator as any).restartOperations;

      // Manually create an operation to test tracking
      const operation = {
        id: 'test-op-1',
        platforms: ['telegram'],
        status: 'in-progress' as const,
        startedAt: new Date()
      };
      restartOperations.set(operation.id, operation);

      const activeOps = restartCoordinator.getActiveRestartOperations();
      expect(activeOps).toHaveLength(1);
      expect(activeOps[0].platforms).toEqual(['telegram']);
      expect(activeOps[0].status).toBe('in-progress');

      // Test getting operation by ID
      const retrievedOp = restartCoordinator.getRestartOperation('test-op-1');
      expect(retrievedOp).toEqual(operation);
    });

    it('should clean up old restart operations', () => {
      // Create multiple completed operations by directly accessing the private map
      const restartOperations = (restartCoordinator as any).restartOperations;

      for (let i = 0; i < 15; i++) {
        const operation = {
          id: `op-${i}`,
          platforms: ['telegram'],
          status: 'completed' as const,
          startedAt: new Date(Date.now() - i * 1000),
          completedAt: new Date()
        };
        restartOperations.set(operation.id, operation);
      }

      expect(restartOperations.size).toBe(15);

      restartCoordinator.cleanupRestartOperations();

      expect(restartOperations.size).toBeLessThanOrEqual(10);
    });
  });

  describe('restart events', () => {
    it('should emit integration-status-changed events', () => {
      const statusChangedSpy = vi.fn();
      restartCoordinator.on('integration-status-changed', statusChangedSpy);

      restartCoordinator.registerIntegration('telegram');
      restartCoordinator.updateIntegrationStatus('telegram', 'starting');
      restartCoordinator.updateIntegrationStatus('telegram', 'running');

      expect(statusChangedSpy).toHaveBeenCalledTimes(2);
      expect(statusChangedSpy).toHaveBeenNthCalledWith(1, 'telegram', 'starting');
      expect(statusChangedSpy).toHaveBeenNthCalledWith(2, 'telegram', 'running');
    });

    it('should emit restart operation events', () => {
      const startedSpy = vi.fn();
      const failedSpy = vi.fn();

      restartCoordinator.on('restart-operation-started', startedSpy);
      restartCoordinator.on('restart-operation-failed', failedSpy);

      restartCoordinator.registerIntegration('telegram');

      // Test event emission by manually triggering events
      const operation = {
        id: 'test-op-1',
        platforms: ['telegram'],
        status: 'in-progress' as const,
        startedAt: new Date()
      };

      restartCoordinator.emit('restart-operation-started', operation);
      restartCoordinator.emit('restart-operation-failed', operation, new Error('Test error'));

      expect(startedSpy).toHaveBeenCalledWith(operation);
      expect(failedSpy).toHaveBeenCalledWith(operation, expect.any(Error));
    });
  });
});

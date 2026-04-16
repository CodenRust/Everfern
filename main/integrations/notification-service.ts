/**
 * Notification Service for Configuration Changes
 *
 * This service handles user notifications for configuration changes,
 * integration restarts, and other important events.
 */

import { EventEmitter } from 'events';
import { ConfigChangeNotification } from './config-manager';

/**
 * Notification types
 */
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'config-change'
  | 'restart-required';

/**
 * User notification
 */
export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  persistent: boolean;
  actions?: NotificationAction[];
  metadata?: {
    platform?: string;
    configChanges?: number;
    requiresRestart?: boolean;
  };
}

/**
 * Notification action
 */
export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  handler: () => Promise<void> | void;
}

/**
 * Notification service events
 */
export interface NotificationServiceEvents {
  'notification-created': (notification: UserNotification) => void;
  'notification-dismissed': (notificationId: string) => void;
  'notification-action-executed': (notificationId: string, actionId: string) => void;
  'error': (error: Error) => void;
}

/**
 * Notification service for handling user alerts and messages
 */
export class NotificationService extends EventEmitter {
  private notifications: Map<string, UserNotification> = new Map();
  private notificationCounter = 0;

  constructor() {
    super();
  }

  /**
   * Create a notification from configuration change
   */
  createConfigChangeNotification(configNotification: ConfigChangeNotification): UserNotification {
    const notification: UserNotification = {
      id: this.generateNotificationId(),
      type: this.mapConfigNotificationType(configNotification.type),
      title: this.generateConfigChangeTitle(configNotification),
      message: configNotification.message,
      timestamp: configNotification.timestamp,
      persistent: configNotification.requiresRestart,
      metadata: {
        platform: configNotification.platform,
        configChanges: configNotification.changes.length,
        requiresRestart: configNotification.requiresRestart
      }
    };

    // Add restart action if required
    if (configNotification.requiresRestart) {
      notification.actions = [
        {
          id: 'restart-integration',
          label: 'Restart Integration',
          type: 'primary',
          handler: () => this.handleRestartIntegration(configNotification.platform)
        },
        {
          id: 'dismiss',
          label: 'Dismiss',
          type: 'secondary',
          handler: () => { this.dismissNotification(notification.id); }
        }
      ];
    }

    return this.addNotification(notification);
  }

  /**
   * Create a general notification
   */
  createNotification(
    type: NotificationType,
    title: string,
    message: string,
    options: {
      persistent?: boolean;
      actions?: NotificationAction[];
      metadata?: any;
    } = {}
  ): UserNotification {
    const notification: UserNotification = {
      id: this.generateNotificationId(),
      type,
      title,
      message,
      timestamp: new Date(),
      persistent: options.persistent || false,
      actions: options.actions,
      metadata: options.metadata
    };

    return this.addNotification(notification);
  }

  /**
   * Create integration restart notification
   */
  createRestartNotification(platform: string, reason: string): UserNotification {
    return this.createNotification(
      'restart-required',
      `${this.capitalizeFirst(platform)} Integration Restart Required`,
      reason,
      {
        persistent: true,
        actions: [
          {
            id: 'restart-now',
            label: 'Restart Now',
            type: 'primary',
            handler: () => this.handleRestartIntegration(platform)
          },
          {
            id: 'restart-later',
            label: 'Restart Later',
            type: 'secondary',
            handler: () => { this.dismissNotification(''); }
          }
        ],
        metadata: { platform }
      }
    );
  }

  /**
   * Create success notification
   */
  createSuccessNotification(title: string, message: string): UserNotification {
    return this.createNotification('success', title, message, { persistent: false });
  }

  /**
   * Create error notification
   */
  createErrorNotification(title: string, message: string): UserNotification {
    return this.createNotification('error', title, message, { persistent: true });
  }

  /**
   * Create warning notification
   */
  createWarningNotification(title: string, message: string): UserNotification {
    return this.createNotification('warning', title, message, { persistent: false });
  }

  /**
   * Get all active notifications
   */
  getNotifications(): UserNotification[] {
    return Array.from(this.notifications.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get notification by ID
   */
  getNotification(id: string): UserNotification | undefined {
    return this.notifications.get(id);
  }

  /**
   * Dismiss notification
   */
  dismissNotification(id: string): boolean {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.delete(id);
      this.emit('notification-dismissed', id);
      return true;
    }
    return false;
  }

  /**
   * Dismiss all notifications
   */
  dismissAllNotifications(): void {
    const ids = Array.from(this.notifications.keys());
    this.notifications.clear();

    for (const id of ids) {
      this.emit('notification-dismissed', id);
    }
  }

  /**
   * Dismiss notifications by type
   */
  dismissNotificationsByType(type: NotificationType): void {
    const toRemove: string[] = [];

    for (const [id, notification] of this.notifications) {
      if (notification.type === type) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.dismissNotification(id);
    }
  }

  /**
   * Execute notification action
   */
  async executeNotificationAction(notificationId: string, actionId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification || !notification.actions) {
      return;
    }

    const action = notification.actions.find(a => a.id === actionId);
    if (!action) {
      return;
    }

    try {
      await action.handler();
      this.emit('notification-action-executed', notificationId, actionId);
    } catch (error) {
      console.error(`Failed to execute notification action ${actionId}:`, error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Add notification to the collection
   */
  private addNotification(notification: UserNotification): UserNotification {
    this.notifications.set(notification.id, notification);
    this.emit('notification-created', notification);

    // Auto-dismiss non-persistent notifications after 5 seconds
    if (!notification.persistent) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, 5000);
    }

    return notification;
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notification-${Date.now()}-${++this.notificationCounter}`;
  }

  /**
   * Map configuration notification type to user notification type
   */
  private mapConfigNotificationType(configType: ConfigChangeNotification['type']): NotificationType {
    switch (configType) {
      case 'config-changed':
        return 'success';
      case 'integration-restart-required':
        return 'restart-required';
      case 'config-validation-failed':
        return 'error';
      default:
        return 'info';
    }
  }

  /**
   * Generate title for configuration change notification
   */
  private generateConfigChangeTitle(configNotification: ConfigChangeNotification): string {
    const platform = configNotification.platform;
    const changeCount = configNotification.changes.length;

    switch (configNotification.type) {
      case 'config-changed':
        if (platform && platform !== 'all') {
          return `${this.capitalizeFirst(platform)} Configuration Updated`;
        }
        return 'Configuration Updated';

      case 'integration-restart-required':
        if (platform && platform !== 'all') {
          return `${this.capitalizeFirst(platform)} Restart Required`;
        }
        return 'Integration Restart Required';

      case 'config-validation-failed':
        return 'Configuration Validation Failed';

      default:
        return 'Configuration Change';
    }
  }

  /**
   * Handle integration restart action
   */
  private async handleRestartIntegration(platform?: string): Promise<void> {
    try {
      console.log(`Restarting integration for platform: ${platform || 'all'}`);

      // This would typically emit an event that the integration manager listens to
      // For now, we'll just log the action

      // Dismiss restart-related notifications
      this.dismissNotificationsByType('restart-required');

      // Create success notification
      this.createSuccessNotification(
        'Integration Restarted',
        platform
          ? `${this.capitalizeFirst(platform)} integration has been restarted successfully.`
          : 'All integrations have been restarted successfully.'
      );
    } catch (error) {
      console.error('Failed to restart integration:', error);
      this.createErrorNotification(
        'Restart Failed',
        'Failed to restart integration. Please try again or restart the application.'
      );
    }
  }

  /**
   * Capitalize first letter of string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Global notification service instance
 */
let globalNotificationService: NotificationService | null = null;

/**
 * Get or create global notification service
 */
export function getNotificationService(): NotificationService {
  if (!globalNotificationService) {
    globalNotificationService = new NotificationService();
  }
  return globalNotificationService;
}

/**
 * Create a notification service instance
 */
export function createNotificationService(): NotificationService {
  return new NotificationService();
}

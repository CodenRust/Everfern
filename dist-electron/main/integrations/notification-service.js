"use strict";
/**
 * Notification Service for Configuration Changes
 *
 * This service handles user notifications for configuration changes,
 * integration restarts, and other important events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
exports.getNotificationService = getNotificationService;
exports.createNotificationService = createNotificationService;
const events_1 = require("events");
/**
 * Notification service for handling user alerts and messages
 */
class NotificationService extends events_1.EventEmitter {
    notifications = new Map();
    notificationCounter = 0;
    constructor() {
        super();
    }
    /**
     * Create a notification from configuration change
     */
    createConfigChangeNotification(configNotification) {
        const notification = {
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
    createNotification(type, title, message, options = {}) {
        const notification = {
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
    createRestartNotification(platform, reason) {
        return this.createNotification('restart-required', `${this.capitalizeFirst(platform)} Integration Restart Required`, reason, {
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
        });
    }
    /**
     * Create success notification
     */
    createSuccessNotification(title, message) {
        return this.createNotification('success', title, message, { persistent: false });
    }
    /**
     * Create error notification
     */
    createErrorNotification(title, message) {
        return this.createNotification('error', title, message, { persistent: true });
    }
    /**
     * Create warning notification
     */
    createWarningNotification(title, message) {
        return this.createNotification('warning', title, message, { persistent: false });
    }
    /**
     * Get all active notifications
     */
    getNotifications() {
        return Array.from(this.notifications.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Get notification by ID
     */
    getNotification(id) {
        return this.notifications.get(id);
    }
    /**
     * Dismiss notification
     */
    dismissNotification(id) {
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
    dismissAllNotifications() {
        const ids = Array.from(this.notifications.keys());
        this.notifications.clear();
        for (const id of ids) {
            this.emit('notification-dismissed', id);
        }
    }
    /**
     * Dismiss notifications by type
     */
    dismissNotificationsByType(type) {
        const toRemove = [];
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
    async executeNotificationAction(notificationId, actionId) {
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
        }
        catch (error) {
            console.error(`Failed to execute notification action ${actionId}:`, error);
            this.emit('error', error);
        }
    }
    /**
     * Add notification to the collection
     */
    addNotification(notification) {
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
    generateNotificationId() {
        return `notification-${Date.now()}-${++this.notificationCounter}`;
    }
    /**
     * Map configuration notification type to user notification type
     */
    mapConfigNotificationType(configType) {
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
    generateConfigChangeTitle(configNotification) {
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
    async handleRestartIntegration(platform) {
        try {
            console.log(`Restarting integration for platform: ${platform || 'all'}`);
            // This would typically emit an event that the integration manager listens to
            // For now, we'll just log the action
            // Dismiss restart-related notifications
            this.dismissNotificationsByType('restart-required');
            // Create success notification
            this.createSuccessNotification('Integration Restarted', platform
                ? `${this.capitalizeFirst(platform)} integration has been restarted successfully.`
                : 'All integrations have been restarted successfully.');
        }
        catch (error) {
            console.error('Failed to restart integration:', error);
            this.createErrorNotification('Restart Failed', 'Failed to restart integration. Please try again or restart the application.');
        }
    }
    /**
     * Capitalize first letter of string
     */
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
exports.NotificationService = NotificationService;
/**
 * Global notification service instance
 */
let globalNotificationService = null;
/**
 * Get or create global notification service
 */
function getNotificationService() {
    if (!globalNotificationService) {
        globalNotificationService = new NotificationService();
    }
    return globalNotificationService;
}
/**
 * Create a notification service instance
 */
function createNotificationService() {
    return new NotificationService();
}

"use strict";
/**
 * EverFern Desktop — Scheduled Tasks Store
 *
 * Persists scheduled tasks to the SQLite database.
 */
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
exports.scheduledTasksStore = exports.ScheduledTasksStore = void 0;
const db_1 = require("../lib/db");
const crypto = __importStar(require("crypto"));
const scheduler_service_1 = require("../integrations/scheduler-service");
class ScheduledTasksStore {
    /**
     * List all scheduled tasks.
     */
    async list(projectId) {
        try {
            let rows;
            if (projectId) {
                rows = await db_1.dbOps.all('SELECT * FROM scheduled_tasks WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
            }
            else {
                rows = await db_1.dbOps.all('SELECT * FROM scheduled_tasks ORDER BY created_at DESC');
            }
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                cron: row.cron,
                pattern: row.pattern || row.cron,
                prompt: row.prompt,
                projectId: row.project_id,
                startsAt: row.starts_at || row.created_at,
                lastRun: row.last_run,
                nextRun: row.next_run,
                endsAt: row.ends_at,
                enabled: !!row.enabled,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));
        }
        catch (err) {
            console.error('[ScheduledTasks] Failed to list tasks:', err);
            return [];
        }
    }
    /**
     * Get a task by ID.
     */
    async get(id) {
        try {
            const row = await db_1.dbOps.get('SELECT * FROM scheduled_tasks WHERE id = ?', [id]);
            if (!row)
                return null;
            return {
                id: row.id,
                name: row.name,
                description: row.description,
                cron: row.cron,
                pattern: row.pattern || row.cron,
                prompt: row.prompt,
                projectId: row.project_id,
                startsAt: row.starts_at || row.created_at,
                lastRun: row.last_run,
                nextRun: row.next_run,
                endsAt: row.ends_at,
                enabled: !!row.enabled,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        }
        catch (err) {
            console.error(`[ScheduledTasks] Failed to get task ${id}:`, err);
            return null;
        }
    }
    /**
     * Save a task (create or update).
     */
    async save(task) {
        const id = task.id || crypto.randomUUID();
        const now = new Date().toISOString();
        try {
            const existing = await this.get(id);
            if (existing) {
                await db_1.dbOps.run(`UPDATE scheduled_tasks SET
            name = ?,
            description = ?,
            cron = ?,
            pattern = ?,
            prompt = ?,
            project_id = ?,
            starts_at = ?,
            enabled = ?,
            ends_at = ?,
            updated_at = ?
          WHERE id = ?`, [
                    task.name || existing.name || null,
                    task.description || existing.description,
                    task.cron || existing.cron,
                    task.pattern || existing.pattern,
                    task.prompt || existing.prompt,
                    task.projectId || existing.projectId,
                    task.startsAt || existing.startsAt,
                    task.enabled !== undefined ? (task.enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
                    task.endsAt || existing.endsAt || null,
                    now,
                    id
                ]);
            }
            else {
                // Calculate initial nextRun
                const cron = task.cron || '';
                const startsAt = task.startsAt || now;
                const nextRun = scheduler_service_1.SchedulerService.calculateNextRun(cron, undefined, startsAt);
                await db_1.dbOps.run(`INSERT INTO scheduled_tasks (id, name, description, cron, pattern, prompt, project_id, starts_at, next_run, enabled, ends_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    id,
                    task.name || null,
                    task.description || '',
                    cron,
                    task.pattern || cron || '',
                    task.prompt || '',
                    task.projectId || null,
                    startsAt,
                    nextRun.toISOString(),
                    task.enabled !== false ? 1 : 0,
                    task.endsAt || null,
                    now,
                    now
                ]);
            }
            return (await this.get(id));
        }
        catch (err) {
            console.error(`[ScheduledTasks] Failed to save task:`, err);
            throw err;
        }
    }
    /**
     * Update task run times.
     */
    async updateRunTimes(id, lastRun, nextRun) {
        try {
            await db_1.dbOps.run('UPDATE scheduled_tasks SET last_run = ?, next_run = ?, updated_at = ? WHERE id = ?', [lastRun, nextRun, new Date().toISOString(), id]);
        }
        catch (err) {
            console.error(`[ScheduledTasks] Failed to update run times for task ${id}:`, err);
        }
    }
    /**
     * Delete a task.
     */
    async delete(id) {
        try {
            await db_1.dbOps.run('DELETE FROM scheduled_tasks WHERE id = ?', [id]);
        }
        catch (err) {
            console.error(`[ScheduledTasks] Failed to delete task ${id}:`, err);
            throw err;
        }
    }
}
exports.ScheduledTasksStore = ScheduledTasksStore;
exports.scheduledTasksStore = new ScheduledTasksStore();

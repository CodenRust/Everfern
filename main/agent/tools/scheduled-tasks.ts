/**
 * EverFern Desktop — Scheduled Tasks Tools
 *
 * Tools for creating and managing scheduled tasks.
 */

import { AgentTool } from '../runner/types';
import { scheduledTasksStore } from '../../store/scheduled-tasks';

export const createScheduledTaskTool: AgentTool = {
  name: 'create_scheduled_task',
  description: 'Create a repeating task or cron job. Use this when the user asks to "do X every morning", "remind me every 5 minutes", or "schedule a task...".',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A short, descriptive name for the task (e.g. "Morning Briefing").' },
      description: { type: 'string', description: 'Brief description of what the task is for.' },
      cron: { type: 'string', description: 'The repetition pattern. Supported formats: "every X minutes", "every X hours", "daily at HH:mm".' },
      prompt: { type: 'string', description: 'The prompt the AI should execute when the task triggers.' },
      endsAt: { type: 'string', description: 'Optional ISO date string when the task should stop repeating.' }
    },
    required: ['description', 'cron', 'prompt']
  },
  execute: async ({ name, description, cron, prompt, endsAt }) => {
    try {
      const task = await scheduledTasksStore.save({
        name: name as string,
        description: description as string,
        cron: cron as string,
        prompt: prompt as string,
        endsAt: endsAt as string,
        enabled: true
      });

      return { 
        success: true, 
        output: `Scheduled task created: "${task.name || task.description}" (ID: ${task.id}). Repetition: ${task.cron}` 
      };
    } catch (err) {
      return { success: false, output: `Failed to create scheduled task: ${err}` };
    }
  }
};

export const listScheduledTasksTool: AgentTool = {
  name: 'list_scheduled_tasks',
  description: 'List all currently active scheduled tasks.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async () => {
    try {
      const tasks = await scheduledTasksStore.list();
      if (tasks.length === 0) return { success: true, output: 'No scheduled tasks found.' };

      const output = tasks.map(t => `- [${t.enabled ? 'ENABLED' : 'DISABLED'}] ${t.name || t.description} (${t.cron}) - Prompt: ${t.prompt.substring(0, 50)}...`).join('\n');
      return { success: true, output };
    } catch (err) {
      return { success: false, output: `Failed to list scheduled tasks: ${err}` };
    }
  }
};

export const deleteScheduledTaskTool: AgentTool = {
  name: 'delete_scheduled_task',
  description: 'Delete a scheduled task by its ID.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The ID of the task to delete.' }
    },
    required: ['id']
  },
  execute: async ({ id }) => {
    try {
      await scheduledTasksStore.delete(id as string);
      return { success: true, output: `Scheduled task ${id} deleted.` };
    } catch (err) {
      return { success: false, output: `Failed to delete scheduled task: ${err}` };
    }
  }
};

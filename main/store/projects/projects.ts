import { dbOps } from '../../lib/db';

export interface Project {
  id: string;
  name: string;
  instructions?: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export class ProjectsStore {
  /**
   * List all projects.
   */
  async list(): Promise<Project[]> {
    try {
      const rows = await dbOps.all(`
        SELECT *
        FROM projects
        ORDER BY updated_at DESC
      `);

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        instructions: row.instructions,
        path: row.path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.error('[Projects] Failed to list projects:', err);
      return [];
    }
  }

  /**
   * Get a project by ID.
   */
  async get(id: string): Promise<Project | null> {
    try {
      const row = await dbOps.get('SELECT * FROM projects WHERE id = ?', [id]);
      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        instructions: row.instructions,
        path: row.path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err) {
      console.error(`[Projects] Failed to get project ${id}:`, err);
      return null;
    }
  }

  /**
   * Create a new project.
   */
  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; project?: Project; error?: string }> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const newProject: Project = {
        ...project,
        id,
        createdAt: now,
        updatedAt: now,
      };

      await dbOps.run(
        `INSERT INTO projects (id, name, instructions, path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          newProject.id,
          newProject.name,
          newProject.instructions || null,
          newProject.path,
          newProject.createdAt,
          newProject.updatedAt,
        ]
      );

      const fs = require('fs/promises');
      const fssync = require('fs');
      const pathModule = require('path');

      // Create the project directory if it doesn't exist
      if (!fssync.existsSync(newProject.path)) {
        await fs.mkdir(newProject.path, { recursive: true });
      }

      // Copy files if provided
      if ((project as any).files && Array.isArray((project as any).files)) {
        for (const file of (project as any).files) {
          try {
            const fileName = pathModule.basename(file);
            const targetPath = pathModule.join(newProject.path, fileName);
            await fs.copyFile(file, targetPath);
          } catch (e) {
            console.error(`Failed to copy file ${file}:`, e);
          }
        }
      }

      return { success: true, project: newProject };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Projects] Failed to create project:`, msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a project by ID.
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await dbOps.run('DELETE FROM projects WHERE id = ?', [id]);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Projects] Failed to delete project ${id}:`, msg);
      return { success: false, error: msg };
    }
  }
}

export const projectsStore = new ProjectsStore();

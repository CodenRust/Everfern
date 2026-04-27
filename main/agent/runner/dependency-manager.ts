/**
 * EverFern Desktop — Dependency Manager
 *
 * Provides real-time dependency graph tracking across the codebase.
 * Manages import statements, detects circular dependencies, and integrates
 * with semanticRename and smartRelocate tools for safe refactoring.
 */

export interface ImportStatement {
  source: string; // The file being imported from
  specifiers: ImportSpecifier[];
  importPath: string; // The import path string (e.g., './utils')
  isTypeOnly: boolean;
  line: number;
}

export interface ImportSpecifier {
  name: string; // The imported name
  alias?: string; // The alias if using 'as'
  isDefault: boolean;
  isNamespace: boolean; // import * as name
}

export interface ExportStatement {
  specifiers: ExportSpecifier[];
  exportPath?: string; // For re-exports
  line: number;
}

export interface ExportSpecifier {
  name: string;
  alias?: string;
  isDefault: boolean;
}

export interface FileNode {
  path: string;
  imports: ImportStatement[];
  exports: ExportStatement[];
  dependencies: Set<string>; // Files this file depends on
  dependents: Set<string>; // Files that depend on this file
  lastModified: number;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'warning' | 'error';
  suggestion: string;
}

export interface DependencyGraphStats {
  totalFiles: number;
  totalDependencies: number;
  circularDependencies: CircularDependency[];
  orphanedFiles: string[];
  mostDepended: Array<{ file: string; count: number }>;
}

/**
 * Dependency Manager - Tracks and manages file dependencies and imports
 */
export class DependencyManager {
  private graph: Map<string, FileNode> = new Map();
  private importPatterns = {
    // Matches: import { x, y as z } from 'path'
    namedImport: /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
    // Matches: import x from 'path'
    defaultImport: /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // Matches: import * as x from 'path'
    namespaceImport: /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // Matches: import type { x } from 'path'
    typeImport: /import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
  };

  /**
   * Add or update a file in the dependency graph
   */
  addFile(filePath: string, content: string): void {
    const imports = this.parseImports(content);
    const exports = this.parseExports(content);

    const dependencies = new Set<string>();
    for (const imp of imports) {
      const resolvedPath = this.resolveImportPath(filePath, imp.importPath);
      if (resolvedPath) {
        dependencies.add(resolvedPath);
      }
    }

    const node: FileNode = {
      path: filePath,
      imports,
      exports,
      dependencies,
      dependents: new Set(),
      lastModified: Date.now(),
    };

    // Update dependents for files this file imports
    for (const depPath of dependencies) {
      const depNode = this.graph.get(depPath);
      if (depNode) {
        depNode.dependents.add(filePath);
      }
    }

    // Remove old dependencies if file already exists
    const oldNode = this.graph.get(filePath);
    if (oldNode) {
      for (const oldDep of oldNode.dependencies) {
        const oldDepNode = this.graph.get(oldDep);
        if (oldDepNode) {
          oldDepNode.dependents.delete(filePath);
        }
      }
    }

    this.graph.set(filePath, node);
  }

  /**
   * Remove a file from the dependency graph
   */
  removeFile(filePath: string): void {
    const node = this.graph.get(filePath);
    if (!node) return;

    // Remove this file from dependents of its dependencies
    for (const depPath of node.dependencies) {
      const depNode = this.graph.get(depPath);
      if (depNode) {
        depNode.dependents.delete(filePath);
      }
    }

    // Remove this file from dependencies of its dependents
    for (const depPath of node.dependents) {
      const depNode = this.graph.get(depPath);
      if (depNode) {
        depNode.dependencies.delete(filePath);
      }
    }

    this.graph.delete(filePath);
  }

  /**
   * Get all files that depend on the given file
   */
  getDependents(filePath: string): string[] {
    const node = this.graph.get(filePath);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Get all files that the given file depends on
   */
  getDependencies(filePath: string): string[] {
    const node = this.graph.get(filePath);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Detect circular dependencies in the graph
   */
  detectCircularDependencies(): CircularDependency[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: CircularDependency[] = [];

    const dfs = (filePath: string, path: string[]): void => {
      visited.add(filePath);
      recursionStack.add(filePath);
      path.push(filePath);

      const node = this.graph.get(filePath);
      if (node) {
        for (const dep of node.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found a cycle
            const cycleStart = path.indexOf(dep);
            const cycle = path.slice(cycleStart);
            cycle.push(dep); // Complete the cycle

            cycles.push({
              cycle,
              severity: cycle.length <= 3 ? 'warning' : 'error',
              suggestion: this.generateCircularDependencySuggestion(cycle),
            });
          }
        }
      }

      recursionStack.delete(filePath);
    };

    for (const filePath of this.graph.keys()) {
      if (!visited.has(filePath)) {
        dfs(filePath, []);
      }
    }

    return cycles;
  }

  /**
   * Get import statements for a specific file
   */
  getImports(filePath: string): ImportStatement[] {
    const node = this.graph.get(filePath);
    return node ? node.imports : [];
  }

  /**
   * Get export statements for a specific file
   */
  getExports(filePath: string): ExportStatement[] {
    const node = this.graph.get(filePath);
    return node ? node.exports : [];
  }

  /**
   * Update import path when a file is moved
   * Returns the list of files that need to be updated
   */
  updateImportsForFileMove(oldPath: string, newPath: string): string[] {
    const dependents = this.getDependents(oldPath);
    const filesToUpdate: string[] = [];

    for (const dependent of dependents) {
      const node = this.graph.get(dependent);
      if (!node) continue;

      // Check if this file imports the moved file
      const hasImport = node.imports.some(imp => {
        const resolvedPath = this.resolveImportPath(dependent, imp.importPath);
        return resolvedPath === oldPath;
      });

      if (hasImport) {
        filesToUpdate.push(dependent);
      }
    }

    return filesToUpdate;
  }

  /**
   * Calculate the new import path after a file move
   */
  calculateNewImportPath(importingFile: string, oldTargetPath: string, newTargetPath: string): string {
    // This is a simplified version - in production, you'd use proper path resolution
    const importingDir = this.getDirectory(importingFile);
    const relativePath = this.getRelativePath(importingDir, newTargetPath);
    return relativePath;
  }

  /**
   * Get dependency graph statistics
   */
  getStats(): DependencyGraphStats {
    const circularDependencies = this.detectCircularDependencies();
    const orphanedFiles: string[] = [];
    const dependencyCount = new Map<string, number>();

    for (const [filePath, node] of this.graph.entries()) {
      if (node.dependents.size === 0 && node.dependencies.size === 0) {
        orphanedFiles.push(filePath);
      }
      dependencyCount.set(filePath, node.dependents.size);
    }

    const mostDepended = Array.from(dependencyCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, count]) => ({ file, count }));

    return {
      totalFiles: this.graph.size,
      totalDependencies: Array.from(this.graph.values()).reduce(
        (sum, node) => sum + node.dependencies.size,
        0
      ),
      circularDependencies,
      orphanedFiles,
      mostDepended,
    };
  }

  /**
   * Parse import statements from file content
   */
  private parseImports(content: string): ImportStatement[] {
    const imports: ImportStatement[] = [];
    const lines = content.split('\n');

    // Parse named imports (including type imports)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for type-only imports first
      const typeImportMatch = /import\s+type\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (typeImportMatch) {
        const specifiersStr = typeImportMatch[1];
        const importPath = typeImportMatch[2];
        const specifiers = this.parseImportSpecifiers(specifiersStr);

        imports.push({
          source: importPath,
          specifiers,
          importPath,
          isTypeOnly: true,
          line: i + 1,
        });
        continue;
      }

      // Parse regular named imports
      const namedMatch = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (namedMatch) {
        const specifiersStr = namedMatch[1];
        const importPath = namedMatch[2];
        const specifiers = this.parseImportSpecifiers(specifiersStr);

        imports.push({
          source: importPath,
          specifiers,
          importPath,
          isTypeOnly: false,
          line: i + 1,
        });
        continue;
      }

      // Parse default imports
      const defaultMatch = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (defaultMatch) {
        const name = defaultMatch[1];
        const importPath = defaultMatch[2];

        imports.push({
          source: importPath,
          specifiers: [{ name, isDefault: true, isNamespace: false }],
          importPath,
          isTypeOnly: false,
          line: i + 1,
        });
        continue;
      }

      // Parse namespace imports
      const namespaceMatch = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/.exec(line);
      if (namespaceMatch) {
        const name = namespaceMatch[1];
        const importPath = namespaceMatch[2];

        imports.push({
          source: importPath,
          specifiers: [{ name, isDefault: false, isNamespace: true }],
          importPath,
          isTypeOnly: false,
          line: i + 1,
        });
      }
    }

    return imports;
  }

  /**
   * Parse export statements from file content
   */
  private parseExports(content: string): ExportStatement[] {
    const exports: ExportStatement[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse named exports
      const namedMatch = /export\s+{([^}]+)}/.exec(line);
      if (namedMatch) {
        const specifiersStr = namedMatch[1];
        const specifiers = this.parseExportSpecifiers(specifiersStr);

        exports.push({
          specifiers,
          line: i + 1,
        });
      }

      // Parse default exports
      if (line.includes('export default')) {
        exports.push({
          specifiers: [{ name: 'default', isDefault: true }],
          line: i + 1,
        });
      }

      // Parse export declarations
      const declMatch = /export\s+(const|let|var|function|class|interface|type)\s+(\w+)/.exec(line);
      if (declMatch) {
        const name = declMatch[2];
        exports.push({
          specifiers: [{ name, isDefault: false }],
          line: i + 1,
        });
      }
    }

    return exports;
  }

  /**
   * Parse import specifiers from string like "x, y as z, w"
   */
  private parseImportSpecifiers(specifiersStr: string): ImportSpecifier[] {
    const specifiers: ImportSpecifier[] = [];
    const parts = specifiersStr.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.includes(' as ')) {
        const [name, alias] = part.split(' as ').map(s => s.trim());
        specifiers.push({ name, alias, isDefault: false, isNamespace: false });
      } else {
        specifiers.push({ name: part, isDefault: false, isNamespace: false });
      }
    }

    return specifiers;
  }

  /**
   * Parse export specifiers from string like "x, y as z"
   */
  private parseExportSpecifiers(specifiersStr: string): ExportSpecifier[] {
    const specifiers: ExportSpecifier[] = [];
    const parts = specifiersStr.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.includes(' as ')) {
        const [name, alias] = part.split(' as ').map(s => s.trim());
        specifiers.push({ name, alias, isDefault: false });
      } else {
        specifiers.push({ name: part, isDefault: false });
      }
    }

    return specifiers;
  }

  /**
   * Resolve import path to absolute file path
   * This is a simplified version - in production, you'd use proper module resolution
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Skip node_modules and external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const fromDir = this.getDirectory(fromFile);
    const resolved = this.joinPaths(fromDir, importPath);

    // Try common extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (this.graph.has(candidate)) {
        return candidate;
      }
    }

    return resolved;
  }

  /**
   * Get directory from file path
   */
  private getDirectory(filePath: string): string {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/');
  }

  /**
   * Join paths
   */
  private joinPaths(base: string, relative: string): string {
    if (relative.startsWith('/')) {
      return relative;
    }

    const parts = base.split('/');
    const relativeParts = relative.split('/');

    for (const part of relativeParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  /**
   * Get relative path from one directory to a file
   */
  private getRelativePath(fromDir: string, toFile: string): string {
    const fromParts = fromDir.split('/').filter(p => p);
    const toParts = toFile.split('/').filter(p => p);

    // Find common prefix
    let commonLength = 0;
    while (
      commonLength < fromParts.length &&
      commonLength < toParts.length &&
      fromParts[commonLength] === toParts[commonLength]
    ) {
      commonLength++;
    }

    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const downParts = toParts.slice(commonLength);

    const relativeParts = Array(upLevels).fill('..').concat(downParts);
    const relativePath = relativeParts.join('/');

    return relativePath.startsWith('.') ? relativePath : './' + relativePath;
  }

  /**
   * Generate suggestion for resolving circular dependency
   */
  private generateCircularDependencySuggestion(cycle: string[]): string {
    if (cycle.length === 2) {
      return `Consider extracting shared code from ${cycle[0]} and ${cycle[1]} into a separate module.`;
    } else if (cycle.length === 3) {
      return `Consider using dependency injection or extracting interfaces to break the cycle between ${cycle[0]}, ${cycle[1]}, and ${cycle[2]}.`;
    } else {
      return `Complex circular dependency detected. Consider refactoring the architecture to reduce coupling between these ${cycle.length} modules.`;
    }
  }

  /**
   * Clear the entire dependency graph
   */
  clear(): void {
    this.graph.clear();
  }

  /**
   * Get all files in the graph
   */
  getAllFiles(): string[] {
    return Array.from(this.graph.keys());
  }
}

/**
 * Singleton instance for global access
 */
let dependencyManagerInstance: DependencyManager | null = null;

/**
 * Get or create the dependency manager singleton
 */
export function getDependencyManager(): DependencyManager {
  if (!dependencyManagerInstance) {
    dependencyManagerInstance = new DependencyManager();
  }
  return dependencyManagerInstance;
}

/**
 * Reset the dependency manager (useful for testing)
 */
export function resetDependencyManager(): void {
  dependencyManagerInstance = null;
}

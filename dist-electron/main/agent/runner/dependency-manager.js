"use strict";
/**
 * EverFern Desktop — Dependency Manager
 *
 * Provides real-time dependency graph tracking across the codebase.
 * Manages import statements, detects circular dependencies, and integrates
 * with semanticRename and smartRelocate tools for safe refactoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyManager = void 0;
exports.getDependencyManager = getDependencyManager;
exports.resetDependencyManager = resetDependencyManager;
/**
 * Dependency Manager - Tracks and manages file dependencies and imports
 */
class DependencyManager {
    graph = new Map();
    importPatterns = {
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
    addFile(filePath, content) {
        const imports = this.parseImports(content);
        const exports = this.parseExports(content);
        const dependencies = new Set();
        for (const imp of imports) {
            const resolvedPath = this.resolveImportPath(filePath, imp.importPath);
            if (resolvedPath) {
                dependencies.add(resolvedPath);
            }
        }
        const node = {
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
    removeFile(filePath) {
        const node = this.graph.get(filePath);
        if (!node)
            return;
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
    getDependents(filePath) {
        const node = this.graph.get(filePath);
        return node ? Array.from(node.dependents) : [];
    }
    /**
     * Get all files that the given file depends on
     */
    getDependencies(filePath) {
        const node = this.graph.get(filePath);
        return node ? Array.from(node.dependencies) : [];
    }
    /**
     * Detect circular dependencies in the graph
     */
    detectCircularDependencies() {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const dfs = (filePath, path) => {
            visited.add(filePath);
            recursionStack.add(filePath);
            path.push(filePath);
            const node = this.graph.get(filePath);
            if (node) {
                for (const dep of node.dependencies) {
                    if (!visited.has(dep)) {
                        dfs(dep, [...path]);
                    }
                    else if (recursionStack.has(dep)) {
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
    getImports(filePath) {
        const node = this.graph.get(filePath);
        return node ? node.imports : [];
    }
    /**
     * Get export statements for a specific file
     */
    getExports(filePath) {
        const node = this.graph.get(filePath);
        return node ? node.exports : [];
    }
    /**
     * Update import path when a file is moved
     * Returns the list of files that need to be updated
     */
    updateImportsForFileMove(oldPath, newPath) {
        const dependents = this.getDependents(oldPath);
        const filesToUpdate = [];
        for (const dependent of dependents) {
            const node = this.graph.get(dependent);
            if (!node)
                continue;
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
    calculateNewImportPath(importingFile, oldTargetPath, newTargetPath) {
        // This is a simplified version - in production, you'd use proper path resolution
        const importingDir = this.getDirectory(importingFile);
        const relativePath = this.getRelativePath(importingDir, newTargetPath);
        return relativePath;
    }
    /**
     * Get dependency graph statistics
     */
    getStats() {
        const circularDependencies = this.detectCircularDependencies();
        const orphanedFiles = [];
        const dependencyCount = new Map();
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
            totalDependencies: Array.from(this.graph.values()).reduce((sum, node) => sum + node.dependencies.size, 0),
            circularDependencies,
            orphanedFiles,
            mostDepended,
        };
    }
    /**
     * Parse import statements from file content
     */
    parseImports(content) {
        const imports = [];
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
    parseExports(content) {
        const exports = [];
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
    parseImportSpecifiers(specifiersStr) {
        const specifiers = [];
        const parts = specifiersStr.split(',').map(s => s.trim());
        for (const part of parts) {
            if (part.includes(' as ')) {
                const [name, alias] = part.split(' as ').map(s => s.trim());
                specifiers.push({ name, alias, isDefault: false, isNamespace: false });
            }
            else {
                specifiers.push({ name: part, isDefault: false, isNamespace: false });
            }
        }
        return specifiers;
    }
    /**
     * Parse export specifiers from string like "x, y as z"
     */
    parseExportSpecifiers(specifiersStr) {
        const specifiers = [];
        const parts = specifiersStr.split(',').map(s => s.trim());
        for (const part of parts) {
            if (part.includes(' as ')) {
                const [name, alias] = part.split(' as ').map(s => s.trim());
                specifiers.push({ name, alias, isDefault: false });
            }
            else {
                specifiers.push({ name: part, isDefault: false });
            }
        }
        return specifiers;
    }
    /**
     * Resolve import path to absolute file path
     * This is a simplified version - in production, you'd use proper module resolution
     */
    resolveImportPath(fromFile, importPath) {
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
    getDirectory(filePath) {
        const parts = filePath.split('/');
        parts.pop();
        return parts.join('/');
    }
    /**
     * Join paths
     */
    joinPaths(base, relative) {
        if (relative.startsWith('/')) {
            return relative;
        }
        const parts = base.split('/');
        const relativeParts = relative.split('/');
        for (const part of relativeParts) {
            if (part === '..') {
                parts.pop();
            }
            else if (part !== '.') {
                parts.push(part);
            }
        }
        return parts.join('/');
    }
    /**
     * Get relative path from one directory to a file
     */
    getRelativePath(fromDir, toFile) {
        const fromParts = fromDir.split('/').filter(p => p);
        const toParts = toFile.split('/').filter(p => p);
        // Find common prefix
        let commonLength = 0;
        while (commonLength < fromParts.length &&
            commonLength < toParts.length &&
            fromParts[commonLength] === toParts[commonLength]) {
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
    generateCircularDependencySuggestion(cycle) {
        if (cycle.length === 2) {
            return `Consider extracting shared code from ${cycle[0]} and ${cycle[1]} into a separate module.`;
        }
        else if (cycle.length === 3) {
            return `Consider using dependency injection or extracting interfaces to break the cycle between ${cycle[0]}, ${cycle[1]}, and ${cycle[2]}.`;
        }
        else {
            return `Complex circular dependency detected. Consider refactoring the architecture to reduce coupling between these ${cycle.length} modules.`;
        }
    }
    /**
     * Clear the entire dependency graph
     */
    clear() {
        this.graph.clear();
    }
    /**
     * Get all files in the graph
     */
    getAllFiles() {
        return Array.from(this.graph.keys());
    }
}
exports.DependencyManager = DependencyManager;
/**
 * Singleton instance for global access
 */
let dependencyManagerInstance = null;
/**
 * Get or create the dependency manager singleton
 */
function getDependencyManager() {
    if (!dependencyManagerInstance) {
        dependencyManagerInstance = new DependencyManager();
    }
    return dependencyManagerInstance;
}
/**
 * Reset the dependency manager (useful for testing)
 */
function resetDependencyManager() {
    dependencyManagerInstance = null;
}

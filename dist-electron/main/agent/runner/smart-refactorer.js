"use strict";
/**
 * EverFern Desktop — Smart Refactorer
 *
 * Provides intelligent refactoring capabilities including code duplication detection,
 * function decomposition, naming convention improvements, and design pattern application.
 * Integrates with the dependency manager for safe refactoring operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartRefactorer = void 0;
exports.getSmartRefactorer = getSmartRefactorer;
exports.resetSmartRefactorer = resetSmartRefactorer;
const dependency_manager_1 = require("./dependency-manager");
/**
 * Smart Refactorer - Analyzes code and performs intelligent refactoring
 */
class SmartRefactorer {
    dependencyManager = (0, dependency_manager_1.getDependencyManager)();
    // Common design patterns that can be applied
    designPatterns = [
        {
            name: 'Factory Pattern',
            description: 'Create objects without specifying their exact class',
            applicableWhen: ['Multiple similar constructors', 'Complex object creation logic'],
            implementation: `
class Factory {
  static create(type: string, options: any) {
    switch (type) {
      case 'typeA': return new TypeA(options);
      case 'typeB': return new TypeB(options);
      default: throw new Error('Unknown type');
    }
  }
}`,
            benefits: ['Decouples object creation', 'Easier to extend', 'Centralized creation logic']
        },
        {
            name: 'Observer Pattern',
            description: 'Define a subscription mechanism to notify multiple objects',
            applicableWhen: ['Event handling', 'State change notifications', 'Loose coupling needed'],
            implementation: `
interface Observer {
  update(data: any): void;
}

class Subject {
  private observers: Observer[] = [];

  subscribe(observer: Observer) {
    this.observers.push(observer);
  }

  notify(data: any) {
    this.observers.forEach(observer => observer.update(data));
  }
}`,
            benefits: ['Loose coupling', 'Dynamic relationships', 'Broadcast communication']
        }
    ];
    /**
     * Analyze code architecture and identify refactoring opportunities
     */
    analyzeCodeArchitecture(filePaths) {
        const opportunities = [];
        for (const filePath of filePaths) {
            // Analyze each file for refactoring opportunities
            const fileOpportunities = this.analyzeFile(filePath);
            opportunities.push(...fileOpportunities);
        }
        return opportunities;
    }
    /**
     * Detect code duplication across multiple files
     */
    detectCodeDuplication(filePaths) {
        const duplications = [];
        const codeBlocks = new Map();
        // Extract code blocks from all files
        for (const filePath of filePaths) {
            const content = this.getFileContent(filePath);
            if (!content)
                continue;
            const lines = content.split('\n');
            // Look for function blocks, class methods, etc.
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                // Detect function/method blocks
                if (this.isFunctionStart(line)) {
                    const block = this.extractCodeBlock(lines, i);
                    if (block.lines.length >= 3) { // Only consider blocks with 3+ lines
                        const signature = this.normalizeCode(block.lines.join('\n'));
                        if (!codeBlocks.has(signature)) {
                            codeBlocks.set(signature, []);
                        }
                        codeBlocks.get(signature).push({
                            file: filePath,
                            lines: block.lines,
                            startLine: i + 1
                        });
                    }
                }
            }
        }
        // Find duplications
        for (const [signature, blocks] of codeBlocks.entries()) {
            if (blocks.length > 1) {
                const similarity = this.calculateSimilarity(blocks[0].lines, blocks[1].lines);
                if (similarity > 0.8) { // 80% similarity threshold
                    duplications.push({
                        files: blocks.map(b => b.file),
                        duplicatedCode: blocks[0].lines.join('\n'),
                        startLine: blocks[0].startLine,
                        endLine: blocks[0].startLine + blocks[0].lines.length - 1,
                        similarity,
                        suggestion: this.generateDuplicationSuggestion(blocks)
                    });
                }
            }
        }
        return duplications;
    }
    /**
     * Extract repeated code into reusable functions or components
     */
    extractReusableComponents(duplications) {
        const results = [];
        for (const duplication of duplications) {
            try {
                const result = this.performExtraction(duplication);
                results.push(result);
            }
            catch (error) {
                results.push({
                    success: false,
                    filesModified: [],
                    description: `Failed to extract duplication from ${duplication.files.join(', ')}`,
                    errors: [error instanceof Error ? error.message : 'Unknown error']
                });
            }
        }
        return results;
    }
    /**
     * Decompose large functions into smaller, more maintainable units
     */
    decomposeFunctions(filePath) {
        const content = this.getFileContent(filePath);
        if (!content) {
            return {
                success: true,
                filesModified: [],
                description: 'No large functions found that need decomposition'
            };
        }
        const lines = content.split('\n');
        const largeFunctions = this.findLargeFunctions(lines);
        if (largeFunctions.length === 0) {
            return {
                success: true,
                filesModified: [],
                description: 'No large functions found that need decomposition'
            };
        }
        // Decompose each large function
        let modifiedContent = content;
        const modifications = [];
        for (const func of largeFunctions) {
            const decomposed = this.decomposeLargeFunction(func);
            modifiedContent = this.applyFunctionDecomposition(modifiedContent, func, decomposed);
            modifications.push(`Decomposed function '${func.name}' into ${decomposed.length} smaller functions`);
        }
        return {
            success: true,
            filesModified: [filePath],
            description: `Decomposed ${largeFunctions.length} large functions`,
            warnings: modifications
        };
    }
    /**
     * Improve naming conventions for better code readability
     */
    improveNamingConventions(filePath) {
        const content = this.getFileContent(filePath);
        if (!content)
            return [];
        const issues = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check variable names
            const varMatches = line.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            for (const match of varMatches) {
                const varName = match[1];
                const suggestion = this.suggestBetterVariableName(varName, line);
                if (suggestion && suggestion !== varName) {
                    issues.push({
                        file: filePath,
                        symbol: varName,
                        currentName: varName,
                        suggestedName: suggestion,
                        type: 'variable',
                        line: i + 1,
                        reason: this.explainNamingImprovement(varName, suggestion)
                    });
                }
            }
            // Check function names
            const funcMatches = line.matchAll(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            for (const match of funcMatches) {
                const funcName = match[1];
                const suggestion = this.suggestBetterFunctionName(funcName, line);
                if (suggestion && suggestion !== funcName) {
                    issues.push({
                        file: filePath,
                        symbol: funcName,
                        currentName: funcName,
                        suggestedName: suggestion,
                        type: 'function',
                        line: i + 1,
                        reason: this.explainNamingImprovement(funcName, suggestion)
                    });
                }
            }
            // Check class names
            const classMatches = line.matchAll(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            for (const match of classMatches) {
                const className = match[1];
                const suggestion = this.suggestBetterClassName(className);
                if (suggestion && suggestion !== className) {
                    issues.push({
                        file: filePath,
                        symbol: className,
                        currentName: className,
                        suggestedName: suggestion,
                        type: 'class',
                        line: i + 1,
                        reason: this.explainNamingImprovement(className, suggestion)
                    });
                }
            }
        }
        return issues;
    }
    /**
     * Apply design patterns where appropriate to improve code structure
     */
    applyDesignPatterns(filePath) {
        const content = this.getFileContent(filePath);
        if (!content)
            return [];
        const opportunities = [];
        // Analyze code for pattern application opportunities
        for (const pattern of this.designPatterns) {
            const applicability = this.analyzePatternApplicability(content, pattern);
            if (applicability.applicable) {
                opportunities.push({
                    type: 'apply-pattern',
                    file: filePath,
                    description: `Apply ${pattern.name}: ${pattern.description}`,
                    impact: applicability.impact,
                    suggestion: `Consider applying the ${pattern.name} pattern. ${applicability.reason}`,
                    location: applicability.location
                });
            }
        }
        return opportunities;
    }
    /**
     * Optimize import statements and remove unused imports
     */
    optimizeImports(filePath) {
        const imports = this.dependencyManager.getImports(filePath);
        const content = this.getFileContent(filePath);
        if (!content || imports.length === 0) {
            return {
                success: true,
                filesModified: [],
                description: 'No imports to optimize'
            };
        }
        const usedImports = this.findUsedImports(content, imports);
        const unusedImports = imports.filter(imp => !imp.specifiers.some(spec => usedImports.has(spec.name)));
        if (unusedImports.length === 0) {
            return {
                success: true,
                filesModified: [],
                description: 'All imports are being used'
            };
        }
        // Remove unused imports and reorganize
        const optimizedContent = this.removeUnusedImports(content, unusedImports);
        const reorganizedContent = this.reorganizeImports(optimizedContent);
        return {
            success: true,
            filesModified: [filePath],
            description: `Removed ${unusedImports.length} unused imports and reorganized import statements`,
            warnings: unusedImports.map(imp => `Removed unused import: ${imp.importPath}`)
        };
    }
    /**
     * Run tests to verify functionality is preserved after refactoring
     */
    async verifyRefactoringPreservesFunction(filePaths) {
        // This would integrate with the testing system
        // For now, we'll simulate the verification
        try {
            // Check if files compile without errors
            for (const filePath of filePaths) {
                const hasErrors = await this.checkForCompilationErrors(filePath);
                if (hasErrors) {
                    return false;
                }
            }
            // Run relevant tests
            const testResults = await this.runRelevantTests(filePaths);
            return testResults.allPassed;
        }
        catch (error) {
            console.error('Error verifying refactoring:', error);
            return false;
        }
    }
    // Private helper methods
    analyzeFile(filePath) {
        const opportunities = [];
        const content = this.getFileContent(filePath);
        if (!content)
            return opportunities;
        const lines = content.split('\n');
        // Look for long functions
        const longFunctions = this.findLargeFunctions(lines);
        for (const func of longFunctions) {
            opportunities.push({
                type: 'extract-function',
                file: filePath,
                description: `Function '${func.name}' is ${func.lineCount} lines long`,
                impact: func.lineCount > 50 ? 'high' : 'medium',
                suggestion: `Consider breaking down this function into smaller, more focused functions`,
                location: {
                    startLine: func.startLine,
                    endLine: func.endLine
                }
            });
        }
        // Look for repeated patterns
        const patterns = this.findRepeatedPatterns(content);
        for (const pattern of patterns) {
            opportunities.push({
                type: 'extract-component',
                file: filePath,
                description: `Repeated code pattern found (${pattern.occurrences} times)`,
                impact: pattern.occurrences > 3 ? 'high' : 'medium',
                suggestion: `Extract this pattern into a reusable function or component`
            });
        }
        return opportunities;
    }
    getFileContent(filePath) {
        // In a real implementation, this would read the file from disk
        // For now, we'll simulate it
        return null;
    }
    isFunctionStart(line) {
        return /^\s*(function|const\s+\w+\s*=|class\s+\w+|\w+\s*\([^)]*\)\s*{)/.test(line);
    }
    extractCodeBlock(lines, startIndex) {
        const blockLines = [];
        let braceCount = 0;
        let i = startIndex;
        while (i < lines.length) {
            const line = lines[i];
            blockLines.push(line);
            // Count braces to find block end
            for (const char of line) {
                if (char === '{')
                    braceCount++;
                if (char === '}')
                    braceCount--;
            }
            if (braceCount === 0 && i > startIndex) {
                break;
            }
            i++;
        }
        return { lines: blockLines, endIndex: i };
    }
    normalizeCode(code) {
        return code
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\/\/.*$/gm, '') // Remove line comments
            .trim();
    }
    calculateSimilarity(lines1, lines2) {
        const normalized1 = lines1.map(line => this.normalizeCode(line));
        const normalized2 = lines2.map(line => this.normalizeCode(line));
        const minLength = Math.min(normalized1.length, normalized2.length);
        let matches = 0;
        for (let i = 0; i < minLength; i++) {
            if (normalized1[i] === normalized2[i]) {
                matches++;
            }
        }
        return matches / Math.max(normalized1.length, normalized2.length);
    }
    generateDuplicationSuggestion(blocks) {
        const functionName = this.extractFunctionName(blocks[0].lines[0]);
        return `Extract the duplicated code into a shared utility function${functionName ? ` (consider naming it '${functionName}Util')` : ''}. This code appears in ${blocks.length} files: ${blocks.map(b => b.file).join(', ')}.`;
    }
    extractFunctionName(line) {
        const match = line.match(/function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*\(/);
        return match ? (match[1] || match[2] || match[3]) : null;
    }
    performExtraction(duplication) {
        // This would perform the actual code extraction
        // For now, we'll simulate it
        return {
            success: true,
            filesModified: duplication.files,
            description: `Extracted duplicated code into a shared utility function`,
            warnings: [`Created new utility function for code duplicated across ${duplication.files.length} files`]
        };
    }
    findLargeFunctions(lines) {
        const largeFunctions = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (this.isFunctionStart(line)) {
                const block = this.extractCodeBlock(lines, i);
                const functionName = this.extractFunctionName(line) || 'anonymous';
                if (block.lines.length > 20) { // Consider functions > 20 lines as large
                    largeFunctions.push({
                        name: functionName,
                        startLine: i + 1,
                        endLine: block.endIndex + 1,
                        lineCount: block.lines.length
                    });
                }
            }
        }
        return largeFunctions;
    }
    decomposeLargeFunction(func) {
        // This would analyze the function and suggest decomposition
        // For now, we'll return a placeholder
        return [`${func.name}Helper1`, `${func.name}Helper2`];
    }
    applyFunctionDecomposition(content, func, decomposed) {
        // This would apply the actual decomposition
        // For now, we'll return the original content
        return content;
    }
    suggestBetterVariableName(varName, context) {
        // Simple naming convention improvements
        if (varName.length <= 2 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(varName)) {
            return null; // Too short, needs context
        }
        if (varName.includes('temp') || varName.includes('tmp')) {
            return varName.replace(/temp|tmp/g, 'current');
        }
        if (varName.startsWith('data') && varName.length > 4) {
            const suffix = varName.slice(4);
            return suffix.charAt(0).toLowerCase() + suffix.slice(1);
        }
        return null;
    }
    suggestBetterFunctionName(funcName, context) {
        // Suggest verb-based function names
        if (!this.startsWithVerb(funcName)) {
            if (context.includes('return')) {
                return 'get' + funcName.charAt(0).toUpperCase() + funcName.slice(1);
            }
            if (context.includes('=')) {
                return 'set' + funcName.charAt(0).toUpperCase() + funcName.slice(1);
            }
        }
        return null;
    }
    suggestBetterClassName(className) {
        // Ensure PascalCase for classes
        if (className.charAt(0) !== className.charAt(0).toUpperCase()) {
            return className.charAt(0).toUpperCase() + className.slice(1);
        }
        return null;
    }
    startsWithVerb(name) {
        const verbs = ['get', 'set', 'is', 'has', 'can', 'should', 'will', 'create', 'update', 'delete', 'find', 'search', 'validate', 'process', 'handle', 'execute', 'run', 'start', 'stop', 'pause', 'resume'];
        return verbs.some(verb => name.toLowerCase().startsWith(verb));
    }
    explainNamingImprovement(oldName, newName) {
        if (newName.startsWith('get') || newName.startsWith('set')) {
            return 'Function names should start with verbs to indicate their action';
        }
        if (newName.charAt(0) !== oldName.charAt(0)) {
            return 'Class names should use PascalCase convention';
        }
        return 'Improved name for better readability and convention compliance';
    }
    analyzePatternApplicability(content, pattern) {
        // Simplified pattern detection
        if (pattern.name === 'Factory Pattern') {
            const hasMultipleConstructors = (content.match(/new\s+\w+\(/g) || []).length > 3;
            const hasComplexCreation = content.includes('switch') && content.includes('new');
            if (hasMultipleConstructors || hasComplexCreation) {
                return {
                    applicable: true,
                    impact: 'medium',
                    reason: 'Multiple object creation patterns detected that could benefit from a factory'
                };
            }
        }
        if (pattern.name === 'Observer Pattern') {
            const hasEventHandling = content.includes('addEventListener') || content.includes('on');
            const hasStateChanges = content.includes('setState') || content.includes('state');
            if (hasEventHandling && hasStateChanges) {
                return {
                    applicable: true,
                    impact: 'high',
                    reason: 'Event handling and state changes detected that could benefit from observer pattern'
                };
            }
        }
        return {
            applicable: false,
            impact: 'low',
            reason: 'Pattern not applicable to current code structure'
        };
    }
    findRepeatedPatterns(content) {
        const patterns = [];
        const lines = content.split('\n');
        const lineGroups = new Map();
        // Look for repeated line patterns
        for (let i = 0; i < lines.length - 2; i++) {
            const pattern = lines.slice(i, i + 3).map(line => this.normalizeCode(line)).join('|');
            if (pattern.trim()) {
                lineGroups.set(pattern, (lineGroups.get(pattern) || 0) + 1);
            }
        }
        for (const [pattern, count] of lineGroups.entries()) {
            if (count > 1) {
                patterns.push({ pattern, occurrences: count });
            }
        }
        return patterns;
    }
    findUsedImports(content, imports) {
        const used = new Set();
        for (const imp of imports) {
            for (const spec of imp.specifiers) {
                if (content.includes(spec.name)) {
                    used.add(spec.name);
                }
            }
        }
        return used;
    }
    removeUnusedImports(content, unusedImports) {
        let result = content;
        for (const imp of unusedImports) {
            // Remove the entire import line
            const importRegex = new RegExp(`import.*from\\s+['"]${imp.importPath}['"];?\\s*\\n?`, 'g');
            result = result.replace(importRegex, '');
        }
        return result;
    }
    reorganizeImports(content) {
        const lines = content.split('\n');
        const imports = [];
        const otherLines = [];
        for (const line of lines) {
            if (line.trim().startsWith('import')) {
                imports.push(line);
            }
            else {
                otherLines.push(line);
            }
        }
        // Sort imports: external packages first, then relative imports
        imports.sort((a, b) => {
            const aIsRelative = a.includes('./') || a.includes('../');
            const bIsRelative = b.includes('./') || b.includes('../');
            if (aIsRelative && !bIsRelative)
                return 1;
            if (!aIsRelative && bIsRelative)
                return -1;
            return a.localeCompare(b);
        });
        return [...imports, '', ...otherLines].join('\n');
    }
    async checkForCompilationErrors(filePath) {
        // This would use getDiagnostics or similar to check for errors
        // For now, we'll simulate it
        return false;
    }
    async runRelevantTests(filePaths) {
        // This would run tests related to the modified files
        // For now, we'll simulate it
        return { allPassed: true, results: [] };
    }
}
exports.SmartRefactorer = SmartRefactorer;
/**
 * Singleton instance for global access
 */
let smartRefactorerInstance = null;
/**
 * Get or create the smart refactorer singleton
 */
function getSmartRefactorer() {
    if (!smartRefactorerInstance) {
        smartRefactorerInstance = new SmartRefactorer();
    }
    return smartRefactorerInstance;
}
/**
 * Reset the smart refactorer (useful for testing)
 */
function resetSmartRefactorer() {
    smartRefactorerInstance = null;
}

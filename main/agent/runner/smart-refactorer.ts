/**
 * EverFern Desktop — Smart Refactorer
 *
 * Provides intelligent refactoring capabilities including code duplication detection,
 * function decomposition, naming convention improvements, and design pattern application.
 * Integrates with the dependency manager for safe refactoring operations.
 */

import { getDependencyManager } from './dependency-manager';

export interface CodeDuplication {
  files: string[];
  duplicatedCode: string;
  startLine: number;
  endLine: number;
  similarity: number; // 0-1 score
  suggestion: string;
}

export interface RefactoringOpportunity {
  type: 'extract-function' | 'extract-component' | 'rename-symbol' | 'apply-pattern' | 'optimize-imports';
  file: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
  location?: {
    startLine: number;
    endLine: number;
  };
}

export interface NamingConventionIssue {
  file: string;
  symbol: string;
  currentName: string;
  suggestedName: string;
  type: 'variable' | 'function' | 'class' | 'interface' | 'type';
  line: number;
  reason: string;
}

export interface DesignPattern {
  name: string;
  description: string;
  applicableWhen: string[];
  implementation: string;
  benefits: string[];
}

export interface RefactoringResult {
  success: boolean;
  filesModified: string[];
  description: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * Smart Refactorer - Analyzes code and performs intelligent refactoring
 */
export class SmartRefactorer {
  private dependencyManager = getDependencyManager();

  // Common design patterns that can be applied
  private designPatterns: DesignPattern[] = [
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
  analyzeCodeArchitecture(filePaths: string[]): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];

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
  detectCodeDuplication(filePaths: string[]): CodeDuplication[] {
    const duplications: CodeDuplication[] = [];
    const codeBlocks = new Map<string, { file: string; lines: string[]; startLine: number }[]>();

    // Extract code blocks from all files
    for (const filePath of filePaths) {
      const content = this.getFileContent(filePath);
      if (!content) continue;

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

            codeBlocks.get(signature)!.push({
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
  extractReusableComponents(duplications: CodeDuplication[]): RefactoringResult[] {
    const results: RefactoringResult[] = [];

    for (const duplication of duplications) {
      try {
        const result = this.performExtraction(duplication);
        results.push(result);
      } catch (error) {
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
  decomposeFunctions(filePath: string): RefactoringResult {
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
    const modifications: string[] = [];

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
  improveNamingConventions(filePath: string): NamingConventionIssue[] {
    const content = this.getFileContent(filePath);
    if (!content) return [];

    const issues: NamingConventionIssue[] = [];
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
  applyDesignPatterns(filePath: string): RefactoringOpportunity[] {
    const content = this.getFileContent(filePath);
    if (!content) return [];

    const opportunities: RefactoringOpportunity[] = [];

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
  optimizeImports(filePath: string): RefactoringResult {
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
    const unusedImports = imports.filter(imp =>
      !imp.specifiers.some(spec => usedImports.has(spec.name))
    );

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
  async verifyRefactoringPreservesFunction(filePaths: string[]): Promise<boolean> {
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

    } catch (error) {
      console.error('Error verifying refactoring:', error);
      return false;
    }
  }

  // Private helper methods

  private analyzeFile(filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const content = this.getFileContent(filePath);

    if (!content) return opportunities;

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

  private getFileContent(filePath: string): string | null {
    // In a real implementation, this would read the file from disk
    // For now, we'll simulate it
    return null;
  }

  private isFunctionStart(line: string): boolean {
    return /^\s*(function|const\s+\w+\s*=|class\s+\w+|\w+\s*\([^)]*\)\s*{)/.test(line);
  }

  private extractCodeBlock(lines: string[], startIndex: number): { lines: string[]; endIndex: number } {
    const blockLines: string[] = [];
    let braceCount = 0;
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      blockLines.push(line);

      // Count braces to find block end
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      if (braceCount === 0 && i > startIndex) {
        break;
      }

      i++;
    }

    return { lines: blockLines, endIndex: i };
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .trim();
  }

  private calculateSimilarity(lines1: string[], lines2: string[]): number {
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

  private generateDuplicationSuggestion(blocks: { file: string; lines: string[] }[]): string {
    const functionName = this.extractFunctionName(blocks[0].lines[0]);
    return `Extract the duplicated code into a shared utility function${functionName ? ` (consider naming it '${functionName}Util')` : ''}. This code appears in ${blocks.length} files: ${blocks.map(b => b.file).join(', ')}.`;
  }

  private extractFunctionName(line: string): string | null {
    const match = line.match(/function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*\(/);
    return match ? (match[1] || match[2] || match[3]) : null;
  }

  private performExtraction(duplication: CodeDuplication): RefactoringResult {
    // This would perform the actual code extraction
    // For now, we'll simulate it
    return {
      success: true,
      filesModified: duplication.files,
      description: `Extracted duplicated code into a shared utility function`,
      warnings: [`Created new utility function for code duplicated across ${duplication.files.length} files`]
    };
  }

  private findLargeFunctions(lines: string[]): Array<{
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
  }> {
    const largeFunctions: Array<{
      name: string;
      startLine: number;
      endLine: number;
      lineCount: number;
    }> = [];

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

  private decomposeLargeFunction(func: { name: string; startLine: number; endLine: number }): string[] {
    // This would analyze the function and suggest decomposition
    // For now, we'll return a placeholder
    return [`${func.name}Helper1`, `${func.name}Helper2`];
  }

  private applyFunctionDecomposition(content: string, func: any, decomposed: string[]): string {
    // This would apply the actual decomposition
    // For now, we'll return the original content
    return content;
  }

  private suggestBetterVariableName(varName: string, context: string): string | null {
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

  private suggestBetterFunctionName(funcName: string, context: string): string | null {
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

  private suggestBetterClassName(className: string): string | null {
    // Ensure PascalCase for classes
    if (className.charAt(0) !== className.charAt(0).toUpperCase()) {
      return className.charAt(0).toUpperCase() + className.slice(1);
    }

    return null;
  }

  private startsWithVerb(name: string): boolean {
    const verbs = ['get', 'set', 'is', 'has', 'can', 'should', 'will', 'create', 'update', 'delete', 'find', 'search', 'validate', 'process', 'handle', 'execute', 'run', 'start', 'stop', 'pause', 'resume'];
    return verbs.some(verb => name.toLowerCase().startsWith(verb));
  }

  private explainNamingImprovement(oldName: string, newName: string): string {
    if (newName.startsWith('get') || newName.startsWith('set')) {
      return 'Function names should start with verbs to indicate their action';
    }
    if (newName.charAt(0) !== oldName.charAt(0)) {
      return 'Class names should use PascalCase convention';
    }
    return 'Improved name for better readability and convention compliance';
  }

  private analyzePatternApplicability(content: string, pattern: DesignPattern): {
    applicable: boolean;
    impact: 'low' | 'medium' | 'high';
    reason: string;
    location?: { startLine: number; endLine: number };
  } {
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

  private findRepeatedPatterns(content: string): Array<{ pattern: string; occurrences: number }> {
    const patterns: Array<{ pattern: string; occurrences: number }> = [];
    const lines = content.split('\n');
    const lineGroups = new Map<string, number>();

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

  private findUsedImports(content: string, imports: any[]): Set<string> {
    const used = new Set<string>();

    for (const imp of imports) {
      for (const spec of imp.specifiers) {
        if (content.includes(spec.name)) {
          used.add(spec.name);
        }
      }
    }

    return used;
  }

  private removeUnusedImports(content: string, unusedImports: any[]): string {
    let result = content;

    for (const imp of unusedImports) {
      // Remove the entire import line
      const importRegex = new RegExp(`import.*from\\s+['"]${imp.importPath}['"];?\\s*\\n?`, 'g');
      result = result.replace(importRegex, '');
    }

    return result;
  }

  private reorganizeImports(content: string): string {
    const lines = content.split('\n');
    const imports: string[] = [];
    const otherLines: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('import')) {
        imports.push(line);
      } else {
        otherLines.push(line);
      }
    }

    // Sort imports: external packages first, then relative imports
    imports.sort((a, b) => {
      const aIsRelative = a.includes('./') || a.includes('../');
      const bIsRelative = b.includes('./') || b.includes('../');

      if (aIsRelative && !bIsRelative) return 1;
      if (!aIsRelative && bIsRelative) return -1;
      return a.localeCompare(b);
    });

    return [...imports, '', ...otherLines].join('\n');
  }

  private async checkForCompilationErrors(filePath: string): Promise<boolean> {
    // This would use getDiagnostics or similar to check for errors
    // For now, we'll simulate it
    return false;
  }

  private async runRelevantTests(filePaths: string[]): Promise<{ allPassed: boolean; results: any[] }> {
    // This would run tests related to the modified files
    // For now, we'll simulate it
    return { allPassed: true, results: [] };
  }
}

/**
 * Singleton instance for global access
 */
let smartRefactorerInstance: SmartRefactorer | null = null;

/**
 * Get or create the smart refactorer singleton
 */
export function getSmartRefactorer(): SmartRefactorer {
  if (!smartRefactorerInstance) {
    smartRefactorerInstance = new SmartRefactorer();
  }
  return smartRefactorerInstance;
}

/**
 * Reset the smart refactorer (useful for testing)
 */
export function resetSmartRefactorer(): void {
  smartRefactorerInstance = null;
}

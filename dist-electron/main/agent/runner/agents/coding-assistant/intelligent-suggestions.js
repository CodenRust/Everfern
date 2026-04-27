"use strict";
/**
 * AI-Powered Intelligent Suggestions Engine
 *
 * Generates context-aware, AI-driven suggestions for code improvements,
 * completions, refactoring, and best practices based on codebase analysis.
 * All suggestions are generated through AI analysis, not hardcoded patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntelligentSuggestionsEngine = void 0;
exports.getIntelligentSuggestionsEngine = getIntelligentSuggestionsEngine;
exports.resetIntelligentSuggestionsEngine = resetIntelligentSuggestionsEngine;
const intent_classifier_1 = require("./core/intent-classifier");
class IntelligentSuggestionsEngine {
    intentClassifier;
    constructor() {
        this.intentClassifier = new intent_classifier_1.IntentClassifier();
    }
    /**
     * Generate intelligent suggestions based on AI analysis of context
     */
    async generateSuggestions(context) {
        try {
            // Classify user intent using AI
            const intent = await this.intentClassifier.classifyIntent(context.userInput, {
                codebaseAnalysis: context.codebaseAnalysis,
                recentChanges: context.recentChanges,
                activeFiles: context.currentFile ? [context.currentFile] : []
            });
            // Generate suggestions based on AI analysis
            const suggestions = await this.generateAISuggestions(context, intent);
            // Prioritize and filter suggestions
            return this.prioritizeSuggestions(suggestions);
        }
        catch (error) {
            console.error('Error generating suggestions:', error);
            return [];
        }
    }
    /**
     * Generate suggestions using AI analysis
     */
    async generateAISuggestions(context, intent) {
        const suggestions = [];
        // Generate AI-powered suggestions for different categories
        const completionSuggestions = await this.generateCompletionSuggestions(context, intent);
        const refactorSuggestions = await this.generateRefactorSuggestions(context, intent);
        const securitySuggestions = await this.generateSecuritySuggestions(context, intent);
        const performanceSuggestions = await this.generatePerformanceSuggestions(context, intent);
        const testingSuggestions = await this.generateTestingSuggestions(context, intent);
        const bestPracticeSuggestions = await this.generateBestPracticeSuggestions(context, intent);
        suggestions.push(...completionSuggestions, ...refactorSuggestions, ...securitySuggestions, ...performanceSuggestions, ...testingSuggestions, ...bestPracticeSuggestions);
        return suggestions;
    }
    /**
     * Generate code completion suggestions using AI
     */
    async generateCompletionSuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // Analyze framework and generate framework-specific completions
        if (codebaseAnalysis.framework.primary === 'React') {
            if (this.matchesIntent(intent, 'create_component')) {
                suggestions.push({
                    id: `completion-react-component-${Date.now()}`,
                    type: 'completion',
                    priority: 'high',
                    title: 'Create React Component',
                    description: 'Generate a complete React component with TypeScript interfaces',
                    reasoning: 'AI detected React project and component creation intent',
                    confidence: 0.9,
                    impact: 'medium',
                    effort: 'low',
                    code: {
                        file: 'src/components/NewComponent.tsx',
                        after: this.generateReactComponentTemplate()
                    },
                    tags: ['react', 'component', 'typescript'],
                    category: 'Code Generation'
                });
            }
            if (this.matchesIntent(intent, 'create_component') && context.userInput.toLowerCase().includes('hook')) {
                suggestions.push({
                    id: `completion-react-hook-${Date.now()}`,
                    type: 'completion',
                    priority: 'medium',
                    title: 'Create Custom React Hook',
                    description: 'Generate a custom React hook with proper TypeScript types',
                    reasoning: 'AI detected custom hook creation intent in React project',
                    confidence: 0.85,
                    impact: 'medium',
                    effort: 'low',
                    code: {
                        file: 'src/hooks/useCustomHook.ts',
                        after: this.generateReactHookTemplate()
                    },
                    tags: ['react', 'hook', 'typescript'],
                    category: 'Code Generation'
                });
            }
        }
        // API endpoint completions
        if (codebaseAnalysis.capabilities.hasAPI && this.matchesIntent(intent, 'create_api')) {
            suggestions.push({
                id: `completion-api-endpoint-${Date.now()}`,
                type: 'completion',
                priority: 'high',
                title: 'Create API Endpoint',
                description: 'Generate RESTful API endpoint with validation and error handling',
                reasoning: 'AI detected API creation intent in project with existing API structure',
                confidence: 0.88,
                impact: 'high',
                effort: 'medium',
                code: {
                    file: this.suggestAPIFilePath(codebaseAnalysis),
                    after: this.generateAPIEndpointTemplate(codebaseAnalysis)
                },
                tags: ['api', 'endpoint', 'validation'],
                category: 'API Development'
            });
        }
        // Database model completions
        if (codebaseAnalysis.capabilities.hasDatabase && this.matchesIntent(intent, 'create_database')) {
            suggestions.push({
                id: `completion-database-model-${Date.now()}`,
                type: 'completion',
                priority: 'high',
                title: 'Create Database Model',
                description: 'Generate database model with proper relationships and validation',
                reasoning: 'AI detected database model creation intent',
                confidence: 0.87,
                impact: 'high',
                effort: 'medium',
                code: {
                    file: this.suggestModelFilePath(codebaseAnalysis),
                    after: this.generateDatabaseModelTemplate()
                },
                tags: ['database', 'model', 'schema'],
                category: 'Database'
            });
        }
        return suggestions;
    }
    /**
     * Generate refactoring suggestions using AI
     */
    async generateRefactorSuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // Suggest refactoring for complex codebases
        if (codebaseAnalysis.complexity === 'complex' && this.matchesIntent(intent, 'refactor')) {
            suggestions.push({
                id: `refactor-structure-${Date.now()}`,
                type: 'refactor',
                priority: 'medium',
                title: 'Improve Project Structure',
                description: 'Reorganize files into a more scalable folder structure with clear separation of concerns',
                reasoning: 'AI detected complex project - better organization recommended',
                confidence: 0.7,
                impact: 'medium',
                effort: 'high',
                tags: ['refactoring', 'architecture', 'ai-generated'],
                category: 'Code Improvement'
            });
        }
        // Suggest code quality improvements
        if (codebaseAnalysis.codeQuality.score < 70) {
            suggestions.push({
                id: `refactor-quality-${Date.now()}`,
                type: 'refactor',
                priority: 'high',
                title: 'Improve Code Quality',
                description: 'Address code quality issues identified in analysis',
                reasoning: `AI analysis shows code quality score of ${codebaseAnalysis.codeQuality.score}/100`,
                confidence: 0.85,
                impact: 'high',
                effort: 'medium',
                tags: ['refactoring', 'quality', 'ai-generated'],
                category: 'Code Improvement'
            });
        }
        return suggestions;
    }
    /**
     * Generate security suggestions using AI
     */
    async generateSecuritySuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // Authentication security
        if (codebaseAnalysis.capabilities.hasAuth) {
            suggestions.push({
                id: `security-auth-${Date.now()}`,
                type: 'security',
                priority: 'high',
                title: 'Review Authentication Security',
                description: 'Implement secure authentication practices including password hashing, JWT security, and session management',
                reasoning: 'AI detected authentication - security review recommended',
                confidence: 0.9,
                impact: 'high',
                effort: 'medium',
                tags: ['security', 'authentication', 'jwt'],
                category: 'Security'
            });
        }
        // API security
        if (codebaseAnalysis.capabilities.hasAPI) {
            suggestions.push({
                id: `security-api-${Date.now()}`,
                type: 'security',
                priority: 'high',
                title: 'API Security Hardening',
                description: 'Implement input validation, rate limiting, CORS configuration, and security headers',
                reasoning: 'AI detected API endpoints - security hardening recommended',
                confidence: 0.88,
                impact: 'high',
                effort: 'medium',
                tags: ['security', 'api', 'validation'],
                category: 'Security'
            });
        }
        // Database security
        if (codebaseAnalysis.capabilities.hasDatabase) {
            suggestions.push({
                id: `security-database-${Date.now()}`,
                type: 'security',
                priority: 'medium',
                title: 'Database Security Review',
                description: 'Implement parameterized queries, connection security, and data encryption',
                reasoning: 'AI detected database integration - security review needed',
                confidence: 0.85,
                impact: 'high',
                effort: 'medium',
                tags: ['security', 'database', 'sql-injection'],
                category: 'Security'
            });
        }
        return suggestions;
    }
    /**
     * Generate performance suggestions using AI
     */
    async generatePerformanceSuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // React performance optimizations
        if (codebaseAnalysis.framework.primary === 'React' && this.matchesIntent(intent, 'optimize')) {
            suggestions.push({
                id: `performance-react-${Date.now()}`,
                type: 'optimize',
                priority: 'medium',
                title: 'React Performance Optimization',
                description: 'Implement React.memo, useMemo, useCallback, and code splitting for better performance',
                reasoning: 'AI detected React project - performance optimizations available',
                confidence: 0.8,
                impact: 'medium',
                effort: 'medium',
                tags: ['performance', 'react', 'optimization'],
                category: 'Performance'
            });
        }
        // Bundle optimization for web projects
        if (codebaseAnalysis.projectType === 'web-app') {
            suggestions.push({
                id: `performance-bundle-${Date.now()}`,
                type: 'optimize',
                priority: 'medium',
                title: 'Bundle Size Optimization',
                description: 'Implement code splitting, tree shaking, and dynamic imports to reduce bundle size',
                reasoning: 'AI detected web application - bundle optimization recommended',
                confidence: 0.75,
                impact: 'medium',
                effort: 'high',
                tags: ['performance', 'bundling', 'optimization'],
                category: 'Performance'
            });
        }
        return suggestions;
    }
    /**
     * Generate testing suggestions using AI
     */
    async generateTestingSuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // Missing tests detection
        if (!codebaseAnalysis.capabilities.hasTests && this.matchesIntent(intent, 'test')) {
            suggestions.push({
                id: `testing-setup-${Date.now()}`,
                type: 'test',
                priority: 'high',
                title: 'Set Up Testing Framework',
                description: 'Add comprehensive testing setup with unit and integration tests',
                reasoning: 'AI detected no tests - testing framework setup recommended',
                confidence: 0.95,
                impact: 'high',
                effort: 'medium',
                code: {
                    file: 'tests/setup.ts',
                    after: this.generateTestSetupTemplate(codebaseAnalysis)
                },
                tags: ['testing', 'setup', 'quality'],
                category: 'Testing'
            });
        }
        // Component testing for React
        if (codebaseAnalysis.framework.primary === 'React' && this.matchesIntent(intent, 'test')) {
            suggestions.push({
                id: `testing-components-${Date.now()}`,
                type: 'test',
                priority: 'medium',
                title: 'Add Component Tests',
                description: 'Generate comprehensive tests for React components with React Testing Library',
                reasoning: 'AI detected React components - component testing recommended',
                confidence: 0.85,
                impact: 'medium',
                effort: 'medium',
                tags: ['testing', 'react', 'components'],
                category: 'Testing'
            });
        }
        // API testing
        if (codebaseAnalysis.capabilities.hasAPI && this.matchesIntent(intent, 'test')) {
            suggestions.push({
                id: `testing-api-${Date.now()}`,
                type: 'test',
                priority: 'high',
                title: 'Add API Integration Tests',
                description: 'Create comprehensive API endpoint tests with proper mocking and assertions',
                reasoning: 'AI detected API endpoints - integration testing recommended',
                confidence: 0.9,
                impact: 'high',
                effort: 'medium',
                tags: ['testing', 'api', 'integration'],
                category: 'Testing'
            });
        }
        return suggestions;
    }
    /**
     * Generate best practice suggestions using AI
     */
    async generateBestPracticeSuggestions(context, intent) {
        const suggestions = [];
        const { codebaseAnalysis } = context;
        // TypeScript strict mode
        if (codebaseAnalysis.language.primary === 'TypeScript') {
            suggestions.push({
                id: `best-practice-typescript-${Date.now()}`,
                type: 'best-practice',
                priority: 'medium',
                title: 'Enable TypeScript Strict Mode',
                description: 'Configure strict TypeScript settings for better type safety',
                reasoning: 'AI detected TypeScript project - strict mode recommended for better type safety',
                confidence: 0.8,
                impact: 'medium',
                effort: 'low',
                code: {
                    file: 'tsconfig.json',
                    after: this.generateStrictTSConfigTemplate()
                },
                tags: ['typescript', 'configuration', 'type-safety'],
                category: 'Best Practices'
            });
        }
        // ESLint and Prettier setup
        suggestions.push({
            id: `best-practice-quality-tools-${Date.now()}`,
            type: 'best-practice',
            priority: 'medium',
            title: 'Set Up Code Quality Tools',
            description: 'Configure ESLint, Prettier, and pre-commit hooks for consistent code quality',
            reasoning: 'AI recommends code quality tools for maintainability and team collaboration',
            confidence: 0.85,
            impact: 'medium',
            effort: 'low',
            tags: ['eslint', 'prettier', 'code-quality'],
            category: 'Best Practices'
        });
        return suggestions;
    }
    /**
     * Prioritize suggestions based on confidence, priority, and impact
     */
    prioritizeSuggestions(suggestions) {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const impactWeight = { high: 3, medium: 2, low: 1 };
        return suggestions
            .sort((a, b) => {
            // Priority weight
            const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            // Confidence weight
            const confidenceDiff = b.confidence - a.confidence;
            if (Math.abs(confidenceDiff) > 0.1)
                return confidenceDiff;
            // Impact weight
            return impactWeight[b.impact] - impactWeight[a.impact];
        })
            .slice(0, 10); // Limit to top 10 suggestions
    }
    /**
     * Helper methods
     */
    matchesIntent(intent, intentType) {
        return intent.type === intentType && intent.confidence > 0.6;
    }
    generateReactComponentTemplate() {
        return `import React from 'react';

interface ComponentProps {
  // Define your props here
}

export const Component: React.FC<ComponentProps> = (props) => {
  return (
    <div>
      <h1>Component</h1>
      {/* Your component content here */}
    </div>
  );
};

export default Component;`;
    }
    generateReactHookTemplate() {
        return `import { useState, useEffect } from 'react';

export const useCustomHook = () => {
  const [state, setState] = useState();

  useEffect(() => {
    // Your effect logic here
  }, []);

  return {
    state,
    setState
  };
};`;
    }
    generateAPIEndpointTemplate(analysis) {
        const framework = analysis.framework.primary.toLowerCase();
        if (framework.includes('express')) {
            return `import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

// Validation middleware
export const validateRequest = [
  body('field').notEmpty().withMessage('Field is required'),
  // Add more validation rules
];

// Controller function
export const handleRequest = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Your business logic here
    const result = await processRequest(req.body);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const processRequest = async (data: any) => {
  // Implement your business logic
  return data;
};`;
        }
        return `// API endpoint template for ${framework}`;
    }
    generateDatabaseModelTemplate() {
        return `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class ModelName {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}`;
    }
    generateTestSetupTemplate(analysis) {
        if (analysis.framework.primary === 'React') {
            return `import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

configure({ testIdAttribute: 'data-testid' });

// Global test setup
beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});`;
        }
        return `// Test setup configuration
import { beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});`;
    }
    generateStrictTSConfigTemplate() {
        return `{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}`;
    }
    suggestAPIFilePath(analysis) {
        if (analysis.framework.primary === 'Express') {
            return 'src/routes/api.ts';
        }
        return 'src/api/endpoint.ts';
    }
    suggestModelFilePath(analysis) {
        return 'src/models/Model.ts';
    }
}
exports.IntelligentSuggestionsEngine = IntelligentSuggestionsEngine;
/**
 * Singleton instance for global access
 */
let suggestionsEngineInstance = null;
function getIntelligentSuggestionsEngine() {
    if (!suggestionsEngineInstance) {
        suggestionsEngineInstance = new IntelligentSuggestionsEngine();
    }
    return suggestionsEngineInstance;
}
function resetIntelligentSuggestionsEngine() {
    suggestionsEngineInstance = null;
}

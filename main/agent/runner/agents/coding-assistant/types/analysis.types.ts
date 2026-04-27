/**
 * Codebase Analysis Type Definitions
 */

export interface CodebaseAnalysis {
  framework: FrameworkInfo;
  language: LanguageInfo;
  architecture: ArchitectureInfo;
  dependencies: DependencyInfo;
  capabilities: CapabilityInfo;
  codeQuality: CodeQualityInfo;
  projectType: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
}

export interface FrameworkInfo {
  primary: string;
  secondary: string[];
  confidence: number;
  reasoning: string;
}

export interface LanguageInfo {
  primary: string;
  secondary: string[];
  confidence: number;
}

export interface ArchitectureInfo {
  pattern: string;
  structure: string;
  confidence: number;
  reasoning: string;
}

export interface DependencyInfo {
  runtime: string[];
  development: string[];
  frameworks: string[];
  tools: string[];
}

export interface CapabilityInfo {
  hasAPI: boolean;
  hasDatabase: boolean;
  hasFrontend: boolean;
  hasTests: boolean;
  hasAuth: boolean;
  hasConfig: boolean;
  reasoning: string;
}

export interface CodeQualityInfo {
  score: number;
  issues: string[];
  strengths: string[];
  suggestions: string[];
  metrics?: {
    totalFiles: number;
    linesOfCode: number;
    testCoverage?: number;
    maintainability: number;
  };
}

export interface ProjectPattern {
  name: string;
  description: string;
  files: string[];
  confidence: number;
}

export interface CodeMetrics {
  totalFiles: number;
  linesOfCode: number;
  testCoverage?: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  maintainability: number;
}

export interface ProjectStructure {
  rootPath: string;
  files: string[];
  directories: string[];
  configFiles: string[];
  sourceFiles: string[];
  testFiles: string[];
}

export interface FileAnalysis {
  path: string;
  type: string;
  content?: string;
  insights?: Record<string, any>;
}

/**
 * EverFern Desktop — Framework Expert
 *
 * Provides deep knowledge of popular frameworks and their best practices.
 * Includes project scaffolding templates and framework-specific optimization patterns.
 */

export interface FrameworkTemplate {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile';
  description: string;
  techStack: string[];
  directoryStructure: DirectoryNode;
  configFiles: ConfigFile[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  bestPractices: string[];
  optimizationPatterns: string[];
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  content?: string;
  description?: string;
}

export interface ConfigFile {
  path: string;
  content: string;
  description: string;
}

/**
 * Framework Expert - Provides framework knowledge and templates
 */
export class FrameworkExpert {
  private templates: Map<string, FrameworkTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Get framework template by name
   */
  getTemplate(frameworkName: string): FrameworkTemplate | undefined {
    return this.templates.get(frameworkName.toLowerCase());
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): FrameworkTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: FrameworkTemplate['type']): FrameworkTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.type === type);
  }

  /**
   * Recommend framework based on requirements
   */
  recommendFramework(requirements: {
    type: 'frontend' | 'backend' | 'fullstack';
    features: string[];
    complexity: 'simple' | 'moderate' | 'complex';
  }): FrameworkTemplate[] {
    const candidates = this.getTemplatesByType(requirements.type);

    // Score each framework based on requirements
    const scored = candidates.map(template => {
      let score = 0;

      // Match features with tech stack
      for (const feature of requirements.features) {
        if (template.techStack.some(tech =>
          tech.toLowerCase().includes(feature.toLowerCase())
        )) {
          score += 2;
        }
      }

      // Complexity matching
      if (requirements.complexity === 'simple' && template.techStack.length <= 3) {
        score += 1;
      } else if (requirements.complexity === 'complex' && template.techStack.length > 3) {
        score += 1;
      }

      return { template, score };
    });

    // Sort by score and return top recommendations
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(s => s.template);
  }

  /**
   * Initialize framework templates
   */
  private initializeTemplates() {
    // React + TypeScript Template
    this.templates.set('react-typescript', {
      name: 'React + TypeScript',
      type: 'frontend',
      description: 'Modern React application with TypeScript, Vite, and best practices',
      techStack: ['React', 'TypeScript', 'Vite', 'React Router', 'TanStack Query'],
      directoryStructure: {
        name: 'src',
        type: 'directory',
        children: [
          {
            name: 'components',
            type: 'directory',
            description: 'Reusable UI components',
            children: [
              { name: 'common', type: 'directory', description: 'Common components' },
              { name: 'layout', type: 'directory', description: 'Layout components' }
            ]
          },
          {
            name: 'pages',
            type: 'directory',
            description: 'Page components for routing'
          },
          {
            name: 'hooks',
            type: 'directory',
            description: 'Custom React hooks'
          },
          {
            name: 'services',
            type: 'directory',
            description: 'API services and data fetching'
          },
          {
            name: 'types',
            type: 'directory',
            description: 'TypeScript type definitions'
          },
          {
            name: 'utils',
            type: 'directory',
            description: 'Utility functions'
          },
          {
            name: 'App.tsx',
            type: 'file',
            description: 'Root application component'
          },
          {
            name: 'main.tsx',
            type: 'file',
            description: 'Application entry point'
          }
        ]
      },
      configFiles: [
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true
            },
            include: ['src'],
            references: [{ path: './tsconfig.node.json' }]
          }, null, 2),
          description: 'TypeScript configuration with strict mode'
        },
        {
          path: 'vite.config.ts',
          content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})`,
          description: 'Vite configuration for development and build'
        }
      ],
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.0',
        '@tanstack/react-query': '^5.0.0'
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.2.0',
        'typescript': '^5.3.0',
        'vite': '^5.0.0',
        'eslint': '^8.55.0',
        '@typescript-eslint/eslint-plugin': '^6.15.0',
        '@typescript-eslint/parser': '^6.15.0'
      },
      scripts: {
        'dev': 'vite',
        'build': 'tsc && vite build',
        'preview': 'vite preview',
        'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
      },
      bestPractices: [
        'Use functional components with hooks',
        'Implement proper memoization with useMemo and useCallback',
        'Use React.lazy for code splitting',
        'Implement error boundaries for error handling',
        'Use TypeScript strict mode for type safety',
        'Follow component composition patterns',
        'Keep components small and focused',
        'Use custom hooks for reusable logic'
      ],
      optimizationPatterns: [
        'Code splitting with React.lazy and Suspense',
        'Memoization with React.memo for expensive components',
        'Virtual scrolling for large lists',
        'Debouncing and throttling for event handlers',
        'Image lazy loading and optimization',
        'Bundle size optimization with tree shaking'
      ]
    });

    // Next.js Template
    this.templates.set('nextjs', {
      name: 'Next.js',
      type: 'fullstack',
      description: 'Full-stack Next.js application with App Router and TypeScript',
      techStack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
      directoryStructure: {
        name: 'app',
        type: 'directory',
        children: [
          {
            name: 'api',
            type: 'directory',
            description: 'API routes',
            children: [
              { name: 'route.ts', type: 'file', description: 'API route handler' }
            ]
          },
          {
            name: 'components',
            type: 'directory',
            description: 'React components'
          },
          {
            name: 'lib',
            type: 'directory',
            description: 'Utility functions and helpers'
          },
          {
            name: 'types',
            type: 'directory',
            description: 'TypeScript types'
          },
          {
            name: 'layout.tsx',
            type: 'file',
            description: 'Root layout component'
          },
          {
            name: 'page.tsx',
            type: 'file',
            description: 'Home page component'
          }
        ]
      },
      configFiles: [
        {
          path: 'next.config.js',
          content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
  },
}

module.exports = nextConfig`,
          description: 'Next.js configuration'
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'es5',
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              noEmit: true,
              esModuleInterop: true,
              module: 'esnext',
              moduleResolution: 'bundler',
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: 'preserve',
              incremental: true,
              plugins: [{ name: 'next' }],
              paths: { '@/*': ['./*'] }
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules']
          }, null, 2),
          description: 'TypeScript configuration for Next.js'
        }
      ],
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        'typescript': '^5.3.0',
        'eslint': '^8.55.0',
        'eslint-config-next': '^14.0.0'
      },
      scripts: {
        'dev': 'next dev',
        'build': 'next build',
        'start': 'next start',
        'lint': 'next lint'
      },
      bestPractices: [
        'Use App Router for new projects',
        'Implement proper SEO with metadata API',
        'Use Server Components by default',
        'Optimize images with next/image',
        'Implement proper error handling with error.tsx',
        'Use loading.tsx for loading states',
        'Implement proper caching strategies',
        'Use environment variables for configuration'
      ],
      optimizationPatterns: [
        'Server-side rendering (SSR) for dynamic content',
        'Static site generation (SSG) for static content',
        'Incremental static regeneration (ISR) for hybrid approach',
        'Image optimization with next/image',
        'Font optimization with next/font',
        'Route prefetching for faster navigation',
        'Code splitting with dynamic imports'
      ]
    });

    // Express + TypeScript Template
    this.templates.set('express-typescript', {
      name: 'Express + TypeScript',
      type: 'backend',
      description: 'RESTful API with Express, TypeScript, and best practices',
      techStack: ['Express', 'TypeScript', 'Node.js', 'Prisma'],
      directoryStructure: {
        name: 'src',
        type: 'directory',
        children: [
          {
            name: 'controllers',
            type: 'directory',
            description: 'Request handlers'
          },
          {
            name: 'routes',
            type: 'directory',
            description: 'API routes'
          },
          {
            name: 'middleware',
            type: 'directory',
            description: 'Express middleware'
          },
          {
            name: 'services',
            type: 'directory',
            description: 'Business logic'
          },
          {
            name: 'models',
            type: 'directory',
            description: 'Data models'
          },
          {
            name: 'types',
            type: 'directory',
            description: 'TypeScript types'
          },
          {
            name: 'utils',
            type: 'directory',
            description: 'Utility functions'
          },
          {
            name: 'config',
            type: 'directory',
            description: 'Configuration files'
          },
          {
            name: 'index.ts',
            type: 'file',
            description: 'Application entry point'
          }
        ]
      },
      configFiles: [
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              resolveJsonModule: true,
              moduleResolution: 'node'
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist']
          }, null, 2),
          description: 'TypeScript configuration for Node.js'
        }
      ],
      dependencies: {
        'express': '^4.18.0',
        'cors': '^2.8.5',
        'helmet': '^7.1.0',
        'dotenv': '^16.3.0',
        'express-validator': '^7.0.0'
      },
      devDependencies: {
        '@types/express': '^4.17.0',
        '@types/cors': '^2.8.0',
        '@types/node': '^20.0.0',
        'typescript': '^5.3.0',
        'ts-node': '^10.9.0',
        'nodemon': '^3.0.0',
        'eslint': '^8.55.0',
        '@typescript-eslint/eslint-plugin': '^6.15.0',
        '@typescript-eslint/parser': '^6.15.0'
      },
      scripts: {
        'dev': 'nodemon --exec ts-node src/index.ts',
        'build': 'tsc',
        'start': 'node dist/index.js',
        'lint': 'eslint src --ext .ts'
      },
      bestPractices: [
        'Use middleware for cross-cutting concerns',
        'Implement proper error handling middleware',
        'Use async/await with proper error propagation',
        'Validate requests with express-validator',
        'Implement rate limiting for API protection',
        'Use helmet for security headers',
        'Implement proper logging',
        'Use environment variables for configuration'
      ],
      optimizationPatterns: [
        'Connection pooling for database',
        'Caching with Redis for frequently accessed data',
        'Compression middleware for response optimization',
        'Clustering for multi-core utilization',
        'Proper middleware ordering for performance',
        'Async operations for I/O-bound tasks'
      ]
    });

    // FastAPI Template
    this.templates.set('fastapi', {
      name: 'FastAPI',
      type: 'backend',
      description: 'Modern Python API with FastAPI, async support, and type hints',
      techStack: ['FastAPI', 'Python', 'Pydantic', 'SQLAlchemy'],
      directoryStructure: {
        name: 'app',
        type: 'directory',
        children: [
          {
            name: 'api',
            type: 'directory',
            description: 'API routes',
            children: [
              { name: 'v1', type: 'directory', description: 'API version 1' }
            ]
          },
          {
            name: 'core',
            type: 'directory',
            description: 'Core configuration'
          },
          {
            name: 'models',
            type: 'directory',
            description: 'Database models'
          },
          {
            name: 'schemas',
            type: 'directory',
            description: 'Pydantic schemas'
          },
          {
            name: 'services',
            type: 'directory',
            description: 'Business logic'
          },
          {
            name: 'main.py',
            type: 'file',
            description: 'Application entry point'
          }
        ]
      },
      configFiles: [
        {
          path: 'requirements.txt',
          content: `fastapi==0.104.0
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
sqlalchemy==2.0.23
alembic==1.13.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6`,
          description: 'Python dependencies'
        },
        {
          path: 'pyproject.toml',
          content: `[tool.black]
line-length = 100
target-version = ['py311']

[tool.isort]
profile = "black"
line_length = 100

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true`,
          description: 'Python tooling configuration'
        }
      ],
      dependencies: {},
      devDependencies: {},
      scripts: {
        'dev': 'uvicorn app.main:app --reload',
        'start': 'uvicorn app.main:app --host 0.0.0.0 --port 8000',
        'test': 'pytest',
        'lint': 'black . && isort . && mypy .'
      },
      bestPractices: [
        'Use Pydantic models for request/response validation',
        'Implement dependency injection for database connections',
        'Use async endpoints for I/O-bound operations',
        'Implement proper CORS configuration',
        'Use environment variables with pydantic-settings',
        'Implement comprehensive error handlers',
        'Use type hints throughout the codebase',
        'Follow PEP 8 style guidelines'
      ],
      optimizationPatterns: [
        'Async database operations with asyncpg',
        'Connection pooling for database',
        'Background tasks for long-running operations',
        'Caching with Redis for frequently accessed data',
        'Response compression for large payloads',
        'Proper use of async/await for concurrency'
      ]
    });
  }
}

// Singleton instance
let frameworkExpertInstance: FrameworkExpert | null = null;

export function getFrameworkExpert(): FrameworkExpert {
  if (!frameworkExpertInstance) {
    frameworkExpertInstance = new FrameworkExpert();
  }
  return frameworkExpertInstance;
}

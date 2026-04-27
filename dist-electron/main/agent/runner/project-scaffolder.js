"use strict";
/**
 * EverFern Desktop — Project Scaffolder
 *
 * Generates complete project structures with proper configurations.
 * Handles framework-specific setup, dependency management, and documentation.
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
exports.ProjectScaffolder = void 0;
exports.getProjectScaffolder = getProjectScaffolder;
const framework_expert_1 = require("./framework-expert");
const path = __importStar(require("path"));
/**
 * Project Scaffolder - Generates complete project structures
 */
class ProjectScaffolder {
    frameworkExpert = (0, framework_expert_1.getFrameworkExpert)();
    /**
     * Generate project structure from template
     */
    async scaffold(options) {
        const template = this.frameworkExpert.getTemplate(options.framework);
        if (!template) {
            return {
                success: false,
                filesCreated: [],
                instructions: [],
                errors: [`Framework template not found: ${options.framework}`]
            };
        }
        const filesCreated = [];
        const instructions = [];
        const errors = [];
        try {
            // Generate directory structure
            const structureFiles = this.generateDirectoryStructure(template.directoryStructure, options.outputDir);
            filesCreated.push(...structureFiles.map(f => f.path));
            // Generate package.json
            const packageJson = this.generatePackageJson(template, options);
            filesCreated.push(path.join(options.outputDir, 'package.json'));
            // Generate config files
            for (const configFile of template.configFiles) {
                filesCreated.push(path.join(options.outputDir, configFile.path));
            }
            // Generate README
            const readme = this.generateReadme(template, options);
            filesCreated.push(path.join(options.outputDir, 'README.md'));
            // Generate .gitignore
            const gitignore = this.generateGitignore(template);
            filesCreated.push(path.join(options.outputDir, '.gitignore'));
            // Generate environment template
            const envTemplate = this.generateEnvTemplate(template);
            filesCreated.push(path.join(options.outputDir, '.env.example'));
            // Add Docker files if requested
            if (options.includeDocker) {
                const dockerFiles = this.generateDockerFiles(template, options);
                filesCreated.push(...dockerFiles.map(f => f.path));
            }
            // Add CI/CD files if requested
            if (options.includeCI) {
                const ciFiles = this.generateCIFiles(template, options);
                filesCreated.push(...ciFiles.map(f => f.path));
            }
            // Generate setup instructions
            instructions.push(...this.generateInstructions(template, options));
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : String(error));
            return {
                success: false,
                filesCreated,
                instructions,
                errors
            };
        }
        return {
            success: true,
            filesCreated,
            instructions,
            errors: errors.length > 0 ? errors : undefined
        };
    }
    /**
     * Generate directory structure from template
     */
    generateDirectoryStructure(node, basePath, files = []) {
        const fullPath = path.join(basePath, node.name);
        if (node.type === 'file' && node.content) {
            files.push({
                path: fullPath,
                content: node.content,
                description: node.description || ''
            });
        }
        else if (node.type === 'directory' && node.children) {
            // Create directory marker (empty file to ensure directory exists)
            files.push({
                path: path.join(fullPath, '.gitkeep'),
                content: '',
                description: 'Directory placeholder'
            });
            // Process children
            for (const child of node.children) {
                this.generateDirectoryStructure(child, fullPath, files);
            }
        }
        return files;
    }
    /**
     * Generate package.json
     */
    generatePackageJson(template, options) {
        const packageJson = {
            name: options.projectName,
            version: '0.1.0',
            description: `${template.name} application`,
            private: true,
            scripts: template.scripts,
            dependencies: template.dependencies,
            devDependencies: template.devDependencies,
            engines: {
                node: '>=18.0.0'
            }
        };
        return JSON.stringify(packageJson, null, 2);
    }
    /**
     * Generate README.md
     */
    generateReadme(template, options) {
        const pm = options.packageManager || 'npm';
        const installCmd = pm === 'npm' ? 'npm install' : pm === 'yarn' ? 'yarn' : 'pnpm install';
        const devCmd = pm === 'npm' ? 'npm run dev' : pm === 'yarn' ? 'yarn dev' : 'pnpm dev';
        const buildCmd = pm === 'npm' ? 'npm run build' : pm === 'yarn' ? 'yarn build' : 'pnpm build';
        return `# ${options.projectName}

${template.description}

## Tech Stack

${template.techStack.map(tech => `- ${tech}`).join('\n')}

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- ${pm} package manager

### Installation

1. Install dependencies:

\`\`\`bash
${installCmd}
\`\`\`

2. Copy environment variables:

\`\`\`bash
cp .env.example .env
\`\`\`

3. Configure your environment variables in \`.env\`

### Development

Run the development server:

\`\`\`bash
${devCmd}
\`\`\`

### Build

Build for production:

\`\`\`bash
${buildCmd}
\`\`\`

## Project Structure

\`\`\`
${this.formatDirectoryTree(template.directoryStructure)}
\`\`\`

## Best Practices

${template.bestPractices.map(practice => `- ${practice}`).join('\n')}

## Optimization Patterns

${template.optimizationPatterns.map(pattern => `- ${pattern}`).join('\n')}

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
`;
    }
    /**
     * Format directory tree for README
     */
    formatDirectoryTree(node, indent = '') {
        let result = `${indent}${node.name}${node.description ? ` - ${node.description}` : ''}\n`;
        if (node.children) {
            for (const child of node.children) {
                result += this.formatDirectoryTree(child, indent + '  ');
            }
        }
        return result;
    }
    /**
     * Generate .gitignore
     */
    generateGitignore(template) {
        const common = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.log

# Production
build/
dist/
.next/
out/

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;
        // Add framework-specific ignores
        if (template.name.includes('Next.js')) {
            return common + `\n# Next.js\n.next/\nout/\n`;
        }
        else if (template.name.includes('React')) {
            return common + `\n# React\nbuild/\n`;
        }
        else if (template.name.includes('Python') || template.name.includes('FastAPI')) {
            return common + `\n# Python\n__pycache__/\n*.py[cod]\n*$py.class\n.pytest_cache/\n.mypy_cache/\nvenv/\n.venv/\n`;
        }
        return common;
    }
    /**
     * Generate .env.example
     */
    generateEnvTemplate(template) {
        let envVars = `# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API Keys
API_KEY=your_api_key_here
`;
        if (template.name.includes('Next.js')) {
            envVars += `\n# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000/api
`;
        }
        return envVars;
    }
    /**
     * Generate Docker files
     */
    generateDockerFiles(template, options) {
        const files = [];
        // Dockerfile
        const dockerfile = template.type === 'backend' || template.name.includes('Express')
            ? this.generateBackendDockerfile(template)
            : this.generateFrontendDockerfile(template);
        files.push({
            path: path.join(options.outputDir, 'Dockerfile'),
            content: dockerfile,
            description: 'Docker configuration for containerization'
        });
        // docker-compose.yml
        const dockerCompose = this.generateDockerCompose(template, options);
        files.push({
            path: path.join(options.outputDir, 'docker-compose.yml'),
            content: dockerCompose,
            description: 'Docker Compose configuration for local development'
        });
        // .dockerignore
        files.push({
            path: path.join(options.outputDir, '.dockerignore'),
            content: `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
dist
build
coverage
.next
out`,
            description: 'Docker ignore file'
        });
        return files;
    }
    /**
     * Generate backend Dockerfile
     */
    generateBackendDockerfile(template) {
        return `FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
`;
    }
    /**
     * Generate frontend Dockerfile
     */
    generateFrontendDockerfile(template) {
        if (template.name.includes('Next.js')) {
            return `FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
`;
        }
        return `FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
    }
    /**
     * Generate docker-compose.yml
     */
    generateDockerCompose(template, options) {
        return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/${options.projectName}
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=${options.projectName}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;
    }
    /**
     * Generate CI/CD files
     */
    generateCIFiles(template, options) {
        const files = [];
        // GitHub Actions workflow
        const githubWorkflow = this.generateGitHubWorkflow(template, options);
        files.push({
            path: path.join(options.outputDir, '.github', 'workflows', 'ci.yml'),
            content: githubWorkflow,
            description: 'GitHub Actions CI/CD workflow'
        });
        return files;
    }
    /**
     * Generate GitHub Actions workflow
     */
    generateGitHubWorkflow(template, options) {
        return `name: CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run linter
      run: npm run lint

    - name: Run tests
      run: npm test

    - name: Build
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v3

    - name: Deploy to production
      run: echo "Add your deployment steps here"
`;
    }
    /**
     * Generate setup instructions
     */
    generateInstructions(template, options) {
        const pm = options.packageManager || 'npm';
        const installCmd = pm === 'npm' ? 'npm install' : pm === 'yarn' ? 'yarn' : 'pnpm install';
        const devCmd = pm === 'npm' ? 'npm run dev' : pm === 'yarn' ? 'yarn dev' : 'pnpm dev';
        const instructions = [
            `Project scaffolded successfully: ${options.projectName}`,
            `Framework: ${template.name}`,
            '',
            'Next steps:',
            `1. cd ${options.projectName}`,
            `2. ${installCmd}`,
            '3. Copy .env.example to .env and configure your environment variables',
            `4. ${devCmd}`,
            ''
        ];
        if (options.includeDocker) {
            instructions.push('Docker files included. To run with Docker:');
            instructions.push('  docker-compose up');
            instructions.push('');
        }
        if (options.includeCI) {
            instructions.push('CI/CD workflow included. Push to GitHub to trigger automated builds.');
            instructions.push('');
        }
        instructions.push('For more information, see README.md');
        return instructions;
    }
}
exports.ProjectScaffolder = ProjectScaffolder;
// Singleton instance
let scaffolderInstance = null;
function getProjectScaffolder() {
    if (!scaffolderInstance) {
        scaffolderInstance = new ProjectScaffolder();
    }
    return scaffolderInstance;
}

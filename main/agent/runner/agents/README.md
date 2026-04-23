# Specialized Agents

This directory contains individual specialized agent implementations, each with their own dedicated files and prompt templates.

## Structure

```
agents/
├── index.ts                 # Exports all agents
├── coding-specialist.ts     # Coding specialist agent implementation
├── data-analyst.ts         # Data analyst agent implementation
├── computer-use.ts         # Computer use agent implementation
├── web-explorer.ts         # Web explorer agent implementation
└── README.md               # This file

../prompts/
├── coding-specialist.md    # Coding specialist system prompt
├── data-analyst.md        # Data analyst system prompt
├── computer-use.md        # Computer use system prompt
└── web-explorer.md        # Web explorer system prompt
```

## Agent Overview

### Coding Specialist (`coding-specialist.ts`)
- **Purpose**: Write, debug, and optimize code with extreme precision
- **Tools**: fsWrite, strReplace, readFile, readCode, executePwsh, getDiagnostics, semanticRename, smartRelocate
- **Capabilities**: Code generation, debugging, refactoring, testing, code review, architecture design

### Data Analyst (`data-analyst.ts`)
- **Purpose**: Process data, generate insights, and create compelling visualizations
- **Tools**: readFile, terminal_execute, visualize, fsWrite, grepSearch, executePwsh
- **Capabilities**: Data loading & cleaning, exploratory analysis, statistical analysis, visualization, reporting, ML
- **Special Features**: Progress streaming, session management, dashboard generation with Tailwind CSS + Figtree

### Computer Use (`computer-use.ts`)
- **Purpose**: Perform autonomous desktop automation and GUI interactions
- **Tools**: Direct computer_use tool invocation
- **Capabilities**: Application control, GUI interaction, file operations, text input, window management

### Web Explorer (`web-explorer.ts`)
- **Purpose**: Navigate the web efficiently to find and extract information
- **Tools**: remote_web_search, webFetch, fsWrite, readFile, grepSearch
- **Capabilities**: Web search, content extraction, information synthesis, fact verification, research reports

## Prompt System

Each agent loads its system prompt from a corresponding markdown file in `main/agent/prompts/`:

- **Modular**: Each agent has its own dedicated prompt file
- **Maintainable**: Easy to update prompts without touching code
- **Fallback**: Agents include fallback prompts if file loading fails
- **Comprehensive**: Detailed instructions, rules, and guidelines for each agent

## Key Features

### Dynamic Prompt Loading
Agents load their system prompts from markdown files at runtime, allowing for easy updates without code changes.

### Progress Streaming (Data Analyst)
The data analyst includes sophisticated progress tracking and real-time updates for multi-step analyses.

### Session Management (Data Analyst)
Maintains conversation-specific analysis sessions with DataFrame and variable persistence.

### Plan State Integration
All agents integrate with the planning system to continue from existing plans without duplication.

### Mission Integration
All agents integrate with the mission tracking system for progress reporting and error handling.

## Usage

Agents are imported and used through the main specialized_agents.ts file:

```typescript
import {
  createCodingSpecialistNode,
  createDataAnalystNode,
  createComputerUseNode,
  createWebExplorerNode
} from './nodes/specialized_agents';
```

## Development Guidelines

### Adding New Agents
1. Create new agent file in `agents/` directory
2. Create corresponding prompt file in `prompts/` directory
3. Export the agent from `agents/index.ts`
4. Re-export from `nodes/specialized_agents.ts`
5. Update this README

### Modifying Agents
- **Code changes**: Edit the agent file directly
- **Prompt changes**: Edit the corresponding markdown file in `prompts/`
- **Testing**: Update relevant test files in `nodes/__tests__/`

### Best Practices
- Keep agent logic focused and single-purpose
- Use comprehensive error handling
- Include fallback prompts for reliability
- Follow the established patterns for mission integration
- Document any special capabilities or requirements

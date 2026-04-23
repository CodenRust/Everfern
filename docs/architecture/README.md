# EverFern Architecture Documentation

> Comprehensive technical documentation of EverFern's architecture, design patterns, and system components.

This directory contains detailed architectural documentation for EverFern, a sophisticated desktop AI agent built on a dual-process Electron architecture with a graph-based execution engine.

## 📋 Table of Contents

- [System Overview](#system-overview) - High-level architecture and design principles
- [Core Components](#core-components) - Detailed component documentation
- [Data Flow](#data-flow) - How data moves through the system
- [Agent System](#agent-system) - Graph-based execution engine
- [Tool System](#tool-system) - Tool architecture and execution
- [Integration System](#integration-system) - Multi-platform integrations
- [IPC Communication](#ipc-communication) - Inter-process communication
- [State Management](#state-management) - Session and state handling
- [Security Model](#security-model) - Privacy and security architecture

## 🏗️ System Overview

EverFern is built on a **dual-process architecture** optimized for AI workloads, combining the power of Electron's desktop integration with Next.js's modern web technologies.

```mermaid
graph TB
    subgraph "Frontend Process (Renderer)"
        UI[Next.js React UI]
        Chat[Chat Interface]
        Artifacts[Artifact Viewer]
        Settings[Settings Panel]
    end

    subgraph "Backend Process (Main)"
        Agent[Agent Runner]
        Tools[Tool System]
        ACP[AI Provider Manager]
        Store[Data Store]
    end

    subgraph "External Systems"
        LocalAI[Local AI<br/>Ollama/LMStudio]
        CloudAI[Cloud AI<br/>OpenAI/Anthropic]
        OS[Operating System]
        MCP[MCP Servers]
    end

    UI <--> |IPC Bridge| Agent
    Agent --> Tools
    Agent --> ACP
    Tools --> OS
    Tools --> MCP
    ACP --> LocalAI
    ACP --> CloudAI
    Agent --> Store
```

### Key Design Principles

1. **Privacy-First**: All data stays local, no cloud sync
2. **Modularity**: Loosely coupled components with clear interfaces
3. **Extensibility**: Plugin architecture via MCP protocol
4. **Performance**: Parallel execution and intelligent caching
5. **Reliability**: Robust error handling and recovery mechanisms

## 🔧 Core Components

### 1. Agent Execution Engine
- **Location**: `main/agent/runner/`
- **Technology**: LangGraph state machine
- **Purpose**: Orchestrates complex AI workflows through specialized nodes

### 2. Tool System
- **Location**: `main/agent/tools/`
- **Count**: 30+ built-in tools
- **Purpose**: Provides AI agents with system capabilities

### 3. AI Provider Management (ACP)
- **Location**: `main/acp/`
- **Providers**: 9+ supported (OpenAI, Anthropic, Ollama, etc.)
- **Purpose**: Unified interface for AI model interactions

### 4. Integration Service
- **Location**: `main/integrations/`
- **Platforms**: Discord, Telegram, and more
- **Purpose**: Multi-platform bot and messaging integration

### 5. IPC Communication Layer
- **Location**: `preload/preload.ts`, `main/ipc/`
- **Protocol**: Electron IPC with typed interfaces
- **Purpose**: Secure communication between processes

## 📊 Data Flow

The system processes user requests through a sophisticated pipeline:

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend UI
    participant IPC as IPC Bridge
    participant Agent as Agent Runner
    participant Graph as Execution Graph
    participant Tools as Tool System
    participant AI as AI Provider

    User->>UI: User Input
    UI->>IPC: Send Message
    IPC->>Agent: Execute Request
    Agent->>Graph: Initialize State Machine

    loop Graph Execution
        Graph->>Graph: Triage Intent
        Graph->>Graph: Plan Execution
        Graph->>Tools: Execute Tools
        Graph->>AI: Generate Response
        Graph->>Graph: Validate Output
    end

    Graph->>Agent: Return Results
    Agent->>IPC: Stream Events
    IPC->>UI: Update Interface
    UI->>User: Display Response
```

## 🤖 Agent System

The agent system is built on a **graph-based state machine** using LangGraph, providing sophisticated workflow orchestration.

### Execution Nodes

```mermaid
graph LR
    Start([Start]) --> Triage[Triage Node]
    Triage --> Planner[Planner Node]
    Planner --> Decomposer[Task Decomposer]
    Decomposer --> Router{Route Decision}

    Router --> CodingAgent[Coding Specialist]
    Router --> DataAgent[Data Analyst]
    Router --> ComputerAgent[Computer Use]
    Router --> WebAgent[Web Explorer]
    Router --> Brain[Brain Node]

    CodingAgent --> Validation[Validation Node]
    DataAgent --> Validation
    ComputerAgent --> Validation
    WebAgent --> Validation
    Brain --> ExecuteTools[Execute Tools]

    ExecuteTools --> Validation
    Validation --> HITL{HITL Required?}
    HITL -->|Yes| HitlNode[HITL Approval]
    HITL -->|No| Judge[Judge Node]
    HitlNode --> Judge
    Judge --> End([End])
```

### Specialized Agents

Each specialized agent has its own dedicated implementation and system prompt:

| Agent | Purpose | Key Tools | Capabilities |
|-------|---------|-----------|--------------|
| **Coding Specialist** | Code generation, debugging, refactoring | fsWrite, strReplace, readCode, getDiagnostics | Full-stack development, testing, architecture |
| **Data Analyst** | Data processing and visualization | terminal_execute, fsWrite, readFile | Statistical analysis, ML, dashboard creation |
| **Computer Use** | GUI automation and desktop interaction | computer_use | Application control, file operations, UI interaction |
| **Web Explorer** | Web research and content extraction | web_search, webFetch | Information gathering, fact verification |

## 🛠️ Tool System

The tool system provides AI agents with capabilities to interact with the operating system, web, and external services.

### Tool Categories

```mermaid
graph TB
    subgraph "File Operations"
        ReadFile[readFile]
        WriteFile[fsWrite]
        EditFile[strReplace]
        DeleteFile[deleteFile]
    end

    subgraph "System Operations"
        Terminal[executePwsh]
        ComputerUse[computer_use]
        SystemFiles[system_files]
    end

    subgraph "Web & Search"
        WebSearch[remote_web_search]
        WebFetch[webFetch]
        FileSearch[fileSearch]
        GrepSearch[grepSearch]
    end

    subgraph "AI & Memory"
        MemorySave[memory_save]
        MemorySearch[memory_search]
        AskUser[ask_user_question]
    end

    subgraph "Development"
        GetDiagnostics[getDiagnostics]
        SemanticRename[semanticRename]
        SmartRelocate[smartRelocate]
        ReadCode[readCode]
    end

    subgraph "Planning & Control"
        TodoWrite[todo_write]
        PresentFiles[present_files]
        CreateArtifact[create_artifact]
    end
```

### Tool Execution Pipeline

1. **Validation**: Check tool availability and permissions
2. **HITL Check**: Determine if human approval is required
3. **Execution**: Run tool with proper error handling
4. **Result Processing**: Format and validate output
5. **State Update**: Update graph state with results

## 🔌 Integration System

EverFern supports multi-platform integrations through a modular service architecture.

### Integration Architecture

```mermaid
graph TB
    subgraph "Integration Service"
        Manager[Integration Manager]
        Router[Conversation Router]
        Adapter[Content Adapter]
        Auth[User Authentication]
        Permissions[Permission Manager]
    end

    subgraph "Platform Integrations"
        Discord[Discord Platform]
        Telegram[Telegram Platform]
        Future[Future Platforms...]
    end

    subgraph "Security & Monitoring"
        SecurityMonitor[Security Monitor]
        HealthChecker[Health Checker]
        Logger[Security Logger]
    end

    Manager --> Router
    Manager --> Adapter
    Manager --> Auth
    Manager --> Permissions

    Router --> Discord
    Router --> Telegram
    Router --> Future

    Manager --> SecurityMonitor
    Manager --> HealthChecker
    Manager --> Logger
```

### Platform Support

- **Discord**: Bot integration with slash commands and webhooks
- **Telegram**: Bot API integration with message handling
- **Extensible**: Plugin architecture for additional platforms

## 📡 IPC Communication

Inter-process communication between the frontend and backend uses Electron's IPC with a typed bridge.

### Communication Patterns

```mermaid
sequenceDiagram
    participant Frontend
    participant Preload as Preload Bridge
    participant Main as Main Process

    Note over Frontend,Main: Request-Response Pattern
    Frontend->>Preload: electronAPI.acp.sendMessage()
    Preload->>Main: ipcRenderer.invoke()
    Main->>Preload: Response
    Preload->>Frontend: Typed Response

    Note over Frontend,Main: Event Streaming Pattern
    Main->>Preload: sender.send('acp:stream-chunk')
    Preload->>Frontend: Event Listener
    Frontend->>Frontend: Update UI
```

### Event Types

- **Stream Events**: Real-time AI response streaming
- **Tool Events**: Tool execution progress and results
- **Mission Events**: Task progress and timeline updates
- **System Events**: Provider status, errors, notifications

## 💾 State Management

EverFern manages multiple types of state across different scopes and lifecycles.

### State Hierarchy

```mermaid
graph TB
    subgraph "Application State"
        AppConfig[App Configuration]
        ProviderConfig[AI Provider Config]
        UserSettings[User Settings]
    end

    subgraph "Session State"
        ConversationHistory[Conversation History]
        MissionTimeline[Mission Timeline]
        GraphState[Graph Execution State]
    end

    subgraph "Execution State"
        ToolState[Tool Execution State]
        AbortSignals[Abort Signals]
        ProgressTracking[Progress Tracking]
    end

    subgraph "Persistent Storage"
        LocalDB[(Local Database)]
        FileSystem[(File System)]
        Cache[(Semantic Cache)]
    end

    AppConfig --> LocalDB
    ConversationHistory --> LocalDB
    MissionTimeline --> Cache
    GraphState --> FileSystem
```

### State Persistence

- **Configuration**: Stored in `~/.everfern/config.json`
- **Conversations**: SQLite database with semantic caching
- **Artifacts**: File system with metadata indexing
- **Cache**: LRU cache with TTL for API responses

## 🔒 Security Model

EverFern implements a comprehensive security model focused on privacy and data protection.

### Security Layers

```mermaid
graph TB
    subgraph "Application Security"
        LocalFirst[Local-First Architecture]
        NoCloudSync[No Cloud Sync]
        EncryptedStorage[Encrypted Key Storage]
    end

    subgraph "Process Security"
        ProcessIsolation[Process Isolation]
        SecureIPC[Secure IPC Bridge]
        PermissionModel[Permission Model]
    end

    subgraph "Tool Security"
        ToolValidation[Tool Validation]
        HITLApproval[HITL Approval]
        RiskAssessment[Risk Assessment]
    end

    subgraph "Integration Security"
        AuthValidation[Authentication Validation]
        InputSanitization[Input Sanitization]
        SecurityMonitoring[Security Monitoring]
    end
```

### Security Features

- **Local-First**: All data remains on user's machine
- **Encrypted Storage**: API keys and sensitive data encrypted at rest
- **HITL Approval**: Human-in-the-loop approval for high-risk operations
- **Process Isolation**: Frontend and backend run in separate processes
- **Permission Model**: Granular permissions for tool execution

## 📈 Performance Optimizations

EverFern includes several performance optimizations for responsive AI interactions:

### Optimization Strategies

1. **Parallel Execution**: Independent tools run concurrently
2. **Semantic Caching**: Reduce redundant API calls
3. **Context Window Management**: Intelligent message pruning
4. **Graph Checkpointing**: Resume capability for long tasks
5. **Provider Pooling**: Connection reuse for AI providers

### Performance Monitoring

- **Telemetry System**: Detailed performance metrics
- **Mission Tracking**: Timeline visualization for debugging
- **Resource Monitoring**: CPU, memory, and token usage tracking

## 🔧 Development Guidelines

### Adding New Components

1. **Agents**: Create in `main/agent/runner/agents/` with corresponding prompt
2. **Tools**: Implement in `main/agent/tools/` with proper validation
3. **Integrations**: Add to `main/integrations/` with security checks
4. **UI Components**: Create in `src/components/` with TypeScript

### Testing Strategy

- **Unit Tests**: Individual component testing
- **Integration Tests**: Cross-component interaction testing
- **Property-Based Tests**: Correctness validation
- **E2E Tests**: Full workflow testing

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Automated code formatting
- **Documentation**: Comprehensive inline documentation

---

## 📚 Additional Resources

- [Agent System Deep Dive](./agent-system.md) - Detailed agent architecture
- [Tool Development Guide](./tool-development.md) - Creating custom tools
- [Integration Guide](./integration-guide.md) - Adding platform integrations
- [Performance Tuning](./performance-tuning.md) - Optimization strategies
- [Security Best Practices](./security-guide.md) - Security implementation details

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Maintainers**: EverFern Core Team

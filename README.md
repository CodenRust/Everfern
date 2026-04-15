<div align="center">
  <img src="public/images/banner.jpg" alt="EverFern" width="100%" />
</div>

# EverFern

> Your autonomous AI workplace agent — intelligent OS orchestration at your fingertips.

**EverFern** is a next-generation AI-first desktop application that brings autonomous intelligence to your workflow. Built on a sophisticated graph-based agent engine, it orchestrates complex tasks, manages system operations, and provides real-time streaming insights—all while keeping your data local and private.

[Website](https://everfern.vercel.app) • [Documentation](#documentation) • [Community](#community) • [License](LICENSE)

---

## ✨ Features

- **🤖 Autonomous Agent Engine** — Graph-based orchestration with intelligent task decomposition, planning, and execution
- **⚡ Real-time Streaming UI** — Next.js-powered glassmorphic interface with live token streaming and artifact rendering
- **🛠️ Multi-Provider Support** — Seamless integration with local (Ollama, LMStudio) and cloud AI providers (OpenAI, Anthropic, DeepSeek, and more)
- **📊 High-Fidelity Telemetry** — Detailed insights into agent behavior, node transitions, and resource utilization
- **🔒 Privacy-First Architecture** — All data stays local; no secrets leave your desktop
- **🎨 Rich Artifact Viewer** — Interactive visualization for diffs, code, execution plans, and more
- **💾 Intelligent Context Persistence** — Semantic caching and conversation history management

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18 or higher
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/everfern/desktop.git
cd desktop

# Install dependencies
npm install

# Start development server
npm run dev
```

The development environment will launch both the React frontend and Electron backend simultaneously.

### Build for Production

```bash
# Build Next.js and Electron
npm run build

# Create distributable packages
npm run make
```

---

## 📚 Documentation

### Architecture Overview

EverFern uses a dual-process architecture optimized for AI workloads:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  • React Components & Streaming UI                          │
│  • Chat Interface & Artifact Viewer                         │
│  • Settings & Onboarding                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ IPC Bridge
┌────────────────────▼────────────────────────────────────────┐
│                   Backend (Electron)                         │
│  • Agent Orchestration Engine (LangGraph)                   │
│  • Tool Execution & OS Integration                          │
│  • Context Store & Settings Management                      │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼──┐    ┌───▼──┐    ┌───▼──┐
    │Local │    │Cloud │    │Tools │
    │AI    │    │AI    │    │& OS  │
    └──────┘    └──────┘    └──────┘
```

### Agent Execution Flow

The agent processes requests through a sophisticated state machine:

1. **Triage** — Analyzes user intent, decomposes tasks, and computes context limits
2. **Planner** — Generates deterministic execution strategies
3. **Execute Tools** — Invokes file operations, searches, and shell commands
4. **Call Model** — Evaluates state and generates responses
5. **Output** — Returns results to the user

### Supported AI Providers

**Local:**
- Ollama
- LMStudio

**Cloud:**
- EverFern Native
- OpenAI
- Google Gemini
- Anthropic Claude
- DeepSeek
- OpenRouter
- Nvidia NIM

---

## 🔧 Configuration

### Environment Variables

```bash
NEXT_TELEMETRY_DISABLED=1    # Disable Next.js telemetry
UV_THREADPOOL_SIZE=4         # Thread pool size for async operations
```

### Provider Setup

Configure your AI provider in the application settings. EverFern automatically handles provider fallbacks and manages API keys securely in your local filesystem.

---

## 🏗️ Project Structure

```
everfern/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── chat/              # Chat interface & components
│   │   ├── settings/          # Configuration UI
│   │   └── layout.tsx         # Root layout
│   └── components/            # Shared React components
├── main/
│   ├── agent/                 # Agent orchestration engine
│   │   ├── runner/            # Graph execution & nodes
│   │   ├── tools/             # Tool implementations
│   │   └── helpers/           # Utilities & telemetry
│   ├── acp/                   # AI provider management
│   ├── lib/                   # Core libraries
│   └── main.ts                # Electron entry point
├── public/                    # Static assets
└── package.json               # Dependencies & scripts
```

---

## 🔐 Privacy & Security

EverFern is built with privacy as a core principle:

- **Local-First Storage** — All data, keys, and history stored in `~/.everfern/store`
- **No Cloud Sync** — Your conversations and context never leave your machine
- **Secure Credentials** — API keys encrypted and stored locally
- **Transparent Telemetry** — Optional telemetry for debugging; disabled by default

---

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run with UI
npm test:ui

# Generate coverage report
npm test:coverage
```

Tests cover:
- Agent node behavior and state transitions
- Tool execution and error handling
- Frontend component rendering and interactions
- IPC communication and event handling

---

## 🐛 Troubleshooting

### AI Provider Connection Issues

If you see `ECONNREFUSED` errors:

1. Verify your local AI provider is running (Ollama, LMStudio)
2. Check the configured endpoint (default: `localhost:11434` for Ollama)
3. Switch to a cloud provider in settings if local provider is unavailable

### Performance Issues

- Check telemetry logs for context window pressure
- Reduce conversation history if needed
- Verify system resources (CPU, memory)
- Consider using a faster AI model

### UI Not Updating

- Restart the application
- Clear browser cache: `~/.everfern/store/cache`
- Check browser console for errors (DevTools: Ctrl+Shift+I)

---

## 📊 Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting

```bash
npm run lint
```

### Building Locally

```bash
# Development build
npm run dev

# Production build
npm run build

# Create installer
npm run make
```

---

## 🚀 Performance Optimization

EverFern includes several optimizations:

- **Semantic Caching** — Reduces redundant API calls
- **Parallel Tool Execution** — Concurrent operations when possible
- **Context Window Management** — Intelligent message pruning
- **Graph Checkpointing** — Resume capability for long-running tasks

---

## 🤝 Community

We welcome contributions! Whether it's bug reports, feature requests, or code contributions:

- **Issues** — Report bugs or suggest features on GitHub
- **Discussions** — Join our community conversations
- **Contributing** — See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

**Copyright © 2026 EverFern Community**

---

## 🙏 Acknowledgments

Built with:
- [LangGraph](https://langchain-ai.github.io/langgraph/) — Agent orchestration
- [Next.js](https://nextjs.org/) — Frontend framework
- [Electron](https://www.electronjs.org/) — Desktop application framework
- [TypeScript](https://www.typescriptlang.org/) — Type-safe development

---

**Made with ❤️ by the EverFern Community**

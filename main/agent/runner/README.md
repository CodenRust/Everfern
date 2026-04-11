# EverFern Agent Runner Engine

This folder contains the core AGI execution engine for EverFern. It implements a LangGraph-based state machine that powers the autonomous agent with parallel tool execution and sub-agent spawning capabilities.

## Architecture Overview

The runner uses a **6-Node Architecture** (optimized into a triage -> model -> execute loop):
1. **Triage**: Classifies user intent and sets initial task phase.
2. **Call Model**: LLM inference with dynamic system prompts and vision grounding.
3. **Execute Tools**: Parallel execution of independent tools with loop detection and policy gating.

## Core Files

- **runner.ts**: The main orchestration class. Manages the high-level life cycle of a run.
- **graph.ts**: Assembly of the LangGraph state machine and routing logic.
- **state.ts**: Defines the shared `GraphState` schema and core interfaces for intent, plans, and events.
- **utils.ts**: Shared helper functions for path validation, contextual messaging, and task hints.
- **triage.ts**: Intent classification logic using heuristic signals.

## Nodes (`/nodes`)

- **triage.ts**: Node implementation for intent classification.
- **call_model.ts**: Node implementation for LLM interaction, including streaming thought and text-to-tool parsing.
- **execute_tools.ts**: Node implementation for running tools in parallel groups.

## Supporting Engine Files

- **types.ts**: Core type definitions for tools and configuration.
- **system-prompt.ts**: Logic for building dynamic, multi-layered system prompts.
- **skills-loader.ts**: Handles scanning and loading `SKILL.md` files.
- **task-decomposer.ts**: Breaks down complex user requests into actionable steps.
- **parallel-executor.ts**: Logic for grouping and executing independent tool calls.
- **loop-detection.ts**: Prevents the agent from getting stuck in repetitive cycles.
- **tool-policy.ts**: Gating logic for human approval and tool restrictions.
- **context-window-guard.ts**: Monitors token usage and manages history truncation.
- **subagent-spawn.ts**: Implementation of the recursive `spawn_agent` tool.
- **subagent-registry.ts**: Tracks sub-agent parent/child relationships.
- **showui-server.ts**: Manager for the local ShowUI server for GUI automation.
- **grounding.ts**: Logic for grounding responses in local context.
- **router.ts**: Phase-based routing logic.
- **patch.py**: Python utility for surgical file edits.

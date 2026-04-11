# EverFern Project + Gemini CLI

This document outlines how to use Gemini CLI with the EverFern desktop agent project.

## 🚀 Running the Agent

To start an agent task, you can use a prompt like:
`@../customers-100.csv generate me a report`

The agent will then:
1. Decompose the task into a plan.
2. The graph will `interrupt()` and wait for your approval of the plan.
3. To approve, just type "approve" or "yes". To reject, type "reject" and provide feedback.
4. The agent will resume and execute the plan.

## 🧪 Testing the HITL Architecture

To test the new Human-in-the-Loop (HITL) architecture with Vitest:
`npx vitest run main/agent/runner/graph.test.ts`

This test suite verifies that the LangGraph checkpointer is working correctly and that the graph can be paused with `interrupt()` and resumed with `Command({ resume })`.

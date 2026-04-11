/**
 * EverFern Desktop — Context Engine
 * Unified exports for the context-engine subsystem.
 */

export type {
  ContextEngine,
  ContextEngineInfo,
  AssembleResult,
  CompactResult,
  IngestResult,
} from './types';

export {
  registerContextEngine,
  resolveContextEngine,
  listContextEngineIds,
  setDefaultContextEngine,
} from './registry';

export type { ContextEngineFactory } from './registry';

export { DefaultContextEngine } from './default';
export { VectorContextEngine, HybridContextEngine, getContextEngineStats } from './vector';

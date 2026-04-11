/**
 * EverFern Desktop — ACP Control Plane
 *
 * This module exports the core primitives for session management.
 * 
 * - Session lifecycle management (create, pause, resume, kill)
 * - Rate limiting and quota enforcement
 * - Multi-agent coordination and routing
 * - Identity reconciliation (which agent owns which session)
 */

export * from './manager.types';
export * from './manager.core';
export * from './manager.identity-reconcile';
export * from './manager.runtime-controls';

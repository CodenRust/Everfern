"use strict";
/**
 * AbortSignalManager - Enhanced Stop Button Mechanism
 *
 * Provides robust abort signal propagation through the execution graph
 * to ensure the stop button can immediately halt AI execution.
 *
 * Requirements:
 * - 1.1: Stop button shall immediately set the Stream_Abort_Flag to true
 * - 1.2: Agent_Runner shall check the flag before each node execution
 * - 1.3: Agent_Runner shall throw an abortion error within 100ms when flag is true
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortError = exports.globalAbortManager = exports.AbortSignalManager = void 0;
class AbortSignalManager {
    _streamAborted = false;
    _abortController = new AbortController();
    _abortStartTime = null;
    /**
     * Gets the current abort status
     */
    get streamAborted() {
        return this._streamAborted;
    }
    /**
     * Gets the AbortController for tool execution cancellation
     */
    get abortController() {
        return this._abortController;
    }
    /**
     * Sets the abort flag to true and starts abort propagation
     * Requirement 1.1: Stop button shall immediately set the Stream_Abort_Flag to true
     */
    setAborted() {
        if (!this._streamAborted) {
            this._streamAborted = true;
            this._abortStartTime = Date.now();
            this._abortController.abort();
            console.log('[AbortSignalManager] 🛑 Abort signal set - execution will be terminated');
        }
    }
    /**
     * Checks if execution should be aborted and throws error if needed
     * Requirement 1.2: Agent_Runner shall check the flag before each node execution
     * Requirement 1.3: Agent_Runner shall throw an abortion error within 100ms when flag is true
     */
    checkAbort() {
        if (this._streamAborted) {
            const abortTime = this._abortStartTime ? Date.now() - this._abortStartTime : 0;
            console.log(`[AbortSignalManager] 🛑 Abort detected after ${abortTime}ms - throwing abortion error`);
            throw new Error('Execution aborted by user (stop button clicked)');
        }
        return false;
    }
    /**
     * Propagates abort signal to running tools and operations
     * Requirement 1.7: For ALL running tool executions, abortion SHALL propagate to terminate long-running operations
     */
    propagateToTools() {
        if (this._streamAborted && !this._abortController.signal.aborted) {
            this._abortController.abort();
            console.log('[AbortSignalManager] 🛑 Abort signal propagated to running tools');
        }
    }
    /**
     * Resets the abort state for a new execution
     */
    reset() {
        this._streamAborted = false;
        this._abortStartTime = null;
        // Create new AbortController for fresh execution
        this._abortController = new AbortController();
        console.log('[AbortSignalManager] ✅ Abort state reset for new execution');
    }
    /**
     * Creates a shouldAbort callback function for compatibility with existing code
     */
    createShouldAbortCallback() {
        return () => this._streamAborted;
    }
    /**
     * Gets abort timing information for debugging
     */
    getAbortTiming() {
        return {
            aborted: this._streamAborted,
            elapsedMs: this._abortStartTime ? Date.now() - this._abortStartTime : null
        };
    }
}
exports.AbortSignalManager = AbortSignalManager;
/**
 * Global abort signal manager instance
 * This provides a centralized abort state that can be accessed across the system
 */
exports.globalAbortManager = new AbortSignalManager();
/**
 * AbortError class for consistent error handling
 */
class AbortError extends Error {
    constructor(message = 'Execution aborted by user') {
        super(message);
        this.name = 'AbortError';
    }
}
exports.AbortError = AbortError;

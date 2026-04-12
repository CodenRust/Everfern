/**
 * Simple State Manager for HITL Support
 * 
 * This provides session state management without using LangGraph's checkpointer,
 * which was causing compilation hangs.
 */

interface SessionState {
  conversationId: string;
  currentState: any;
  history: any[];
  lastUpdate: number;
  isInterrupted: boolean;
  interruptData?: any;
}

class StateManager {
  private sessions: Map<string, SessionState> = new Map();

  /**
   * Save state for a conversation
   */
  saveState(conversationId: string, state: any): void {
    const existing = this.sessions.get(conversationId);
    
    this.sessions.set(conversationId, {
      conversationId,
      currentState: state,
      history: existing?.history || [],
      lastUpdate: Date.now(),
      isInterrupted: existing?.isInterrupted || false,
      interruptData: existing?.interruptData,
    });

    // Add to history
    const session = this.sessions.get(conversationId)!;
    session.history.push({
      state,
      timestamp: Date.now(),
    });

    // Limit history to last 50 states
    if (session.history.length > 50) {
      session.history = session.history.slice(-50);
    }

    console.log(`[StateManager] 💾 Saved state for conversation: ${conversationId}`);
  }

  /**
   * Get state for a conversation
   */
  getState(conversationId: string): any | undefined {
    const session = this.sessions.get(conversationId);
    return session?.currentState;
  }

  /**
   * Mark conversation as interrupted (for HITL)
   */
  setInterrupted(conversationId: string, interruptData: any): void {
    const session = this.sessions.get(conversationId);
    if (session) {
      session.isInterrupted = true;
      session.interruptData = interruptData;
      console.log(`[StateManager] ⏸️  Conversation interrupted: ${conversationId}`);
    }
  }

  /**
   * Resume from interrupt
   */
  resumeFromInterrupt(conversationId: string, resumeData: any): { state: any; interruptData: any } | undefined {
    const session = this.sessions.get(conversationId);
    if (!session || !session.isInterrupted) {
      return undefined;
    }

    session.isInterrupted = false;
    const interruptData = session.interruptData;
    session.interruptData = undefined;

    console.log(`[StateManager] ▶️  Resuming conversation: ${conversationId}`);

    return {
      state: session.currentState,
      interruptData,
    };
  }

  /**
   * Check if conversation is interrupted
   */
  isInterrupted(conversationId: string): boolean {
    const session = this.sessions.get(conversationId);
    return session?.isInterrupted || false;
  }

  /**
   * Get interrupt data for a conversation
   */
  getInterruptData(conversationId: string): any | undefined {
    const session = this.sessions.get(conversationId);
    return session?.interruptData;
  }

  /**
   * Clear conversation state
   */
  clearState(conversationId: string): void {
    this.sessions.delete(conversationId);
    console.log(`[StateManager] 🗑️  Cleared state for conversation: ${conversationId}`);
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get statistics
   */
  getStats(): { sessions: number; totalStates: number } {
    let totalStates = 0;
    for (const session of this.sessions.values()) {
      totalStates += session.history.length;
    }

    return {
      sessions: this.sessions.size,
      totalStates,
    };
  }

  /**
   * Cleanup old sessions (older than 1 hour)
   */
  cleanup(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;

    for (const [conversationId, session] of this.sessions.entries()) {
      if (session.lastUpdate < oneHourAgo) {
        this.sessions.delete(conversationId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[StateManager] 🧹 Cleaned up ${cleaned} old sessions`);
    }
  }
}

// Create singleton instance
export const stateManager = new StateManager();

// Run cleanup every 10 minutes
setInterval(() => {
  stateManager.cleanup();
}, 10 * 60 * 1000);

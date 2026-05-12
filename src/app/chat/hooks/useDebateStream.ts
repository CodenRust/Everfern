/**
 * Hook for listening to debate stream events from the main process
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DebateStreamEvent, DebateDisplayData } from '../types/debate-types';

interface DebateState {
  currentDebate: DebateDisplayData | null;
  isDebating: boolean;
  lastDebateId: string | null;
}

export function useDebateStream() {
  const [state, setState] = useState<DebateState>({
    currentDebate: null,
    isDebating: false,
    lastDebateId: null,
  });

  const handleDebateEvent = useCallback((event: DebateStreamEvent) => {
    console.log('[useDebateStream] Received debate event:', event.type);

    switch (event.type) {
      case 'debate_start':
        setState(prev => ({
          ...prev,
          isDebating: true,
          lastDebateId: event.debateId,
        }));
        break;

      case 'vanguard_complete':
      case 'phantom_complete':
      case 'arbiter_complete':
        if (event.data) {
          setState(prev => ({
            ...prev,
            currentDebate: event.data as DebateDisplayData,
          }));
        }
        break;

      case 'debate_complete':
        if (event.data) {
          setState(prev => ({
            ...prev,
            currentDebate: event.data as DebateDisplayData,
            isDebating: false,
          }));
        }
        break;

      case 'debate_error':
        console.error('[useDebateStream] Debate error:', event.error);
        setState(prev => ({
          ...prev,
          isDebating: false,
        }));
        break;
    }
  }, []);

  useEffect(() => {
    const hasAPI = typeof window !== 'undefined' && !!(window as any).electronAPI?.acp?.onDebateStream;
    console.log('[useDebateStream] Hook mounted, electronAPI.acp.onDebateStream available:', hasAPI);
    if (hasAPI) {
      (window as any).electronAPI.acp.onDebateStream(handleDebateEvent);
      return () => {
        console.log('[useDebateStream] Cleaning up listener');
        (window as any).electronAPI?.acp?.removeDebateStreamListener?.();
      };
    }
  }, [handleDebateEvent]);

  return {
    debate: state.currentDebate,
    isDebating: state.isDebating,
  };
}

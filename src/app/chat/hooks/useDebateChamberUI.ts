/**
 * Hook for managing debate chamber UI state
 */

'use client';

import { useState, useCallback } from 'react';

interface DebateChamberState {
  showLiveDebate: boolean;
  showArena: boolean;
  debateId: string | null;
}

export function useDebateChamberUI() {
  const [state, setState] = useState<DebateChamberState>({
    showLiveDebate: false,
    showArena: false,
    debateId: null,
  });

  const openLiveDebate = useCallback((debateId: string) => {
    setState(prev => ({
      ...prev,
      showLiveDebate: true,
      debateId,
    }));
  }, []);

  const openArena = useCallback((debateId: string) => {
    setState(prev => ({
      ...prev,
      showArena: true,
      debateId,
    }));
  }, []);

  const closeLiveDebate = useCallback(() => {
    setState(prev => ({
      ...prev,
      showLiveDebate: false,
    }));
  }, []);

  const closeArena = useCallback(() => {
    setState(prev => ({
      ...prev,
      showArena: false,
    }));
  }, []);

  const closeAll = useCallback(() => {
    setState({
      showLiveDebate: false,
      showArena: false,
      debateId: null,
    });
  }, []);

  return {
    ...state,
    openLiveDebate,
    openArena,
    closeLiveDebate,
    closeArena,
    closeAll,
  };
}

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import type { DebateDisplayData } from '../types/debate-types';

interface LiveDebateChamberProps {
  debate: DebateDisplayData | null;
  isDebating: boolean;
  onClose?: () => void;
  onViewArena?: () => void;
}

const AGENT_COLORS: Record<string, { bg: string; accent: string; border: string; light: string; pulse: string }> = {
  vanguard: { bg: 'from-blue-500 to-blue-600', accent: 'text-blue-500', border: 'border-blue-500', light: 'bg-blue-50', pulse: 'bg-blue-400' },
  phantom: { bg: 'from-purple-500 to-purple-600', accent: 'text-purple-500', border: 'border-purple-500', light: 'bg-purple-50', pulse: 'bg-purple-400' },
  arbiter: { bg: 'from-amber-500 to-amber-600', accent: 'text-amber-500', border: 'border-amber-500', light: 'bg-amber-50', pulse: 'bg-amber-400' },
};

const AGENT_ICONS: Record<string, string> = {
  vanguard: '🚀',
  phantom: '👻',
  arbiter: '⚖️',
};

const AGENT_TITLES: Record<string, string> = {
  vanguard: 'Vanguard\nProposer',
  phantom: 'Phantom\nCritic',
  arbiter: 'Arbiter\nJudge',
};

export function LiveDebateChamber({ debate, isDebating, onClose, onViewArena }: LiveDebateChamberProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    console.log('[LiveDebateChamber] visibility check — isDebating:', isDebating, 'debate:', !!debate);
    if (isDebating || debate) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isDebating, debate]);

  if (!visible) return null;

  const hasProposal = debate?.proposal?.stepCount !== undefined;
  const hasReview = debate?.review?.concernCount !== undefined;
  const hasFinal = debate?.finalPlan?.goNogo !== undefined;
  const showDecision = hasFinal && debate?.finalPlan;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-20 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isDebating ? 360 : 0 }}
              transition={{ duration: 2, repeat: isDebating ? Infinity : 0, ease: 'linear' }}
            >
              <SparklesIcon className="w-4 h-4" />
            </motion.div>
            <h2 className="font-bold text-sm">Debate Chamber</h2>
          </div>
          <div className="flex items-center gap-1">
            {onViewArena && (
              <button onClick={onViewArena} className="p-1 hover:bg-white/20 rounded transition-colors" title="Expand">
                <ArrowsPointingOutIcon className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-white/20 rounded transition-colors">
              {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-80 overflow-y-auto"
            >
              <div className="p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {/* Three Agent Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {(['vanguard', 'phantom', 'arbiter'] as const).map((agent) => {
                    const isActive = agent === 'vanguard' ? hasProposal : agent === 'phantom' ? hasReview : hasFinal;
                    const isThinking = isDebating && !isActive && (
                      agent === 'vanguard' ? !hasProposal :
                      agent === 'phantom' ? !hasReview :
                      !hasFinal
                    );
                    return (
                      <AgentCard
                        key={agent}
                        agent={agent}
                        isActive={isActive}
                        isThinking={isThinking}
                      />
                    );
                  })}
                </div>

                {/* Stats row */}
                {debate && (
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    {hasProposal && (
                      <div className="bg-blue-50 rounded p-1.5">
                        <p className="font-bold text-blue-700">{debate.proposal.stepCount}</p>
                        <p className="text-blue-500">Steps</p>
                      </div>
                    )}
                    {hasReview && (
                      <div className="bg-purple-50 rounded p-1.5">
                        <p className="font-bold text-purple-700">{debate.review.concernCount}</p>
                        <p className="text-purple-500">Concerns</p>
                      </div>
                    )}
                    {showDecision && (
                      <div className="bg-amber-50 rounded p-1.5">
                        <p className="font-bold text-amber-700 capitalize">{debate.finalPlan.goNogo === 'go' ? 'Go' : debate.finalPlan.goNogo === 'proceed-with-caution' ? 'Caution' : 'No-Go'}</p>
                        <p className="text-amber-500">Decision</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Final Decision Banner */}
                {showDecision && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-3 rounded-lg border-2 text-xs ${
                      debate.finalPlan.goNogo === 'go'
                        ? 'border-green-500 bg-green-50'
                        : debate.finalPlan.goNogo === 'proceed-with-caution'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-red-500 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {debate.finalPlan.goNogo === 'go' && <CheckCircleIcon className="w-4 h-4 text-green-600" />}
                      {debate.finalPlan.goNogo === 'proceed-with-caution' && <ExclamationCircleIcon className="w-4 h-4 text-yellow-600" />}
                      {debate.finalPlan.goNogo === 'no-go' && <XMarkIcon className="w-4 h-4 text-red-600" />}
                      <p className="font-semibold">
                        {debate.finalPlan.goNogo === 'go' && 'Approved'}
                        {debate.finalPlan.goNogo === 'proceed-with-caution' && 'Proceed with Caution'}
                        {debate.finalPlan.goNogo === 'no-go' && 'Rejected'}
                      </p>
                    </div>
                    <p className="text-slate-600">{debate.finalPlan.explanation}</p>
                  </motion.div>
                )}

                {/* Thinking indicator */}
                {isDebating && (
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-2 h-2 bg-indigo-500 rounded-full"
                    />
                    Debate in progress...
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

interface AgentCardProps {
  agent: 'vanguard' | 'phantom' | 'arbiter';
  isActive: boolean;
  isThinking: boolean;
}

function AgentCard({ agent, isActive, isThinking }: AgentCardProps) {
  const colors = AGENT_COLORS[agent];
  const icon = AGENT_ICONS[agent];
  const title = AGENT_TITLES[agent];

  return (
    <motion.div
      animate={{
        scale: isActive ? 1 : 0.95,
        opacity: isActive || isThinking ? 1 : 0.5,
      }}
      className={`p-3 rounded-lg border-2 transition-colors ${colors.border} ${isActive ? colors.light : 'bg-slate-100'}`}
    >
      <div className="text-center">
        <div className="text-2xl mb-1">{icon}</div>
        <p className="text-[10px] font-bold text-slate-900 whitespace-pre-line leading-tight">{title}</p>
      </div>
      {isThinking && (
        <div className="flex justify-center gap-1 mt-2">
          <motion.div
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className={`w-1.5 h-1.5 rounded-full ${colors.pulse}`}
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            className={`w-1.5 h-1.5 rounded-full ${colors.pulse}`}
          />
          <motion.div
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            className={`w-1.5 h-1.5 rounded-full ${colors.pulse}`}
          />
        </div>
      )}
    </motion.div>
  );
}

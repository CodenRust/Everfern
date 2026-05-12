/**
 * EverFern Desktop — Immersive Debate Arena
 *
 * Full-screen immersive visualization of the debate process.
 * Shows debate progression with animated thought clouds, decision flows, and live transcripts.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { DebateDisplayData } from '../types/debate-types';

interface DebateArenaProps {
  debate: DebateDisplayData | null;
  isDebating: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function DebateArena({ debate, isDebating, isOpen, onClose }: DebateArenaProps) {
  const [activePhase, setActivePhase] = useState<'proposal' | 'review' | 'final' | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDebating && debate) {
      // Auto-progress through phases
      const phases: ('proposal' | 'review' | 'final')[] = ['proposal', 'review', 'final'];
      let currentPhase = 0;

      const timer = setInterval(() => {
        setActivePhase(phases[currentPhase]);
        currentPhase = (currentPhase + 1) % phases.length;
      }, 2000);

      return () => clearInterval(timer);
    } else if (isDebating) {
      setActivePhase('proposal');
    }
  }, [isDebating, debate]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [activePhase]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-5xl h-[90vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 px-8 py-6 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{ rotate: isDebating ? 360 : 0 }}
                  transition={{ duration: 3, repeat: isDebating ? Infinity : 0, ease: 'linear' }}
                  className="text-3xl"
                >
                  ⚔️
                </motion.div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Peer Agent Debate Arena</h1>
                  <p className="text-sm text-indigo-200">Three minds deliberating on optimal execution</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex gap-6 p-8 bg-gradient-to-b from-slate-800 to-slate-900">
              {/* Left: Agent Debate Visualization */}
              <div className="flex-1 space-y-6">
                {/* Three Agents in Arena */}
                <DebateArenaVisual
                  debate={debate}
                  isDebating={isDebating}
                  activePhase={activePhase}
                />

                {/* Phase Progression */}
                <PhaseProgressBar
                  isDebating={isDebating}
                  activePhase={activePhase}
                />
              </div>

              {/* Right: Live Transcript & Details */}
              <div className="w-80 flex flex-col gap-4 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  {showTranscript ? '📊 Details' : '📝 Transcript'}
                  <ChevronRightIcon className="w-4 h-4" />
                </button>

                {showTranscript ? (
                  <Transcript debate={debate} transcriptRef={transcriptRef} />
                ) : (
                  <DebateDetails debate={debate} />
                )}
              </div>
            </div>

            {/* Footer */}
            {isDebating && (
              <div className="bg-slate-800/50 px-8 py-4 border-t border-slate-700 flex items-center gap-3 text-sm text-indigo-300">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-indigo-400 rounded-full"
                />
                Debate in progress · Vanguard proposing...
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DebateArenaVisualProps {
  debate: DebateDisplayData | null;
  isDebating: boolean;
  activePhase: string | null;
}

function DebateArenaVisual({ debate, isDebating, activePhase }: DebateArenaVisualProps) {
  const agents = [
    { name: 'Vanguard', icon: '🚀', color: 'from-blue-500 to-blue-600', side: 'left' },
    { name: 'Arbiter', icon: '⚖️', color: 'from-amber-500 to-amber-600', side: 'center' },
    { name: 'Phantom', icon: '👻', color: 'from-purple-500 to-purple-600', side: 'right' },
  ];

  return (
    <div className="relative h-56 bg-gradient-to-b from-slate-700/30 to-slate-800/30 rounded-xl border border-slate-700 p-8 flex items-center justify-between overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-amber-500 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-purple-500 rounded-full blur-3xl" />
      </div>

      {/* Agent Avatars */}
      {agents.map((agent, idx) => (
        <motion.div
          key={agent.name}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: idx * 0.2 }}
          className="relative z-10"
        >
          <AgentAvatar
            agent={agent}
            isActive={activePhase === agent.name.toLowerCase()}
            isThinking={isDebating}
          />
        </motion.div>
      ))}

      {/* Connection lines */}
      {!isDebating && debate && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <motion.path
            d="M 80 80 Q 300 40 520 80"
            stroke="url(#gradient1)"
            strokeWidth="2"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.5 }}
          />
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      )}
    </div>
  );
}

interface AgentAvatarProps {
  agent: { name: string; icon: string; color: string; side: string };
  isActive: boolean;
  isThinking: boolean;
}

function AgentAvatar({ agent, isActive, isThinking }: AgentAvatarProps) {
  return (
    <motion.div
      animate={{
        scale: isActive ? 1.2 : 1,
        y: isThinking && isActive ? [0, -10, 0] : 0,
      }}
      transition={{ duration: 0.5, repeat: isThinking && isActive ? Infinity : 0 }}
      className="flex flex-col items-center gap-3"
    >
      {/* Agent Circle */}
      <motion.div
        className={`w-20 h-20 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center text-4xl shadow-lg relative`}
        animate={{
          boxShadow: isActive ? [
            '0 0 0 0 rgba(99, 102, 241, 0.7)',
            '0 0 0 10px rgba(99, 102, 241, 0)',
          ] : 'none',
        }}
        transition={{ duration: 1.5, repeat: isActive ? Infinity : 0 }}
      >
        {agent.icon}

        {/* Activity indicator */}
        {isActive && (
          <motion.div
            className="absolute top-0 right-0 w-4 h-4 bg-green-400 rounded-full"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Label */}
      <div className="text-center">
        <p className="font-bold text-sm text-white">{agent.name}</p>
        {isActive && <p className="text-xs text-green-400">● Active</p>}
      </div>

      {/* Thought Bubbles */}
      {isActive && isThinking && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-2 bg-slate-700/50 backdrop-blur px-3 py-2 rounded-lg text-xs text-slate-200 max-w-32 border border-slate-600"
        >
          Analyzing...
        </motion.div>
      )}
    </motion.div>
  );
}

interface PhaseProgressBarProps {
  isDebating: boolean;
  activePhase: string | null;
}

function PhaseProgressBar({ isDebating, activePhase }: PhaseProgressBarProps) {
  const phases = [
    { id: 'proposal', label: 'Proposal', icon: '🚀' },
    { id: 'review', label: 'Review', icon: '🔍' },
    { id: 'final', label: 'Final', icon: '✅' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-300">Debate Progress</p>
      <div className="space-y-2">
        {phases.map((phase, idx) => (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.2 }}
            className="flex items-center gap-3"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                activePhase === phase.id
                  ? 'bg-indigo-600 text-white scale-110'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {phase.icon}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{phase.label}</p>
              <motion.div
                className="h-1 bg-indigo-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: activePhase === phase.id ? '100%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface TranscriptProps {
  debate: DebateDisplayData | null;
  transcriptRef: React.RefObject<HTMLDivElement | null>;
}

function Transcript({ debate, transcriptRef }: TranscriptProps) {
  if (!debate) return null;

  const entries = [
    {
      agent: 'Vanguard',
      icon: '🚀',
      text: `Proposing approach: ${debate.proposal.approach}`,
      details: `${debate.proposal.stepCount} steps, ${debate.proposal.estimatedTimeMs}ms estimated`,
    },
    {
      agent: 'Phantom',
      icon: '👻',
      text: `Assessment: ${debate.review.assessment}`,
      details: `${debate.review.concernCount} concerns (${debate.review.criticalCount} critical)`,
    },
    {
      agent: 'Arbiter',
      icon: '⚖️',
      text: `Final: ${debate.finalPlan.goNogo.toUpperCase()}`,
      details: debate.finalPlan.explanation,
    },
  ];

  return (
    <div
      ref={transcriptRef}
      className="flex-1 overflow-y-auto space-y-4 text-sm"
    >
      {entries.map((entry, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.2 }}
          className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{entry.icon}</span>
            <p className="font-bold text-white">{entry.agent}</p>
          </div>
          <p className="text-slate-200">{entry.text}</p>
          <p className="text-xs text-slate-400 mt-2">{entry.details}</p>
        </motion.div>
      ))}
    </div>
  );
}

interface DebateDetailsProps {
  debate: DebateDisplayData | null;
}

function DebateDetails({ debate }: DebateDetailsProps) {
  if (!debate) return null;

  return (
    <div className="space-y-4 text-sm flex-1 overflow-y-auto">
      {/* Proposal */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
        <p className="font-bold text-blue-300 mb-2">🚀 Vanguard Proposal</p>
        <p className="text-slate-300">{debate.proposal.approach}</p>
        <p className="text-xs text-slate-400 mt-2">
          {debate.proposal.stepCount} steps · {debate.proposal.estimatedTimeMs}ms
        </p>
      </div>

      {/* Review */}
      <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
        <p className="font-bold text-purple-300 mb-2">👻 Phantom Review</p>
        <p className="text-slate-300">Assessment: {debate.review.assessment}</p>
        <p className="text-xs text-slate-400 mt-2">
          {debate.review.concernCount} concerns · {debate.review.criticalCount} critical
        </p>
      </div>

      {/* Final Plan */}
      <div
        className={`border rounded-lg p-4 ${
          debate.finalPlan.goNogo === 'go'
            ? 'bg-green-900/30 border-green-700'
            : 'bg-yellow-900/30 border-yellow-700'
        }`}
      >
        <p className="font-bold text-yellow-300 mb-2">⚖️ Arbiter Decision</p>
        <p className="text-slate-300">{debate.finalPlan.explanation}</p>
      </div>
    </div>
  );
}

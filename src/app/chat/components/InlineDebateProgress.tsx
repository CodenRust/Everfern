/**
 * EverFern Desktop — Inline Debate Progress
 *
 * Shows debate progress inline within the chat message stream.
 * Provides quick access to full debate chamber.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import type { DebateDisplayData } from '../types/debate-types';

interface InlineDebateProgressProps {
  debate: DebateDisplayData | null;
  isDebating: boolean;
  onViewFullDebate?: () => void;
}

export function InlineDebateProgress({
  debate,
  isDebating,
  onViewFullDebate,
}: InlineDebateProgressProps) {
  const [phase, setPhase] = useState<'proposal' | 'review' | 'arbitration' | null>(null);

  useEffect(() => {
    if (isDebating) {
      const phases: ('proposal' | 'review' | 'arbitration')[] = [
        'proposal',
        'review',
        'arbitration',
      ];
      let current = 0;

      const timer = setInterval(() => {
        setPhase(phases[current]);
        current = (current + 1) % phases.length;
      }, 2000);

      return () => clearInterval(timer);
    }
  }, [isDebating]);

  if (!debate && !isDebating) return null;

  const phaseInfo = {
    proposal: {
      label: '🚀 Vanguard: Proposing',
      description: 'Generating execution plan',
      icon: '🚀',
    },
    review: {
      label: '👻 Phantom: Reviewing',
      description: 'Analyzing for risks',
      icon: '👻',
    },
    arbitration: {
      label: '⚖️ Arbiter: Deciding',
      description: 'Making final call',
      icon: '⚖️',
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-4 p-4 rounded-lg border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400"
    >
      {isDebating && phase ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </motion.div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                {phaseInfo[phase].label}
              </p>
            </div>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 ml-7">
              {phaseInfo[phase].description}
            </p>

            {/* Progress dots */}
            <div className="flex gap-1 mt-3 ml-7">
              {['proposal', 'review', 'arbitration'].map((p) => (
                <motion.div
                  key={p}
                  className={`h-2 rounded-full ${
                    p === phase
                      ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                      : 'w-2 bg-indigo-300 dark:bg-indigo-600'
                  }`}
                  animate={{
                    scale: p === phase ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              ))}
            </div>
          </div>

          {/* View button */}
          {onViewFullDebate && (
            <button
              onClick={onViewFullDebate}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <span>View</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : debate ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {debate.finalPlan.goNogo === 'go' && (
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            )}
            {debate.finalPlan.goNogo === 'proceed-with-caution' && (
              <ExclamationCircleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            )}
            {debate.finalPlan.goNogo === 'no-go' && (
              <ExclamationCircleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
            <p className="font-semibold text-indigo-900 dark:text-indigo-200">
              Debate Complete: {debate.finalPlan.goNogo === 'go' && '✓ Approved'}
              {debate.finalPlan.goNogo === 'proceed-with-caution' && '⚠ Caution'}
              {debate.finalPlan.goNogo === 'no-go' && '✗ Rejected'}
            </p>
          </div>

          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {debate.finalPlan.explanation}
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="bg-white dark:bg-slate-800 rounded p-2 text-center">
              <p className="font-bold text-indigo-600 dark:text-indigo-400">
                {debate.proposal.stepCount}
              </p>
              <p className="text-slate-600 dark:text-slate-400">Steps</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded p-2 text-center">
              <p className="font-bold text-indigo-600 dark:text-indigo-400">
                {debate.review.concernCount}
              </p>
              <p className="text-slate-600 dark:text-slate-400">Concerns</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded p-2 text-center">
              <p className="font-bold text-indigo-600 dark:text-indigo-400">
                {debate.finalPlan.riskAssessment}
              </p>
              <p className="text-slate-600 dark:text-slate-400">Risk</p>
            </div>
          </div>

          {/* View button */}
          {onViewFullDebate && (
            <button
              onClick={onViewFullDebate}
              className="w-full mt-3 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>View Full Debate Chamber</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

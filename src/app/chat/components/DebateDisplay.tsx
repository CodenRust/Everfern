/**
 * EverFern Desktop — Debate Display Component
 *
 * Shows the three-agent debate process and results in the chat UI.
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import type { DebateDisplayData } from '../types/debate-types';

interface DebateDisplayProps {
  debate: DebateDisplayData;
  isExpanded?: boolean;
}

export function DebateDisplay({ debate, isExpanded: initialExpanded = false }: DebateDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [expandedPhase, setExpandedPhase] = useState<'proposal' | 'review' | 'plan' | null>(initialExpanded ? 'proposal' : null);

  const riskColors = {
    low: 'text-green-500 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    high: 'text-red-500 bg-red-50',
    critical: 'text-red-700 bg-red-100',
  };

  const assessmentColors = {
    viable: 'text-green-600 bg-green-50 border-green-200',
    concerning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    problematic: 'text-red-600 bg-red-50 border-red-200',
  };

  const goNoGoColors = {
    go: 'text-green-600 bg-green-50 border-green-200',
    'proceed-with-caution': 'text-yellow-600 bg-yellow-50 border-yellow-200',
    'no-go': 'text-red-600 bg-red-50 border-red-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full my-3 rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronDownIcon className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-slate-600" />
          )}
        </div>
        <SparklesIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">Peer Agent Debate</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Three agents debated your complex task — Vanguard, Phantom, and Arbiter
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${goNoGoColors[debate.finalPlan.goNogo]}`}>
          {debate.finalPlan.goNogo === 'go' && '✓ Go'}
          {debate.finalPlan.goNogo === 'proceed-with-caution' && '⚠ Caution'}
          {debate.finalPlan.goNogo === 'no-go' && '✗ No-Go'}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 bg-white"
          >
            <div className="p-4 space-y-4">
              {/* Vanguard's Proposal */}
              <PhaseSection
                phase="proposal"
                title="🚀 Vanguard - Proposer"
                subtitle="Generated execution plan"
                expanded={expandedPhase}
                setExpanded={setExpandedPhase}
              >
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{debate.proposal.taskSummary}</h4>
                    <p className="text-slate-600">{debate.proposal.approach}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Steps" value={debate.proposal.stepCount.toString()} />
                    <StatBox label="Est. Time" value={`${Math.round(debate.proposal.estimatedTimeMs / 1000)}s`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Assumptions:</p>
                    <ul className="space-y-1">
                      {debate.proposal.assumptions.map((assumption, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex gap-2">
                          <span className="text-slate-400 flex-shrink-0">•</span>
                          <span>{assumption}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </PhaseSection>

              {/* Phantom's Review */}
              <PhaseSection
                phase="review"
                title="🔍 Phantom - Red-Teamer"
                subtitle={`Found ${debate.review.concernCount} concerns`}
                expanded={expandedPhase}
                setExpanded={setExpandedPhase}
              >
                <div className="space-y-3">
                  <div className={`px-3 py-2 rounded-lg border ${assessmentColors[debate.review.assessment]}`}>
                    <p className="font-semibold capitalize">Assessment: {debate.review.assessment}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {debate.review.criticalCount > 0 && (
                      <StatBox label="Critical" value={debate.review.criticalCount.toString()} color="red" />
                    )}
                    {debate.review.highCount > 0 && (
                      <StatBox label="High" value={debate.review.highCount.toString()} color="orange" />
                    )}
                    <StatBox label="Total" value={debate.review.concernCount.toString()} color="slate" />
                  </div>

                  {debate.review.concerns.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Concerns:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {debate.review.concerns.slice(0, 5).map((concern, idx) => (
                          <div key={idx} className="text-xs border border-slate-200 rounded p-2 bg-slate-50">
                            <div className="flex items-start gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize flex-shrink-0 ${
                                concern.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                concern.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                concern.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {concern.severity}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-900 mb-0.5">{concern.title}</p>
                            <p className="text-slate-600 mb-1">{concern.description}</p>
                            {concern.suggestion && (
                              <p className="text-slate-500 italic">💡 {concern.suggestion}</p>
                            )}
                          </div>
                        ))}
                        {debate.review.concerns.length > 5 && (
                          <p className="text-xs text-slate-500 text-center py-1">
                            ...and {debate.review.concerns.length - 5} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </PhaseSection>

              {/* Arbiter's Final Plan */}
              <PhaseSection
                phase="plan"
                title="⚖️ Arbiter - Decision Maker"
                subtitle="Final audited plan"
                expanded={expandedPhase}
                setExpanded={setExpandedPhase}
              >
                <div className="space-y-3">
                  <div className={`px-4 py-3 rounded-lg border-2 ${goNoGoColors[debate.finalPlan.goNogo]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {debate.finalPlan.goNogo === 'go' && <CheckCircleIcon className="w-5 h-5" />}
                      {debate.finalPlan.goNogo === 'proceed-with-caution' && <ExclamationCircleIcon className="w-5 h-5" />}
                      {debate.finalPlan.goNogo === 'no-go' && <ShieldExclamationIcon className="w-5 h-5" />}
                      <h4 className="font-bold uppercase tracking-wide">
                        {debate.finalPlan.goNogo === 'go' && 'Go - Plan Approved'}
                        {debate.finalPlan.goNogo === 'proceed-with-caution' && 'Proceed With Caution'}
                        {debate.finalPlan.goNogo === 'no-go' && 'No-Go - Redesign Needed'}
                      </h4>
                    </div>
                    <p className="text-sm">{debate.finalPlan.explanation}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Risk Level" value={debate.finalPlan.riskAssessment} />
                    <StatBox label="Steps" value={debate.finalPlan.stepCount.toString()} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Concerns Addressed" value={debate.finalPlan.addressedConcerns.toString()} />
                    <StatBox label="Remaining Risks" value={debate.finalPlan.remainingRisks.toString()} />
                  </div>

                  {debate.finalPlan.guidance.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">Execution Guidance:</p>
                      <ul className="space-y-1">
                        {debate.finalPlan.guidance.map((guidance, idx) => (
                          <li key={idx} className="text-xs text-slate-600 flex gap-2">
                            <span className="text-amber-500 flex-shrink-0">▪</span>
                            <span>{guidance}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </PhaseSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface PhaseSectionProps {
  phase: 'proposal' | 'review' | 'plan';
  title: string;
  subtitle: string;
  expanded: 'proposal' | 'review' | 'plan' | null;
  setExpanded: (phase: 'proposal' | 'review' | 'plan' | null) => void;
  children: React.ReactNode;
}

function PhaseSection({ phase, title, subtitle, expanded, setExpanded, children }: PhaseSectionProps) {
  const isExpanded = expanded === phase;

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
      <button
        onClick={() => setExpanded(isExpanded ? null : phase)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-100 transition-colors text-left"
      >
        <ChevronRightIcon className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-slate-200 bg-white"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBox({ label, value, color = 'slate' }: { label: string; value: string; color?: string }) {
  const bgColors = {
    slate: 'bg-slate-100 text-slate-900',
    green: 'bg-green-100 text-green-900',
    orange: 'bg-orange-100 text-orange-900',
    red: 'bg-red-100 text-red-900',
  };

  return (
    <div className={`px-3 py-2 rounded-lg ${bgColors[color as keyof typeof bgColors]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

/**
 * Mission Timeline Component
 * 
 * Displays a visual timeline of all mission steps/tasks in progress.
 * OpenClaw-style mission orchestration UI.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';

export interface MissionStep {
  id: string;
  name: string;
  description: string;
  phase: 'triage' | 'planning' | 'execution' | 'validation' | 'completion';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  toolCalls?: string[];
  result?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MissionTimeline {
  missionId: string;
  startTime: number;
  currentPhase: string;
  steps: MissionStep[];
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  finalResult?: string;
  error?: string;
}

interface MissionTimelineProps {
  timeline: MissionTimeline | null;
  isRunning: boolean;
}

const phaseColors: Record<string, string> = {
  triage: 'from-purple-500 to-blue-500',
  planning: 'from-blue-500 to-cyan-500',
  execution: 'from-cyan-500 to-teal-500',
  validation: 'from-teal-500 to-green-500',
  completion: 'from-green-500 to-emerald-500',
};

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircleSolidIcon className="w-5 h-5 text-green-500" />,
  'in-progress': <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />,
  pending: <ClockIcon className="w-5 h-5 text-gray-400" />,
  failed: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
  skipped: <div className="w-5 h-5 text-gray-400">⊘</div>,
};

const MissionTimelineComponent: React.FC<MissionTimelineProps> = ({ timeline, isRunning }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
  const toggleExpand = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  if (!timeline || timeline.totalSteps === 0) {
    return null;
  }

  const progress = (timeline.completedSteps / timeline.totalSteps) * 100;

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg p-6 border border-slate-700 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Mission Timeline</h3>
        </div>
        <div className="text-sm text-gray-400">
          {timeline.completedSteps}/{timeline.totalSteps} completed
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Phase Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Current Phase:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize bg-gradient-to-r ${phaseColors[timeline.currentPhase] || phaseColors.planning} text-white`}>
          {timeline.currentPhase}
        </span>
        {isRunning && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
      </div>

      {/* Steps List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {timeline.steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const Icon = statusIcons[step.status];

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
              >
                {/* Step Header */}
                <button
                  onClick={() => toggleExpand(step.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <div className="flex-shrink-0">{Icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{step.name}</div>
                      <div className="text-xs text-gray-400 truncate">{step.description}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0 -mr-2">
                    {step.duration && (
                      <span className="text-xs text-gray-400">
                        {(step.duration / 1000).toFixed(1)}s
                      </span>
                    )}
                    {step.toolCalls && step.toolCalls.length > 0 && (
                      <span className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded">
                        {step.toolCalls.length} tool{step.toolCalls.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronRightIcon
                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </button>

                {/* Step Details (Expandable) */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-slate-700 bg-slate-900/50 px-4 py-3 text-sm space-y-2"
                  >
                    {/* Phase Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Phase:</span>
                      <span className="capitalize text-xs bg-slate-700 px-2 py-0.5 rounded text-gray-300">
                        {step.phase}
                      </span>
                    </div>

                    {/* Tool Calls */}
                    {step.toolCalls && step.toolCalls.length > 0 && (
                      <div>
                        <div className="text-gray-400 mb-1">Tools Used:</div>
                        <div className="flex flex-wrap gap-1">
                          {step.toolCalls.map((tool, i) => (
                            <span key={i} className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300 font-mono">
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Result Preview */}
                    {step.result && (
                      <div>
                        <div className="text-gray-400 mb-1">Result:</div>
                        <div className="text-xs bg-slate-700 p-2 rounded text-gray-300 max-h-20 overflow-y-auto font-mono break-words">
                          {typeof step.result === 'string'
                            ? step.result.slice(0, 200) + (step.result.length > 200 ? '...' : '')
                            : JSON.stringify(step.result).slice(0, 200) + '...'}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {step.error && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                        <div className="text-xs text-red-300 font-mono">{step.error}</div>
                      </div>
                    )}

                    {/* Timing Info */}
                    {step.startTime && (
                      <div className="text-xs text-gray-500">
                        Started: {new Date(step.startTime).toLocaleTimeString()}
                        {step.endTime && (
                          <> · Duration: {((step.endTime - step.startTime) / 1000).toFixed(2)}s</>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Completion Status */}
      {timeline.isComplete && (
        <div className={`p-3 rounded-lg border text-sm font-medium ${
          timeline.error
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-green-500/10 border-green-500/30 text-green-300'
        }`}>
          {timeline.error ? `❌ Mission Failed: ${timeline.error}` : '✅ Mission Complete!'}
        </div>
      )}
    </div>
  );
};

export default MissionTimelineComponent;

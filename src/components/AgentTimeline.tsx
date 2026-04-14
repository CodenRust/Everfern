"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon, LoaderIcon, BrainIcon } from "lucide-react";
import { LoadingBreadcrumb } from "@/components/ui/animated-loading-svg-text-shimmer";

export interface ToolCallDisplay {
    id: string;
    toolName: string;
    icon?: React.ReactNode;
    label?: string;
    color?: string;
    status: "running" | "done" | "error";
    output?: string;
    durationMs?: number;
    data?: any;
    base64Image?: string;
    args?: Record<string, unknown>;
    displayName?: string;
    description?: string;
    phase?: "triage" | "planning" | "execution" | "validation" | "completion";
}

interface AgentTimelineProps {
    toolCalls: ToolCallDisplay[];
    thought?: string;
    isLive?: boolean;
    showOutput?: boolean;
    currentPhase?: "triage" | "planning" | "execution" | "validation" | "completion";
    currentNode?: string;
    planSteps?: Array<{ id: string; description: string; tool?: string }> | null;
    planTitle?: string | null;
}

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

// Phase colors and indicators for better visual distinction
const phaseColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    triage: { bg: "rgba(139, 92, 246, 0.1)", border: "#8b5cf6", text: "#a855f7", icon: "🔍" },
    planning: { bg: "rgba(59, 130, 246, 0.1)", border: "#3b82f6", text: "#3b82f6", icon: "📋" },
    execution: { bg: "rgba(16, 185, 129, 0.1)", border: "#10b981", text: "#10b981", icon: "⚡" },
    validation: { bg: "rgba(245, 158, 11, 0.1)", border: "#f59e0b", text: "#f59e0b", icon: "✓" },
    completion: { bg: "rgba(34, 197, 94, 0.1)", border: "#22c55e", text: "#22c55e", icon: "🎯" }
};

// Enhanced node display names with phase context
const getEnhancedNodeDisplayName = (nodeName: string, phase?: string): string => {
    const nodeNames: Record<string, string> = {
        // Triage phase nodes
        'intent_classifier': 'Understanding your request',
        'triage': 'Analyzing request complexity',

        // Planning phase nodes
        'global_planner': 'Creating execution plan',
        'planner': 'Compiling execution pipeline',
        'planning': 'Designing approach',

        // Execution phase nodes
        'brain': 'Processing with AI',
        'multi_tool_orchestrator': 'Coordinating tools',
        'execute_tools': 'Running tools',
        'execution': 'Executing plan',

        // Validation phase nodes
        'action_validation': 'Validating actions',
        'judge': 'Evaluating completion',
        'validation': 'Validating results',

        // Completion phase nodes
        'completion': 'Finalizing results',
        'hitl_approval': 'Waiting for approval'
    };

    const displayName = nodeNames[nodeName];
    if (displayName) return displayName;

    // Add phase context to unknown nodes
    if (phase && nodeName) {
        const phasePrefix = phase.charAt(0).toUpperCase() + phase.slice(1);
        return `${phasePrefix}: ${nodeName.replace(/_/g, ' ')}`;
    }

    return nodeName ? `Working on ${nodeName.replace(/_/g, ' ')}` : 'Working';
};

// Phase Indicator Component
const PhaseIndicator = ({ phase, currentNode }: { phase?: string; currentNode?: string }) => {
    if (!phase) return null;

    const phaseInfo = phaseColors[phase];
    if (!phaseInfo) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 mb-3 p-2 rounded-lg"
            style={{
                backgroundColor: phaseInfo.bg,
                border: `1px solid ${phaseInfo.border}20`
            }}
        >
            <span className="text-sm">{phaseInfo.icon}</span>
            <div className="flex-1">
                <div className="text-xs font-medium" style={{ color: phaseInfo.text }}>
                    {phase.charAt(0).toUpperCase() + phase.slice(1)} Phase
                </div>
                {currentNode && (
                    <div className="text-xs opacity-75" style={{ color: phaseInfo.text }}>
                        {getEnhancedNodeDisplayName(currentNode, phase)}
                    </div>
                )}
            </div>
            <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: phaseInfo.border }}
            />
        </motion.div>
    );
};

// Plan Steps Component — shown during planning phase
const PlanSteps = ({ steps, title }: { steps: Array<{ id: string; description: string; tool?: string }>; title?: string | null }) => {
    const [expanded, setExpanded] = React.useState(false);
    if (!steps || steps.length === 0) return null;

    const toolIcon = (tool?: string) => {
        if (!tool) return '▸';
        if (tool.includes('write') || tool.includes('edit')) return '✏️';
        if (tool.includes('read') || tool.includes('find') || tool.includes('grep')) return '🔍';
        if (tool.includes('run') || tool.includes('command') || tool.includes('bash')) return '⚡';
        if (tool.includes('web') || tool.includes('search') || tool.includes('fetch')) return '🌐';
        return '▸';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                margin: '8px 0 12px',
                borderRadius: 10,
                border: '1px solid rgba(59,130,246,0.2)',
                backgroundColor: 'rgba(59,130,246,0.04)',
                overflow: 'hidden'
            }}
        >
            <button
                onClick={() => setExpanded(e => !e)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left'
                }}
            >
                <span style={{ fontSize: 13 }}>📋</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', flex: 1 }}>
                    {title || 'Execution Plan'} <span style={{ fontWeight: 400, color: '#6b7280' }}>({steps.length} steps)</span>
                </span>
                <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDownIcon width={13} height={13} className="text-blue-400" />
                </motion.span>
            </button>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {steps.map((step, idx) => (
                                <div key={step.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 18, paddingTop: 1 }}>{idx + 1}.</span>
                                    <span style={{ fontSize: 12, color: '#374151', flex: 1, lineHeight: 1.5 }}>
                                        {toolIcon(step.tool)} {step.description}
                                    </span>
                                    {step.tool && (
                                        <span style={{
                                            fontSize: 10, color: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)',
                                            padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0
                                        }}>
                                            {step.tool}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};


const ToolRow = ({ tc, isExpanded, onToggle, isFirst, isLast, currentPhase }: {
    tc: ToolCallDisplay;
    isExpanded: boolean;
    onToggle: () => void;
    isFirst: boolean;
    isLast: boolean;
    currentPhase?: string;
}) => {
    const isRunning = tc.status === "running";
    const isError = tc.status === "error";
    const isTerminal = tc.toolName === "run_command" || tc.toolName === "bash";
    const hasOutput = !!tc.output && !isRunning;

    // Use phase-specific colors if available
    const toolPhase = tc.phase || currentPhase;
    const phaseInfo = toolPhase ? phaseColors[toolPhase] : null;

    const statusColor = isRunning
        ? { dot: phaseInfo?.border || "#6b7280", line: "#d1d5db" }
        : isError
            ? { dot: "#ef4444", line: "#fecaca" }
            : isTerminal
                ? { dot: "#6366f1", line: "#c7d2fe" }
                : { dot: phaseInfo?.border || "#22c55e", line: "#bbf7d0" };

    return (
        <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ display: "flex", alignItems: "stretch", gap: 12, position: "relative" }}
        >
            {/* Connection Line & Dot */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
                <div style={{
                    flex: isFirst ? 0 : 1,
                    width: 2,
                    backgroundColor: isFirst ? "transparent" : "#e5e7eb",
                    minHeight: isFirst ? 10 : 0
                }} />

                <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    backgroundColor: statusColor.dot,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    zIndex: 2,
                    boxShadow: isRunning ? `0 0 8px ${statusColor.dot}40` : "none"
                }}>
                    {isRunning && (
                        <motion.div
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            style={{ position: "absolute", width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${statusColor.dot}` }}
                        />
                    )}
                </div>

                <div style={{
                    flex: 1,
                    width: 2,
                    backgroundColor: isLast ? "transparent" : "#e5e7eb"
                }} />
            </div>

            {/* Content Branch */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingTop: 4 }}>
                <div
                    onClick={() => hasOutput && onToggle()}
                    onMouseEnter={(e) => { if (hasOutput) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: '4px 8px',
                        borderRadius: 6,
                        marginLeft: -8,
                        cursor: hasOutput ? "pointer" : "default",
                        userSelect: "none",
                        transition: "background-color 0.15s ease"
                    }}
                >
                    <div style={{ width: 12, height: 1, backgroundColor: "#e5e7eb", marginLeft: -12, zIndex: 1 }} />

                    {/* Phase indicator for tool */}
                    {toolPhase && phaseInfo && (
                        <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                                backgroundColor: phaseInfo.bg,
                                color: phaseInfo.text,
                                border: `1px solid ${phaseInfo.border}30`
                            }}
                        >
                            {phaseInfo.icon}
                        </span>
                    )}

                    <span style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isRunning ? "#111111" : isError ? "#ef4444" : "#4b5563",
                        fontFamily: "'Matter', sans-serif"
                    }}>
                        {tc.label || tc.displayName || tc.toolName}
                    </span>

                    {isRunning && (
                        <LoaderIcon size={12} className="animate-spin text-zinc-400" />
                    )}

                    {tc.durationMs !== undefined && !isRunning && (
                        <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatDuration(tc.durationMs)}
                        </span>
                    )}

                    {hasOutput && (
                        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDownIcon width={12} height={12} className="text-zinc-400" />
                        </motion.span>
                    )}
                </div>

                {tc.description && !isExpanded && (
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 2, marginLeft: 8, opacity: 0.8 }}>
                        {tc.description}
                    </div>
                )}

                <AnimatePresence>
                    {isExpanded && tc.output && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: "hidden" }}
                        >
                            <div style={{
                                marginTop: 8, padding: "12px 16px",
                                backgroundColor: "#fcfbf7", borderRadius: 12,
                                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                                color: "#4a4846", whiteSpace: "pre-wrap", maxHeight: 300, overflowY: "auto",
                                border: "1px solid rgba(0,0,0,0.05)",
                                marginLeft: 8
                            }}>
                                {tc.output}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export const AgentTimeline = ({ toolCalls, thought, isLive, showOutput = true, currentPhase, currentNode, planSteps, planTitle }: AgentTimelineProps) => {
    const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

    const nonWriteToolCalls = useMemo(
        () => toolCalls.filter((tc) => tc.toolName !== "write" && tc.toolName !== "write_file"),
        [toolCalls]
    );

    const toggleTool = (id: string) => {
        setExpandedToolId((prev) => (prev === id ? null : id));
    };

    if (!isLive && nonWriteToolCalls.length === 0 && !thought?.trim() && !currentPhase && !planSteps?.length) return null;

    const runningCount = toolCalls.filter((t) => t.status === "running").length;
    const hasRunning = runningCount > 0 || isLive;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 4 }}
        >
            {/* Phase Indicator */}
            <PhaseIndicator phase={currentPhase} currentNode={currentNode} />

            {/* Plan Steps — shown during/after planning phase */}
            {planSteps && planSteps.length > 0 && (
                <PlanSteps steps={planSteps} title={planTitle} />
            )}

            {thought && (
                <div style={{ padding: '0 8px 8px' }}>
                    {isLive ? (
                        <LoadingBreadcrumb text="Thinking" className="mb-2" />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <BrainIcon width={14} height={14} className="text-zinc-400" />
                            <span style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', fontWeight: 500 }}>
                                Reasoning
                            </span>
                        </div>
                    )}
                    <div style={{ fontSize: 13.5, color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.7, borderLeft: '2px solid #e5e7eb', paddingLeft: 12, marginLeft: 6 }}>
                        {thought}
                        {isLive && (
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                style={{ display: 'inline-block', width: 2, height: '1em', backgroundColor: '#6366f1', marginLeft: 4, verticalAlign: 'text-bottom' }}
                            />
                        )}
                    </div>
                </div>
            )}

            {nonWriteToolCalls.length > 0 && (
                <div style={{ padding: "8px 0 8px 12px" }}>
                    {nonWriteToolCalls.map((tc, idx) => (
                        <ToolRow
                            key={tc.id || idx}
                            tc={tc}
                            isExpanded={expandedToolId === tc.id}
                            onToggle={() => toggleTool(tc.id)}
                            isFirst={idx === 0}
                            isLast={idx === nonWriteToolCalls.length - 1}
                            currentPhase={currentPhase}
                        />
                    ))}
                </div>
            )}

            {hasRunning && nonWriteToolCalls.length === 0 && !currentPhase && (
                <div style={{ padding: "12px 0", textAlign: "center" }}>
                    <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>
                        Initializing...
                    </span>
                </div>
            )}
        </motion.div>
    );
};

export default AgentTimeline;

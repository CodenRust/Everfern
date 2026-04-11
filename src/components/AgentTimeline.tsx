"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDownIcon, LoaderIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BrainIcon } from "lucide-react";

export interface ToolCallDisplay {
    id: string;
    toolName: string;
    icon?: string;
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
}

interface AgentTimelineProps {
    toolCalls: ToolCallDisplay[];
    thought?: string;
    isLive?: boolean;
    showOutput?: boolean;
}

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

const ToolRow = ({ tc, isExpanded, onToggle, isFirst, isLast }: {
    tc: ToolCallDisplay;
    isExpanded: boolean;
    onToggle: () => void;
    isFirst: boolean;
    isLast: boolean;
}) => {
    const isRunning = tc.status === "running";
    const isError = tc.status === "error";
    const isTerminal = tc.toolName === "run_command" || tc.toolName === "bash";
    const hasOutput = !!tc.output && !isRunning;

    const statusColor = isRunning
        ? { dot: "#6b7280", line: "#d1d5db" }
        : isError
            ? { dot: "#ef4444", line: "#fecaca" }
            : isTerminal
                ? { dot: "#6366f1", line: "#c7d2fe" }
                : { dot: "#22c55e", line: "#bbf7d0" };

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
                        <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} Transition={{ duration: 0.2 }}>
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

export const AgentTimeline = ({ toolCalls, thought, isLive, showOutput = true }: AgentTimelineProps) => {
    const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
    const [toolsOpen, setToolsOpen] = useState(true);
    const [reasoningOpen, setReasoningOpen] = useState(isLive);

    const nonWriteToolCalls = useMemo(
        () => toolCalls.filter((tc) => tc.toolName !== "write" && tc.toolName !== "write_file"),
        [toolCalls]
    );

    const toggleTool = (id: string) => {
        setExpandedToolId((prev) => (prev === id ? null : id));
    };

    if (!isLive && nonWriteToolCalls.length === 0 && !thought?.trim()) return null;

    const runningCount = toolCalls.filter((t) => t.status === "running").length;
    const hasRunning = runningCount > 0 || isLive;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 4 }}
        >
            {thought && (
                <div style={{ padding: '0 8px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {isLive ? (
                            <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                {[0, 0.15, 0.3].map((delay, i) => (
                                    <motion.span
                                        key={i}
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1.2, delay, ease: 'easeInOut' }}
                                        style={{ display: 'block', width: 4, height: 4, borderRadius: '50%', backgroundColor: '#9ca3af' }}
                                    />
                                ))}
                            </span>
                        ) : (
                            <BrainIcon width={14} height={14} className="text-zinc-400" />
                        )}
                        <span style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic', fontWeight: 500 }}>
                            {isLive ? 'Thinking...' : 'Reasoning'}
                        </span>
                    </div>
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
                        />
                    ))}
                </div>
            )}

            {hasRunning && nonWriteToolCalls.length === 0 && (
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

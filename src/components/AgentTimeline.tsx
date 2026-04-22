"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    thought?: string; // Individual thought for this step
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
    subAgentProgress?: Map<string, SubAgentProgressEvent[]>;
}

// Import SubAgentProgressEvent type
import type { SubAgentProgressEvent } from "@/app/chat/types";

// Timeline item types
type TimelineItem =
    | { type: "tool"; data: ToolCallDisplay }
    | { type: "thought"; data: { id: string; content: string; isLive?: boolean } }
    | { type: "plan"; data: { steps: Array<{ id: string; description: string; tool?: string }>; title?: string | null } }
    | { type: "subagent-progress"; data: SubAgentProgressEvent };

const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};

// Tool name → human label
const toolLabel = (toolName: string, label?: string, displayName?: string): string => {
    if (label) return label;
    if (displayName) return displayName;
    const map: Record<string, string> = {
        read_file: "Read file",
        write: "Write file",
        write_file: "Write file",
        run_command: "Run command",
        bash: "Run command",
        executePwsh: "Run command",
        web_search: "Web search",
        web_fetch: "Fetch URL",
        grep_search: "Search codebase",
        file_search: "Find file",
        list_directory: "List directory",
        get_diagnostics: "Check diagnostics",
        str_replace: "Edit file",
        create_artifact: "Create artifact",
        memory_save: "Save memory",
        memory_search: "Search memory",
        screenshot: "Take screenshot",
        computer_use: "Computer use",
        ask_user: "Ask user",
        planner: "Plan steps",
        subagent: "Spawn subagent",
    };
    return map[toolName] ?? toolName.replace(/_/g, " ");
};

// Status dot with pulse animation
const StatusDot = ({ status, isLive }: { status: ToolCallDisplay["status"]; isLive?: boolean }) => {
    const isRunning = status === "running" || isLive;
    const color = isRunning ? "#6366f1" : status === "error" ? "#ef4444" : "#22c55e";

    return (
        <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
            <div style={{
                width: 10, height: 10, borderRadius: "50%",
                backgroundColor: color,
                border: "2px solid #faf9f7",
                boxShadow: "0 0 0 1px #e8e6d9",
            }} />
            {isRunning && (
                <motion.div
                    animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                    style={{
                        position: "absolute", inset: -2,
                        borderRadius: "50%",
                        backgroundColor: color,
                    }}
                />
            )}
        </div>
    );
};

// Thought item - appears as a branch off the main timeline
const ThoughtItem = ({ content, isLive, isLast }: { content: string; isLive?: boolean; isLast: boolean }) => {
    return (
        <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
            {/* Main timeline line */}
            <div style={{
                width: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
            }}>
                {/* Vertical line before */}
                <div style={{
                    width: 2,
                    height: 12,
                    backgroundColor: "#e8e6d9",
                }} />

                {/* Branch point */}
                <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#faf9f7",
                    border: "2px solid #e8e6d9",
                    flexShrink: 0,
                    zIndex: 2,
                }} />

                {/* Vertical line after - extends through entire content */}
                {!isLast && (
                    <div style={{
                        position: "absolute",
                        top: 22,
                        bottom: -20,
                        width: 2,
                        backgroundColor: "#e8e6d9",
                    }} />
                )}

                {/* Branch curve */}
                <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    style={{
                        position: "absolute",
                        left: 9,
                        top: 12,
                        pointerEvents: "none",
                    }}
                >
                    <path
                        d="M 0 0 Q 20 0 20 20 L 20 40"
                        stroke="#e8e6d9"
                        strokeWidth="2"
                        fill="none"
                    />
                </svg>
            </div>

            {/* Thought content */}
            <div style={{ flex: 1, paddingLeft: 32, paddingTop: 8, paddingBottom: 20 }}>
                {isLive ? (
                    <LoadingBreadcrumb text="Thinking" className="mb-2" />
                ) : (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        marginBottom: 6,
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="#b5b2aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                            <circle cx="12" cy="12" r="10" />
                        </svg>
                        <span style={{
                            fontSize: 11,
                            color: "#8a8886",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase"
                        }}>
                            Reasoning
                        </span>
                    </div>
                )}
                <div style={{
                    fontSize: 12.5,
                    color: "#4a4846",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.75,
                    borderLeft: "2px solid #e8e6d9",
                    paddingLeft: 12,
                    fontStyle: "italic",
                    backgroundColor: "#faf9f7",
                    padding: "8px 12px",
                    borderRadius: 8,
                    position: 'relative'
                }}>
                    {content}
                    {isLive && (
                        <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            style={{
                                display: "inline-block",
                                width: 2,
                                height: "1.2em",
                                backgroundColor: "#6366f1",
                                marginLeft: 4,
                                verticalAlign: "middle",
                                boxShadow: "0 0 8px rgba(99, 102, 241, 0.4)"
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// Plan item - appears as a branch off the main timeline
const PlanItem = ({
    steps,
    title,
    isLast
}: {
    steps: Array<{ id: string; description: string; tool?: string }>;
    title?: string | null;
    isLast: boolean;
}) => {
    return (
        <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
            {/* Main timeline line */}
            <div style={{
                width: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
            }}>
                {/* Vertical line before */}
                <div style={{
                    width: 2,
                    height: 12,
                    backgroundColor: "#e8e6d9",
                }} />

                {/* Branch point */}
                <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#faf9f7",
                    border: "2px solid #e8e6d9",
                    flexShrink: 0,
                    zIndex: 2,
                }} />

                {/* Vertical line after - extends through entire content */}
                {!isLast && (
                    <div style={{
                        position: "absolute",
                        top: 22,
                        bottom: -20,
                        width: 2,
                        backgroundColor: "#e8e6d9",
                    }} />
                )}

                {/* Branch curve */}
                <svg
                    width="40"
                    height="40"
                    viewBox="0 0 40 40"
                    style={{
                        position: "absolute",
                        left: 9,
                        top: 12,
                        pointerEvents: "none",
                    }}
                >
                    <path
                        d="M 0 0 Q 20 0 20 20 L 20 40"
                        stroke="#e8e6d9"
                        strokeWidth="2"
                        fill="none"
                    />
                </svg>
            </div>

            {/* Plan content */}
            <div style={{ flex: 1, paddingLeft: 32, paddingTop: 8, paddingBottom: 20 }}>
                <div style={{
                    display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="#b5b2aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span style={{
                        fontSize: 11,
                        color: "#8a8886",
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase"
                    }}>
                        {title || "Plan"} · {steps.length} steps
                    </span>
                </div>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    backgroundColor: "#faf9f7",
                    padding: "10px 12px",
                    borderRadius: 8,
                    borderLeft: "2px solid #e8e6d9",
                }}>
                    {steps.map((step, idx) => (
                        <div key={step.id || idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <span style={{
                                fontSize: 10.5, color: "#b5b2aa",
                                fontFamily: "'JetBrains Mono', monospace",
                                minWidth: 18, paddingTop: 1,
                            }}>
                                {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span style={{ fontSize: 12.5, color: "#4a4846", lineHeight: 1.55, flex: 1 }}>
                                {step.description}
                            </span>
                            {step.tool && (
                                <span style={{
                                    fontSize: 10, color: "#6366f1",
                                    backgroundColor: "rgba(99,102,241,0.08)",
                                    padding: "2px 7px", borderRadius: 4,
                                    whiteSpace: "nowrap", flexShrink: 0,
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                    {step.tool}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Sub-agent progress item - displays step-by-step progress for sub-agent executions
const SubAgentProgressItem = ({
    event,
    isLast
}: {
    event: SubAgentProgressEvent;
    isLast: boolean;
}) => {
    const [screenshotExpanded, setScreenshotExpanded] = useState(false);
    const isLive = event.type === 'step' && !event.content;

    // Render based on event type
    if (event.type === 'step') {
        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 0,
                }}>
                    {/* Vertical line before dot */}
                    <div style={{
                        width: 2,
                        height: 8,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Step indicator dot */}
                    {isLive ? (
                        <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: "#6366f1",
                                border: "2px solid #faf9f7",
                                boxShadow: "0 0 0 1px #e8e6d9",
                            }} />
                            <motion.div
                                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                                style={{
                                    position: "absolute", inset: -2,
                                    borderRadius: "50%",
                                    backgroundColor: "#6366f1",
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: "#22c55e",
                            border: "2px solid #faf9f7",
                            boxShadow: "0 0 0 1px #e8e6d9",
                            flexShrink: 0,
                        }} />
                    )}

                    {/* Vertical line after dot */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 18,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}
                </div>

                {/* Step content */}
                <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "2px 0",
                    }}>
                        <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: isLive ? "#6366f1" : "#8a8886",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}>
                            STEP {event.stepNumber}/{event.totalSteps}
                        </span>

                        {isLive && (
                            <motion.div
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                style={{ display: "flex", gap: 3, alignItems: "center" }}
                            >
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                                        style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#6366f1" }}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'reasoning') {
        const isThinking = !event.content || event.content.trim() === '';

        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                }}>
                    {/* Vertical line before */}
                    <div style={{
                        width: 2,
                        height: 12,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Branch point */}
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#faf9f7",
                        border: "2px solid #e8e6d9",
                        flexShrink: 0,
                        zIndex: 2,
                    }} />

                    {/* Vertical line after */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 22,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}

                    {/* Branch curve */}
                    <svg
                        width="40"
                        height="40"
                        viewBox="0 0 40 40"
                        style={{
                            position: "absolute",
                            left: 9,
                            top: 12,
                            pointerEvents: "none",
                        }}
                    >
                        <path
                            d="M 0 0 Q 20 0 20 20 L 20 40"
                            stroke="#e8e6d9"
                            strokeWidth="2"
                            fill="none"
                        />
                    </svg>
                </div>

                {/* Reasoning content */}
                <div style={{ flex: 1, paddingLeft: 32, paddingTop: 8, paddingBottom: 20 }}>
                    {isThinking ? (
                        <LoadingBreadcrumb text="Thinking" className="mb-2" />
                    ) : (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 6,
                            marginBottom: 6,
                        }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                stroke="#b5b2aa" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                            <span style={{
                                fontSize: 11,
                                color: "#8a8886",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase"
                            }}>
                                Reasoning
                            </span>
                        </div>
                    )}
                    {!isThinking && (
                        <div style={{
                            fontSize: 12.5,
                            color: "#4a4846",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.75,
                            borderLeft: "2px solid #e8e6d9",
                            paddingLeft: 12,
                            fontStyle: "italic",
                            backgroundColor: "#faf9f7",
                            padding: "8px 12px",
                            borderRadius: 8,
                        }}>
                            {event.content}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (event.type === 'action' && event.action) {
        // Map action types to icons
        const actionIcons: Record<string, string> = {
            left_click: "🖱️",
            right_click: "🖱️",
            middle_click: "🖱️",
            double_click: "🖱️",
            mouse_move: "🖱️",
            drag: "🖱️",
            type: "⌨️",
            key: "⌨️",
            scroll_up: "📜",
            scroll_down: "📜",
            scroll: "📜",
            wait: "⏱️",
        };

        const icon = actionIcons[event.action.type] || "🖱️";

        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 0,
                }}>
                    {/* Vertical line before dot */}
                    <div style={{
                        width: 2,
                        height: 8,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Action dot */}
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#22c55e",
                        border: "2px solid #faf9f7",
                        boxShadow: "0 0 0 1px #e8e6d9",
                        flexShrink: 0,
                    }} />

                    {/* Vertical line after dot */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 18,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}
                </div>

                {/* Action content */}
                <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "2px 0",
                    }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{
                            fontSize: 12,
                            color: "#4a4846",
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}>
                            Action: {event.action.description}
                        </span>
                    </div>

                    {/* Show action parameters if available */}
                    {event.action.params && Object.keys(event.action.params).length > 0 && (
                        <div style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: "#8a8886",
                            fontFamily: "'JetBrains Mono', monospace",
                            paddingLeft: 24,
                        }}>
                            {Object.entries(event.action.params).map(([key, value]) => (
                                <div key={key}>
                                    {key}: {JSON.stringify(value)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (event.type === 'screenshot' && event.screenshot) {
        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 0,
                }}>
                    {/* Vertical line before dot */}
                    <div style={{
                        width: 2,
                        height: 8,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Screenshot dot */}
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#22c55e",
                        border: "2px solid #faf9f7",
                        boxShadow: "0 0 0 1px #e8e6d9",
                        flexShrink: 0,
                    }} />

                    {/* Vertical line after dot */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 18,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}
                </div>

                {/* Screenshot content */}
                <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                    <div
                        onClick={() => setScreenshotExpanded(!screenshotExpanded)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            userSelect: "none",
                            padding: "2px 0",
                        }}
                    >
                        <span style={{ fontSize: 16 }}>📸</span>
                        <span style={{
                            fontSize: 12,
                            color: "#4a4846",
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}>
                            Screenshot ({event.screenshot.width}x{event.screenshot.height})
                        </span>

                        <motion.svg
                            animate={{ rotate: screenshotExpanded ? 180 : 0 }}
                            transition={{ duration: 0.18 }}
                            width={12} height={12} viewBox="0 0 24 24"
                            fill="none" stroke="#b5b2aa" strokeWidth={2.5}
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ marginLeft: "auto", flexShrink: 0 }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </motion.svg>
                    </div>

                    <AnimatePresence>
                        {screenshotExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: "hidden" }}
                            >
                                <div style={{
                                    marginTop: 10,
                                    maxWidth: 400,
                                    borderRadius: 6,
                                    overflow: "hidden",
                                    border: "1px solid #e8e6d9",
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}>
                                    <img
                                        src={event.screenshot.base64}
                                        alt="Sub-agent screenshot"
                                        style={{
                                            width: "100%",
                                            height: "auto",
                                            display: "block",
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    if (event.type === 'complete') {
        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 0,
                }}>
                    {/* Vertical line before dot */}
                    <div style={{
                        width: 2,
                        height: 8,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Complete dot */}
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#22c55e",
                        border: "2px solid #faf9f7",
                        boxShadow: "0 0 0 1px #e8e6d9",
                        flexShrink: 0,
                    }} />

                    {/* Vertical line after dot */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 18,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}
                </div>

                {/* Complete content */}
                <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "2px 0",
                    }}>
                        <span style={{
                            fontSize: 12,
                            color: "#22c55e",
                            fontWeight: 600,
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}>
                            ✓ Sub-agent completed
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'abort') {
        return (
            <div style={{ display: "flex", gap: 0, position: "relative", paddingBottom: 0 }}>
                {/* Timeline line */}
                <div style={{
                    width: 20,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 0,
                }}>
                    {/* Vertical line before dot */}
                    <div style={{
                        width: 2,
                        height: 8,
                        backgroundColor: "#e8e6d9",
                    }} />

                    {/* Abort dot */}
                    <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        border: "2px solid #faf9f7",
                        boxShadow: "0 0 0 1px #e8e6d9",
                        flexShrink: 0,
                    }} />

                    {/* Vertical line after dot */}
                    {!isLast && (
                        <div style={{
                            position: "absolute",
                            top: 18,
                            bottom: -20,
                            width: 2,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}
                </div>

                {/* Abort content */}
                <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "2px 0",
                    }}>
                        <span style={{
                            fontSize: 12,
                            color: "#ef4444",
                            fontWeight: 600,
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}>
                            ⊗ Aborted by user
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

// Single tool row on the main timeline
const ToolRow = ({
    tc, isExpanded, onToggle, isLast,
}: {
    tc: ToolCallDisplay;
    isExpanded: boolean;
    onToggle: () => void;
    isLast: boolean;
}) => {
    const isRunning = tc.status === "running";
    const isError = tc.status === "error";
    const hasOutput = !!tc.output && !isRunning;
    const name = toolLabel(tc.toolName, tc.label, tc.displayName);

    // Check if this is a terminal command
    const isTerminalCommand = tc.toolName === "run_command" || tc.toolName === "bash" || tc.toolName === "executePwsh";
    const commandPath = tc.args?.cwd as string | undefined;
    const command = tc.args?.command as string | undefined;

    // Check if this is an artifact being created
    const isArtifact = tc.toolName === "create_artifact";
    const artifactContent = tc.args?.content as string | undefined;
    const artifactType = tc.args?.type as string | undefined;
    const artifactTitle = tc.args?.title as string | undefined;

    return (
        <div style={{ display: "flex", gap: 0, paddingBottom: 0, position: "relative" }}>
            {/* Timeline line */}
            <div style={{
                width: 20,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                paddingTop: 0,
            }}>
                {/* Vertical line before dot */}
                <div style={{
                    width: 2,
                    height: 8,
                    backgroundColor: "#e8e6d9",
                }} />

                {/* Status dot */}
                <StatusDot status={tc.status} />

                {/* Vertical line after dot - extends through entire content */}
                {!isLast && (
                    <div style={{
                        position: "absolute",
                        top: 18,
                        bottom: -20,
                        width: 2,
                        backgroundColor: "#e8e6d9",
                    }} />
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingLeft: 12, paddingBottom: 20 }}>
                <div
                    onClick={() => hasOutput && onToggle()}
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        cursor: hasOutput ? "pointer" : "default",
                        userSelect: "none",
                        padding: "2px 0",
                    }}
                >
                    <span style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: isRunning ? "#201e24" : isError ? "#dc2626" : "#4a4846",
                        fontFamily: "'Figtree', system-ui, sans-serif",
                        letterSpacing: "-0.01em",
                    }}>
                        {name}
                    </span>

                    {isRunning && (
                        <motion.div
                            animate={{ opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            style={{ display: "flex", gap: 3, alignItems: "center" }}
                        >
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    animate={{ opacity: [0.3, 1, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                                    style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "#6366f1" }}
                                />
                            ))}
                        </motion.div>
                    )}

                    {tc.durationMs !== undefined && !isRunning && (
                        <span style={{
                            fontSize: 11, color: "#b5b2aa",
                            fontFamily: "'JetBrains Mono', monospace",
                        }}>
                            {formatDuration(tc.durationMs)}
                        </span>
                    )}

                    {hasOutput && (
                        <motion.svg
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.18 }}
                            width={12} height={12} viewBox="0 0 24 24"
                            fill="none" stroke="#b5b2aa" strokeWidth={2.5}
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ marginLeft: "auto", flexShrink: 0 }}
                        >
                            <polyline points="6 9 12 15 18 9" />
                        </motion.svg>
                    )}
                </div>

                {tc.description && !isExpanded && (
                    <div style={{
                        fontSize: 11.5, color: "#8a8886", marginTop: 2,
                        lineHeight: 1.5, fontFamily: "'Figtree', system-ui, sans-serif",
                    }}>
                        {tc.description}
                    </div>
                )}

                {/* Streaming artifact content preview */}
                {isArtifact && isRunning && artifactContent && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            marginTop: 10,
                            padding: "10px 14px",
                            backgroundColor: "#faf9f7",
                            borderRadius: 8,
                            border: "1px solid #e8e6d9",
                            borderLeft: "2px solid #6366f1",
                        }}
                    >
                        {artifactTitle && (
                            <div style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#6366f1",
                                marginBottom: 6,
                                fontFamily: "'Figtree', system-ui, sans-serif",
                            }}>
                                {artifactTitle}
                                {artifactType && (
                                    <span style={{
                                        marginLeft: 8,
                                        fontSize: 10,
                                        fontWeight: 400,
                                        color: "#8a8886",
                                        fontFamily: "'JetBrains Mono', monospace",
                                    }}>
                                        {artifactType}
                                    </span>
                                )}
                            </div>
                        )}
                        <div style={{
                            fontSize: 11.5,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: "#4a4846",
                            whiteSpace: "pre-wrap",
                            maxHeight: 200,
                            overflowY: "auto",
                            lineHeight: 1.6,
                        }}>
                            {artifactContent}
                            <motion.span
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                                style={{
                                    display: "inline-block",
                                    width: 2,
                                    height: "1em",
                                    backgroundColor: "#6366f1",
                                    marginLeft: 2,
                                    verticalAlign: "text-bottom",
                                }}
                            />
                        </div>
                    </motion.div>
                )}

                <AnimatePresence>
                    {isExpanded && tc.output && (() => {
                        const lines = tc.output.split("\n");
                        const MAX = 100;
                        const truncated = lines.length > MAX;
                        const display = truncated
                            ? `[Showing last ${MAX} lines]\n` + lines.slice(-MAX).join("\n")
                            : tc.output;
                        return (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                style={{ overflow: "hidden" }}
                            >
                                {/* Command header for terminal commands */}
                                {isTerminalCommand && (commandPath || command) && (
                                    <div style={{
                                        marginTop: 10,
                                        padding: "8px 12px",
                                        backgroundColor: "#faf9f7",
                                        borderRadius: "8px 8px 0 0",
                                        fontSize: 11,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        color: "#6366f1",
                                        borderLeft: "2px solid #6366f1",
                                        borderRight: "1px solid #e8e6d9",
                                        borderTop: "1px solid #e8e6d9",
                                    }}>
                                        {commandPath && <span style={{ color: "#8a8886" }}>{commandPath} : </span>}
                                        <span style={{ color: "#201e24", fontWeight: 500 }}>{command}</span>
                                    </div>
                                )}

                                <div style={{
                                    marginTop: isTerminalCommand && (commandPath || command) ? 0 : 10,
                                    padding: "10px 14px",
                                    backgroundColor: "#f4f3ef",
                                    borderRadius: isTerminalCommand && (commandPath || command) ? "0 0 8px 8px" : 8,
                                    fontSize: 11.5,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    color: "#4a4846",
                                    whiteSpace: "pre-wrap",
                                    maxHeight: 260,
                                    overflowY: "auto",
                                    border: "1px solid #e8e6d9",
                                    borderTop: isTerminalCommand && (commandPath || command) ? "none" : "1px solid #e8e6d9",
                                    lineHeight: 1.6,
                                }}>
                                    {display}
                                </div>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
        </div>
    );
};

export const AgentTimeline = ({
    toolCalls, thought, isLive, currentNode, planSteps, planTitle, subAgentProgress,
}: AgentTimelineProps) => {
    const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    // Build unified timeline with thoughts interspersed in chronological order
    const timelineItems = useMemo((): TimelineItem[] => {
        const items: TimelineItem[] = [];

        // Filter hidden tools
        const hidden = ["write_file"];
        const visibleTools = toolCalls.filter(tc => !hidden.includes(tc.toolName));

        // Add global thought at the beginning if present
        if (thought && thought.trim()) {
            items.push({
                type: "thought",
                data: { id: "global-thought", content: thought, isLive }
            });
        }

        // Add plan if present
        if (planSteps && planSteps.length > 0) {
            items.push({
                type: "plan",
                data: { steps: planSteps, title: planTitle }
            });
        }

        // Add tools and their individual thoughts in chronological order
        visibleTools.forEach(tc => {
            // Add tool-specific thought before the tool if it exists
            if (tc.thought && tc.thought.trim()) {
                items.push({
                    type: "thought",
                    data: {
                        id: `thought-${tc.id}`,
                        content: tc.thought,
                        isLive: tc.status === "running"
                    }
                });
            }

            // Add the tool
            items.push({
                type: "tool",
                data: tc
            });

            // Add sub-agent progress events for this tool if available
            if (subAgentProgress && subAgentProgress.has(tc.id)) {
                const progressEvents = subAgentProgress.get(tc.id) || [];
                progressEvents.forEach(event => {
                    items.push({
                        type: "subagent-progress",
                        data: event
                    });
                });
            }
        });

        return items;
    }, [toolCalls, thought, isLive, planSteps, planTitle, subAgentProgress]);

    const toggleTool = (id: string) => setExpandedToolId(p => p === id ? null : id);

    const hasContent = timelineItems.length > 0;

    // Don't show timeline if live but no content yet (hide "Initializing..." state)
    if (!hasContent) return null;

    // Count total steps (tools only, not thoughts/plans)
    const totalSteps = timelineItems.filter(item => item.type === "tool").length;

    // Generate header label
    const headerLabel = isLive
        ? currentNode
            ? currentNode.replace(/_/g, " ")
            : "Working"
        : totalSteps > 0
            ? `Completed · ${totalSteps} step${totalSteps !== 1 ? "s" : ""}`
            : "Completed";

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            style={{
                marginBottom: 16,
                fontFamily: "'Figtree', system-ui, sans-serif",
                paddingLeft: 0,
            }}
        >
            {/* Timeline start indicator - clickable header */}
            <button
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: collapsed ? 0 : 12,
                    paddingLeft: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    width: "100%",
                }}
            >
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    {/* Vertical line connecting to timeline */}
                    {!collapsed && hasContent && (
                        <div style={{
                            position: "absolute",
                            top: 10,
                            left: 4,
                            width: 2,
                            height: 12,
                            backgroundColor: "#e8e6d9",
                        }} />
                    )}

                    {isLive ? (
                        <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                backgroundColor: "#6366f1",
                                border: "2px solid #faf9f7",
                                boxShadow: "0 0 0 1px #e8e6d9",
                            }} />
                            <motion.div
                                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                                transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                                style={{
                                    position: "absolute", inset: -2,
                                    borderRadius: "50%", backgroundColor: "#6366f1",
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor: "#22c55e",
                            border: "2px solid #faf9f7",
                            boxShadow: "0 0 0 1px #e8e6d9",
                            flexShrink: 0
                        }} />
                    )}
                </div>

                <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#201e24",
                    letterSpacing: "-0.01em",
                    textTransform: "capitalize",
                    flex: 1,
                    textAlign: "left",
                }}>
                    {headerLabel}
                </span>

                {/* Chevron indicator */}
                <motion.svg
                    animate={{ rotate: collapsed ? -90 : 0 }}
                    transition={{ duration: 0.18 }}
                    width={14} height={14} viewBox="0 0 24 24"
                    fill="none" stroke="#b5b2aa" strokeWidth={2.5}
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                >
                    <polyline points="6 9 12 15 18 9" />
                </motion.svg>
            </button>

            {/* Timeline items - collapsible */}
            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.div
                        key="timeline-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{ paddingLeft: 0 }}>
                            {timelineItems.map((item, idx) => {
                                const isLast = idx === timelineItems.length - 1;

                                if (item.type === "thought") {
                                    return (
                                        <ThoughtItem
                                            key={item.data.id}
                                            content={item.data.content}
                                            isLive={item.data.isLive}
                                            isLast={isLast}
                                        />
                                    );
                                }

                                if (item.type === "plan") {
                                    return (
                                        <PlanItem
                                            key="plan"
                                            steps={item.data.steps}
                                            title={item.data.title}
                                            isLast={isLast}
                                        />
                                    );
                                }

                                if (item.type === "tool") {
                                    return (
                                        <ToolRow
                                            key={item.data.id || idx}
                                            tc={item.data}
                                            isExpanded={expandedToolId === item.data.id}
                                            onToggle={() => toggleTool(item.data.id)}
                                            isLast={isLast}
                                        />
                                    );
                                }

                                if (item.type === "subagent-progress") {
                                    return (
                                        <div
                                            key={`progress-${item.data.toolCallId}-${item.data.timestamp}-${idx}`}
                                            style={{
                                                marginLeft: 20,
                                                backgroundColor: "#faf9f7",
                                                border: "1px solid #e8e6d9",
                                                borderRadius: 8,
                                                padding: 12,
                                                marginBottom: 12,
                                            }}
                                        >
                                            <SubAgentProgressItem
                                                event={item.data}
                                                isLast={isLast}
                                            />
                                        </div>
                                    );
                                }

                                return null;
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default AgentTimeline;

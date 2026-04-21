"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDownIcon,
    XMarkIcon,
    CheckIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    ChevronUpIcon,
    CommandLineIcon,
    Cog6ToothIcon,
    Cog8ToothIcon,
} from "@heroicons/react/24/outline";
import type { ToolCallDisplay } from '../types/index';
import { MarkdownRenderer } from './MarkdownComponents';
import { DiffViewer } from '@/components/diff-viewer';
import { SyntaxHighlighter } from '../ArtifactsPanel';
import { Loader } from '@/components/ui/animated-loading-svg-text-shimmer';

// ── Tool Call Tag Component ──────────────────────────────────────────────────
const ToolCallTag = ({ tc, isLast }: { tc: ToolCallDisplay; isLast?: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    const running = tc.status === 'running';
    const errored = tc.status === 'error';
    const isTerminal = tc.toolName === 'run_command' || tc.toolName === 'bash' || tc.toolName === 'run_terminal';
    const output = tc.output || '';
    const looksLikeTerminal = isTerminal || (output.includes('$ ') && output.includes('\n')) || output.includes('~');

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', gap: 0, position: 'relative' }}
        >
            {/* Timeline dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0, paddingTop: 12 }}>
                <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: looksLikeTerminal ? 'rgba(99,102,241,0.08)' : running ? 'rgba(0,0,0,0.03)' : errored ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
                    border: looksLikeTerminal ? '1.5px solid rgba(99,102,241,0.2)' : running ? '1.5px solid rgba(0,0,0,0.1)' : errored ? '1.5px solid rgba(239,68,68,0.2)' : '1.5px solid rgba(34,197,94,0.2)',
                }}>
                    {running ? (
                        <Loader size={8} strokeWidth={2} className="text-zinc-500" />
                    ) : errored ? (
                        <XMarkIcon width={10} height={10} color="#ef4444" strokeWidth={3} />
                    ) : looksLikeTerminal ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                    ) : (
                        <CheckIcon width={10} height={10} color="#22c55e" strokeWidth={3} />
                    )}
                </div>
                {!isLast && <div style={{ width: 1, flex: 1, minHeight: 12, background: 'rgba(0,0,0,0.06)', marginTop: 4 }} />}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 12 : 8, paddingRight: 12 }}>
                {/* Description (thought/narration above tool) */}
                {tc.description && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6, lineHeight: 1.5, fontStyle: 'italic' }}>
                        {tc.description}
                    </div>
                )}
                {/* Tool header row */}
                <div
                    onClick={() => !running && tc.output && setExpanded(e => !e)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderRadius: 10,
                        background: looksLikeTerminal ? 'rgba(15,23,42,0.04)' : '#f8f8f6',
                        border: looksLikeTerminal ? '1px solid rgba(0,0,0,0.06)' : '1px solid #eceae4',
                        cursor: (!running && tc.output) ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!running && tc.output) { e.currentTarget.style.background = looksLikeTerminal ? 'rgba(15,23,42,0.07)' : '#f2f1ee'; e.currentTarget.style.borderColor = '#d4d1cc'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = looksLikeTerminal ? 'rgba(15,23,42,0.04)' : '#f8f8f6'; e.currentTarget.style.borderColor = '#eceae4'; }}
                >
                    <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{tc.icon}</span>
                    <span style={{ fontSize: 12.5, color: '#4b5563', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: looksLikeTerminal ? "'JetBrains Mono', monospace" : 'inherit' }}>
                        {tc.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {tc.durationMs !== undefined && !running && (
                            <span style={{ fontSize: 10.5, color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace" }}>{(tc.durationMs / 1000).toFixed(1)}s</span>
                        )}
                        {!running && tc.output && tc.toolName !== 'create_plan' && tc.toolName !== 'update_plan_step' && (
                            <ChevronDownIcon width={11} height={11} color="#9ca3af" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        )}
                    </div>
                </div>

                {/* Terminal output - special rendering */}
                <AnimatePresence>
                    {expanded && looksLikeTerminal && tc.output && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden', marginTop: 4 }}
                        >
                            <div style={{
                                background: '#1e1e2e',
                                borderRadius: 10,
                                overflow: 'hidden',
                                border: '1px solid rgba(99,102,241,0.15)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                    <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                                        {isTerminal ? (((tc.args?.CommandLine || tc.args?.command || tc.args?.commandLine || '') as string).split('\n')[0]?.slice(0, 50) || 'Terminal') : 'Terminal'}
                                    </span>
                                </div>
                                <pre style={{
                                    margin: 0, padding: '12px 14px', fontSize: 11.5,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                    lineHeight: 1.7, color: '#e2e8f0', overflowX: 'auto',
                                    whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto'
                                }}>
                                    {tc.output.split('\n').map((line, idx) => {
                                        const isCmd = line.match(/^[\$›#] /) || line.match(/^.+@.+\$ /);
                                        return (
                                            <div key={idx} style={{ color: isCmd ? '#a5b4fc' : '#d1d5db' }}>
                                                {isCmd && <span style={{ color: '#6366f1', marginRight: 8 }}>{'>'}</span>}
                                                {line}
                                            </div>
                                        );
                                    })}
                                </pre>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Standard expanded output (for non-terminal tools) */}
                <AnimatePresence>
                    {expanded && tc.output && !looksLikeTerminal && tc.toolName !== 'create_plan' && tc.toolName !== 'update_plan_step' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden', marginTop: 4 }}
                        >
                            <div style={{ backgroundColor: '#f5f4f0', borderRadius: 10, maxHeight: 400, overflowY: 'auto', border: '1px solid #eceae4', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.02)' }}>
                                {(tc.base64Image || tc.data?.screenshot) && (
                                    <div style={{ padding: 10, borderBottom: '1px solid #eceae4' }}>
                                        <img src={`data:image/jpeg;base64,${tc.base64Image || tc.data?.screenshot}`} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid #e8e6d9' }} />
                                    </div>
                                )}
                                {tc.data?.preClickB64 && (
                                    <div style={{ padding: 10, borderBottom: '1px solid #eceae4' }}>
                                        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, textAlign: 'center', letterSpacing: '0.04em' }}>Click Target</div>
                                        <div style={{ position: 'relative', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e6d9' }}>
                                            <img src={`data:image/png;base64,${tc.data.preClickB64}`} alt="" style={{ width: '100%', display: 'block' }} />
                                            {tc.data.x !== undefined && tc.data.y !== undefined && tc.data.w && tc.data.h && (
                                                <div style={{ position: 'absolute', left: `${(tc.data.x / tc.data.w) * 100}%`, top: `${(tc.data.y / tc.data.h) * 100}%`, width: 18, height: 18, backgroundColor: 'rgba(239,68,68,0.4)', border: '2px solid #e5e5e5', borderRadius: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, pointerEvents: 'none' }} />
                                            )}
                                        </div>
                                    </div>
                                )}
                                {(tc.toolName === 'read' || tc.toolName === 'read_file' || tc.toolName === 'consult_skill' || tc.toolName === 'view_skill' || tc.toolName === 'skill_detected') || tc.output.includes('---') || tc.output.startsWith('#') ? (
                                    <div style={{ padding: '10px 14px', backgroundColor: '#ffffff' }}>
                                        <MarkdownRenderer content={tc.output} />
                                    </div>
                                ) : (
                                    <pre style={{ margin: 0, padding: '10px 14px', fontSize: 11.5, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: 1.7, color: '#6b7280', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                        {tc.output}
                                    </pre>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

// ── ToolCallRow: Individual tool call in the ToolGroup ──────────────────────
const ToolCallRow = ({ tc, isLast }: { tc: ToolCallDisplay, isLast?: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    const isRunning = tc.status === 'running';
    const isError = tc.status === 'error';
    const isTerminal = tc.toolName === 'run_command' || tc.toolName === 'bash' || tc.toolName === 'run_terminal';
    const cmdStr = (tc.args?.command || tc.args?.CommandLine || tc.args?.commandLine) as string | undefined;

    // Enhanced debugging for terminal tools
    if (isTerminal) {
        console.log(`[ToolCallRow] Terminal tool ${tc.toolName}:`, {
            args: tc.args,
            cmdStr,
            output: tc.output,
            status: tc.status,
            hasArgs: !!tc.args,
            hasOutput: !!tc.output
        });
    }

    const isLs = isTerminal && typeof cmdStr === 'string' && cmdStr.trim().startsWith('ls');
    const isRead = tc.toolName === 'read_file' || tc.toolName === 'read' || tc.toolName === 'view_file' || tc.toolName === 'cat';
    const isFind = tc.toolName === 'find_files' || tc.toolName === 'find' || tc.toolName === 'search_docs' || tc.toolName === 'web_search' || tc.toolName === 'search' || tc.toolName === 'grep';

    let iconToDisplay = tc.icon;
    if (!iconToDisplay || (React.isValidElement(iconToDisplay) && (iconToDisplay.type === Cog6ToothIcon || iconToDisplay.type === Cog8ToothIcon))) {
        if (isLs) {
            iconToDisplay = <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>;
        } else if (isRead) {
            iconToDisplay = <DocumentTextIcon width={16} height={16} />;
        } else if (isFind) {
            iconToDisplay = <MagnifyingGlassIcon width={16} height={16} />;
        } else if (isTerminal) {
            iconToDisplay = <CommandLineIcon width={16} height={16} />;
        } else {
            iconToDisplay = <Cog6ToothIcon width={16} height={16} />;
        }
    }

    // Clean up terminal output boilerplate
    let displayOutput = tc.output || '';
    if (isTerminal && displayOutput) {
        displayOutput = displayOutput
            .replace(/in terminal \[.*?\] Session: .*?\n+/ig, '')
            .replace(/\(Terminal session remains active\. You can run more commands in this session\.\)/ig, '')
            .replace(/^>>.*?\n+/gm, '') // Remove the prompt echo lines if they start with >>
            .trim();
    }
    const hasOutput = !!displayOutput && !isRunning;

    // Parse potential search arguments to display as pills
    const queries: string[] = Array.isArray(tc.args?.queries) ? tc.args.queries : (typeof tc.args?.query === 'string' ? [tc.args.query] : []);
    const docs: string[] = Array.isArray(tc.args?.docs) ? tc.args.docs : [];
    const isSearchTool = tc.toolName === 'web_search' || tc.toolName === 'search_docs' || tc.label?.toLowerCase().includes('search');
    const hasSearchPills = isSearchTool && (queries.length > 0 || docs.length > 0);

    // Ensure expanded by default for this specific search demo if it's not running
    useEffect(() => {
        if (hasSearchPills && hasOutput) setExpanded(true);
    }, [hasSearchPills, hasOutput]);

    const statusIcon = isRunning ? (
        <Loader size={14} strokeWidth={2} className="text-emerald-500" />
    ) : isError ? (
        <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
            </svg>
        </div>
    ) : (
        <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
            </svg>
        </div>
    );

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: isLast ? 0 : 24 }}
        >
            {/* Vertical branch line for this segment */}
            {!isLast && (
                <div style={{ position: 'absolute', left: 7, top: 20, bottom: -4, width: 2, backgroundColor: '#e5e7eb', zIndex: 0 }} />
            )}

            <div
                onClick={() => hasOutput && setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: hasOutput ? 'pointer' : 'default',
                    position: 'relative', zIndex: 1
                }}
            >
                {/* Status Icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, backgroundColor: '#ffffff' }}>
                    {statusIcon}
                </div>

                {/* Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280' }}>{iconToDisplay}</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{
                            fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontFamily: "'Matter', sans-serif", fontWeight: 500,
                            color: isError ? '#ef4444' : '#111111',
                            letterSpacing: '-0.01em',
                            display: 'block'
                        }}>
                            {tc.displayName || tc.label || tc.toolName}
                        </span>
                        {/* Show command preview for terminal tools */}
                        {isTerminal && cmdStr && (
                            <div style={{
                                fontSize: 12,
                                color: '#6b7280',
                                fontFamily: "'JetBrains Mono', monospace",
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: 2
                            }}>
                                $ {cmdStr.length > 60 ? cmdStr.substring(0, 57) + '...' : cmdStr}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chevron */}
                {hasOutput && (
                    <motion.span
                        animate={{ rotate: expanded ? 0 : 90 }}
                        style={{ display: 'flex', flexShrink: 0, color: '#9ca3af' }}
                    >
                        <ChevronUpIcon width={14} height={14} strokeWidth={2.5} />
                    </motion.span>
                )}

                {/* Output indicator for terminal tools */}
                {isTerminal && hasOutput && !expanded && (
                    <div style={{
                        fontSize: 11,
                        color: '#10b981',
                        backgroundColor: '#dcfce7',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 500
                    }}>
                        output
                    </div>
                )}
            </div>

            <AnimatePresence>
                {expanded && displayOutput && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{ overflow: 'hidden', paddingLeft: 28, marginTop: 12 }}
                    >
                        {hasSearchPills ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 4 }}>
                                {/* Querying Section */}
                                {queries.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 8, fontFamily: "'Matter', sans-serif" }}>Querying</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {queries.map((q, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 20,
                                                    backgroundColor: '#f3f4f6', border: '1px solid transparent',
                                                    fontSize: 13, color: '#374151', fontWeight: 500,
                                                    fontFamily: "'Matter', sans-serif", transition: 'all 0.15s',
                                                    cursor: 'default'
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                >
                                                    <MagnifyingGlassIcon width={14} height={14} color="#6b7280" strokeWidth={2.5} />
                                                    {q}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Reading Section */}
                                {docs.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 8, fontFamily: "'Matter', sans-serif" }}>Reading</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                            {docs.slice(0, 2).map((d, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    padding: '6px 12px', borderRadius: 20,
                                                    backgroundColor: '#f3f4f6', border: '1px solid transparent',
                                                    fontSize: 13, color: '#374151', fontWeight: 500,
                                                    fontFamily: "'Matter', sans-serif", transition: 'all 0.15s',
                                                    cursor: 'pointer'
                                                }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                                >
                                                    <DocumentTextIcon width={14} height={14} color="#3b82f6" strokeWidth={2} />
                                                    {d}
                                                </div>
                                            ))}
                                            {docs.length > 2 && (
                                                <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, fontFamily: "'Matter', sans-serif", marginLeft: 4, cursor: 'pointer' }}>
                                                    + {docs.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Standard Output rendering */
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: isTerminal ? '#0d0d14' : '#f9fafb',
                                borderRadius: 12,
                                fontSize: 13,
                                lineHeight: 1.6,
                                fontFamily: isTerminal ? "'JetBrains Mono', monospace" : "inherit",
                                color: isTerminal ? '#e2e8f0' : '#4b5563',
                                maxHeight: 400, overflowY: 'auto',
                                border: `1px solid ${isTerminal ? '#1e1e2e' : '#f3f4f6'}`,
                            }}>
                                {isTerminal ? (
                                    <div style={{ whiteSpace: 'pre-wrap' }}>
                                        {/* Show the command that was executed */}
                                        {cmdStr && (
                                            <div style={{
                                                marginBottom: 12,
                                                paddingBottom: 8,
                                                borderBottom: '1px solid #2d2d3a',
                                                color: '#94a3b8',
                                                fontSize: 12
                                            }}>
                                                <span style={{ color: '#64748b' }}>$ </span>
                                                <span style={{ color: '#e2e8f0' }}>{cmdStr}</span>
                                            </div>
                                        )}
                                        {/* Show the output */}
                                        {displayOutput.slice(0, 2000)}
                                        {displayOutput.length > 2000 && <span style={{ color: '#9ca3af' }}>{'\n'}... ({displayOutput.length - 2000} more chars)</span>}
                                    </div>
                                ) : (
                                    <MarkdownRenderer content={displayOutput} />
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
// ── WriteDiffCard: Shows a diff viewer for write/edit tool calls ────────────
const WriteDiffCard = ({ tc }: { tc: ToolCallDisplay }) => {
    const [expanded, setExpanded] = useState(false);
    const filename = (tc.args?.path as string)?.split(/[/\\]/).pop() || 'file';
    const content = (tc.args?.content as string) || '';
    const oldContent = (tc.args?.old_content as string) || '';
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
    const hasDiff = !!oldContent && oldContent !== content;

    return (
        <div style={{
            borderRadius: 12, border: '1px solid #e8e6d9',
            backgroundColor: '#ffffff', overflow: 'hidden', marginBottom: 8,
        }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', cursor: 'pointer',
                    transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafaf8'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <div style={{
                    width: 34, height: 34, borderRadius: 8, border: '1px solid #e8e6d9',
                    backgroundColor: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#9ca3af', flexShrink: 0,
                    fontFamily: 'monospace'
                }}>
                    {ext}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {filename}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                        {hasDiff ? 'edited' : 'created'} · {(content.length / 1024).toFixed(1)} KB
                    </div>
                </div>
                {tc.status === 'done' && (
                    <svg width="14" height="14" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
                <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ display: 'flex', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </motion.span>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{ overflow: 'hidden', borderTop: '1px solid #e8e6d9' }}
                    >
                        <DiffViewer
                            oldFile={hasDiff ? { content: oldContent, name: filename } : { content: '', name: filename }}
                            newFile={{ content, name: filename }}
                            viewMode="unified"
                            showLineNumbers
                            showStats
                            variant="ghost"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export { ToolCallTag, ToolCallRow, WriteDiffCard };

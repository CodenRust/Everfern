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
import type { ToolCallDisplay, LiveToolCall } from '../types/index';
import { MarkdownRenderer } from './MarkdownComponents';
import { FaviconCitation } from './FaviconCitation';
import { DiffViewer } from '@/components/diff-viewer';
import { SyntaxHighlighter } from '../ArtifactsPanel';
import { Loader } from '@/components/ui/animated-loading-svg-text-shimmer';
import { SimpleFileNotification } from './SimpleFileNotification';

// ── Utility Functions ────────────────────────────────────────────────────────
/**
 * Extracts domain from a URL string, removing 'www.' prefix
 * @param url - The URL string to extract domain from
 * @returns The extracted domain without 'www.' prefix, or null if URL is invalid
 */
const extractDomain = (url: string): string | null => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

// ── SearchResult Interfaces ──────────────────────────────────────────────────
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    domain?: string;
    breadcrumbs?: string[];
}

interface SearchResultCardProps {
    result: SearchResult;
    index: number;
}

// ── SearchResultCard Component ───────────────────────────────────────────────
const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, index }) => {
    // Validate URL
    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const domain = result.domain || extractDomain(result.url) || 'Unknown';
    const title = result.title || result.url || 'Untitled Result';
    const hasValidUrl = isValidUrl(result.url);

    return (
        <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                delay: index * 0.05,
                ease: "easeOut"
            }}
            whileHover={{
                y: -1,
                transition: { duration: 0.15 }
            }}
            role="article"
            aria-label="Search result"
            className="group flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-white border border-[#e5e7eb] hover:border-[#c7d2fe] hover:bg-[#f5f3ff] hover:shadow-sm transition-all duration-150 cursor-pointer"
        >
            {hasValidUrl ? (
                <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${title} at ${domain}`}
                    className="flex flex-col gap-1 no-underline"
                    style={{ textDecoration: 'none' }}
                >
                    <SearchResultContent result={result} domain={domain} title={title} />
                </a>
            ) : (
                <div className="flex flex-col gap-1">
                    <SearchResultContent result={result} domain={domain} title={title} />
                </div>
            )}
        </motion.article>
    );
};

// ── SearchResultContent Component ────────────────────────────────────────────
const SearchResultContent: React.FC<{ result: SearchResult; domain: string; title: string }> = ({ result, domain, title }) => {
    return (
        <>
            {/* Domain Header */}
            <div className="flex items-center gap-1.5">
                <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                    alt=""
                    width={14}
                    height={14}
                    className="rounded-sm shrink-0"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <span
                    className="text-[11px] text-[#6b7280] truncate"
                    style={{ fontFamily: "'Matter', sans-serif", letterSpacing: '0.01em' }}
                >
                    {domain}
                </span>
            </div>

            {/* Title Link */}
            <div
                className="text-[14px] font-semibold text-[#1a56db] group-hover:underline leading-snug truncate mt-1"
                style={{ fontFamily: "'Matter', sans-serif", letterSpacing: '-0.01em' }}
            >
                {title}
            </div>

            {/* Snippet */}
            {result.snippet && (
                <div
                    className="text-[12px] text-[#4b5563] leading-relaxed line-clamp-2 md:line-clamp-3 mt-1.5"
                    style={{ fontFamily: "'Matter', sans-serif", lineHeight: '1.5' }}
                >
                    {result.snippet}
                </div>
            )}

            {/* Metadata Row */}
            {result.publishedDate && (
                <div
                    className="text-[11px] text-[#9ca3af] mt-2"
                    style={{ fontFamily: "'Matter', sans-serif", letterSpacing: '0.01em' }}
                >
                    {result.publishedDate}
                </div>
            )}
        </>
    );
};

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
                                    <div className="px-[14px] py-[10px] bg-white">
                                        <MarkdownRenderer content={tc.output} />
                                    </div>
                                ) : (
                                    <pre className="m-0 px-[14px] py-[10px] text-[11.5px] font-mono leading-[1.7] text-[#6b7280] overflow-x-auto whitespace-pre-wrap">
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

    const isLs = isTerminal && typeof cmdStr === 'string' && cmdStr.trim().startsWith('ls');
    const isRead = tc.toolName === 'read_file' || tc.toolName === 'read' || tc.toolName === 'view_file' || tc.toolName === 'cat';
    const isFind = tc.toolName === 'find_files' || tc.toolName === 'find' || tc.toolName === 'search_docs' || tc.toolName === 'web_search' || tc.toolName === 'remote_web_search' || tc.toolName === 'search' || tc.toolName === 'grep';

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
            .replace(/^>>.*?\n+/gm, '')
            .trim();
    }
    const hasOutput = !!displayOutput && !isRunning;

    const queries: string[] = Array.isArray(tc.args?.queries) ? tc.args.queries : (typeof tc.args?.query === 'string' ? [tc.args.query] : []);
    const docs: string[] = Array.isArray(tc.args?.docs) ? tc.args.docs : [];
    const isSearchTool = tc.toolName === 'web_search' || tc.toolName === 'remote_web_search' || tc.toolName === 'search_docs' || tc.label?.toLowerCase().includes('search');
    const hasSearchPills = isSearchTool && (queries.length > 0 || docs.length > 0);

    useEffect(() => {
        if ((hasSearchPills && hasOutput) || (isSearchTool && Array.isArray(tc.data?.results) && tc.data.results.length > 0)) {
            setExpanded(true);
        }
    }, [hasSearchPills, hasOutput, isSearchTool, tc.data?.results]);

    const statusIcon = isRunning ? (
        <Loader size={14} strokeWidth={2} className="text-emerald-500" />
    ) : isError ? (
        <div className="w-4 h-4 rounded-full bg-[#ef4444] flex items-center justify-center z-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
            </svg>
        </div>
    ) : (
        <div className="w-4 h-4 rounded-full bg-[#10b981] flex items-center justify-center z-1">
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
            className={`flex flex-col relative ${isLast ? '' : 'pb-6'}`}
        >
            {/* Vertical branch line */}
            {!isLast && (
                <div className="absolute left-[7px] top-5 bottom-[-4px] w-0.5 bg-[#e5e7eb] z-0" />
            )}

            <div
                onClick={() => hasOutput && setExpanded(!expanded)}
                className={`flex items-center gap-3 relative z-1 ${hasOutput ? 'cursor-pointer' : 'cursor-default'}`}
            >
                {/* Status Icon */}
                <div className="flex items-center justify-center w-4 h-4 bg-white">
                    {statusIcon}
                </div>

                {/* Title */}
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <span className="flex items-center text-[#6b7280]">{iconToDisplay}</span>
                    <div className="flex-1 overflow-hidden">
                        <span className={`text-[15px] overflow-hidden text-ellipsis whitespace-nowrap font-medium tracking-[-0.01em] block ${isError ? 'text-[#ef4444]' : 'text-[#111111]'}`}
                            style={{ fontFamily: "'Matter', sans-serif" }}>
                            {tc.displayName || tc.label || tc.toolName}
                        </span>
                        {isTerminal && cmdStr && (
                            <div className="text-xs text-[#6b7280] font-mono overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">
                                $ {cmdStr.length > 60 ? cmdStr.substring(0, 57) + '...' : cmdStr}
                            </div>
                        )}
                    </div>
                </div>

                {/* Chevron */}
                {hasOutput && (
                    <motion.span
                        animate={{ rotate: expanded ? 0 : 90 }}
                        className="flex shrink-0 text-[#9ca3af]"
                    >
                        <ChevronUpIcon width={14} height={14} strokeWidth={2.5} />
                    </motion.span>
                )}

                {/* Output indicator for terminal tools */}
                {isTerminal && hasOutput && !expanded && (
                    <div className="text-[11px] text-[#10b981] bg-[#dcfce7] px-1.5 py-0.5 rounded font-medium">
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
                        className="overflow-hidden pl-7 mt-3"
                    >
                        {hasSearchPills ? (
                            <div className="flex flex-col gap-4 pb-1">
                                {queries.length > 0 && (
                                    <div>
                                        <div className="text-[13px] text-[#6b7280] font-medium mb-2" style={{ fontFamily: "'Matter', sans-serif" }}>Querying</div>
                                        <div className="flex flex-wrap gap-2">
                                            {queries.map((q, i) => (
                                                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] bg-[#f3f4f6] border border-transparent text-[13px] text-[#374151] font-medium cursor-default transition-all duration-150 hover:bg-[#e5e7eb]"
                                                    style={{ fontFamily: "'Matter', sans-serif" }}>
                                                    <MagnifyingGlassIcon width={14} height={14} color="#6b7280" strokeWidth={2.5} />
                                                    {q}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {docs.length > 0 && (
                                    <div>
                                        <div className="text-[13px] text-[#6b7280] font-medium mb-2" style={{ fontFamily: "'Matter', sans-serif" }}>Reading</div>
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {docs.slice(0, 2).map((d, i) => (
                                                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] bg-[#f3f4f6] border border-transparent text-[13px] text-[#374151] font-medium cursor-pointer transition-all duration-150 hover:bg-[#e5e7eb]"
                                                    style={{ fontFamily: "'Matter', sans-serif" }}>
                                                    <DocumentTextIcon width={14} height={14} color="#3b82f6" strokeWidth={2} />
                                                    {d}
                                                </div>
                                            ))}
                                            {docs.length > 2 && (
                                                <div className="text-[13px] text-[#2563eb] font-semibold ml-1 cursor-pointer" style={{ fontFamily: "'Matter', sans-serif" }}>
                                                    + {docs.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {Array.isArray(tc.data?.results) && tc.data.results.length > 0 && (
                                    <div>
                                        <div className="text-[13px] text-[#6b7280] font-medium mb-3" style={{ fontFamily: "'Matter', sans-serif" }}>
                                            {tc.data.results.length} result{tc.data.results.length !== 1 ? 's' : ''}
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            {(tc.data.results as SearchResult[]).map((result, i) => (
                                                <SearchResultCard key={i} result={result} index={i} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={`px-4 py-3 rounded-xl text-[13px] leading-relaxed max-h-[400px] overflow-y-auto border ${
                                isTerminal
                                    ? 'bg-[#0d0d14] font-mono text-[#e2e8f0] border-[#1e1e2e]'
                                    : 'bg-[#f9fafb] text-[#4b5563] border-[#f3f4f6]'
                            }`}>
                                {isTerminal ? (
                                    <div className="whitespace-pre-wrap">
                                        {cmdStr && (
                                            <div className="mb-3 pb-2 border-b border-[#2d2d3a] text-[#94a3b8] text-xs">
                                                <span className="text-[#64748b]">$ </span>
                                                <span className="text-[#e2e8f0]">{cmdStr}</span>
                                            </div>
                                        )}
                                        {displayOutput.slice(0, 2000)}
                                        {displayOutput.length > 2000 && <span className="text-[#9ca3af]">{'\n'}... ({displayOutput.length - 2000} more chars)</span>}
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


// Optional: Styled Scrollbar for the diff area
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
`;

const WriteDiffCard = ({ tc }: { tc: any }) => {
    const [expanded, setExpanded] = useState(false);

    const path = (tc.args?.path as string) || '';
    const filename = path.split(/[/\\]/).pop() || 'file';
    const content = (tc.args?.content as string) || '';
    const oldContent = (tc.args?.old_content as string) || '';
    const hasDiff = !!oldContent && oldContent !== content;
    const isNew = !hasDiff;

    if (tc.status !== 'done' && tc.status !== 'running') return null;

    return (
        <div className="w-full max-w-3xl">
            <SimpleFileNotification
                filename={filename}
                content={content}
                size={content.length}
                isNew={isNew}
                status={tc.status === 'running' ? 'creating' : tc.status === 'done' ? 'success' : 'error'}
                onViewFile={() => setExpanded(!expanded)}
                onCopyContent={() => navigator.clipboard.writeText(content)}
                onOpenInEditor={() => {
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }}
            />

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                        className="overflow-hidden mt-1"
                    >
                        <div className="rounded-b-2xl border-x border-b border-gray-200 bg-white shadow-sm">
                            {/* Sub-header / Breadcrumbs */}
                            <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[11px] font-mono text-gray-400 truncate max-w-[300px]">
                                        {path || filename}
                                    </span>
                                </div>

                                <button
                                    onClick={() => setExpanded(false)}
                                    className="group p-1 hover:bg-gray-200/50 rounded-md transition-colors"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 group-hover:text-gray-600">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Diff Area */}
                            <div className="p-1 max-h-[500px] overflow-y-auto custom-scrollbar">
                                <div className="rounded-xl overflow-hidden border border-gray-100">
                                    <DiffViewer
                                        oldFile={hasDiff ? { content: oldContent, name: filename } : { content: '', name: filename }}
                                        newFile={{ content, name: filename }}
                                        viewMode="unified"
                                        showLineNumbers
                                        showStats
                                        variant="ghost"
                                    />
                                </div>
                            </div>

                            {/* Footer / Status */}
                            <div className="px-4 py-2 border-t border-gray-50 flex justify-end">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-300">
                                    {hasDiff ? 'Modification' : 'New File'}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        );
    };

// ── ComputerUseResultCard ────────────────────────────────────────────────────
const ComputerUseResultCard = ({ tc }: { tc: ToolCallDisplay }) => {
    if (tc.status !== 'done') return null;

    let tcData: any = tc.data || {};
    if (tc.output) {
        try {
            const parsed = JSON.parse(tc.output);
            if (typeof parsed === 'object' && parsed !== null) tcData = { ...tcData, ...parsed };
        } catch(e) {}
    }

    const outputMatch = tcData.detail || (tc.output && tc.output.includes('Success: ') ? tc.output.split('Success: ')[1] : tc.output || 'Computer action completed successfully.');
    const appName = typeof tcData?.appName === 'string' && tcData.appName.trim() ? tcData.appName : "Application";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 mt-3 mb-3 max-w-[600px]"
            >
                <div className="bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] rounded-xl px-4 py-[14px] flex items-start gap-2.5">
                    <div className="mt-0.5 bg-[#22c55e] rounded w-4 h-4 flex items-center justify-center shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <div className="text-[13.5px] text-[#064e3b] font-medium leading-relaxed wrap-break-word">
                        {outputMatch}
                    </div>
                </div>

                <div className="flex items-center flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-[#4b5563] bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-[20px]">
                        <span className="font-medium">Tool used</span>
                        <div className="flex items-center gap-1 bg-[#22c55e] text-white px-2 py-0.5 rounded-xl text-[11px] font-semibold">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                            {appName}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#4b5563] bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-[20px]">
                        <span>Duration</span>
                        <span className="font-semibold text-[#111827]">{(tc.durationMs ? tc.durationMs / 1000 : 2.3).toFixed(1)}s</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#4b5563] bg-[#f9fafb] border border-[#e5e7eb] px-3 py-1.5 rounded-[20px]">
                        <span>Status</span>
                        <span className="font-semibold text-[#22c55e]">Success</span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── LiveToolCallCard: Shows a tool call being constructed in real-time ──────
export const LiveToolCallCard = ({ toolName, partialArguments, isStreaming }: LiveToolCall) => {
    const displayName = toolName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className={`rounded-xl border overflow-hidden mb-2 ${
                isStreaming
                    ? 'border-indigo-300 shadow-[0_0_0_2px_rgba(99,102,241,0.15)]'
                    : 'border-emerald-300 shadow-[0_0_0_2px_rgba(34,197,94,0.1)]'
            }`}
        >
            <div className={`flex items-center gap-2 px-3 py-2 ${isStreaming ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
                {isStreaming ? (
                    <Loader size={12} strokeWidth={2} className="text-indigo-500 shrink-0" />
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                )}
                <span className={`text-xs font-semibold tracking-wide ${isStreaming ? 'text-indigo-700' : 'text-emerald-700'}`}>
                    {displayName}
                </span>
                {isStreaming && (
                    <span className="ml-auto text-[10px] text-indigo-400 font-medium animate-pulse">
                        building…
                    </span>
                )}
            </div>
            {partialArguments && (
                <pre className="m-0 px-3 py-2 text-[11px] font-mono leading-relaxed text-slate-600 bg-white overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {partialArguments}
                </pre>
            )}
        </motion.div>
    );
};

export { ToolCallTag, ToolCallRow, WriteDiffCard, ComputerUseResultCard, SearchResultCard };

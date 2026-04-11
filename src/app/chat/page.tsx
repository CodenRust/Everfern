"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, memo, KeyboardEvent } from "react";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { resolveToolDisplay } from "./tool-labels";
import { FileExplorerView } from "../components/FileExplorerView";
import {
    PlusIcon,
    Cog6ToothIcon,
    PaperAirplaneIcon,
    ChevronDownIcon,
    XMarkIcon,
    CheckIcon,
    PaperClipIcon,
    StopIcon,
    KeyIcon,
    ArrowDownOnSquareIcon,
    GlobeAltIcon,
    SparklesIcon,
    CpuChipIcon,
    TrashIcon,
    ArrowTopRightOnSquareIcon,
    CheckCircleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    BellIcon,
    UserCircleIcon,
    Bars3CenterLeftIcon,
    SparklesIcon as SparklesIcon2,
    Cog8ToothIcon,
    AcademicCapIcon,
    MagnifyingGlassIcon,
    ChevronUpIcon,
    CommandLineIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon as CheckSolidIcon } from "@heroicons/react/24/solid";
import { AgentTimeline } from "../../components/AgentTimeline";
import StreamView from "../../components/StreamView";
import WindowControls from "../components/WindowControls";
import Sidebar from "../components/Sidebar";
import PermissionDialog from "../components/PermissionDialog";
import ArtifactsPanel, { SyntaxHighlighter } from './ArtifactsPanel';
import ArtifactsList from './ArtifactsList';
import SitePreview from './SitePreview';
import SettingsPage from './SettingsPage';
import DirectoryModal from '../components/DirectoryModal';
import FileArtifact from './FileArtifact';
import VoiceAssistantUI from './VoiceAssistantUI';
import PlanViewerPanel from './PlanViewerPanel';
import { ToolGroupRoot, ToolGroupTrigger, ToolGroupContent } from '@/components/tool-group';
import { ReasoningRoot, ReasoningTrigger, ReasoningContent, ReasoningText } from '@/components/reasoning';
import { DiffViewer } from '@/components/diff-viewer';

// ── Provider Logos ──────────────────────────────────────────────────────────

const OpenAILogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/openai.svg" alt="OpenAI Logo" width={size} height={size} className="invert opacity-90" />
);

const AnthropicLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/claude.svg" alt="Anthropic Logo" width={size} height={size} className="grayscale opacity-90" />
);

const DeepSeekLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/deepseek.svg" alt="DeepSeek Logo" width={size} height={size} className="grayscale opacity-90" />
);

const GeminiLogo = ({ size = 20 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/gemini.svg" alt="Gemini Logo" width={size} height={size} className="grayscale opacity-80" />
);

const NvidiaLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/nvidia.svg" alt="Nvidia Logo" width={size} height={size} className="grayscale opacity-90" />
);

const OllamaLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/ollama.svg" alt="Ollama Logo" width={size} height={size} className="invert opacity-90" />
);

const LMStudioLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/lm-studio.png" alt="LM Studio Logo" width={size} height={size} className="grayscale opacity-80" />
);

const HuggingFaceLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/hf-logo.svg" alt="HuggingFace Logo" width={size} height={size} className="grayscale opacity-90" />
);

const EverFernBglessLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/logos/everfern-withoutbg.png" alt="" width={size} height={size} />
);

// ── Waveform Icon SVG ────────────────────────────────────────────────────────
const WaveformIcon = ({ size = 16, style }: { size?: number; style?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 58 58" style={{ width: size, height: size, ...style }}>
        <rect x="3" y="21" width="10" height="16" rx="5" fill="currentColor" />
        <rect x="16" y="9" width="10" height="40" rx="5" fill="currentColor" />
        <rect x="29" y="3" width="10" height="52" rx="5" fill="currentColor" />
        <rect x="42" y="9" width="10" height="40" rx="5" fill="currentColor" />
        <rect x="55" y="21" width="10" height="16" rx="5" fill="currentColor" />
    </svg>
);

// ── Starburst SVG Component ──────────────────────────────────────────────────
const FernStarburst = ({ size = 40, color = '#e5e5e5', animate = false }: { size?: number; color?: string; animate?: boolean }) => {
    const rays = 12;
    const inner = size * 0.15;
    const outer = size * 0.45;
    const center = size / 2;
    const points: string[] = [];
    for (let i = 0; i < rays * 2; i++) {
        const angle = (Math.PI * 2 * i) / (rays * 2) - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        points.push(`${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`);
    }
    const Wrapper = animate ? motion.div : 'div';
    const animProps = animate ? { animate: { rotate: 360 }, transition: { duration: 8, repeat: Infinity, ease: 'linear' as const } } : {};
    return (
        <Wrapper {...(animProps as any)} style={{ width: size, height: size, display: 'inline-flex' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
                <polygon points={points.join(' ')} fill={color} />
            </svg>
        </Wrapper>
    );
};

// ── Utilities ────────────────────────────────────────────────────────────────
function stripAnsi(str: string) {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function extractFileArtifacts(content: string) {
    if (!content) return { cleanContent: '', artifacts: [] };
    const artifactRegex = /📄 \*\*([^*]+)\*\*\n\s*Path: `([^`]+)`/g;
    const artifacts: { description: string, path: string }[] = [];
    let match;
    while ((match = artifactRegex.exec(content)) !== null) {
        artifacts.push({ description: match[1], path: match[2] });
    }

    let cleanContent = content;
    if (artifacts.length > 0) {
        // Remove entire block if it matches "Files presented to the user:" up to "Task complete."
        const blockRegex = /Files presented to the user:\n\n(?:📄 \*\*[\s\S]*?\*\*\n\s*Path: `[^`]+`\n\n?)+\n*Task complete\./g;
        const replaced = cleanContent.replace(blockRegex, '');
        if (replaced !== cleanContent) {
            cleanContent = replaced;
        } else {
            // Fallback: remove lines one by one
            cleanContent = cleanContent.replace(/Files presented to the user:\n\n/g, '');
            cleanContent = cleanContent.replace(artifactRegex, '');
            cleanContent = cleanContent.replace(/Task complete\./g, '');
        }
    }
    return { cleanContent: cleanContent.trim(), artifacts };
}

// ── Markdown Renderer ────────────────────────────────────────────────────────
const MarkdownRenderer = memo(({ content }: { content: string }) => {
    // Hide raw tool_call tags that the model sometimes leaks into text to prevent fake internal tool UI
    const cleanedContent = content.replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/gi, '');
    const lines = cleanedContent.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const inlineRender = (text: string, parentKey: string | number): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let idx = 0;
        const patterns: [RegExp, (m: RegExpMatchArray, k: string) => React.ReactNode | null][] = [
            // Strip computer:// links (handled by ReportLink/ReportPane)
            [/\[([^\]]*)\]\(computer:\/\/\/[^)]+\)/, () => null],
            [/\*\*(.+?)\*\*/, (m, k) => <strong key={k} style={{ color: '#111111', fontWeight: 600 }}>{m[1]}</strong>],
            [/\*([^*]+)\*/, (m, k) => <em key={k} style={{ color: '#4a4846', fontStyle: 'italic' }}>{m[1]}</em>],
            [/`([^`]+)`/, (m, k) => <code key={k} style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 4, padding: '2px 6px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 13, color: '#111111' }}>{m[1]}</code>],
        ];
        while (remaining.length > 0) {
            let earliest = -1, bestMatch: RegExpMatchArray | null = null, bestRenderer: ((m: RegExpMatchArray, k: string) => React.ReactNode) | null = null;
            for (const [regex, renderer] of patterns) {
                const match = remaining.match(regex);
                if (match && match.index !== undefined) {
                    if (earliest === -1 || match.index < earliest) {
                        earliest = match.index; bestMatch = match; bestRenderer = renderer;
                    }
                }
            }
            if (!bestMatch || bestRenderer === null) { parts.push(remaining); break; }
            if (earliest > 0) parts.push(remaining.slice(0, earliest));
            const rendered = bestRenderer(bestMatch, `inline-${parentKey}-${idx++}`);
            if (rendered !== null) parts.push(rendered);
            remaining = remaining.slice(earliest + bestMatch[0].length);
        }
        return <React.Fragment key={parentKey}>{parts}</React.Fragment>;
    };

    while (i < lines.length) {
        const line = lines[i];
        const blockStartIndex = i;

        if (line.trim().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
            elements.push(
                <div key={`code-${blockStartIndex}`} style={{ margin: '16px 0' }}>
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0, 0, 0, 0.08)', backgroundColor: '#fcfbf7' }}>
                        {lang && (
                            <div style={{ padding: '6px 14px', backgroundColor: '#f4f3ed', fontSize: 11, color: '#717171', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", letterSpacing: '0.05em', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                                {lang}
                            </div>
                        )}
                        <div style={{ padding: '14px 16px', overflowX: 'auto' }}>
                            <SyntaxHighlighter language={lang || 'text'} code={codeLines.join('\n')} />
                        </div>
                    </div>
                </div>
            );
            i++; continue;
        }

        if (line.trim().startsWith('> ')) {
            const bqLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('> ')) { bqLines.push(lines[i].trim().slice(2)); i++; }
            elements.push(
                <blockquote key={`bq-${blockStartIndex}`} style={{ margin: '8px 0', paddingLeft: 14, borderLeft: '3px solid rgba(0, 0, 0, 0.2)', color: '#717171', fontStyle: 'italic' }}>
                    {bqLines.map((l, j) => <div key={j}>{inlineRender(l, j)}</div>)}
                </blockquote>
            );
            continue;
        }

        if (line.includes('|') && lines[i + 1]?.includes('---')) {
            const headers = line.split('|').map(h => h.trim()).filter(Boolean);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].includes('|')) {
                rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
                i++;
            }
            elements.push(
                <div key={`table-${blockStartIndex}`} style={{ overflowX: 'auto', margin: '10px 0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr>{headers.map((h, j) => <th key={j} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.12)', textAlign: 'left', color: '#717171', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{inlineRender(h, j)}</th>)}</tr></thead>
                        <tbody>{rows.map((row, ri) => <tr key={ri} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{row.map((cell, ci) => <td key={ci} style={{ padding: '8px 12px', color: '#4a4846' }}>{inlineRender(cell, ci)}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            );
            continue;
        }

        const h4 = line.match(/^#### (.+)/);
        const h3 = line.match(/^### (.+)/);
        const h2 = line.match(/^## (.+)/);
        const h1 = line.match(/^# (.+)/);
        if (h1) { elements.push(<h1 key={`h1-${blockStartIndex}`} style={{ fontSize: 24, fontWeight: 500, color: '#111111', margin: '14px 0 6px', fontFamily: 'var(--font-serif)' }}>{inlineRender(h1[1], i)}</h1>); i++; continue; }
        if (h2) { elements.push(<h2 key={`h2-${blockStartIndex}`} style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: '12px 0 5px', fontFamily: 'var(--font-serif)' }}>{inlineRender(h2[1], i)}</h2>); i++; continue; }
        if (h3) { elements.push(<h3 key={`h3-${blockStartIndex}`} style={{ fontSize: 16, fontWeight: 600, color: '#4a4846', margin: '10px 0 4px' }}>{inlineRender(h3[1], i)}</h3>); i++; continue; }
        if (h4) { elements.push(<h4 key={`h4-${blockStartIndex}`} style={{ fontSize: 14, fontWeight: 700, color: '#717171', margin: '10px 0 4px', letterSpacing: '0.01em' }}>{inlineRender(h4[1], i)}</h4>); i++; continue; }

        if (line.match(/^[\-\*] /)) {
            const items: string[] = [];
            while (i < lines.length && lines[i].match(/^[\-\*] /)) { items.push(lines[i].slice(2)); i++; }
            elements.push(<ul key={`ul-${blockStartIndex}`} style={{ margin: '6px 0', paddingLeft: 20, color: '#4a4846' }}>{items.map((it, j) => <li key={j} style={{ marginBottom: 3, lineHeight: 1.65 }}>{inlineRender(it, j)}</li>)}</ul>);
            continue;
        }

        if (line.match(/^\d+\. /)) {
            const items: string[] = [];
            while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, '')); i++; }
            elements.push(<ol key={`ol-${blockStartIndex}`} style={{ margin: '6px 0', paddingLeft: 20, color: '#4a4846' }}>{items.map((it, j) => <li key={j} style={{ marginBottom: 3, lineHeight: 1.65 }}>{inlineRender(it, j)}</li>)}</ol>);
            continue;
        }

        if (line.match(/^[-*]{3,}$/)) { elements.push(<hr key={`hr-${blockStartIndex}`} style={{ border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.08)', margin: '12px 0' }} />); i++; continue; }
        if (line.trim() === '') { elements.push(<div key={`empty-${blockStartIndex}`} style={{ height: 8 }} />); i++; continue; }

        elements.push(<p key={`p-${blockStartIndex}`} style={{ margin: '2px 0', lineHeight: 1.7, color: '#111111' }}>{inlineRender(line, i)}</p>);
        i++;
    }

    return <div style={{ fontSize: 15 }}>{elements}</div>;
});

// ── Types ────────────────────────────────────────────────────────────────────
interface ToolCallDisplay {
    id: string;
    toolName: string;
    icon?: React.ReactNode;
    label?: string;
    color?: string;
    status: 'running' | 'done' | 'error';
    output?: string;
    durationMs?: number;
    data?: any;
    base64Image?: string;
    args?: Record<string, unknown>;
    displayName?: string;
    description?: string;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    thought?: string;
    timestamp: Date;
    toolCalls?: ToolCallDisplay[];
    attachments?: FileAttachment[];
}

interface FileAttachment {
    id: string;
    path?: string;
    name: string;
    size: number;
    mimeType: string;
    base64?: string;
    content?: string;
}

interface FolderContext {
    id: string;
    path: string;
    name: string;
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    providerType: string;
    logo: any;
}

// ── Context Token Ring Component ────────────────────────────────────────────
const ContextTokenRing = ({ used, max }: { used: number; max: number }) => {
    const pct = Math.min((used / max) * 100, 100);
    const displayTokens = used >= 1000 ? `${(used / 1000).toFixed(1)}k` : `${used}`;
    const ringColor = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#22c55e';
    const bgColor = 'rgba(0,0,0,0.06)';

    return (
        <div style={{ position: 'relative', width: 32, height: 32, cursor: 'default' }}>
            <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: '#1a1a1a', borderRadius: 8, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 4, opacity: 0, pointerEvents: 'none',
                transition: 'opacity 0.15s ease', whiteSpace: 'nowrap', zIndex: 9999, marginBottom: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }} className="token-ring-tooltip">
                <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', fontFamily: "'Figtree', system-ui, sans-serif" }}>
                    {displayTokens}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280', fontFamily: "'Figtree', system-ui, sans-serif" }}>/</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', fontFamily: "'Figtree', system-ui, sans-serif" }}>
                    {Math.round(max / 1000)}k
                </span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: "'Figtree', system-ui, sans-serif" }}>tokens</span>
            </div>
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="16" cy="16" r="12" fill="none" stroke={bgColor} strokeWidth="3" />
                <circle
                    cx="16" cy="16" r="12"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 12 * pct / 100} ${2 * Math.PI * 12 * (100 - pct) / 100}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
            </svg>
            <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, color: ringColor,
                fontFamily: "'Figtree', system-ui, sans-serif"
            }}>
                {pct.toFixed(0)}%
            </div>
        </div>
    );
};

// ── Tool Call Tag Component ──────────────────────────────────────────────────
const ToolCallTag = ({ tc, isLast }: { tc: ToolCallDisplay; isLast?: boolean }) => {
    const [expanded, setExpanded] = useState(false);
    const running = tc.status === 'running';
    const errored = tc.status === 'error';
    const isTerminal = tc.toolName === 'run_command' || tc.toolName === 'bash' || tc.toolName === 'run_terminal';
    const output = tc.output || '';
    const looksLikeTerminal = isTerminal || (output.includes('$ ') && output.includes('\n')) || output.includes('~\$');

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
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid transparent', borderTopColor: '#717171' }} />
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
                <div
                    onClick={() => !running && tc.output && setExpanded(e => !e)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px', borderRadius: 12,
                        background: '#fcfcfb', border: '1px solid #e8e6d9',
                        cursor: (!running && tc.output) ? 'pointer' : 'default',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!running && tc.output) { e.currentTarget.style.background = '#f5f4f0'; e.currentTarget.style.borderColor = '#dcdad0'; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fcfcfb'; e.currentTarget.style.borderColor = '#e8e6d9'; }}
                >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{tc.icon}</span>
                    <span style={{ fontSize: 13, color: '#201e24', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tc.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {tc.durationMs !== undefined && !running && (
                            <span style={{ fontSize: 11, color: '#8a8886' }}>{(tc.durationMs / 1000).toFixed(1)}s</span>
                        )}
                        {!running && tc.output && tc.toolName !== 'create_plan' && tc.toolName !== 'update_plan_step' && (
                            <ChevronDownIcon width={12} height={12} color="#8a8886" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        )}
                    </div>
                </div>

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
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #e5e7eb', borderTopColor: '#10b981', flexShrink: 0, backgroundColor: '#ffffff' }}
        />
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
                    <span style={{
                        fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: "'Matter', sans-serif", fontWeight: 500,
                        color: isError ? '#ef4444' : '#111111',
                        letterSpacing: '-0.01em'
                    }}>
                        {tc.displayName || tc.label || tc.toolName}
                    </span>
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

// ── Reasoning Block: Collapsible thinking process ─────────────────────────────
const ReasoningBlock = ({ thought, isLive }: { thought: string; isLive?: boolean }) => {
    const [expanded, setExpanded] = useState(true);
    return (
        <div style={{ marginBottom: 20 }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 8 : 0, cursor: 'pointer', padding: '2px 0' }}
            >
                <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        <AcademicCapIcon width={16} height={16} color="#9ca3af" />
                    )}
                </div>
                <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 500, fontFamily: "'Matter', sans-serif", flex: 1 }}>
                    {isLive ? 'Thinking...' : 'Reasoning'}
                </span>
                <motion.span
                    animate={{ rotate: expanded ? 0 : 90 }}
                    style={{ display: 'flex', flexShrink: 0, color: '#9ca3af' }}
                >
                    <ChevronUpIcon width={14} height={14} strokeWidth={2.5} />
                </motion.span>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ fontSize: 13.5, color: '#4b5563', whiteSpace: 'pre-wrap', lineHeight: 1.7, paddingLeft: 26, paddingBottom: 4 }}>
                            {thought}
                            {isLive && (
                                <motion.span
                                    animate={{ opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                    style={{ display: 'inline-block', width: 2, height: '1em', backgroundColor: '#9ca3af', marginLeft: 2, verticalAlign: 'text-bottom' }}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── ToolTimeline: Replaces AgentTimeline ────────────────────────────────────
const ToolTimeline = ({ toolCalls, thought, isLive }: { toolCalls: ToolCallDisplay[]; thought?: string; isLive?: boolean }) => {
    const nonWriteTools = toolCalls.filter(tc =>
        tc.toolName !== 'write' && tc.toolName !== 'write_to_file' && tc.toolName !== 'write_file'
    );
    const anyRunning = toolCalls.some(t => t.status === 'running') || isLive;
    const hasMeaningfulContent = nonWriteTools.length > 0 || !!thought?.trim();

    if (!hasMeaningfulContent) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            style={{
                backgroundColor: '#ffffff',
                border: '1px solid #f3f4f6',
                borderRadius: 16,
                padding: '24px',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
                marginBottom: 12,
                position: 'relative'
            }}
        >
            {/* Reasoning block */}
            {thought && thought.trim() && (
                <ReasoningBlock thought={thought} isLive={isLive} />
            )}

            {/* Tool calls as a connected branch */}
            {nonWriteTools.length > 0 && (
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {nonWriteTools.map((tc, idx) => (
                        <ToolCallRow key={tc.id || idx} tc={tc} isLast={idx === nonWriteTools.length - 1} />
                    ))}
                </div>
            )}
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

// ── StreamingMarkdown: Renders content directly — no RAF animation ───────────
const StreamingMarkdown = ({ content, isLive }: { content: string; isLive?: boolean; isLatest?: boolean }) => {
    return (
        <div style={{ position: 'relative' }}>
            <MarkdownRenderer content={content} />
            {isLive && content && (
                <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6 }}
                    style={{
                        display: 'inline-block', width: 7, height: 15,
                        backgroundColor: '#374151', borderRadius: 2,
                        marginLeft: 2, verticalAlign: 'text-bottom', opacity: 0.7,
                    }}
                />
            )}
        </div>
    );
};

// ── Report Link (inline trigger for report pane) ───────────────────────────────
const ReportLink = ({ content, onOpen }: { content: string; onOpen: (label: string, path: string) => void }) => {
    const computerLinkPattern = /\[([^\]]+)\]\(computer:\/\/\/([^)]+)\)/g;
    const links: Array<{ label: string; path: string }> = [];
    let match;
    while ((match = computerLinkPattern.exec(content)) !== null) {
        links.push({ label: match[1], path: match[2] });
    }

    if (links.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {links.map((link, idx) => (
                <button
                    key={idx}
                    onClick={() => onOpen(link.label, link.path)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '7px 14px', borderRadius: 10,
                        backgroundColor: '#f4f3ef', border: '1px solid #e0ded9',
                        color: '#4a4846', fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        fontFamily: "'Figtree', system-ui, sans-serif"
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#eceae4';
                        e.currentTarget.style.borderColor = '#ccc9c3';
                        e.currentTarget.style.color = '#201e24';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#f4f3ef';
                        e.currentTarget.style.borderColor = '#e0ded9';
                        e.currentTarget.style.color = '#4a4846';
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                    </svg>
                    {link.label}
                </button>
            ))}
        </div>
    );
};

// ── Report Preview Pane ────────────────────────────────────────────────────────
const ReportPane = ({ isOpen, onClose, label, path }: { isOpen: boolean; onClose: () => void; label: string; path: string }) => {
    const isHtml = /\.(html?|htm)$/i.test(path);
    const fileUrl = `file:///${path.replace(/\\/g, '/')}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                    style={{
                        position: 'fixed',
                        top: 12,
                        right: 12,
                        bottom: 12,
                        width: '65vw',
                        maxWidth: 1100,
                        backgroundColor: '#ffffff',
                        border: '1px solid #e8e6d9',
                        borderRadius: 24,
                        boxShadow: '-10px 0 40px rgba(0,0,0,0.08), 0 10px 30px rgba(0,0,0,0.03)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '20px 28px', borderBottom: '1px solid #f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf9f7' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                            <div>
                                <h2 style={{ fontSize: 17, fontWeight: 600, color: '#201e24', margin: 0 }}>{label}</h2>
                                <p style={{ fontSize: 12, color: '#8a8886', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>{path.split(/[/\\]/).pop()}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => window.open(fileUrl, '_blank')}
                                style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #e0ded9', backgroundColor: 'transparent', color: '#4a4846', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f4f3ef'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                Open in Browser
                            </button>
                            <button
                                onClick={onClose}
                                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'transparent', border: '1px solid #e0ded9', color: '#8a8886', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f4f3ef'; e.currentTarget.style.color = '#201e24'; }}
                                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8886'; }}
                            >
                                <XMarkIcon width={18} height={18} />
                            </button>
                        </div>
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#fafaf8' }}>
                        {isHtml ? (
                            <iframe
                                src={fileUrl}
                                title={label}
                                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                                sandbox="allow-same-origin allow-scripts"
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
                                <div style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#f4f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a8886" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 15, fontWeight: 600, color: '#201e24', margin: '0 0 4px' }}>Preview not available</p>
                                    <p style={{ fontSize: 13, color: '#8a8886', margin: 0 }}>Open in browser to view this file</p>
                                </div>
                                <button
                                    onClick={() => window.open(fileUrl, '_blank')}
                                    style={{ padding: '10px 22px', borderRadius: 10, border: 'none', backgroundColor: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Open in Browser
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};


// ── Plan Approval Banner ────────────────────────────────────────────────────
const PlanApprovalBanner = () => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.05) 100%)',
        border: '1px solid rgba(34,197,94,0.25)',
        marginBottom: 8
    }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
        </div>
        <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Plan Approved</div>
            <div style={{ fontSize: 14, color: '#15803d', lineHeight: 1.5 }}>I have reviewed and approved your execution plan. Please proceed with the execution as planned.</div>
        </div>
    </div>
);
// ── Reasoning Branch Component ─────────────────────────────────────────────────
// Replace the existing ReasoningBranch with this version.
const ReasoningBranch = ({ thought, isLive }: { thought?: string; isLive?: boolean }) => {
    const [expanded, setExpanded] = useState(false); // collapsed by default like Claude

    if (!thought?.trim()) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ marginBottom: 14 }}
        >
            {/* Toggle row */}
            <motion.button
                onClick={() => setExpanded(e => !e)}
                whileHover={{ opacity: 0.8 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 8px', color: '#8a8886',
                }}
            >
                {isLive ? (
                    // Animated dots — identical rhythm to Claude
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                        {[0, 0.15, 0.3].map((delay, i) => (
                            <motion.span
                                key={i}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ repeat: Infinity, duration: 1.2, delay, ease: 'easeInOut' }}
                                style={{ display: 'block', width: 5, height: 5, borderRadius: '50%', backgroundColor: '#9ca3af' }}
                            />
                        ))}
                    </span>
                ) : (
                    // Static icon when done — the chat bubble from the created SVG style
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                )}

                <span style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                    {isLive ? 'Thinking…' : 'Thought for a moment'}
                </span>

                <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{ display: 'flex', marginLeft: 2 }}
                >
                    <ChevronDownIcon width={12} height={12} color="#9ca3af" />
                </motion.span>
            </motion.button>

            {/* Expanded thought content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{
                            borderLeft: '2px solid #e5e7eb',
                            paddingLeft: 16,
                            marginLeft: 2,
                            marginBottom: 12,
                        }}>
                            <div style={{
                                fontSize: 13.5,
                                lineHeight: 1.75,
                                color: '#9ca3af',
                                fontStyle: 'italic',
                                whiteSpace: 'pre-wrap',
                            }}>
                                {/* Shimmer overlay when live */}
                                {isLive && (
                                    <style>{`
                                        @keyframes thoughtShimmer {
                                            0% { background-position: -400px 0; }
                                            100% { background-position: 400px 0; }
                                        }
                                    `}</style>
                                )}
                                <MarkdownRenderer content={thought} />
                                {isLive && (
                                    <motion.span
                                        animate={{ opacity: [1, 0] }}
                                        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                                        style={{ display: 'inline-block', width: 2, height: '1em', backgroundColor: '#9ca3af', marginLeft: 2, verticalAlign: 'text-bottom' }}
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};
// ── ReasoningPane — Agent Activity side panel ────────────────────────────────
// Replace the existing ReasoningPane with this version.
// Uses the inline SVG progress circles and context grid from the created icons.

// ── Inline SVG: progress circles (3-step) ───────────────────────────────────
const ProgressStepsIcon = ({ done = 0 }: { done?: number }) => {
    // done = how many of 3 circles are filled with a check
    const circles = [0, 1, 2];
    return (
        <svg width="38" height="12" viewBox="0 0 38 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            {circles.map((i) => {
                const cx = i === 0 ? 6 : i === 1 ? 19 : 32;
                const filled = i < done;
                return (
                    <g key={i}>
                        {/* dash connector */}
                        {i > 0 && (
                            <line
                                x1={i === 1 ? 12 : 25} y1="6"
                                x2={i === 1 ? 13 : 26} y2="6"
                                stroke={filled ? 'currentColor' : '#d1d5db'}
                                strokeWidth="1.5"
                                strokeDasharray="2 1.5"
                                strokeLinecap="round"
                            />
                        )}
                        <circle
                            cx={cx} cy="6" r="5"
                            fill={filled ? 'currentColor' : 'none'}
                            stroke={filled ? 'none' : '#d1d5db'}
                            strokeWidth="1.5"
                            opacity={filled ? 0.8 : 1}
                        />
                        {filled && (
                            <path
                                d={`M${cx - 2.5} 6 L${cx - 0.5} 8 L${cx + 2.5} 4`}
                                stroke="white"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

// ── Inline SVG: context thumbnail grid ──────────────────────────────────────
const ContextGridIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    </svg>
);

// ── Section wrapper ──────────────────────────────────────────────────────────
const PaneSection = ({
    icon, label, badge, children, defaultOpen = true,
}: {
    icon: React.ReactNode;
    label: string;
    badge?: number;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: 4 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
                }}
            >
                <span style={{ color: '#a1a1aa', display: 'flex', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1, textAlign: 'left' }}>
                    {label}
                </span>
                {badge !== undefined && (
                    <span style={{ fontSize: 10, color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{badge}</span>
                )}
                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{ display: 'flex', color: '#9ca3af' }}
                >
                    <ChevronDownIcon width={13} height={13} color="currentColor" />
                </motion.span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ paddingBottom: 16 }}>{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Main ReasoningPane ───────────────────────────────────────────────────────
const ReasoningPane = ({
    isOpen, onClose, thought, toolCalls, isLive,
    intent, confidence, context, progress,
}: {
    isOpen: boolean;
    onClose: () => void;
    thought?: string;
    toolCalls: ToolCallDisplay[];
    isLive: boolean;
    intent?: string;
    confidence?: number;
    context?: { completedSteps: string[]; pendingSteps: string[]; filesModified: string[] };
    progress?: { current: number; total: number };
}) => {
    const doneCount = progress
        ? Math.round((progress.current / progress.total) * 3)
        : toolCalls.filter(t => t.status === 'done').length > 0
            ? Math.min(toolCalls.filter(t => t.status === 'done').length, 2)
            : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                    style={{
                        position: 'fixed', top: 52, right: 0, bottom: 0, width: 340,
                        backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb',
                        zIndex: 100, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        boxShadow: '-6px 0 24px rgba(0,0,0,0.04)',
                    }}
                >
                    {/* ── Header ── */}
                    <div style={{
                        padding: '16px 20px 14px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        {/* Progress icon — updates as tools complete */}
                        <div style={{ color: isLive ? '#6366f1' : '#6b7280', display: 'flex', flexShrink: 0 }}>
                            <ProgressStepsIcon done={doneCount} />
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Agent Activity</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {isLive ? (
                                    <>
                                        <motion.span
                                            animate={{ opacity: [1, 0.3, 1] }}
                                            transition={{ repeat: Infinity, duration: 1.4 }}
                                            style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }}
                                        />
                                        Processing
                                    </>
                                ) : (
                                    <>
                                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                                            <circle cx="4" cy="4" r="3.5" stroke="#22c55e" strokeWidth="1" />
                                            <path d="M2 4L3.5 5.5L6 2.5" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Completed
                                    </>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                width: 26, height: 26, borderRadius: 7, border: '1px solid #e5e7eb',
                                backgroundColor: 'transparent', color: '#9ca3af', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                        >
                            <XMarkIcon width={13} height={13} />
                        </button>
                    </div>

                    {/* ── Body ── */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

                        {/* Intent pill */}
                        {intent && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '4px 10px', borderRadius: 99,
                                    backgroundColor: 'rgba(99,102,241,0.08)',
                                    border: '1px solid rgba(99,102,241,0.18)',
                                }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>{intent}</span>
                                    {confidence !== undefined && (
                                        <span style={{ fontSize: 11, color: '#a5b4fc' }}>{Math.round(confidence * 100)}%</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Thought / Reasoning */}
                        <PaneSection
                            icon={
                                isLive ? (
                                    <span style={{ display: 'flex', gap: 3 }}>
                                        {[0, 0.15, 0.3].map((delay, i) => (
                                            <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay }}
                                                style={{ display: 'block', width: 4, height: 4, borderRadius: '50%', backgroundColor: '#9ca3af' }} />
                                        ))}
                                    </span>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                )
                            }
                            label="Reasoning"
                        >
                            {thought ? (
                                <div style={{
                                    fontSize: 12.5, lineHeight: 1.75, color: '#9ca3af',
                                    fontStyle: 'italic',
                                    borderLeft: '2px solid #e5e7eb',
                                    paddingLeft: 12,
                                    maxHeight: 220, overflowY: 'auto',
                                }}>
                                    <MarkdownRenderer content={thought} />
                                    {isLive && (
                                        <motion.span
                                            animate={{ opacity: [1, 0] }}
                                            transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                                            style={{ display: 'inline-block', width: 2, height: '0.9em', backgroundColor: '#9ca3af', marginLeft: 2, verticalAlign: 'text-bottom' }}
                                        />
                                    )}
                                </div>
                            ) : (
                                <span style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>
                                    Waiting for model to reason…
                                </span>
                            )}
                        </PaneSection>

                        {/* Progress bar */}
                        {progress && (
                            <PaneSection
                                icon={<ProgressStepsIcon done={doneCount} />}
                                label="Progress"
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 12, color: '#6b7280' }}>Step {progress.current} of {progress.total}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{Math.round((progress.current / progress.total) * 100)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: 3, borderRadius: 99, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            style={{ height: '100%', borderRadius: 99, backgroundColor: '#22c55e' }}
                                        />
                                    </div>
                                </div>
                            </PaneSection>
                        )}

                        {/* Tools — the timeline */}
                        <PaneSection
                            icon={
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                </svg>
                            }
                            label="Tools"
                            badge={toolCalls.length}
                        >
                            {toolCalls.length === 0 ? (
                                <span style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>No tools called yet</span>
                            ) : (
                                <div style={{ borderLeft: '2px solid #e5e7eb', marginLeft: 4, paddingLeft: 14, display: 'flex', flexDirection: 'column' }}>
                                    {toolCalls.map((tc, idx) => (
                                        <motion.div
                                            key={tc.id || idx}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                            style={{ position: 'relative', paddingBottom: idx < toolCalls.length - 1 ? 10 : 0 }}
                                        >
                                            {/* Rail dot */}
                                            <div style={{
                                                position: 'absolute', left: -20, top: 8,
                                                width: 8, height: 8, borderRadius: '50%',
                                                backgroundColor:
                                                    tc.status === 'running' ? '#f3f4f6'
                                                        : tc.status === 'error' ? 'rgba(239,68,68,0.15)'
                                                            : 'rgba(34,197,94,0.15)',
                                                border:
                                                    tc.status === 'running' ? '1.5px solid #d1d5db'
                                                        : tc.status === 'error' ? '1.5px solid rgba(239,68,68,0.4)'
                                                            : '1.5px solid rgba(34,197,94,0.4)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {tc.status === 'running' ? (
                                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                                        style={{ width: 4, height: 4, borderRadius: '50%', border: '1px solid transparent', borderTopColor: '#9ca3af' }} />
                                                ) : tc.status === 'error' ? (
                                                    <XMarkIcon width={5} height={5} color="#ef4444" strokeWidth={3} />
                                                ) : (
                                                    <svg width="5" height="5" viewBox="0 0 8 8" fill="none">
                                                        <path d="M1.5 4L3 5.5L6.5 2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 12, lineHeight: 1 }}>{tc.icon}</span>
                                                <span style={{ fontSize: 12, color: tc.status === 'running' ? '#9ca3af' : '#374151', fontStyle: tc.status === 'running' ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                    {tc.label || tc.toolName}
                                                </span>
                                                {tc.durationMs !== undefined && (
                                                    <span style={{ fontSize: 10.5, color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                                                        {(tc.durationMs / 1000).toFixed(1)}s
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </PaneSection>

                        {/* Context */}
                        {context && (
                            <PaneSection
                                icon={<ContextGridIcon />}
                                label="Context"
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {context.completedSteps.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Completed</div>
                                            {context.completedSteps.map((step, i) => (
                                                <div key={i} style={{ fontSize: 12, color: '#22c55e', marginBottom: 3, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                                                        <circle cx="5" cy="5" r="4.5" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
                                                        <path d="M3 5L4.5 6.5L7 3.5" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                    <span style={{ color: '#374151' }}>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {context.pendingSteps.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Pending</div>
                                            {context.pendingSteps.map((step, i) => (
                                                <div key={i} style={{ fontSize: 12, color: '#9ca3af', marginBottom: 3, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #d1d5db', flexShrink: 0, marginTop: 2 }} />
                                                    <span>{step}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {context.filesModified.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Files</div>
                                            {context.filesModified.map((file, i) => (
                                                <div key={i} style={{ fontSize: 11, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>{file}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </PaneSection>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
// ── ThinkingBlock ────────────────────────────────────────────────────────────
// @deprecated - use ToolTimeline instead
const ThinkingBlock = ({ toolCalls, thought, isLive }: { toolCalls: ToolCallDisplay[]; thought?: string; isLive?: boolean }) => {
    return null;
}



// ── TimelineStep — one row inside ThinkingBlock ──────────────────────────────
// Extracted to keep ThinkingBlock readable. Replaces ToolCallTag inline usage.
// @deprecated - use ToolCallRow instead
const TimelineStep = ({
    tc, isLast, isFirst, running, errored, looksLikeTerminal
}: {
    tc: ToolCallDisplay;
    isLast: boolean;
    isFirst: boolean;
    running: boolean;
    errored: boolean;
    looksLikeTerminal: boolean;
}) => {
    return null;
}


// ── Agent Workspace Cards ────────────────────────────────────────────────────
const AgentWorkspaceCards = ({ plan, contextItems, setTooltip }: { plan: any | null; contextItems: any[]; setTooltip: (ts: any) => void }) => {
    const [progressExpanded, setProgressExpanded] = useState(true);
    const [contextExpanded, setContextExpanded] = useState(true);

    if (!plan && contextItems.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {plan && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", backgroundColor: "transparent" }}>
                    <div onClick={() => setProgressExpanded(!progressExpanded)} style={{ padding: "8px 0px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "#201e24" }}>Progress</span>
                        <ChevronDownIcon width={16} height={16} color="#8a8886" style={{ transform: progressExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>
                    <AnimatePresence>
                        {progressExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 12, paddingBottom: 16 }}>
                                    {plan.steps?.map((step: any, index: number) => {
                                        const isDone = step.status === 'done';
                                        const isInProgress = step.status === 'in_progress';
                                        return (
                                            <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                                {isDone ? (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <CheckIcon width={14} height={14} color="#16a34a" strokeWidth={3} />
                                                    </div>
                                                ) : isInProgress ? (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, border: "2.5px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <span style={{ fontSize: 13, color: "#111111", fontWeight: 700 }}>{index + 1}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f4f4f4", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <span style={{ fontSize: 12, color: "#8a8886", fontWeight: 500 }}>{index + 1}</span>
                                                    </div>
                                                )}
                                                <span style={{ fontSize: 14, fontWeight: isInProgress ? 500 : 400, color: isDone ? "#201e24" : isInProgress ? "#201e24" : "#8a8886", lineHeight: 1.5, marginTop: 4 }}>
                                                    {step.description}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {contextItems.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 16, overflow: "hidden" }}>
                    <div onClick={() => setContextExpanded(!contextExpanded)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: contextExpanded ? "1px solid #e8e6d9" : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#201e24", textTransform: "uppercase", letterSpacing: "0.03em" }}>Active Context</span>
                        <ChevronDownIcon width={14} height={14} color="#8a8886" style={{ transform: contextExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>
                    <AnimatePresence>
                        {contextExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 16px 16px" }}>
                                    {contextItems.map((item, idx) => {
                                        const isFolder = item.label.startsWith("Folder:");
                                        return (
                                            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f5f4f0", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                    {isFolder || item.type === 'file' ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                                    ) : item.type === 'web' ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1-4-10z"></path></svg>
                                                    ) : (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                                                    <span
                                                        onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content: item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '') })}
                                                        onMouseMove={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content: item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '') })}
                                                        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, content: "" })}
                                                        style={{ fontSize: 14, fontWeight: 400, color: "#A0A0A0", lineHeight: 1.5, marginTop: 4, wordBreak: "break-all", cursor: "default" }}
                                                    >
                                                        <span style={{ color: "#F0F0F0", fontWeight: 500 }}>{isFolder ? "Folder:" : item.type === "web" ? "URL:" : "File:"}</span> {item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '').split(/[/\\]/).pop()}
                                                    </span>
                                                    {item.base64Image && (
                                                        <div style={{ marginTop: 2, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                                                            <img src={`data:image/jpeg;base64,${item.base64Image}`} alt="vision context" style={{ width: "100%", display: "block" }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
};

// ── Plan Review Card ─────────────────────────────────────────────────────────
const PlanReviewCard = ({ plan, onApprove, onEdit }: { plan: { content: string; chatId: string }; onApprove: (content: string) => void; onEdit: () => void }) => {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.98, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{ marginTop: '12px', marginBottom: '24px', padding: '24px', backgroundColor: 'rgba(251, 191, 36, 0.04)', border: '1px solid rgba(251, 191, 36, 0.15)', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}
        >
            <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'radial-gradient(circle at top right, rgba(251, 191, 36, 0.12), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <DocumentTextIcon width={24} height={24} color="#fbbf24" />
                </div>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>Execution Plan Ready</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa' }}>Review the proposed steps before I proceed</div>
                </div>
            </div>
            <div style={{ backgroundColor: '#131312', border: '1px solid #2b2a29', borderRadius: 16, padding: '20px 24px', maxHeight: 350, overflowY: 'auto', WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)' }}>
                <MarkdownRenderer content={plan.content} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
                <button onClick={onEdit} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #363534', backgroundColor: 'transparent', color: '#a1a1aa', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}>
                    View in Artifacts
                </button>
                <button onClick={() => onApprove(plan.content)} style={{ padding: '10px 26px', borderRadius: 12, border: 'none', backgroundColor: '#fbbf24', color: '#1a1a1a', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(251, 191, 36, 0.2)', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(251, 191, 36, 0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(251, 191, 36, 0.2)'; }}>
                    <CheckCircleIcon width={18} height={18} />
                    Approve & Execute
                </button>
            </div>
        </motion.div>
    );
};

// ── Voice Button (shared between both composers) ─────────────────────────────
const VoiceButton = ({ isRecording, voiceProvider, voiceDeepgramKey, voiceElevenlabsKey, onClick }: {
    isRecording: boolean;
    voiceProvider: string | null;
    voiceDeepgramKey: string;
    voiceElevenlabsKey: string;
    onClick: () => void;
}) => {
    const hasVoice = !!(voiceProvider && (voiceDeepgramKey || voiceElevenlabsKey));
    return (
        <button
            type="button"
            onClick={onClick}
            title={isRecording ? "Stop recording" : hasVoice ? "Voice mode" : "Configure voice in settings"}
            style={{
                width: 32, height: 32, borderRadius: 10,
                background: isRecording ? "rgba(239, 68, 68, 0.15)" : "rgba(113, 113, 113, 0.08)",
                border: isRecording ? "1px solid #ef4444" : hasVoice ? "1px solid #c4c2be" : "1px solid #e8e6d9",
                color: isRecording ? "#ef4444" : hasVoice ? "#555" : "#aaa",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
            }}
            onMouseEnter={e => {
                if (!isRecording) {
                    e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.07)";
                    e.currentTarget.style.borderColor = "#a1a1aa";
                    e.currentTarget.style.color = "#333";
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = isRecording ? "rgba(239,68,68,0.15)" : "rgba(113,113,113,0.08)";
                e.currentTarget.style.borderColor = isRecording ? "#ef4444" : hasVoice ? "#c4c2be" : "#e8e6d9";
                e.currentTarget.style.color = isRecording ? "#ef4444" : hasVoice ? "#555" : "#aaa";
            }}
        >
            <WaveformIcon size={15} style={{ animation: isRecording ? "pulse 1s infinite" : "none" }} />
        </button>
    );
};

// ── Rate Limit Continue Button (helps user recover from 429 errors) ──────────
const RateLimitContinueButton = ({ content, onContinue }: { content: string; onContinue: () => void }) => {
    if (!content.includes('Rate Limit Reached') && !content.includes('429')) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 5 }} 
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 16, padding: '16px', backgroundColor: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <SparklesIcon width={18} height={18} color="#fbbf24" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#201e24' }}>Ready to resume?</div>
            </div>
            <button
                onClick={onContinue}
                style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: 12,
                    backgroundColor: '#fbbf24',
                    border: 'none',
                    color: '#1a1a1a',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 191, 36, 0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.2)'; }}
            >
                <PaperAirplaneIcon width={16} height={16} style={{ transform: 'rotate(-45deg)', marginTop: -2 }} />
                Continue Mission
            </button>
        </motion.div>
    );
};

// ── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const [folderContexts, setFolderContexts] = useState<FolderContext[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [folderHover, setFolderHover] = useState(false);
    const [tooltipState, setTooltipState] = useState<{ visible: boolean; x: number; y: number; content: string }>({ visible: false, x: 0, y: 0, content: "" });
    const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
    const [showArtifacts, setShowArtifacts] = useState(false);
    const [selectedArtifactName, setSelectedArtifactName] = useState<string | null>(null);
    const [showPlanViewer, setShowPlanViewer] = useState(false);
    const [planViewerContent, setPlanViewerContent] = useState("");
    const [fileViewerPane, setFileViewerPane] = useState<{ toolId: string; filename: string; content: string; tab: 'code' | 'preview' } | null>(null);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState("everfern-1");
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showDirectoryModal, setShowDirectoryModal] = useState(false);
    const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [randomGreeting, setRandomGreeting] = useState("");
    const [currentSites, setCurrentSites] = useState<any[]>([]);
    const [settingsMotionBlur, setSettingsMotionBlur] = useState(true);

    const loadingMessages = ["marinating...", "schlepping...", "concocting...", "honking..."];
    const greetingMessages = [
        "What do you want to do, {name}?",
        "Ready to build, {name}?",
        "Back at it, {name}?"
    ];

    useEffect(() => {
        if (isLoading) {
            setLoadingMsgIdx(0);
            const interval = setInterval(() => {
                setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [isLoading]);

    // Inject CSS for token ring tooltip hover
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .token-ring-tooltip { opacity: 0 !important; transition: opacity 0.15s ease !important; }
            div:hover > .token-ring-tooltip { opacity: 1 !important; }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    const [config, setConfig] = useState<any>(null);
    const [settingsEngine, setSettingsEngine] = useState<"online" | "local" | "everfern" | null>("everfern");
    const [settingsProvider, setSettingsProvider] = useState<string | null>(null);
    const [settingsApiKey, setSettingsApiKey] = useState("");
    const [settingsCustomModel, setSettingsCustomModel] = useState("");
    const [currentPlan, setCurrentPlan] = useState<any | null>(null);
    const [executionPlan, setExecutionPlan] = useState<{ title?: string; content: string } | null>(null);
    const [isExecutionPlanPaneOpen, setIsExecutionPlanPaneOpen] = useState<boolean>(true);
    const [reportPane, setReportPane] = useState<{ label: string; path: string } | null>(null);
    const [contextItems, setContextItems] = useState<{ id: string; type: 'file' | 'web' | 'app'; label: string; base64Image?: string }[]>([]);
    const [isValidatingModel, setIsValidatingModel] = useState(false);
    const [modelValidationStatus, setModelValidationStatus] = useState<"none" | "success" | "error">("none");
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState<"name" | "vlm">("name");
    const [onboardingName, setOnboardingName] = useState("");
    const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
    const [modelInstalled, setModelInstalled] = useState<boolean | null>(null);
    const [ollamaLogs, setOllamaLogs] = useState<string[]>([]);
    const [isInstallingOllama, setIsInstallingOllama] = useState(false);
    const [ollamaInstallDone, setOllamaInstallDone] = useState(false);
    const [ollamaInstallPct, setOllamaInstallPct] = useState(0);
    const [ollamaInstallPhase, setOllamaInstallPhase] = useState<"downloading" | "finalizing" | "done">("downloading");
    const [isPullingModel, setIsPullingModel] = useState(false);
    const [pullPct, setPullPct] = useState(0);
    const [isComputerUseActive, setIsComputerUseActive] = useState(false);
    const [computerUseStep, setComputerUseStep] = useState("");
    const [liveToolCalls, setLiveToolCalls] = useState<ToolCallDisplay[]>([]);
    const [streamingContent, setStreamingContent] = useState("");
    const [streamingThought, setStreamingThought] = useState("");
    const [modelCallInfo, setModelCallInfo] = useState<{ model: string; toolsCount: number } | null>(null);

    // Settings
    const [settingsShowuiUrl, setSettingsShowuiUrl] = useState("http://127.0.0.1:7860");
    const [settingsVlmMode, setSettingsVlmMode] = useState<"local" | "cloud">("local");
    const [settingsVlmCloudProvider, setSettingsVlmCloudProvider] = useState("ollama");
    const [settingsVlmCloudModel, setSettingsVlmCloudModel] = useState("qwen3-vl:235b-instruct-cloud");
    const [settingsVlmCloudUrl, setSettingsVlmCloudUrl] = useState("https://ollama.com");
    const [settingsVlmCloudKey, setSettingsVlmCloudKey] = useState("");

    // Voice state
    const [voiceProvider, setVoiceProvider] = useState<"deepgram" | "elevenlabs" | null>(null);
    const [voiceDeepgramKey, setVoiceDeepgramKey] = useState("");
    const [voiceElevenlabsKey, setVoiceElevenlabsKey] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [voicePlayback, setVoicePlayback] = useState(false);
    const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
    const [voiceVoiceId, setVoiceVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
    const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

    // Permission state
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [permissionsGranted, setPermissionsGranted] = useState(false);

    // Plan card state
    const [activePlan, setActivePlan] = useState<{ content: string; chatId: string } | null>(null);

    // JSON Viewer state
    const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
    const [lastEventJson, setLastEventJson] = useState<string>("");
    const [lastEventType, setLastEventType] = useState<string>("");
    const [contextTokens, setContextTokens] = useState<{ used: number; max: number }>({ used: 0, max: 128000 });

    const liveToolCallsRef = useRef<ToolCallDisplay[]>([]);
    const streamingContentRef = useRef("");
    const streamingThoughtRef = useRef("");
    const toolCallMap = useRef<Map<string, string>>(new Map());
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
    const hasReceivedUsageData = useRef(false);
    const isMessageCommittedRef = useRef(false);
    const isHandlingPlanRef = useRef(false);

    const isEmpty = messages.length === 0;
    const displayName = (config?.userName || onboardingName || "there").toString();

    useEffect(() => {
        if (displayName) {
            const nameStr = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            const msg = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
            setRandomGreeting(msg.replace("{name}", nameStr));
        } else {
            const msg = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
            setRandomGreeting(msg.replace(", {name}", ""));
        }
    }, [displayName]);

    // Update context tokens based on messages (fallback when no real usage data)
    useEffect(() => {
        if (messages.length === 0) {
            setContextTokens({ used: 0, max: 128000 });
            return;
        }

        // Skip if we've already received real usage data from the API
        if (hasReceivedUsageData.current) {
            return;
        }

        // Rough token estimation: ~4 chars per token
        const estimateTokens = (text: string) => Math.ceil(text.length / 4);

        let totalChars = 0;
        for (const msg of messages) {
            if (msg.content) {
                totalChars += estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            }
            if (msg.thought) {
                totalChars += estimateTokens(msg.thought);
            }
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    totalChars += estimateTokens(JSON.stringify(tc.args || {}));
                    if (tc.output) {
                        totalChars += estimateTokens(tc.output);
                    }
                }
            }
        }

        // Add input value to estimate
        const inputChars = estimateTokens(inputValue);
        totalChars += inputChars;

        // Add overhead for message format (~10% overhead)
        const totalTokens = Math.ceil(totalChars * 1.1);

        setContextTokens({ used: totalTokens, max: 128000 });
    }, [messages, inputValue]);

    useEffect(() => {
        if (!settingsMotionBlur) return;
        let ticking = false;
        const handleMouseMove = (e: MouseEvent) => {
            if (!ticking) {
                window.requestAnimationFrame(() => { setMousePos({ x: e.clientX, y: e.clientY }); ticking = false; });
                ticking = true;
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [settingsMotionBlur]);

    useEffect(() => {
        const loadInitialData = async () => {
            if ((window as any).electronAPI?.loadConfig) {
                const res = await (window as any).electronAPI.loadConfig();
                if (res.success && res.config) {
                    setConfig(res.config);
                    if (res.config.model) setSelectedModel(res.config.model);
                    if (res.config.motionBlur !== undefined) setSettingsMotionBlur(res.config.motionBlur);
                    if (res.config.voice) {
                        setVoiceProvider(res.config.voice.provider || null);
                        setVoiceDeepgramKey(res.config.voice.deepgramKey || "");
                        setVoiceElevenlabsKey(res.config.voice.elevenlabsKey || "");
                    }
                    if (!res.config.userName) setShowOnboarding(true);
                } else {
                    setShowOnboarding(true);
                }
            }
        };
        loadInitialData();
    }, []);

    const fetchModels = useCallback(async () => {
        if ((window as any).electronAPI?.acp?.listModels) {
            const res = await (window as any).electronAPI.acp.listModels();
            if (res.success && res.models) {
                const formatted = res.models.map((m: any) => ({
                    id: m.id, name: m.name, provider: m.provider, providerType: m.providerType,
                    logo: (m.providerType === 'ollama' || m.providerType === 'local') ? OllamaLogo : m.providerType === 'openai' ? OpenAILogo : m.providerType === 'anthropic' ? AnthropicLogo : m.providerType === 'deepseek' ? DeepSeekLogo : m.providerType === 'nvidia' ? NvidiaLogo : (m.providerType === 'gemini' || m.providerType === 'google') ? GeminiLogo : m.providerType === 'lmstudio' ? LMStudioLogo : m.providerType === 'everfern' ? EverFernBglessLogo : null
                }));
                const finalModels = (formatted.length > 0 ? formatted : [
                    { id: "everfern-1", name: "Fern-1", provider: "EverFern", providerType: "everfern", logo: EverFernBglessLogo },
                    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", providerType: "openai", logo: OpenAILogo },
                    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", providerType: "anthropic", logo: AnthropicLogo },
                    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "Google Gemini", providerType: "gemini", logo: GeminiLogo },
                    { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google Gemini", providerType: "gemini", logo: GeminiLogo },
                    { id: "google/gemma-4-31b-it", name: "Gemma 4 31B IT", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                    { id: "nvidia/llama-nemotron-32b-instruct", name: "Nemotron 32B", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                    { id: "mistralai/mistral-nemo-12b-instruct", name: "Mistral Nemo 12B", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                ]).filter((m: any) => m.id !== 'qwen3-vl:2b');
                setAvailableModels(finalModels);
                setSelectedModel(prev => {
                    const validIds = finalModels.filter((m: ModelOption) => !m.id.endsWith('-error') && !m.id.endsWith('-empty')).map((m: ModelOption) => m.id);
                    if (!validIds.includes(prev)) return validIds[0] ?? prev;
                    return prev;
                });
            }
        }
    }, [config]);

    useEffect(() => { if (config) fetchModels(); }, [config, fetchModels]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showModelSelector && config) { fetchModels(); interval = setInterval(fetchModels, 3000); }
        return () => { if (interval) clearInterval(interval); };
    }, [showModelSelector, config, fetchModels]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => { if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) setShowModelSelector(false); };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
    }, [inputValue]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    useEffect(() => {
        if (showSettings && config) {
            setSettingsEngine(config.engine || "everfern");
            setSettingsProvider(config.provider || null);
            setSettingsApiKey(config.keys?.[config.provider || ""] || config.apiKey || "");
            setSettingsCustomModel(config.customModel || "z-ai/glm5");
            setModelValidationStatus("none");
            setSettingsShowuiUrl(config.showuiUrl || "http://127.0.0.1:7860");
            setSettingsVlmMode(config.vlm?.engine === "cloud" ? "cloud" : "local");
            setSettingsVlmCloudProvider(config.vlm?.engine === "cloud" ? (config.vlm.provider || "ollama") : "ollama");
            setSettingsVlmCloudModel(config.vlm?.engine === "cloud" ? (config.vlm.model || "qwen3-vl:235b-instruct-cloud") : "qwen3-vl:235b-instruct-cloud");
            setSettingsVlmCloudUrl(config.vlm?.engine === "cloud" ? (config.vlm.baseUrl || "https://ollama.com") : "https://ollama.com");
            setSettingsVlmCloudKey(config.vlm?.engine === "cloud" ? (config.keys?.[`vlm-${config.vlm.provider || 'ollama'}`] || config.vlm.apiKey || "") : "");
        }
    }, [showSettings]);

    useEffect(() => {
        if (settingsProvider && config) setSettingsApiKey(config.keys?.[settingsProvider] || "");
    }, [settingsProvider, config]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
            if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
            if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
        };
    }, []);

    // JSON Viewer keyboard shortcut (Ctrl+Shift+J)
    useEffect(() => {
        const handleKeyDown = (e: Event) => {
            const ke = e as unknown as KeyboardEvent<HTMLDivElement>;
            if ((ke.metaKey || ke.ctrlKey) && ke.shiftKey && ke.key === "J") {
                ke.preventDefault();
                handleShowJsonViewer();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Listen for acp:show-json-viewer event from main process
    useEffect(() => {
        const handleShowJsonViewerEvent = async () => {
            handleShowJsonViewer();
        };
        window.addEventListener("acp:show-json-viewer", handleShowJsonViewerEvent as EventListener);
        return () => window.removeEventListener("acp:show-json-viewer", handleShowJsonViewerEvent as EventListener);
    }, []);

    const handleShowJsonViewer = async () => {
        try {
            // Try to get full chat history first, fall back to last event
            const chatHistory = await (window as any).electronAPI?.debug?.getChatHistory();
            if (chatHistory) {
                setLastEventJson(JSON.stringify(chatHistory, null, 2));
                setLastEventType(chatHistory.type || "chat_history");
                setIsJsonViewerOpen(true);
            } else {
                const lastEvent = await (window as any).electronAPI?.debug?.getLastEvent();
                if (lastEvent) {
                    setLastEventJson(JSON.stringify(lastEvent, null, 2));
                    setLastEventType(lastEvent.type || "unknown");
                    setIsJsonViewerOpen(true);
                }
            }
        } catch (err) {
            console.error("Failed to get JSON:", err);
        }
    };

    const handleAttachment = async (type?: 'image' | 'document') => {
        if ((window as any).electronAPI?.system?.openFilePicker) {
            let options = {};
            if (type === 'image') options = { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'webp', 'gif', 'jpeg'] }] };
            else if (type === 'document') options = { filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv', 'docx'] }] };
            const file = await (window as any).electronAPI.system.openFilePicker(options);
            if (file && file.success) {
                const newAttachment: FileAttachment = { id: crypto.randomUUID(), name: file.name, size: file.size || 0, mimeType: file.mimeType || 'application/octet-stream', base64: file.base64, content: file.content, path: file.path };
                setAttachments(prev => [...prev, newAttachment]);
            }
        }
    };

    const handleAddContextFolder = async () => {
        const picker = (window as any).electronAPI?.system?.openFolderPicker;
        if (!picker) return;
        const folder = await picker();
        if (folder && folder.success && folder.path) {
            setFolderContexts(prev => { if (prev.some(f => f.path === folder.path)) return prev; return [...prev, { id: crypto.randomUUID(), path: folder.path, name: folder.name || folder.path }]; });
            setContextItems(prev => { const label = `Folder: ${folder.path}`; if (prev.some(i => i.label === label)) return prev; return [...prev, { id: crypto.randomUUID(), type: 'file', label }]; });
        }
    };

    const checkForPlan = useCallback(async (chatId: string) => {
        const api = (window as any).electronAPI;
        if (!api?.plans?.read) return;
        try {
            const planContent = await api.plans.read(chatId, 'execution_plan.md');
            if (planContent) setActivePlan({ content: planContent, chatId });
            else setActivePlan(null);
        } catch (e) { console.error("Failed to check for plan", e); }
    }, []);

    const checkForSites = useCallback(async (chatId: string) => {
        const api = (window as any).electronAPI;
        if (!api?.sites?.list) return;
        try {
            const results = await api.sites.list(chatId);
            // Filter sites to only include those belonging to the current chat
            const chatSites = (results || []).filter((s: any) => s.chatId === chatId);
            setCurrentSites(chatSites);
        }
        catch (e) { console.error("Failed to check for sites:", e); }
    }, []);

    const handleApprovePlan = useCallback(async (content: string) => {
        if (!activeConversationId) return;
        const api = (window as any).electronAPI;
        setActivePlan(null);
        setIsExecutionPlanPaneOpen(false);
        try { await api.plans.delete(activeConversationId, 'execution_plan.md'); } catch (e) { console.error("Failed to delete plan", e); }
        const approvalMsg = `[PLAN_APPROVED]\nI have reviewed and approved your execution plan. Please proceed with the execution as planned.`;

        // Clear ANY previous pending message that might be duplicated
        // Filter out any assistant messages that were part of pending execution plan flow
        const cleanMessages = messages.filter(m => {
            if (m.role !== 'assistant') return true;
            const content = typeof m.content === 'string' ? m.content : '';
            return !content.includes('[PLAN_APPROVED]') && !content.includes('execution plan');
        });

        // Create a user message
        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: approvalMsg,
            timestamp: new Date(),
        };

        // Add only clean messages + new approval message
        const newMessages = [...cleanMessages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setLiveToolCalls([]);
        setStreamingContent("");
        setStreamingThought("");
        hasReceivedUsageData.current = false;
        isMessageCommittedRef.current = false;
        isHandlingPlanRef.current = false;
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";

        const currentM = availableModels.find(m => m.id === selectedModel) || availableModels[0];

        (async () => {
            const acpApi = (window as any).electronAPI?.acp;
            if (!acpApi?.stream) return;

            acpApi.removeStreamListeners();
            acpApi.onAgentPermissionRequest(() => {
                const soundUrl = acpApi?.getPermissionSoundUrl?.();
                if (soundUrl) {
                    try {
                        const audio = new Audio(soundUrl);
                        audio.volume = 0.7;
                        audio.play().catch(e => console.log('[Audio] Could not play permission sound:', e));
                    } catch (e) { console.log('[Audio] Error:', e); }
                }
                setShowPermissionModal(true);
            });
            acpApi.onToolStart(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
                const display = resolveToolDisplay(toolName, toolArgs);
                const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName, ...display, status: 'running', args: toolArgs };
                liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                setLiveToolCalls([...liveToolCallsRef.current]);
            });
            acpApi.onToolCall((record: any) => {
                const existingIdx = liveToolCallsRef.current.findIndex(t => t.toolName === record.toolName && t.status === 'running');
                if (existingIdx >= 0) {
                    const updated = [...liveToolCallsRef.current];
                    updated[existingIdx] = { ...updated[existingIdx], status: 'done' as const, output: typeof record.result === 'string' ? record.result : JSON.stringify(record.result) };
                    liveToolCallsRef.current = updated;
                    setLiveToolCalls(updated);
                }
            });
            acpApi.onThought(({ content }: { content: string }) => { streamingThoughtRef.current += content; setStreamingThought(streamingThoughtRef.current); });
            acpApi.onUsage(({ totalTokens }: { promptTokens: number; completionTokens: number; totalTokens: number }) => { hasReceivedUsageData.current = true; setContextTokens({ used: totalTokens, max: 128000 }); });

            acpApi.onStreamChunk(({ delta, done }: { delta: string; done: boolean }) => {
                if (isMessageCommittedRef.current) return;
                if (!done) {
                    if (delta) {
                        streamingContentRef.current += delta;
                        setStreamingContent(streamingContentRef.current);
                    }
                } else {
                    acpApi.removeStreamListeners();
                    isMessageCommittedRef.current = true;
                    setLiveToolCalls(prevTools => {
                        const finalToolCalls = prevTools.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t);
                        const assistantMsg: Message = {
                            id: crypto.randomUUID(),
                            role: "assistant",
                            content: streamingContentRef.current || "Done.",
                            thought: streamingThoughtRef.current,
                            timestamp: new Date(),
                            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined
                        };
                        setMessages(prev => {
                            const final = [...prev, assistantMsg];
                            saveConversation(final);
                            return final;
                        });
                        setStreamingContent("");
                        setStreamingThought("");
                        setIsLoading(false);
                        return [];
                    });
                }
            });

            try {
                await acpApi.stream({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    model: currentM?.id,
                    providerType: currentM?.providerType,
                    conversationId: activeConversationId,
                });
            } catch (err) { console.error("Stream error:", err); }
            finally { setIsLoading(false); }
        })();
    }, [activeConversationId, messages, selectedModel, availableModels]);

    const saveConversation = useCallback(async (msgs: Message[]) => {
        if (msgs.length === 0) return;
        const id = activeConversationId || crypto.randomUUID();
        if (!activeConversationId) setActiveConversationId(id);
        const conversation = { id, title: msgs[0].content.slice(0, 60) + (msgs[0].content.length > 60 ? "..." : ""), messages: msgs.map(m => ({ id: m.id || crypto.randomUUID(), role: m.role, content: m.content, thought: m.thought, toolCalls: m.toolCalls ? m.toolCalls.map(({ icon, ...rest }) => rest) : undefined })), provider: config?.provider || "everfern", createdAt: msgs[0].timestamp.toISOString(), updatedAt: new Date().toISOString() };
        if ((window as any).electronAPI?.history?.save) await (window as any).electronAPI.history.save(conversation);
    }, [activeConversationId, config?.provider]);

    const handlePlayVoiceResponse = useCallback(async (text: string) => {
        if (!voiceOutputEnabled || !voiceProvider || !voiceElevenlabsKey) return;
        try {
            setVoicePlayback(true);
            if (voiceProvider === "elevenlabs") {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceVoiceId}?optimize_streaming_latency=0`, { method: 'POST', headers: { 'xi-api-key': voiceElevenlabsKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) });
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    if (!audioPlaybackRef.current) audioPlaybackRef.current = new Audio();
                    const audio = audioPlaybackRef.current;
                    audio.src = audioUrl;
                    audio.onended = () => { setVoicePlayback(false); URL.revokeObjectURL(audioUrl); };
                    audio.onerror = () => { setVoicePlayback(false); URL.revokeObjectURL(audioUrl); };
                    await audio.play();
                } else { setVoicePlayback(false); }
            }
        } catch (error) { console.error('Voice playback error:', error); setVoicePlayback(false); }
    }, [voiceOutputEnabled, voiceProvider, voiceElevenlabsKey, voiceVoiceId]);

    const handleSend = useCallback((overrideValue?: any) => {
        const textToUse = typeof overrideValue === 'string' ? overrideValue : inputValue;
        if ((!textToUse.trim() && attachments.length === 0 && folderContexts.length === 0) || isLoading) return;
        const folderContextText = folderContexts.length > 0 ? `\n\n[Shared folder context]\n${folderContexts.map(f => `- ${f.path}`).join('\n')}\n\nNote: This folder structure is provided as passive context. You do not need to process, scan, or organize these files automatically. However, if the user explicitly asks you to take an action on these files in this message, you MUST fulfill their request using your tools immediately without asking for extra confirmation.` : '';
        const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: (textToUse.trim() + folderContextText).trim(), timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        if (typeof overrideValue !== 'string') setInputValue("");
        setAttachments([]);
        setFolderContexts([]);
        setIsLoading(true);
        setLiveToolCalls([]);
        setStreamingContent("");
        setStreamingThought("");
        liveToolCallsRef.current = [];
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";
        toolCallMap.current.clear();
        hasReceivedUsageData.current = false;

        const currentM = availableModels.find(m => m.id === selectedModel) || availableModels[0];

        (async () => {
            const api = (window as any).electronAPI?.acp;
            isMessageCommittedRef.current = false;
            isHandlingPlanRef.current = false;
            try {
                if (!api?.stream) throw new Error('No AI provider configured.');
                api.removeStreamListeners();
                api.onAgentPermissionRequest(() => {
                    const soundUrl = api?.getPermissionSoundUrl?.();
                    if (soundUrl) {
                        try {
                            const audio = new Audio(soundUrl);
                            audio.volume = 0.7;
                            audio.play().catch(e => console.log('[Audio] Could not play permission sound:', e));
                        } catch (e) { console.log('[Audio] Error:', e); }
                    }
                    setShowPermissionModal(true);
                });
                api.onToolStart(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
                    if (toolName === 'computer_use') { setIsComputerUseActive(true); setComputerUseStep('Starting...'); }
                    const display = resolveToolDisplay(toolName, toolArgs);
                    const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName, ...display, status: 'running', args: toolArgs };
                    toolCallMap.current.set(toolName + '_running', newTc.id);
                    liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                    setLiveToolCalls(liveToolCallsRef.current);
                });
                api.onViewSkill(({ name }: { name: string }) => {
                    const display = resolveToolDisplay('view_skill', { name });
                    const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName: 'view_skill', ...display, status: 'done' };
                    liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                    setLiveToolCalls(liveToolCallsRef.current);
                });
                api.onSkillDetected(({ skillName, reason }: { skillName: string; skillDescription: string; reason: string }) => {
                    const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName: 'skill_detected', displayName: `📚 Skill Detected: ${skillName}`, description: reason, status: 'done', args: { skillName } };
                    liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                    setLiveToolCalls(liveToolCallsRef.current);
                });
                
                let accumulated = "";

                api.onToolCall((record: any) => {
                    if (record.toolName === 'computer_use') { setIsComputerUseActive(false); setComputerUseStep(''); }
                    if (record.toolName === 'create_plan' || record.toolName === 'update_plan_step') { if (record.result?.success && record.result?.data) setCurrentPlan(record.result.data); }
                    if (record.toolName === 'execution_plan') {
                        if (record.result?.success && record.result?.data) {
                            const planData = record.result.data;
                            setExecutionPlan({ title: planData.title, content: planData.content });
                            setIsExecutionPlanPaneOpen(true);
                            if (activeConversationId) {
                                localStorage.setItem(`everfern_execution_plan_${activeConversationId}`, JSON.stringify(planData));
                            }
                            // Stop loading - wait for user to approve plan
                            // Stop loading - wait for user to approve plan
                            if (isMessageCommittedRef.current || isHandlingPlanRef.current) return;
                            isMessageCommittedRef.current = true;
                            isHandlingPlanRef.current = true;
                            api.removeStreamListeners();

                            setLiveToolCalls(prevTools => {
                                const finalToolCalls = prevTools.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t);
                                const assistantMsg: Message = {
                                    id: crypto.randomUUID(),
                                    role: "assistant",
                                    content: accumulated || "I have created an execution plan for your request.",
                                    thought: streamingThoughtRef.current,
                                    timestamp: new Date(),
                                    toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined
                                };
                                setMessages(prev => {
                                    const final = [...prev, assistantMsg];
                                    saveConversation(final);
                                    return final;
                                });
                                setStreamingContent("");
                                setStreamingThought("");
                                setIsLoading(false);
                                return [];
                            });
                        }
                    }
                    if (record.result?.success) {
                        if (record.toolName === 'read_file') { setContextItems(prev => { const exists = prev.some(i => i.label === record.result.data?.name || i.label === record.args.path); if (!exists) return [...prev, { id: crypto.randomUUID(), type: 'file', label: record.result.data?.name || record.args.path }]; return prev; }); }
                        else if (record.toolName === 'web_search') { setContextItems(prev => [...prev, { id: crypto.randomUUID(), type: 'web', label: record.args.query }]); }
                        else if (record.toolName === 'computer_use') { setContextItems(prev => { const action = record.args.action || 'computer_use'; const target = record.args.query ? ` "${record.args.query}"` : ''; return [...prev.filter(i => i.type !== 'app'), { id: crypto.randomUUID(), type: 'app', label: `Computer Use: ${action}${target}`, base64Image: record.result?.base64Image }]; }); }
                    }
                    const key = record.toolName + '_running';
                    const existingId = toolCallMap.current.get(key);
                    if (existingId) {
                        const updatedToolCalls = liveToolCallsRef.current.map(t => t.id === existingId ? { ...t, status: 'done' as const, output: typeof record.result === 'string' ? record.result : (record.result?.output || JSON.stringify({ ...record.result, base64Image: undefined }, null, 2)), data: record.result?.data, base64Image: record.result?.base64Image, durationMs: record.durationMs } : t);
                        toolCallMap.current.delete(key);
                        liveToolCallsRef.current = updatedToolCalls;
                        setLiveToolCalls(updatedToolCalls);
                    }
                });
                api.onThought(({ content }: { content: string }) => { streamingThoughtRef.current += content; setStreamingThought(streamingThoughtRef.current); });
                api.onUsage(({ promptTokens, completionTokens, totalTokens }: { promptTokens: number; completionTokens: number; totalTokens: number }) => {
                    console.log(`[Token Usage] Prompt: ${promptTokens}, Completion: ${completionTokens}, Total: ${totalTokens}`);
                    hasReceivedUsageData.current = true;
                    setContextTokens({ used: totalTokens, max: 128000 });
                });
                api.onOptima(({ event, details }: { event: string; details: string }) => { setStreamingThought(prev => { const icon = event === 'cache_hit' ? '⚡' : '✂️'; const label = event === 'cache_hit' ? 'Semantic Cache Hit' : 'Prompt Slimmed'; return `> [!NOTE]\n> **Optima**: ${icon} ${label} — ${details}\n\n` + prev; }); });
                api.onToolUpdate?.(({ toolName, update }: { toolName: string; update: string }) => { if (toolName === 'computer_use') setComputerUseStep(update); });
                api.onShowArtifact?.(({ name }: { name: string }) => { setSelectedArtifactName(name); setShowArtifacts(true); });

                api.onShowPlan?.(({ content }: { chatId: string; content: string }) => {
                    console.log('[Plan] Execution plan detected, saving accumulated content');
                    if (isMessageCommittedRef.current || isHandlingPlanRef.current) return;
                    isMessageCommittedRef.current = true;
                    isHandlingPlanRef.current = true;
                    // Save any accumulated AI response before showing plan
                    if (accumulated || streamingThoughtRef.current) {
                        const finalToolCalls = liveToolCallsRef.current.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t);
                        const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: accumulated || "", thought: streamingThoughtRef.current, timestamp: new Date(), toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined };
                        setMessages(prev => {
                            const updatedMessages = [...prev, assistantMsg];
                            saveConversation(updatedMessages);
                            return updatedMessages;
                        });
                    }

                    setExecutionPlan({ content });
                    setIsExecutionPlanPaneOpen(true);
                    if (activeConversationId) {
                        localStorage.setItem(`everfern_execution_plan_${activeConversationId}`, JSON.stringify({ content }));
                        localStorage.removeItem(`everfern_exec_pane_closed_${activeConversationId}`);
                    }

                    // Clear streaming state
                    setStreamingContent("");
                    setStreamingThought("");
                    liveToolCallsRef.current = [];
                    setLiveToolCalls([]);

                    // Stop loading - wait for user to approve plan
                    setIsLoading(false);
                    api.removeStreamListeners();
                });

                api.onStreamChunk(({ delta, done }: { delta: string; done: boolean }) => {
                    if (isMessageCommittedRef.current) return;
                    if (!done) { accumulated += delta; streamingContentRef.current = accumulated; setStreamingContent(accumulated); }
                    else {
                        api.removeStreamListeners();
                        isMessageCommittedRef.current = true;
                        setLiveToolCalls(prevTools => {
                            const finalToolCalls = prevTools.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t);
                            const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: accumulated || "Done.", thought: streamingThoughtRef.current, timestamp: new Date(), toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined };
                            setMessages(prev => {
                                const final = [...prev, assistantMsg];
                                saveConversation(final);
                                return final;
                            });
                            setStreamingContent("");
                            setStreamingThought("");
                            setIsLoading(false);
                            setIsComputerUseActive(false);
                            if (voiceOutputEnabled && voiceProvider === "elevenlabs" && voiceElevenlabsKey) handlePlayVoiceResponse(assistantMsg.content);
                            if (activeConversationId) { checkForPlan(activeConversationId); checkForSites(activeConversationId); }
                            return [];
                        });
                    }
                });

                await api.stream({
                    messages: newMessages.map(m => {
                        if (m.attachments && m.attachments.length > 0 && m.role === 'user') {
                            const blocks: any[] = [];
                            if (m.content) blocks.push({ type: 'text', text: m.content });
                            m.attachments.forEach(a => { if (a.mimeType.startsWith('image/') && a.base64) blocks.push({ type: 'image_url', image_url: { url: a.base64 } }); else blocks.push({ type: 'text', text: `[Attached File: ${a.name}]\n[Location: ${a.path || 'unknown'}]\n${a.content ? a.content : 'Content not loaded. Use your skills to read the file directly at the provided Location path.'}` }); });
                            return { role: m.role, content: blocks };
                        }
                        return { role: m.role, content: m.content };
                    }),
                    model: selectedModel,
                    providerType: currentM?.providerType || 'everfern',
                    conversationId: activeConversationId || crypto.randomUUID()
                });
            } catch (err) {
                if (isMessageCommittedRef.current) return;
                isMessageCommittedRef.current = true;
                const errorMessage = err instanceof Error ? err.message : String(err);
                api?.removeStreamListeners?.();
                const finalToolCalls = liveToolCallsRef.current.map(t => t.status === 'running' ? { ...t, status: 'error' as const } : t);
                const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: streamingContentRef.current ? streamingContentRef.current + `\n\n❌ ${errorMessage}` : `❌ ${errorMessage}`, thought: streamingThoughtRef.current, toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined, timestamp: new Date() };
                setMessages(prev => {
                    const final = [...prev, assistantMsg];
                    saveConversation(final);
                    return final;
                });
                setLiveToolCalls([]);
                setStreamingContent("");
                setStreamingThought("");
                setIsLoading(false);
                setIsComputerUseActive(false);
            }
        })();
    }, [inputValue, attachments, folderContexts, isLoading, messages, saveConversation, selectedModel, availableModels, activeConversationId, checkForPlan]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }, [handleSend]);

    const handleNewChat = () => { setMessages([]); setInputValue(""); setAttachments([]); setActiveConversationId(null); setCurrentPlan(null); setContextItems([]); setExecutionPlan(null); setIsExecutionPlanPaneOpen(false); };

    const handleSelectConversation = async (id: string) => {
        try {
            if ((window as any).electronAPI?.history?.load) {
                const conv = await (window as any).electronAPI.history.load(id);
                if (conv?.messages) {
                    setActiveConversationId(id);
                    setMessages(conv.messages.map((m: any) => ({ id: m.id || crypto.randomUUID(), role: m.role, content: m.content, thought: m.thought, toolCalls: m.toolCalls, attachments: m.attachments || [], timestamp: new Date(conv.updatedAt) })));
                    setCurrentPlan(null);
                    setContextItems([]);
                    setExecutionPlan(null);
                    setIsExecutionPlanPaneOpen(false);
                    const savedPlan = localStorage.getItem(`everfern_execution_plan_${id}`);
                    if (savedPlan) {
                        try {
                            setExecutionPlan(JSON.parse(savedPlan));
                            const isClosed = localStorage.getItem(`everfern_exec_pane_closed_${id}`);
                            setIsExecutionPlanPaneOpen(!isClosed);
                        } catch (e) { }
                    }
                    checkForPlan(id);
                }
            }
        } catch (err) { console.error("Failed to load conversation:", err); }
    };

    const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0] || { id: "fern", name: "EverFern-1", provider: "EverFern", providerType: "everfern", logo: null };

    // ── Model Selector ───────────────────────────────────────────────────────
    const renderModelSelector = (minimal = false) => (
        <div ref={modelSelectorRef} style={{ position: "relative" }}>
            <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                style={{ display: "flex", alignItems: "center", gap: minimal ? 4 : 6, background: minimal ? "transparent" : "rgba(0, 0, 0, 0.04)", border: minimal ? "none" : "1px solid #e8e6d9", color: "#201e24", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: minimal ? "0" : "0 12px", borderRadius: 8, height: minimal ? "auto" : 36, transition: "all 0.15s" }}
                onMouseEnter={e => { if (!minimal) { e.currentTarget.style.borderColor = "#111111"; } e.currentTarget.style.color = "#111111"; }}
                onMouseLeave={e => { if (!minimal) { e.currentTarget.style.borderColor = "#e8e6d9"; } e.currentTarget.style.color = "#201e24"; }}
            >
                {!minimal && currentModel.logo && <currentModel.logo size={14} />}
                {currentModel.name}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: minimal ? 0.7 : 1, marginLeft: minimal ? -2 : 0 }}><path d="m6 9 6 6 6-6" /></svg>
            </button>

            <AnimatePresence>
                {showModelSelector && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
                        style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 240, backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 12, padding: 6, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
                        <div style={{ padding: "8px 10px 4px", fontSize: 10, fontWeight: 700, color: "#8a8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>Models</div>
                        <div style={{ maxHeight: 300, overflowY: "auto" }}>
                            {availableModels.map(model => {
                                const isDisabled = model.id.endsWith('-error') || model.id.endsWith('-empty');
                                return (
                                    <button key={model.id} disabled={isDisabled} onClick={() => { if (!isDisabled) { setSelectedModel(model.id); setShowModelSelector(false); } }}
                                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "none", background: selectedModel === model.id ? "rgba(0,0,0,0.05)" : "transparent", color: isDisabled ? "#8a8886" : "#201e24", cursor: isDisabled ? "default" : "pointer", fontSize: 13, transition: "all 0.1s", textAlign: "left", opacity: isDisabled ? 0.7 : 1 }}
                                        onMouseEnter={e => { if (selectedModel !== model.id && !isDisabled) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                                        onMouseLeave={e => { if (selectedModel !== model.id && !isDisabled) e.currentTarget.style.background = "transparent"; }}
                                    >
                                        {model.logo ? <model.logo size={14} /> : <GlobeAltIcon width={14} height={14} className="text-zinc-500" />}
                                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{model.name}</span>
                                        {selectedModel === model.id && <CheckSolidIcon width={14} height={14} className="text-indigo-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    const handleSaveSettings = async () => {
        const updated: any = { ...config, engine: settingsEngine, provider: settingsEngine === "online" ? settingsProvider : settingsEngine, apiKey: settingsEngine === "online" ? settingsApiKey : undefined, customModel: settingsEngine === "online" && settingsProvider === "nvidia" ? settingsCustomModel : undefined, showuiUrl: settingsShowuiUrl || undefined };
        if (settingsEngine === "local") { updated.provider = "ollama"; updated.baseUrl = "http://localhost:11434"; }
        if (settingsVlmMode === "cloud" && settingsVlmCloudModel.trim()) { updated.vlm = { engine: "cloud", provider: settingsVlmCloudProvider, model: settingsVlmCloudModel.trim(), baseUrl: settingsVlmCloudUrl.trim() || undefined, apiKey: settingsVlmCloudKey.trim() || undefined }; }
        else if (config?.vlm) { updated.vlm = config.vlm; }
        if (voiceProvider && (voiceDeepgramKey.trim() || voiceElevenlabsKey.trim())) { updated.voice = { provider: voiceProvider, deepgramKey: voiceDeepgramKey.trim() || undefined, elevenlabsKey: voiceElevenlabsKey.trim() || undefined }; }
        setConfig(updated);
        if ((window as any).electronAPI?.saveConfig) await (window as any).electronAPI.saveConfig(updated);
        setShowSettings(false);
    };

    const checkOllamaStatus = async () => {
        if ((window as any).electronAPI?.system?.ollamaStatus) { const res = await (window as any).electronAPI.system.ollamaStatus(); setOllamaInstalled(res.installed); setModelInstalled(res.modelInstalled); }
    };

    const handleNextFromName = async () => { if (!onboardingName.trim()) return; await checkOllamaStatus(); setOnboardingStep("vlm"); };

    const finalizeOnboarding = async (useOllama: boolean = false) => {
        const name = onboardingName.trim() || "User";
        let updated: any = { ...config, userName: name };
        if (useOllama) { updated.vlm = { engine: "local", provider: "ollama", model: "qwen3-vl:2b", baseUrl: "http://localhost:11434" }; if (updated.engine === "local") updated.provider = "ollama"; }
        setConfig(updated);
        if ((window as any).electronAPI?.saveConfig) await (window as any).electronAPI.saveConfig(updated);
        if ((window as any).electronAPI?.memory?.saveDirect) await (window as any).electronAPI.memory.saveDirect(`The user's preferred name is ${name}. Always refer to them as ${name}.`, '[User Profile]');
        setShowOnboarding(false);
    };

    const handleInstallOllama = async () => {
        setIsInstallingOllama(true); setOllamaInstallDone(false); setOllamaInstallPct(0); setOllamaInstallPhase("downloading"); setOllamaLogs([]);
        if ((window as any).electronAPI?.system?.onOllamaInstallLine) {
            (window as any).electronAPI.system.onOllamaInstallLine((data: { line: string }) => {
                const pctMatch = data.line.match(/(\d+\.?\d*)%/);
                if (pctMatch) { const pct = parseFloat(pctMatch[1]); setOllamaInstallPct(pct); setOllamaInstallPhase(pct >= 100 ? "finalizing" : "downloading"); }
                setOllamaLogs(prev => [...prev.slice(-40), data.line]);
            });
        }
        if ((window as any).electronAPI?.system?.ollamaInstall) {
            const res = await (window as any).electronAPI.system.ollamaInstall();
            if (res.success) { setOllamaInstalled(true); setOllamaInstallPct(100); setOllamaInstallPhase("done"); setOllamaInstallDone(true); setOllamaLogs(["✔ Ollama installed successfully!"]); }
            else { setOllamaLogs(prev => [...prev, `✘ Installation failed with code ${res.code}`]); }
        }
        setIsInstallingOllama(false);
    };

    const handlePullModel = async () => {
        setIsPullingModel(true); setPullPct(0); setOllamaLogs([]);
        if ((window as any).electronAPI?.system?.onOllamaInstallLine) {
            (window as any).electronAPI.system.onOllamaInstallLine((data: { line: string }) => {
                const cleanLine = stripAnsi(data.line);
                const pctMatch = cleanLine.match(/(\d+\.?\d*)%/);
                if (pctMatch && (cleanLine.includes("pulling") || cleanLine.includes("verifying"))) setPullPct(parseFloat(pctMatch[1]));
                setOllamaLogs(prev => { const last = prev[prev.length - 1] || ""; if (cleanLine.includes("pulling") && last.includes("pulling")) { const newLogs = [...prev]; newLogs[newLogs.length - 1] = cleanLine; return newLogs; } return [...prev.slice(-30), cleanLine]; });
            });
        }
        if ((window as any).electronAPI?.system?.ollamaPull) {
            const res = await (window as any).electronAPI.system.ollamaPull("qwen3-vl:2b");
            if (res.success) { setPullPct(100); await finalizeOnboarding(true); }
            else { setOllamaLogs(prev => [...prev, `✘ Model pull failed with code ${res.code}`]); }
        }
        setIsPullingModel(false);
    };

    // ── Shared composer toolbar ──────────────────────────────────────────────
    const renderComposerLeftActions = () => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setShowAddMenu(!showAddMenu)} title="Attach menu"
                    style={{ background: "transparent", border: "none", color: "#717171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#111111"}
                    onMouseLeave={e => e.currentTarget.style.color = "#717171"}
                >
                    <PlusIcon width={22} height={22} style={{ transform: showAddMenu ? 'rotate(45deg)' : 'none', transition: '0.2s' }} />
                </button>
                <AnimatePresence>
                    {showAddMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #e8e6d9", padding: 6, display: "flex", flexDirection: "column", gap: 2, minWidth: 180, zIndex: 50, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
                            <button type="button" onClick={() => { setShowAddMenu(false); handleAttachment('image'); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "none", backgroundColor: "transparent", color: "#111111", cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path><path d="M21 15l-5-5L5 21"></path></svg>
                                Upload Image
                            </button>
                            <button type="button" onClick={() => { setShowAddMenu(false); handleAttachment('document'); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "none", backgroundColor: "transparent", color: "#111111", cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Upload Document
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <button type="button"
                onClick={folderContexts.length > 0 && folderHover ? () => setFolderContexts([]) : handleAddContextFolder}
                title={folderContexts.length > 0 && folderHover ? "Remove context" : "Add context folder"}
                style={{ display: "flex", alignItems: "center", gap: 6, background: folderHover && folderContexts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "transparent", border: folderHover && folderContexts.length > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #e8e6d9", borderRadius: 14, color: folderHover && folderContexts.length > 0 ? "#ef4444" : "#201e24", cursor: "pointer", padding: "6px 14px", fontSize: 13, fontWeight: 500, transition: "0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = folderContexts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(0,0,0,0.04)"; e.currentTarget.style.color = folderContexts.length > 0 ? "#ef4444" : "#111111"; if (folderContexts.length > 0) e.currentTarget.style.border = "1px solid rgba(239, 68, 68, 0.3)"; setFolderHover(true); }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#201e24"; e.currentTarget.style.border = "1px solid #e8e6d9"; setFolderHover(false); }}
            >
                {folderHover && folderContexts.length > 0 ? <XMarkIcon width={15} height={15} /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>}
                {folderContexts.length > 0 ? folderContexts[folderContexts.length - 1].name : "Add context"}
            </button>
        </div>
    );

    const renderComposerRightActions = (showVolumeToggle = false) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Context Token Ring */}
            <ContextTokenRing used={contextTokens.used} max={contextTokens.max} />

            {/* Voice Output Toggle */}
            {showVolumeToggle && voiceProvider && voiceElevenlabsKey && (
                <button type="button" onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)} title={voiceOutputEnabled ? "Sound on" : "Sound off"}
                    style={{ width: 32, height: 32, borderRadius: 10, background: voicePlayback ? "rgba(59, 130, 246, 0.15)" : voiceOutputEnabled ? "transparent" : "rgba(0,0,0,0.05)", border: voiceOutputEnabled ? "1px solid #a1a1aa" : "1px solid #e8e6d9", color: voicePlayback ? "#3b82f6" : voiceOutputEnabled ? "#717171" : "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = voiceOutputEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(0,0,0,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = voicePlayback ? "rgba(59, 130, 246, 0.15)" : voiceOutputEnabled ? "transparent" : "rgba(0,0,0,0.05)"; }}
                >
                    {voicePlayback ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, animation: "pulse 1s infinite" }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path></svg>
                    ) : voiceOutputEnabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                    )}
                </button>
            )}

            {/* ── VOICE BUTTON ── appears in BOTH empty and non-empty composers */}
            <VoiceButton
                isRecording={isRecording}
                voiceProvider={voiceProvider}
                voiceDeepgramKey={voiceDeepgramKey}
                voiceElevenlabsKey={voiceElevenlabsKey}
                onClick={() => setShowVoiceAssistant(true)}
            />

            {renderModelSelector(true)}

            {isLoading ? (
                <button onClick={() => { 
                    (window as any).electronAPI?.acp?.stop?.(); 
                    setIsLoading(false);
                    isMessageCommittedRef.current = true;
                    setStreamingContent("");
                    setStreamingThought("");
                    setLiveToolCalls([]);
                }}
                    style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", border: "none", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <StopIcon width={16} height={16} />
                </button>
            ) : (
                <button type="button" onClick={handleSend} disabled={!inputValue.trim() && attachments.length === 0 && folderContexts.length === 0} title="Send"
                    style={{ width: 32, height: 32, borderRadius: 10, background: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "#201e24" : "#f4f4f4", border: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "none" : "1px solid #e8e6d9", color: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "#ffffff" : "#a1a1aa", cursor: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}
        </div>
    );

    // ── Attachment preview strip (shared) ────────────────────────────────────
    const renderAttachmentStrip = () => (
        <>
            {attachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 0" }}>
                    {attachments.map(a => (
                        <div key={a.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", backgroundColor: "#f5f4f0", borderRadius: 8, border: "1px solid #e8e6d9" }}>
                            {a.mimeType.startsWith("image/") && a.base64 ? (
                                <div style={{ width: 40, height: 40, borderRadius: 6, backgroundImage: `url(${a.base64})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: "rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <PaperClipIcon width={20} height={20} color="#717171" />
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, paddingRight: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#111111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{a.name}</span>
                                <span style={{ fontSize: 11, color: "#8a8886" }}>{(a.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button onClick={() => setAttachments(prev => prev.filter(att => att.id !== a.id))}
                                style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#ffffff", border: "1px solid #dcdad0", display: "flex", alignItems: "center", justifyContent: "center", color: "#111111", cursor: "pointer", zIndex: 10 }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f5f5e1"}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = "#ffffff"}>
                                <XMarkIcon width={12} height={12} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    // ── Onboarding modal ─────────────────────────────────────────────────────
    const onboardingModalNode = (
        <AnimatePresence>
            {showOnboarding && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,252,240,0.8)", backdropFilter: "blur(16px)" }}>
                    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                        style={{ width: "100%", maxWidth: onboardingStep === "name" ? 440 : 540, backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 32, padding: "48px 32px", textAlign: "center", boxShadow: "0 32px 64px -12px rgba(0,0,0,0.12)" }}>
                        {onboardingStep === "name" ? (
                            <motion.div key="name-step" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                <div style={{ width: 64, height: 64, borderRadius: 24, margin: "0 auto 24px", background: "#f5f4f0", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <SparklesIcon width={32} height={32} color="#201e24" />
                                </div>
                                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 500, margin: "0 0 12px", color: "#201e24", letterSpacing: "-0.02em" }}>Welcome to EverFern</h2>
                                <p style={{ fontSize: 16, color: "#8a8886", marginBottom: 32, lineHeight: 1.5 }}>Let's get started. How should your intelligence companion address you?</p>
                                <input type="text" placeholder="Your name..." value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNextFromName()}
                                    style={{ width: "100%", padding: "18px 24px", backgroundColor: "#f5f4f0", border: "1px solid #e8e6d9", borderRadius: 18, color: "#201e24", fontSize: 16, outline: "none", boxSizing: "border-box", marginBottom: 24, textAlign: "center", transition: "all 0.2s", fontFamily: "var(--font-sans)" }}
                                    onFocus={e => { e.target.style.borderColor = "#111111"; e.target.style.backgroundColor = "#ffffff"; }}
                                    onBlur={e => { e.target.style.borderColor = "#e8e6d9"; e.target.style.backgroundColor = "#f5f4f0"; }}
                                />
                                <button onClick={handleNextFromName} disabled={!onboardingName.trim()}
                                    style={{ width: "100%", padding: "18px", backgroundColor: "#201e24", color: "#ffffff", borderRadius: 18, fontWeight: 600, fontSize: 16, border: "none", cursor: onboardingName.trim() ? "pointer" : "not-allowed", opacity: onboardingName.trim() ? 1 : 0.4, transition: "all 0.2s" }}
                                    onMouseEnter={e => { if (onboardingName.trim()) e.currentTarget.style.transform = "translateY(-1px)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
                                    Get Started
                                </button>
                            </motion.div>
                        ) : (
                            <motion.div key="vlm-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div style={{ width: 64, height: 64, borderRadius: 24, margin: "0 auto 24px", background: "#f5f4f0", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <CpuChipIcon width={32} height={32} color="#201e24" />
                                </div>
                                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 500, margin: "0 0 12px", color: "#201e24", letterSpacing: "-0.02em" }}>Local Vision AI</h2>
                                <p style={{ fontSize: 15, color: "#8a8886", marginBottom: 32, lineHeight: 1.6 }}>
                                    To see your screen and control your PC locally, EverFern recommends installing the <strong style={{ color: "#201e24" }}>Qwen3 VL (2B)</strong> model via Ollama.
                                </p>
                                {ollamaInstalled === false ? (
                                    <div style={{ padding: "24px", background: "#f5f4f0", borderRadius: 20, border: "1px solid #e8e6d9", marginBottom: 24 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16 }}>
                                            <OllamaLogo size={24} />
                                            <span style={{ fontSize: 16, fontWeight: 700, color: "#201e24" }}>Ollama is required</span>
                                        </div>
                                        <button onClick={handleInstallOllama} disabled={isInstallingOllama}
                                            style={{ width: "100%", padding: "14px", backgroundColor: "#201e24", color: "#ffffff", borderRadius: 14, fontWeight: 600, fontSize: 14, border: "none", cursor: isInstallingOllama ? "wait" : "pointer", transition: "all 0.2s" }}>
                                            {isInstallingOllama ? "Installing Ollama..." : "Install Ollama Automatically"}
                                        </button>
                                        {(isInstallingOllama || ollamaInstallDone) && (
                                            <div style={{ marginTop: 20 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                    <span style={{ fontSize: 12, color: "#8a8886", fontWeight: 500 }}>
                                                        {ollamaInstallPhase === "done" ? "✔ Installation complete!" : ollamaInstallPhase === "finalizing" ? "Finalizing..." : "Downloading Ollama..."}
                                                    </span>
                                                    <span style={{ fontSize: 12, color: "#8a8886", fontFamily: "monospace" }}>{ollamaInstallPct.toFixed(1)}%</span>
                                                </div>
                                                <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#e8e6d9", overflow: "hidden" }}>
                                                    <motion.div animate={{ width: `${ollamaInstallPhase === "finalizing" ? 100 : ollamaInstallPct}%` }} transition={{ ease: "linear", duration: 0.3 }} style={{ height: "100%", borderRadius: 999, background: "#201e24" }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", background: "#f5f4f0", borderRadius: 20, border: "1px solid #e8e6d9", marginBottom: 24 }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ffffff", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center" }}><OllamaLogo size={20} /></div>
                                                <div style={{ textAlign: "left" }}>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color: "#201e24" }}>Qwen2.5-VL-3B-Thinking</div>
                                                    <div style={{ fontSize: 12, color: "#8a8886" }}>~2.5 GB · Fast Local Inference</div>
                                                </div>
                                            </div>
                                            <CheckCircleIcon width={24} height={24} color="#201e24" style={{ opacity: (isPullingModel || modelInstalled) ? 1 : 0.2 }} />
                                        </div>
                                        <button onClick={handlePullModel} disabled={!!(isPullingModel || isInstallingOllama || modelInstalled)}
                                            style={{ width: "100%", padding: "14px", backgroundColor: modelInstalled ? "transparent" : "#201e24", color: modelInstalled ? "#8a8886" : "#ffffff", borderRadius: 14, fontWeight: 600, fontSize: 14, border: modelInstalled ? "1px solid #e8e6d9" : "none", cursor: (isPullingModel || isInstallingOllama) ? "wait" : (modelInstalled ? "default" : "pointer"), transition: "all 0.2s" }}>
                                            {modelInstalled ? "✔ Ready to use" : (isPullingModel ? `Downloading... ${pullPct.toFixed(1)}%` : "Download & Setup")}
                                        </button>
                                        {isPullingModel && (
                                            <div style={{ marginTop: 14 }}>
                                                <div style={{ width: "100%", height: 6, borderRadius: 999, background: "#e8e6d9", overflow: "hidden" }}>
                                                    <motion.div animate={{ width: `${pullPct}%` }} transition={{ ease: "linear", duration: 0.3 }} style={{ height: "100%", borderRadius: 999, background: "#201e24" }} />
                                                </div>
                                                <p style={{ fontSize: 11, color: "#8a8886", marginTop: 8, textAlign: "center" }}>Downloading model weights... ~2.5 GB total</p>
                                            </div>
                                        )}
                                        {modelInstalled && !isPullingModel && (
                                            <div style={{ marginTop: 12, textAlign: "center" }}>
                                                <button onClick={() => finalizeOnboarding(true)} style={{ background: "none", border: "none", color: "#111111", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>Complete Setup →</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {ollamaLogs.length > 0 && (
                                    <div style={{ width: "100%", height: 120, backgroundColor: "#242322", borderRadius: 12, padding: 12, border: "1px solid #363635", overflowY: "auto", textAlign: "left" }}>
                                        <pre style={{ margin: 0, color: "#8a8886", fontSize: 11, fontFamily: "monospace", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{ollamaLogs.join('\n')}</pre>
                                    </div>
                                )}
                                <div style={{ marginTop: 24 }}>
                                    <button onClick={() => finalizeOnboarding(false)} style={{ background: "none", border: "none", color: "#8a8886", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>Skip for now</button>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const settingsModalNode = (
        <AnimatePresence>
            {showSettings && (
                <SettingsPage
                    onClose={() => setShowSettings(false)}
                    config={config}
                    username={onboardingName || config?.name || 'User'}
                    settingsEngine={settingsEngine}
                    setSettingsEngine={setSettingsEngine}
                    settingsProvider={settingsProvider}
                    setSettingsProvider={setSettingsProvider}
                    settingsApiKey={settingsApiKey}
                    setSettingsApiKey={setSettingsApiKey}
                    settingsCustomModel={settingsCustomModel}
                    setSettingsCustomModel={setSettingsCustomModel}
                    settingsShowuiUrl={settingsShowuiUrl}
                    setSettingsShowuiUrl={setSettingsShowuiUrl}
                    settingsVlmMode={settingsVlmMode}
                    setSettingsVlmMode={setSettingsVlmMode}
                    settingsVlmCloudProvider={settingsVlmCloudProvider}
                    setSettingsVlmCloudProvider={setSettingsVlmCloudProvider}
                    settingsVlmCloudModel={settingsVlmCloudModel}
                    setSettingsVlmCloudModel={setSettingsVlmCloudModel}
                    settingsVlmCloudUrl={settingsVlmCloudUrl}
                    setSettingsVlmCloudUrl={setSettingsVlmCloudUrl}
                    settingsVlmCloudKey={settingsVlmCloudKey}
                    setSettingsVlmCloudKey={setSettingsVlmCloudKey}
                    voiceProvider={voiceProvider}
                    setVoiceProvider={setVoiceProvider}
                    voiceDeepgramKey={voiceDeepgramKey}
                    setVoiceDeepgramKey={setVoiceDeepgramKey}
                    voiceElevenlabsKey={voiceElevenlabsKey}
                    setVoiceElevenlabsKey={setVoiceElevenlabsKey}
                    modelValidationStatus={modelValidationStatus}
                    setModelValidationStatus={setModelValidationStatus}
                    isValidatingModel={isValidatingModel}
                    setIsValidatingModel={setIsValidatingModel}
                    ollamaInstalled={ollamaInstalled}
                    modelInstalled={modelInstalled}
                    handleSaveSettings={handleSaveSettings}
                    onOpenVlmOnboarding={() => { setShowSettings(false); checkOllamaStatus(); setOnboardingStep('vlm'); setShowOnboarding(true); }}
                />
            )}
        </AnimatePresence>
    );

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            `}</style>
            <div style={{ height: "100vh", backgroundColor: "#f5f4f0", color: "#201e24", fontFamily: "var(--font-sans)", display: "flex", overflow: "hidden" }}>
                <PermissionDialog />
                <ArtifactsPanel isOpen={showArtifacts} onClose={() => { setShowArtifacts(false); setSelectedArtifactName(null); }} activeChatId={activeConversationId} selectedFileName={selectedArtifactName} />
                <PlanViewerPanel isOpen={showPlanViewer} onClose={() => setShowPlanViewer(false)} content={planViewerContent} onApprove={handleApprovePlan} />
                {reportPane && (
                    <ReportPane isOpen={!!reportPane} onClose={() => setReportPane(null)} label={reportPane.label} path={reportPane.path} />
                )}
                <VoiceAssistantUI
                    isOpen={showVoiceAssistant}
                    onClose={() => setShowVoiceAssistant(false)}
                    isRecording={isRecording}
                    voiceLoading={voiceLoading}
                    voiceTranscript={voiceTranscript}
                    voicePlayback={voicePlayback}
                    onRecordToggle={async () => {
                        if (!isRecording) {
                            setVoiceLoading(true);
                            setVoiceTranscript("");
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                const mediaRecorder = new MediaRecorder(stream);
                                const audioChunks: BlobPart[] = [];
                                mediaRecorderRef.current = mediaRecorder;
                                audioStreamRef.current = stream;
                                mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
                                mediaRecorder.onstop = async () => {
                                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                                    const arrayBuffer = await audioBlob.arrayBuffer();
                                    if (voiceProvider === "deepgram" && voiceDeepgramKey) {
                                        try {
                                            const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en', { method: 'POST', headers: { 'Authorization': `Token ${voiceDeepgramKey}`, 'Content-Type': 'audio/webm' }, body: arrayBuffer });
                                            if (response.ok) { const result = await response.json(); const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''; setVoiceTranscript(transcript); setInputValue(transcript); }
                                            else { setVoiceTranscript("Failed to transcribe audio"); }
                                        } catch (error) { setVoiceTranscript("Error transcribing audio"); }
                                    }
                                    stream.getTracks().forEach(track => track.stop());
                                    setVoiceLoading(false);
                                    mediaRecorderRef.current = null;
                                    audioStreamRef.current = null;
                                };
                                mediaRecorder.start();
                                setIsRecording(true);
                                voiceTimeoutRef.current = setTimeout(() => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); setIsRecording(false); } }, 30000);
                            } catch (error) { setVoiceLoading(false); }
                        } else {
                            setIsRecording(false);
                            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
                            if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
                            if (voiceTimeoutRef.current) { clearTimeout(voiceTimeoutRef.current); voiceTimeoutRef.current = null; }
                        }
                    }}
                    onOutputToggle={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                    voiceOutputEnabled={voiceOutputEnabled}
                    voiceProvider={voiceProvider}
                    voiceDeepgramKey={voiceDeepgramKey}
                    voiceElevenlabsKey={voiceElevenlabsKey}
                />
                <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} onNewChat={handleNewChat} onSettingsClick={() => setShowSettings(true)} onArtifactsClick={() => setShowArtifacts(true)} onCustomizeClick={() => setShowDirectoryModal(true)} />

                <motion.div
                    initial={false}
                    animate={{ marginLeft: sidebarOpen ? 260 : 68 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f5f4f0", position: "relative" }}
                >
                    {/* Header */}
                    <header style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", WebkitAppRegion: "drag" } as any}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, WebkitAppRegion: "no-drag" } as any}>
                            {executionPlan && !isExecutionPlanPaneOpen && (
                                <button onClick={() => {
                                    setIsExecutionPlanPaneOpen(true);
                                    if (activeConversationId) localStorage.removeItem(`everfern_exec_pane_closed_${activeConversationId}`);
                                }} style={{ fontSize: 12, fontWeight: 600, color: "#201e24", backgroundColor: "rgba(0,0,0,0.04)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    View Plan
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, WebkitAppRegion: "no-drag" } as any}>
                            <button type="button" style={{ position: "relative", background: "transparent", border: "none", color: "#73716e", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }} onMouseEnter={e => e.currentTarget.style.color = "#111111"} onMouseLeave={e => e.currentTarget.style.color = "#73716e"}>
                                <BellIcon width={20} height={20} />
                                <span style={{ position: "absolute", top: 2, right: 2, width: 14, height: 14, backgroundColor: "#ef4444", borderRadius: "50%", color: "#ffffff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #f5f4f0", fontWeight: 700 }}>2</span>
                            </button>
                            <div style={{ marginLeft: 8 }}><WindowControls /></div>
                        </div>
                    </header>

                    <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "row", backgroundColor: "#ffffff", margin: "0 12px 12px 0", borderRadius: 28, border: "1px solid #e8e6d9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", overflow: "hidden" }}>
                        {/* Main Chat Area */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 32px" }}>
                                <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px" }}>

                                    {/* ── Empty / Home State ── */}
                                    {isEmpty && (
                                        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.7 }}
                                            style={{ marginTop: "14vh", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <div style={{ marginBottom: 26 }}>
                                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 8, backgroundColor: "rgba(0, 0, 0, 0.04)", border: "1px solid rgba(0, 0, 0, 0.08)", color: "#717171", fontSize: 13 }}>
                                                    <span>Free plan</span>
                                                    <span style={{ opacity: 0.5 }}>·</span>
                                                    <button type="button" style={{ background: "transparent", border: "none", color: "#4a4846", cursor: "pointer", fontSize: 13, padding: 0, textDecoration: "underline" }} onClick={() => setShowSettings(true)}>Upgrade</button>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
                                                <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, margin: 0, color: "#201e24", letterSpacing: "-0.01em" }}>{randomGreeting}</h1>
                                            </div>

                                            {/* ── Empty state composer ── */}
                                            <div style={{ width: "100%", maxWidth: 740 }}>
                                                <div style={{ backgroundColor: (isRecording || showVoiceAssistant) ? "transparent" : "#f4f4f4", border: (isRecording || showVoiceAssistant) ? "none" : "1px solid #e8e6d9", borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 120, transition: "all 0.3s ease" }}>
                                                    {renderAttachmentStrip()}
                                                    <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="How can I help you today?" rows={1}
                                                        className="placeholder-[#a5a3a0]"
                                                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 16, color: "#111111", lineHeight: 1.5, padding: "20px 24px", minHeight: 70, maxHeight: 240 }} />
                                                    <div style={{ flex: 1 }} />
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 24px 16px" }}>
                                                        {renderComposerLeftActions()}
                                                        {renderComposerRightActions(false)}
                                                    </div>
                                                </div>

                                                {/* Quick prompt chips */}
                                                <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                                                    {[
                                                        { label: "Code", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> },
                                                        { label: "Write", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg> },
                                                        { label: "Learn", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14v7M22 9l-10 5L2 9l10-5 10 5z"></path><path d="M6 11v5a6 3 0 0 0 12 0v-5"></path></svg> },
                                                        { label: "Life stuff", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"></path></svg> },
                                                        { label: "Fern's choice", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4M12 2v2M4.2 6.2l1.4 1.4M18.4 18.4l1.4 1.4M19.8 6.2l-1.4 1.4M5.6 18.4l-1.4 1.4M22 12h-2M4 12H2M12 6a5 5 0 0 0-3 8.7V17h6v-2.3A5 5 0 0 0 12 6z"></path></svg> },
                                                    ].map(c => (
                                                        <button key={c.label} type="button" onClick={() => setInputValue(prev => prev || c.label + ": ")}
                                                            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, backgroundColor: "transparent", border: "1px solid #f7f5f2", color: "#201e24", fontSize: 13, cursor: "pointer", transition: "all 0.1s" }}
                                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f7f5f2"; e.currentTarget.style.color = "#111111"; }}
                                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#201e24"; }}>
                                                            <span style={{ display: 'flex' }}>{c.icon}</span>
                                                            <span style={{ fontWeight: 400 }}>{c.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Plan Review Card */}
                                    {activePlan && (
                                        <div style={{ maxWidth: 800, margin: "0 auto 24px", padding: "0 32px" }}>
                                            <PlanReviewCard plan={activePlan} onApprove={handleApprovePlan} onEdit={() => setShowArtifacts(true)} />
                                        </div>
                                    )}

                                    {/* Messages */}
                                    <AnimatePresence mode="popLayout">
                                        {messages.map((msg, idx) => (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                                                transition={{ type: "spring", stiffness: 400, damping: 30, delay: Math.min(idx * 0.05, 0.2) }}
                                                layout
                                                style={{ marginBottom: 28, display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}
                                            >
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8886", letterSpacing: "0.02em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}>
                                                    {msg.role === "assistant" && <Image unoptimized src="/images/logos/everfern-withoutbg.png" alt="" width={14} height={14} style={{ opacity: 0.6, filter: 'invert(1)' }} />}
                                                    {msg.role === "user" ? "You" : "Fern"}
                                                </div>
                                                <div style={{ maxWidth: msg.role === "user" ? "80%" : "100%", padding: msg.role === "user" ? "12px 18px" : "0", borderRadius: msg.role === "user" ? 16 : 0, borderTopRightRadius: msg.role === "user" ? 4 : 0, background: msg.role === "user" ? "#f5f4f0" : "transparent", border: msg.role === "user" ? "1px solid #e8e6d9" : "none", fontSize: 15, lineHeight: 1.7 }}>
                                                    {msg.role === "user" ? (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                            {msg.attachments && msg.attachments.length > 0 && (
                                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                                    {msg.attachments.map(a => (
                                                                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", backgroundColor: "#f5f4f0", borderRadius: 8, border: "1px solid #e8e6d9" }}>
                                                                            {a.mimeType.startsWith("image/") && a.base64 ? <div style={{ width: 32, height: 32, borderRadius: 4, backgroundImage: `url(${a.base64})`, backgroundSize: "cover", backgroundPosition: "center" }} /> : <PaperClipIcon width={16} height={16} color="#717171" />}
                                                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                                                <span style={{ fontSize: 12, fontWeight: 500, color: "#111111", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                                                                                <span style={{ fontSize: 10, color: "#8a8886" }}>{(a.size / 1024).toFixed(1)} KB</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {(() => {
                                                                if (!msg.content) return null;
                                                                const parts = msg.content.split(/\n\n\[Shared folder context\]\n/);
                                                                const mainText = parts[0];
                                                                const folderContextBlock = parts.length > 1 ? parts[1].split("\n\nNote:")[0] : null;
                                                                const folderLines = folderContextBlock ? folderContextBlock.split('\n').filter(l => l.startsWith('- ')).map(l => l.substring(2).trim()) : [];
                                                                const isPlanApproved = mainText?.startsWith('[PLAN_APPROVED]');
                                                                const planText = isPlanApproved ? mainText.replace('[PLAN_APPROVED]\n', '').trim() : null;
                                                                return (
                                                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                                                        {isPlanApproved ? (
                                                                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                                                                <PlanApprovalBanner />
                                                                                {planText && planText !== 'I have reviewed and approved your execution plan. Please proceed with the execution as planned.' && (
                                                                                    <span style={{ color: "#111111", whiteSpace: "pre-wrap" }}>{planText}</span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            mainText && <span style={{ color: "#111111", whiteSpace: "pre-wrap" }}>{mainText}</span>
                                                                        )}
                                                                        {folderLines.length > 0 && (
                                                                            <div style={{ padding: "12px 16px", backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 12 }}>
                                                                                <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8886", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}>
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                                                                    Shared context
                                                                                </div>
                                                                                <div style={{ fontSize: 13, color: "#4a4846", display: "flex", flexDirection: "column", gap: 4 }}>
                                                                                    {folderLines.map((line, idx) => <div key={idx} style={{ wordBreak: "break-all", display: "flex", gap: 6 }}><span style={{ color: "#8a8886" }}>-</span> {line}</div>)}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <ToolTimeline
                                                                toolCalls={msg.toolCalls?.filter(tc => tc.toolName !== 'write' && tc.toolName !== 'write_to_file' && tc.toolName !== 'write_file') || []}
                                                                thought={msg.thought}
                                                                isLive={false}
                                                            />
                                                            {(() => {
                                                                const { cleanContent, artifacts } = extractFileArtifacts(msg.content || '');
                                                                return (
                                                                    <>
                                                                        <StreamingMarkdown content={cleanContent} isLive={false} isLatest={idx === messages.length - 1} />
                                                                        {artifacts.map((art, i) => (
                                                                            <FileArtifact key={i} path={art.path} description={art.description} chatId={activeConversationId || ""} />
                                                                        ))}
                                                                    </>
                                                                );
                                                            })()}
                                                            <ReportLink content={msg.content} onOpen={(label, path) => setReportPane({ label, path })} />
                                                            {msg.role === "assistant" && currentSites.length > 0 && currentSites.some(site => site.chatId === activeConversationId) && (
                                                                <div style={{ marginTop: 12 }}>
                                                                    {currentSites.filter(site => site.chatId === activeConversationId).map(site => <SitePreview key={site.id} chatId={activeConversationId || ""} filename={site.id} />)}
                                                                </div>
                                                            )}
                                                            {msg.toolCalls?.filter(tc => tc.toolName === 'write' || tc.toolName === 'write_to_file' || tc.toolName === 'write_file').map(tc => (
                                                                <WriteDiffCard key={`write-${tc.id}`} tc={tc} />
                                                            ))}
                                                            {msg.role === "assistant" && activeConversationId && (
                                                                <ArtifactsList chatId={activeConversationId} onSelect={(name) => { setSelectedArtifactName(name); setShowArtifacts(true); }} />
                                                            )}
                                                            <RateLimitContinueButton content={msg.content} onContinue={() => handleSend("continue")} />
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {/* Live streaming state - hide if last message already has this content (prevent duplicates) */}
                                    {isLoading && !(messages.length > 0 && messages[messages.length - 1].role === "assistant" && streamingContent && messages[messages.length - 1].content?.trim() === streamingContent?.trim()) && (
                                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8886", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                                                <Image unoptimized src="/images/logos/everfern-withoutbg.png" alt="" width={14} height={14} style={{ opacity: 0.5, filter: 'invert(1)' }} />
                                                Fern
                                            </div>
                                            <div style={{ width: "100%" }}>
                                                <ToolTimeline
                                                    toolCalls={liveToolCalls}
                                                    thought={streamingThought}
                                                    isLive={true}
                                                />
                                                {(() => {
                                                    const { cleanContent, artifacts } = extractFileArtifacts(streamingContent || '');
                                                    return (
                                                        <>
                                                            {cleanContent && <StreamingMarkdown content={cleanContent} isLive={true} />}
                                                            {artifacts.map((art, i) => (
                                                                <FileArtifact key={i} path={art.path} description={art.description} chatId={activeConversationId || ""} />
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                                {!streamingContent && liveToolCalls.length === 0 && !streamingThought && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                                                        <motion.div
                                                            animate={{ opacity: [0.3, 1, 0.3] }}
                                                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                                            style={{ display: 'flex', gap: 4 }}
                                                        >
                                                            {[0, 1, 2].map(i => (
                                                                <motion.div
                                                                    key={i}
                                                                    animate={{ scale: [1, 1.3, 1] }}
                                                                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                                                                    style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#9ca3af' }}
                                                                />
                                                            ))}
                                                        </motion.div>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* ── Non-empty bottom composer ── */}
                            {!isEmpty && (
                                <div style={{ padding: "0 24px 12px", width: "100%", maxWidth: 848, margin: "0 auto", position: "relative" }}>
                                    <AnimatePresence>
                                        {(isComputerUseActive || showPermissionModal) && (
                                            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.2 }} style={{ width: "100%", position: "relative", zIndex: 1 }}>
                                                <div style={{ width: "100%", background: "#161615", border: "1px solid rgba(255, 255, 255, 0.12)", borderBottom: "none", borderRadius: "20px 20px 0 0", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: showPermissionModal ? "rgba(251, 191, 36, 0.15)" : "rgba(255, 255, 255, 0.05)", border: showPermissionModal ? "1px solid rgba(251, 191, 36, 0.3)" : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                            {showPermissionModal ? <span style={{ fontSize: 16 }}>🔒</span> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} style={{ width: 14, height: 14, borderRadius: '50%', border: "2px solid rgba(255, 255, 255, 0.2)", borderTopColor: "#e5e5e5" }} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{showPermissionModal ? "Fern needs permission to access your system files" : "EverFern is controlling your PC"}</div>
                                                            <div style={{ fontSize: 12, color: showPermissionModal ? "#fcd34d" : "#a1a1aa", marginTop: 2, fontFamily: showPermissionModal ? "inherit" : "monospace" }}>{showPermissionModal ? "Fern will be able to read and organize files in the folders you share." : computerUseStep || 'Preparing...'}</div>
                                                        </div>
                                                    </div>
                                                    {showPermissionModal ? (
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                                            <button onClick={() => { setShowPermissionModal(false); setIsComputerUseActive(false); (window as any).electronAPI?.acp?.agentPermissionResponse?.(false); }} style={{ padding: "7px 15px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "transparent", color: "#a1a1aa", fontSize: 12, fontWeight: 600, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>Deny</button>
                                                            <button onClick={() => { setPermissionsGranted(true); setShowPermissionModal(false); (window as any).electronAPI?.acp?.agentPermissionResponse?.(true); }} style={{ padding: "7px 18px", borderRadius: 14, border: "none", backgroundColor: "#fbbf24", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 0 16px rgba(251, 191, 36, 0.3)" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f59e0b"; e.currentTarget.style.transform = "scale(1.03)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fbbf24"; e.currentTarget.style.transform = "scale(1)"; }}>
                                                                <CheckCircleIcon width={13} height={13} strokeWidth={2.5} /> Allow Access
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: 11, color: "#52525b", flexShrink: 0 }}>
                                                            <kbd style={{ padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)", fontSize: 10 }}>⌘⇧X</kbd> to abort
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div style={{ width: "96%", maxWidth: 840, margin: "0 auto 8px auto", display: "flex", flexDirection: "column" }}>
                                        <div style={{ width: "100%", backgroundColor: (isRecording || showVoiceAssistant) ? "transparent" : "#ffffff", border: (isRecording || showVoiceAssistant) ? "none" : "1px solid #e8e6d9", borderRadius: (isComputerUseActive || showPermissionModal) ? "0 0 16px 16px" : 16, position: "relative", zIndex: 2, display: "flex", flexDirection: "column", minHeight: 100, transition: "all 0.3s ease" }}>
                                            {renderAttachmentStrip()}
                                            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, paddingRight: 12 }}>
                                                <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="How can I help you today?" rows={1}
                                                    style={{ flex: 1, width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 16, color: "#111111", lineHeight: 1.5, padding: "16px 20px", minHeight: 50, maxHeight: 240 }} />
                                            </div>

                                            {/* Voice recording status */}
                                            {(isRecording || voiceLoading || voiceTranscript) && (
                                                <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                                    {isRecording && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} /><span style={{ fontSize: 13, color: "#ef4444" }}>Recording...</span></div>}
                                                    {voiceLoading && <span style={{ fontSize: 13, color: "#10b981" }}>Transcribing...</span>}
                                                    {voiceTranscript && !isRecording && !voiceLoading && <span style={{ fontSize: 13, color: "#717171", fontStyle: "italic" }}>✓ {voiceTranscript.substring(0, 50)}{voiceTranscript.length > 50 ? '...' : ''}</span>}
                                                </div>
                                            )}

                                            <div style={{ flex: 1 }} />
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 24px 16px" }}>
                                                {renderComposerLeftActions()}
                                                {renderComposerRightActions(true)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "center", fontSize: 11, color: "#71717a", marginTop: 14 }}>
                                            Everfern is an agentic AI and can make mistakes. Please double-check responses.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar */}
                        <AnimatePresence>
                            {(currentPlan || contextItems.length > 0 || (executionPlan && isExecutionPlanPaneOpen)) && (
                                <motion.div key="right-sidebar"
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: 420, opacity: 1 }}
                                    exit={{ width: 0, opacity: 0 }}
                                    style={{ borderLeft: "1px solid #e8e6d9", backgroundColor: "#f5f4f0", display: "flex", flexDirection: "column", overflow: "hidden" }}
                                >
                                    <div style={{ width: 420, display: "flex", flexDirection: "column", padding: "24px 16px", overflowY: "auto", height: "100%" }}>
                                        {((currentPlan || contextItems.length > 0) && !(executionPlan && isExecutionPlanPaneOpen)) && (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                                        </svg>
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: '0.02em' }}>Active Context</span>
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                                                    <AgentWorkspaceCards plan={currentPlan} contextItems={contextItems} setTooltip={setTooltipState} />
                                                </div>
                                            </>
                                        )}

                                        {executionPlan && isExecutionPlanPaneOpen && (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #e5e7eb' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {isLoading ? (
                                                                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <circle cx="12" cy="12" r="10" stroke="#c7d2fe" strokeWidth="4"></circle>
                                                                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="#6366f1" stroke="none"></path>
                                                                </svg>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                                    <line x1="12" y1="18" x2="12" y2="12"></line>
                                                                    <line x1="9" y1="15" x2="15" y2="15"></line>
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", letterSpacing: '0.02em' }}>Execution Plan</span>
                                                    </div>
                                                    <button type="button" onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setIsExecutionPlanPaneOpen(false);
                                                        if (activeConversationId) localStorage.setItem(`everfern_exec_pane_closed_${activeConversationId}`, "true");
                                                        const approvalMsg = `[PLAN_APPROVED]\nI have reviewed and approved your execution plan. Please proceed with the execution as planned.`;
                                                        setInputValue(approvalMsg);
                                                        setTimeout(() => {
                                                            const sendBtn = document.querySelector('button[title="Send"]') as HTMLButtonElement;
                                                            if (sendBtn) sendBtn.click();
                                                        }, 100);
                                                    }} style={{ fontSize: 11, fontWeight: 600, color: "#ffffff", backgroundColor: "#22c55e", padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", transition: "all 0.2s", boxShadow: '0 2px 6px rgba(34,197,94,0.25)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(34,197,94,0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(34,197,94,0.25)'; }}>
                                                        Approve
                                                    </button>
                                                </div>
                                                <div style={{
                                                    backgroundColor: "#ffffff",
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: 16,
                                                    padding: "20px 22px",
                                                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                                                    overflowWrap: "anywhere",
                                                    wordBreak: "break-word",
                                                    maxHeight: '60vh',
                                                    overflowY: 'auto',
                                                }}>
                                                    <MarkdownRenderer content={executionPlan.content} />
                                                </div>
                                                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.15)' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <line x1="12" y1="16" x2="12" y2="12"></line>
                                                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                                    </svg>
                                                    <span style={{ fontSize: 11, color: '#92400e', fontWeight: 500 }}>Review and approve to proceed with execution</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {settingsModalNode}
                <DirectoryModal isOpen={showDirectoryModal} onClose={() => setShowDirectoryModal(false)} />
                {onboardingModalNode}

                {/* Permission Modal */}
                <AnimatePresence>
                    {showPermissionModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,252,240,0.85)", backdropFilter: "blur(20px)" }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                whileHover={{ boxShadow: '0 40px 80px -20px rgba(239, 68, 68, 0.15)' }}
                                style={{ width: "100%", maxWidth: 460, backgroundColor: "#ffffff", border: "1px solid #fecaca", borderRadius: 28, padding: "52px 36px", textAlign: "center", boxShadow: "0 25px 60px -15px rgba(239, 68, 68, 0.2)" }}
                            >
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                                    style={{ width: 72, height: 72, borderRadius: 24, margin: "0 auto 28px", background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%)", border: "1px solid rgba(239, 68, 68, 0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                    <motion.svg
                                        width="36"
                                        height="36"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#ef4444"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </motion.svg>
                                </motion.div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 500, margin: "0 0 14px", color: "#201e24" }}
                                >
                                    Fern needs permission
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    style={{ fontSize: 15, color: "#71717a", marginBottom: 36, lineHeight: 1.6 }}
                                >
                                    The AI requested to execute a system command or modify files on your computer.
                                </motion.p>
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.25 }}
                                    style={{ display: "flex", gap: "14px", flexDirection: "column" }}
                                >
                                    <motion.button
                                        onClick={() => { setShowPermissionModal(false); (window as any).electronAPI?.acp?.agentPermissionResponse?.(true); }}
                                        whileHover={{ scale: 1.02, boxShadow: '0 8px 30px -10px rgba(0,0,0,0.3)' }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{ width: "100%", padding: "20px", backgroundColor: "#201e24", color: "#ffffff", borderRadius: 20, fontWeight: 600, fontSize: 16, border: "none", cursor: "pointer", boxShadow: '0 4px 20px -5px rgba(0,0,0,0.2)' }}
                                    >
                                        Allow Access
                                    </motion.button>
                                    <motion.button
                                        onClick={() => { setShowPermissionModal(false); (window as any).electronAPI?.acp?.agentPermissionResponse?.(false); }}
                                        whileHover={{ scale: 1.02, backgroundColor: "#fef2f2", color: "#dc2626" }}
                                        whileTap={{ scale: 0.98 }}
                                        style={{ width: "100%", padding: "20px", backgroundColor: "transparent", color: "#71717a", borderRadius: 20, fontWeight: 500, fontSize: 16, border: "1px solid #e8e6d9", cursor: "pointer", transition: "all 0.2s" }}
                                    >
                                        Deny
                                    </motion.button>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Global Tooltip */}
                <AnimatePresence>
                    {tooltipState.visible && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}
                            style={{ position: 'fixed', top: tooltipState.y + 15, left: tooltipState.x + 15, backgroundColor: '#ffffff', color: '#201e24', padding: '6px 14px', borderRadius: '99px', fontSize: 12, fontWeight: 500, pointerEvents: 'none', zIndex: 9999, border: '1px solid #3A3A3A', whiteSpace: 'nowrap', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tooltipState.content}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Motion Blur Cursor */}
                {settingsMotionBlur && (
                    <motion.div animate={{ x: mousePos.x - 150, y: mousePos.y - 150 }} transition={{ type: "spring", damping: 30, stiffness: 200, mass: 0.5 }}
                        style={{ position: 'fixed', top: 0, left: 0, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 70%)', pointerEvents: 'none', zIndex: 0, filter: 'blur(40px)' }} />
                )}

                {/* JSON Viewer Modal */}
                <AnimatePresence>
                    {isJsonViewerOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsJsonViewerOpen(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                style={{ width: "90%", maxWidth: 900, maxHeight: "80vh", backgroundColor: "#1a1a1a", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                                {/* Header */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #333", backgroundColor: "#252525" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <span style={{ padding: "4px 10px", backgroundColor: "#3b82f6", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{lastEventType}</span>
                                        <span style={{ fontSize: 13, color: "#9ca3af" }}>Last Event JSON</span>
                                        <span style={{ fontSize: 11, color: "#6b7280" }}>({lastEventJson.length} chars)</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(lastEventJson); }}
                                            style={{ padding: "6px 12px", backgroundColor: "#374151", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer" }}
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([lastEventJson], { type: "application/json" });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement("a");
                                                a.href = url;
                                                a.download = `everfern-event-${lastEventType}-${Date.now()}.json`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            style={{ padding: "6px 12px", backgroundColor: "#374151", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer" }}
                                        >
                                            Download
                                        </button>
                                        <button
                                            onClick={() => setIsJsonViewerOpen(false)}
                                            style={{ padding: "6px", backgroundColor: "transparent", color: "#9ca3af", borderRadius: 6, fontSize: 16, border: "none", cursor: "pointer" }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                {/* Content */}
                                <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
                                    <pre style={{ margin: 0, fontSize: 11, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#e5e5e5", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                        {lastEventJson}
                                    </pre>
                                </div>
                                {/* Footer */}
                                <div style={{ padding: "8px 16px", borderTop: "1px solid #333", fontSize: 11, color: "#6b7280", backgroundColor: "#252525" }}>
                                    Press <kbd style={{ padding: "2px 6px", backgroundColor: "#374151", borderRadius: 4, color: "#fff" }}>Ctrl+Shift+J</kbd> or click outside to close
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}

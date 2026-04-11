'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface PlanViewerPanelProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    onApprove: (content: string) => void;
}

const MarkdownRenderer = ({ content }: { content: string }) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const inlineRender = (text: string, parentKey: string | number): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let idx = 0;
        const patterns: [RegExp, (m: RegExpMatchArray, k: string) => React.ReactNode][] = [
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
            parts.push(bestRenderer(bestMatch, `inline-${parentKey}-${idx++}`));
            remaining = remaining.slice(earliest + bestMatch[0].length);
        }
        return <React.Fragment key={parentKey}>{parts}</React.Fragment>;
    };

    while (i < lines.length) {
        const line = lines[i];
        if (line.trim().startsWith('###')) {
            elements.push(<h3 key={i} style={{ fontSize: 18, fontWeight: 600, color: '#111111', marginTop: 24, marginBottom: 12 }}>{inlineRender(line.trim().slice(3).trim(), i)}</h3>);
        } else if (line.trim().startsWith('##')) {
            elements.push(<h2 key={i} style={{ fontSize: 22, fontWeight: 600, color: '#111111', marginTop: 32, marginBottom: 16, borderBottom: '1px solid #e8e6d9', paddingBottom: 8 }}>{inlineRender(line.trim().slice(2).trim(), i)}</h2>);
        } else if (line.trim().startsWith('#')) {
            elements.push(<h1 key={i} style={{ fontSize: 24, fontWeight: 700, color: '#111111', marginTop: 32, marginBottom: 16 }}>{inlineRender(line.trim().slice(1).trim(), i)}</h1>);
        } else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            elements.push(<div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, paddingLeft: 8 }}>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>•</span>
                <span style={{ color: '#4a4846', lineHeight: 1.6 }}>{inlineRender(line.trim().slice(2), i)}</span>
            </div>);
        } else if (line.trim()) {
            elements.push(<p key={i} style={{ color: '#4a4846', lineHeight: 1.7, marginBottom: 16 }}>{inlineRender(line, i)}</p>);
        } else {
            elements.push(<div key={i} style={{ height: 12 }} />);
        }
        i++;
    }
    return <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15 }}>{elements}</div>;
};

export default function PlanViewerPanel({ isOpen, onClose, content, onApprove }: PlanViewerPanelProps) {
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
                        width: '520px',
                        backgroundColor: 'rgba(255, 255, 255, 0.94)',
                        backdropFilter: 'blur(16px) saturate(180%)',
                        border: '1px solid rgba(232, 230, 217, 0.8)',
                        borderRadius: 32,
                        boxShadow: '-10px 0 40px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.02)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '28px 36px', borderBottom: '1px solid rgba(232, 230, 217, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(252, 251, 247, 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(251, 191, 36, 0.1)' }}>
                                <DocumentTextIcon width={24} height={24} color="#fbbf24" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#201e24', margin: 0, letterSpacing: '-0.02em' }}>Execution Plan</h2>
                                <p style={{ fontSize: 13, color: '#8a8886', margin: '2px 0 0' }}>Review and approve next steps</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#8a8886', cursor: 'pointer', padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                        >
                            <XMarkIcon width={20} height={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '36px', scrollBehavior: 'smooth' }}>
                        <div style={{ padding: '32px', backgroundColor: 'rgba(252, 251, 247, 0.4)', border: '1px solid rgba(232, 230, 217, 0.5)', borderRadius: 24, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}>
                            <MarkdownRenderer content={content} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '28px 36px', borderTop: '1px solid rgba(232, 230, 217, 0.5)', background: 'rgba(255, 255, 255, 0.8)', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button 
                            onClick={onClose}
                            style={{ flex: 1, padding: '16px', borderRadius: 18, border: '1px solid #e8e6d9', backgroundColor: 'transparent', color: '#71717a', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fcfcfb'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            Review later
                        </button>
                        <button 
                            onClick={() => { onApprove(content); onClose(); }}
                            style={{ flex: 2, padding: '16px', borderRadius: 18, border: 'none', backgroundColor: '#fbbf24', color: '#1a1a1a', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(251, 191, 36, 0.25)', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(251, 191, 36, 0.35)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 191, 36, 0.25)'; }}
                        >
                            <CheckCircleIcon width={20} height={20} strokeWidth={2.5} />
                            Approve & Execute
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

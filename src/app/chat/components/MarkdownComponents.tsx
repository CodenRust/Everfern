'use client';
import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { SyntaxHighlighter } from '../ArtifactsPanel';

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

// ── Streaming Markdown Component ─────────────────────────────────────────────
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

export { MarkdownRenderer, StreamingMarkdown };

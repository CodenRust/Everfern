"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

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

// ── Report Container (for displaying reports in a card-like container) ────────
interface ReportContainerProps {
    content: string;
    onView: (label: string, path: string) => void;
}

const ReportContainer = ({ content, onView }: ReportContainerProps) => {
    const computerLinkPattern = /\[([^\]]+)\]\(computer:\/\/\/([^)]+)\)/g;
    const links: Array<{ label: string; path: string }> = [];
    let match;
    while ((match = computerLinkPattern.exec(content)) !== null) {
        links.push({ label: match[1], path: match[2] });
    }

    if (links.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {links.map((link, idx) => {
                const ext = link.path.split('.').pop()?.toUpperCase() || 'FILE';
                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            borderRadius: 14,
                            backgroundColor: '#f4f3ef',
                            border: '1px solid #e8e6d9',
                            transition: 'all 0.2s ease',
                            fontFamily: "'Figtree', system-ui, sans-serif",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLDivElement;
                            el.style.backgroundColor = '#eceae4';
                            el.style.borderColor = '#ddd9ce';
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLDivElement;
                            el.style.backgroundColor = '#f4f3ef';
                            el.style.borderColor = '#e8e6d9';
                        }}
                    >
                        {/* Left side - Icon and text */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 10,
                                    backgroundColor: 'rgba(99,102,241,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#201e24', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {link.label}
                                </span>
                                <span style={{ fontSize: 11, color: '#8a8886', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {ext}
                                </span>
                            </div>
                        </div>

                        {/* Right side - View button */}
                        <button
                            onClick={() => onView(link.label, link.path)}
                            style={{
                                padding: '8px 18px',
                                borderRadius: 10,
                                backgroundColor: 'transparent',
                                border: '1.5px solid #c9c6be',
                                color: '#4a4846',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                transition: 'all 0.15s ease',
                                flexShrink: 0,
                                fontFamily: "'Figtree', system-ui, sans-serif",
                            }}
                            onMouseEnter={(e) => {
                                const el = e.currentTarget as HTMLButtonElement;
                                el.style.backgroundColor = '#201e24';
                                el.style.borderColor = '#201e24';
                                el.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                                const el = e.currentTarget as HTMLButtonElement;
                                el.style.backgroundColor = 'transparent';
                                el.style.borderColor = '#c9c6be';
                                el.style.color = '#4a4846';
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                            View
                        </button>
                    </motion.div>
                );
            })}
        </div>
    );
};

export { ReportLink, ReportPane, ReportContainer };

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DocumentTextIcon, XMarkIcon, DocumentDuplicateIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { SyntaxHighlighter } from './ArtifactsPanel';

interface FileViewerPaneProps {
    isOpen: boolean;
    onClose: () => void;
    name: string;
    path: string;
    content: string;
    chatId?: string;
}

export default function FileViewerPane({ isOpen, onClose, name, path, content, chatId }: FileViewerPaneProps) {
    const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
    const [copied, setCopied] = useState(false);

    const isHtmlOrReact = name.endsWith('.html') || name.endsWith('.htm') || name.endsWith('.jsx') || name.endsWith('.tsx');

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 40
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    style={{
                        width: '100%',
                        maxWidth: 1000,
                        height: '85vh',
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e8e6d9',
                        backgroundColor: '#fcfcfc'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>
                                {name} <span style={{ color: '#8a8886', fontWeight: 400 }}>· {name.split('.').pop()?.toUpperCase()}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isHtmlOrReact && (
                                <div style={{ display: 'flex', backgroundColor: '#f4f3ef', borderRadius: 6, padding: 2, marginRight: 16 }}>
                                    <button
                                        onClick={() => setViewMode('code')}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: 4,
                                            border: 'none',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            backgroundColor: viewMode === 'code' ? '#ffffff' : 'transparent',
                                            color: viewMode === 'code' ? '#111' : '#8a8886',
                                            boxShadow: viewMode === 'code' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        Code
                                    </button>
                                    <button
                                        onClick={() => setViewMode('preview')}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: 4,
                                            border: 'none',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            backgroundColor: viewMode === 'preview' ? '#ffffff' : 'transparent',
                                            color: viewMode === 'preview' ? '#111' : '#8a8886',
                                            boxShadow: viewMode === 'preview' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        Preview
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleCopy}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    border: '1px solid #e8e6d9',
                                    backgroundColor: '#fff',
                                    color: '#4a4846',
                                    fontSize: 12,
                                    cursor: 'pointer'
                                }}
                            >
                                <DocumentDuplicateIcon width={14} height={14} />
                                {copied ? 'Copied!' : 'Copy'}
                            </button>

                            <button
                                style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#8a8886',
                                    cursor: 'pointer'
                                }}
                            >
                                <ArrowPathIcon width={16} height={16} />
                            </button>

                            <button
                                onClick={onClose}
                                style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: '#8a8886',
                                    cursor: 'pointer'
                                }}
                            >
                                <XMarkIcon width={18} height={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, overflow: 'auto', backgroundColor: viewMode === 'code' ? '#faf9f6' : '#fff' }}>
                        {viewMode === 'code' ? (
                            <div style={{ display: 'flex', fontSize: 13, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                                <div style={{
                                    padding: '16px 12px',
                                    color: '#a1a1aa',
                                    textAlign: 'right',
                                    userSelect: 'none',
                                    borderRight: '1px solid #e8e6d9',
                                    backgroundColor: '#f4f3ef',
                                    minWidth: 48
                                }}>
                                    {content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                                </div>
                                <div style={{ padding: '16px 24px', flex: 1, overflowX: 'auto' }}>
                                    <SyntaxHighlighter code={content} language={name.split('.').pop() || 'text'} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ width: '100%', height: '100%' }}>
                                {chatId && isHtmlOrReact ? (
                                    <iframe
                                        src={`everfern-site://${chatId}/${name}`}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        title="Preview"
                                    />
                                ) : (
                                    <div style={{ padding: 40, textAlign: 'center', color: '#8a8886' }}>
                                        Preview not available
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

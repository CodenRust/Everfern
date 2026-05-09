import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
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
                initial={{ x: 600, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 600, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{
                    position: 'fixed',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 600,
                    backgroundColor: '#ffffff',
                    borderLeft: '1px solid #e8e6d9',
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '-2px 0 8px rgba(0,0,0,0.04)'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #e8e6d9',
                    backgroundColor: '#faf9f7',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
                            {name}
                        </div>
                        <span style={{ fontSize: 12, color: '#8a8886', fontWeight: 400 }}>
                            {name.split('.').pop()?.toUpperCase()}
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#8a8886',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0efec';
                            e.currentTarget.style.color = '#111';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#8a8886';
                        }}
                    >
                        <XMarkIcon width={18} height={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                {isHtmlOrReact && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0,
                        padding: '0 20px',
                        borderBottom: '1px solid #e8e6d9',
                        backgroundColor: '#ffffff',
                        flexShrink: 0
                    }}>
                        <button
                            onClick={() => setViewMode('code')}
                            style={{
                                padding: '12px 16px',
                                borderRadius: 0,
                                border: 'none',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor: 'transparent',
                                color: viewMode === 'code' ? '#0891b2' : '#8a8886',
                                borderBottom: viewMode === 'code' ? '2px solid #0891b2' : 'none',
                                transition: 'all 0.2s ease',
                                letterSpacing: '-0.01em'
                            }}
                        >
                            Code
                        </button>
                        <button
                            onClick={() => setViewMode('preview')}
                            style={{
                                padding: '12px 16px',
                                borderRadius: 0,
                                border: 'none',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor: 'transparent',
                                color: viewMode === 'preview' ? '#0891b2' : '#8a8886',
                                borderBottom: viewMode === 'preview' ? '2px solid #0891b2' : 'none',
                                transition: 'all 0.2s ease',
                                letterSpacing: '-0.01em'
                            }}
                        >
                            Preview
                        </button>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 20px',
                    borderBottom: '1px solid #e8e6d9',
                    backgroundColor: '#ffffff',
                    flexShrink: 0
                }}>
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
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9f8f4';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff';
                        }}
                    >
                        <DocumentDuplicateIcon width={14} height={14} />
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflow: 'auto', backgroundColor: viewMode === 'code' ? '#faf9f6' : '#ffffff' }}>
                    {viewMode === 'code' ? (
                        <div style={{ display: 'flex', fontSize: 12, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", minHeight: '100%' }}>
                            <div style={{
                                padding: '16px 12px',
                                color: '#a1a1aa',
                                textAlign: 'right',
                                userSelect: 'none',
                                borderRight: '1px solid #e8e6d9',
                                backgroundColor: '#f4f3ef',
                                minWidth: 48,
                                flexShrink: 0
                            }}>
                                {content.split('\n').map((_, i) => <div key={i} style={{ lineHeight: '1.6' }}>{i + 1}</div>)}
                            </div>
                            <div style={{ padding: '16px 20px', flex: 1, overflowX: 'auto', lineHeight: '1.6' }}>
                                <SyntaxHighlighter code={content} language={name.split('.').pop() || 'text'} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: '100%' }}>
                            {chatId && isHtmlOrReact ? (
                                <iframe
                                    src={`everfern-site://${chatId}/${name}`}
                                    style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#ffffff' }}
                                    title="Preview"
                                />
                            ) : (
                                <div style={{ padding: 40, textAlign: 'center', color: '#8a8886', fontSize: 13 }}>
                                    Preview not available
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

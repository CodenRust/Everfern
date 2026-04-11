import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DocumentIcon, CodeBracketIcon, PhotoIcon, TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import FileViewerPane from './FileViewerPane';

interface FileArtifactProps {
    path: string;
    description: string;
    chatId: string;
}

export default function FileArtifact({ path, description, chatId }: FileArtifactProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState('');
    const [isHovered, setIsHovered] = useState(false);

    const filename = path.split(/[\\/]/).pop() || 'Unknown File';
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Load file content when opened
    useEffect(() => {
        if (isOpen && !content) {
            const loadContent = async () => {
                try {
                    // Try to read from sites or artifacts
                    // The path typically ends with sites/chatId/filename or artifacts/chatId/filename
                    // Since it's presented to user, it's likely an artifact or site
                    let data = await (window as any).electronAPI?.sites?.read?.(chatId, filename);
                    if (!data) {
                        data = await (window as any).electronAPI?.artifacts?.read?.(chatId, filename);
                    }
                    if (data) {
                        setContent(data);
                    } else {
                        setContent('// Could not load file content');
                    }
                } catch (err) {
                    console.error('Failed to load file content', err);
                    setContent('// Error loading file content');
                }
            };
            loadContent();
        }
    }, [isOpen, chatId, filename, content]);

    const getIcon = () => {
        if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'py', 'json', 'md'].includes(ext)) return <CodeBracketIcon width={24} height={24} color="#6366f1" />;
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <PhotoIcon width={24} height={24} color="#10b981" />;
        if (['csv', 'xlsx', 'xls'].includes(ext)) return <TableCellsIcon width={24} height={24} color="#14b8a6" />;
        if (['pdf', 'doc', 'docx'].includes(ext)) return <DocumentIcon width={24} height={24} color="#ef4444" />;
        return <DocumentIcon width={24} height={24} color="#8b5cf6" />;
    };

    return (
        <>
            <motion.div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => setIsOpen(true)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '16px 20px',
                    backgroundColor: isHovered ? '#fcfcfc' : '#ffffff',
                    border: '1px solid #e8e6d9',
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.05)' : '0 2px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    marginTop: 12,
                    marginBottom: 12,
                    maxWidth: 600,
                    gap: 16
                }}
            >
                <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: '#f4f3ef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}>
                    {getIcon()}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {filename}
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8886', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {description}
                    </div>
                    <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {path}
                    </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(true);
                        }}
                        style={{
                            padding: '6px 14px',
                            backgroundColor: isHovered ? '#201e24' : '#f4f3ef',
                            color: isHovered ? '#ffffff' : '#4a4846',
                            border: 'none',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        View File
                    </button>
                </div>
            </motion.div>

            {isOpen && (
                <FileViewerPane
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    name={filename}
                    path={path}
                    content={content || 'Loading...'}
                    chatId={chatId}
                />
            )}
        </>
    );
}

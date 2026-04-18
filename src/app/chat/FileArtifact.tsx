import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DocumentIcon, CodeBracketIcon, PhotoIcon, TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import FileViewerPane from './FileViewerPane';

interface FileArtifactProps {
    path: string;
    description: string;
    chatId: string;
    onOpenArtifact?: (name: string) => void;
}

export default function FileArtifact({ path, description, chatId, onOpenArtifact }: FileArtifactProps) {
    const [isHovered, setIsHovered] = useState(false);

    const filename = path.split(/[\\/]/).pop() || 'Unknown File';
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    const getFileIcon = (type: string) => {
        if (type.includes('python') || type.includes('py')) return '🐍';
        if (type.includes('html') || type.includes('htm')) return '🌐';
        if (type.includes('json')) return '{ }';
        if (type.includes('image') || ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(type)) return '🖼️';
        if (type.includes('pdf')) return '📄';
        if (type.includes('csv') || type.includes('data') || ['xlsx', 'xls'].includes(type)) return '📊';
        return '📎';
    };

    const handleClick = () => {
        if (onOpenArtifact) {
            onOpenArtifact(filename);
        }
    };

    return (
        <motion.div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: isHovered ? '#ffffff' : '#f5f4f0',
                border: `1.5px solid ${isHovered ? '#d4cfc3' : '#e8e6d9'}`,
                borderRadius: 16,
                cursor: 'pointer',
                boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease',
                marginTop: 16,
                marginBottom: 16,
                width: '100%',
                maxWidth: 840,
                gap: 16,
                boxSizing: 'border-box'
            }}
        >
            {/* Thumbnail / Icon - Left (Styled exactly like ArtifactsList) */}
            <div
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: '#ffffff',
                    border: '1px solid #e8e6d9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 20,
                }}
            >
                {getFileIcon(ext)}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {filename}
                </div>
                <div style={{ fontSize: 12, color: '#8a8886', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {description || `Generated ${ext.toUpperCase()} artifact`}
                </div>
                <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.7 }}>
                    {path}
                </div>
            </div>

            {/* Arrow - Far Right */}
            <div style={{ color: '#8a8886', flexShrink: 0, opacity: isHovered ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        </motion.div>
    );
}

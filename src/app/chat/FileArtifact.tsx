import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, FolderIcon } from '@heroicons/react/24/outline';

interface FileArtifactProps {
    path: string;
    description: string;
    chatId: string;
    onOpenArtifact?: (name: string) => void;
}

const AntigravityIcon = () => (
    <div style={{ width: 18, height: 18, backgroundColor: '#111', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}>A</span>
    </div>
);

const CodeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
    </svg>
);

const DocIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

export default function FileArtifact({ path, description, chatId, onOpenArtifact }: FileArtifactProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);

    const [showDropdown, setShowDropdown] = useState(false);

    const filename = path.split(/[\\/]/).pop() || 'Unknown File';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    const getFileDetails = (extension: string) => {
        const details = {
            icon: <DocIcon />,
            subtitle: extension.toUpperCase()
        };

        if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'json', 'c', 'cpp', 'go', 'rs'].includes(extension)) {
            details.icon = <CodeIcon />;
            if (extension === 'js') details.subtitle = 'JS';
            else if (extension === 'ts') details.subtitle = 'TS';
            else if (extension === 'json') details.subtitle = 'Code · JSON';
            else if (extension === 'html') details.subtitle = 'Code · HTML';
            else if (extension === 'css') details.subtitle = 'Style · CSS';
            else if (extension === 'py') details.subtitle = 'Script · Python';
            else details.subtitle = `Code · ${extension.toUpperCase()}`;
        } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(extension)) {
            details.subtitle = 'Image';
        } else if (extension === 'pdf') {
            details.subtitle = 'PDF Document';
        }

        return details;
    };

    const fileDetails = getFileDetails(ext);

    const handleClick = () => {
        if (onOpenArtifact) {
            onOpenArtifact(filename);
        }
    };

    const handleShowInFolder = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDropdown(false);
        // Potential future: (window as any).electronAPI.shell.showItemInFolder(path);
    };

    return (
        <motion.div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setShowDropdown(false);
            }}
            onClick={handleClick}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '24px 32px',
                backgroundColor: '#ffffff',
                border: '1px solid #e8e6d9',
                borderRadius: 24,
                cursor: 'pointer',
                boxShadow: isHovered ? '0 12px 30px rgba(0,0,0,0.06)' : '0 4px 12px rgba(0,0,0,0.02)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                marginTop: 12,
                marginBottom: 12,
                width: '100%',
                maxWidth: 900,
                gap: 24,
                boxSizing: 'border-box',
                position: 'relative',
                overflow: 'visible' // Changed to visible for dropdown
            }}
        >
            {/* Tilted File Icon - Left */}
            <div style={{ position: 'relative', width: 70, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {/* Tilted Shadow/Card Background */}
                <div style={{
                    position: 'absolute',
                    width: 58,
                    height: 72,
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e8e6d9',
                    borderRadius: 12,
                    transform: 'rotate(-5deg)',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                }} />
                {/* Main Icon content */}
                <div style={{ position: 'relative', color: '#8a8886', transform: 'rotate(-5deg)' }}>
                    {fileDetails.icon}
                </div>
            </div>
            
            {/* Text Area - Center */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: '#111', letterSpacing: '-0.01em' }}>
                    {filename.split('.')[0]}
                </div>
                <div style={{ fontSize: 14, color: '#8a8886', fontWeight: 500 }}>
                    {fileDetails.subtitle}
                </div>
            </div>

            {/* Multi-part Action Button - Right */}
            <div style={{ position: 'relative' }}>
                <div 
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: isButtonHovered ? '#f9f8f4' : '#ffffff', 
                        border: '1px solid #e8e6d9', 
                        borderRadius: 14,
                        height: 42,
                        transition: 'all 0.2s ease',
                        boxShadow: isButtonHovered ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                    }}
                >
                    {/* Main Action Part */}
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClick();
                        }}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            padding: '0 16px',
                            height: '100%',
                            borderRight: '1px solid #e8e6d9',
                            cursor: 'pointer'
                        }}
                    >
                        <AntigravityIcon />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Antigravity</span>
                    </div>
                    
                    {/* Dropdown Toggle Part */}
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDropdown(!showDropdown);
                        }}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: 38,
                            height: '100%',
                            color: '#8a8886',
                            cursor: 'pointer'
                        }}
                    >
                        <ChevronDownIcon width={16} height={16} />
                    </div>
                </div>

                {/* Dropdown Menu */}
                <AnimatePresence>
                    {showDropdown && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                width: 180,
                                backgroundColor: '#ffffff',
                                border: '1px solid #e8e6d9',
                                borderRadius: 14,
                                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                                zIndex: 100,
                                padding: 6,
                                overflow: 'hidden'
                            }}
                        >
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClick();
                                    setShowDropdown(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: '#111'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f4f0'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <AntigravityIcon />
                                Open in Antigravity
                            </div>
                            <div 
                                onClick={handleShowInFolder}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: '#111'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f4f0'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <FolderIcon width={18} height={18} style={{ color: '#8a8886' }} />
                                Show in Folder
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Hover Indicator Line at bottom (Subtle) */}
            <motion.div 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isHovered ? 1 : 0 }}
                style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    height: 3, 
                    background: '#111', 
                    transformOrigin: 'center',
                    opacity: 0.1
                }} 
            />
        </motion.div>
    );
}


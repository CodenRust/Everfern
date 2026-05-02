'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeftIcon,
    InformationCircleIcon,
    FolderIcon,
    ArrowPathIcon,
    DocumentIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (project: any) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
    const [name, setName] = useState('');
    const [instructions, setInstructions] = useState('');
    const [path, setPath] = useState('');
    const [basePath, setBasePath] = useState('');
    const [files, setFiles] = useState<string[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const pathEditedRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setName('');
            setInstructions('');
            setPath('');
            setFiles([]);
            pathEditedRef.current = false;
            setIsFocused(true);

            // Fetch default path
            (async () => {
                const isWin = navigator.userAgent.toLowerCase().includes('windows');
                let defaultPath = isWin ? 'C:\\Users\\testuser\\Documents\\Everfern\\Projects' : '~/Documents/Everfern/Projects';
                try {
                    if ((window as any).electronAPI?.projects?.getDefaultPath) {
                        const ipcPath = await (window as any).electronAPI.projects.getDefaultPath();
                        if (ipcPath) defaultPath = ipcPath;
                    }
                } catch (e) {
                    console.error('Failed to get default path via IPC', e);
                }
                setBasePath(defaultPath);
                setPath(defaultPath);
            })();
        }
    }, [isOpen]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setName(newName);

        if (!pathEditedRef.current && basePath) {
            // Auto-update path if user hasn't manually overridden it
            const separator = basePath.includes('\\') ? '\\' : '/';
            const safeName = newName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
            if (safeName) {
                setPath(`${basePath}${separator}${safeName}`);
            } else {
                setPath(basePath);
            }
        }
    };

    const handleSelectFolder = async () => {
        try {
            if ((window as any).electronAPI?.projects?.selectFolder) {
                const selectedPath = await (window as any).electronAPI.projects.selectFolder();
                if (selectedPath) {
                    setPath(selectedPath);
                    pathEditedRef.current = true;
                }
            } else {
                alert('Please restart your development server (npm run dev) to enable folder selection.');
            }
        } catch (err) {
            console.error('Failed to select folder:', err);
        }
    };

    const handleSelectFiles = async () => {
        try {
            if ((window as any).electronAPI?.projects?.selectFiles) {
                const selectedFiles = await (window as any).electronAPI.projects.selectFiles();
                if (selectedFiles && selectedFiles.length > 0) {
                    setFiles(prev => [...prev, ...selectedFiles].filter((v, i, a) => a.indexOf(v) === i));
                }
            } else {
                alert('Please restart your development server (npm run dev) to enable file selection.');
            }
        } catch (err) {
            console.error('Failed to select files:', err);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).map(f => (f as any).path).filter(Boolean);
        if (droppedFiles.length > 0) {
            setFiles(prev => [...prev, ...droppedFiles].filter((v, i, a) => a.indexOf(v) === i));
        }
    };

    const handleCreate = async () => {
        if (!name || !path) return;
        setIsCreating(true);
        try {
            if ((window as any).electronAPI?.projects?.create) {
                const newProject = await (window as any).electronAPI.projects.create({
                    name,
                    path,
                    instructions,
                    files
                });
                onCreated(newProject.project || newProject);
            }
        } catch (err) {
            console.error('Failed to create project:', err);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            width: '100%',
                            maxWidth: 520,
                            backgroundColor: '#ffffff',
                            borderRadius: 24,
                            padding: '32px 32px 24px',
                            position: 'relative',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
                            zIndex: 1,
                            border: '1px solid #f0eee4'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8c85', padding: 4 }}>
                                <ArrowLeftIcon width={20} height={20} strokeWidth={2} />
                            </button>
                            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.01em' }}>Start a new project</h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Name Input */}
                            <div>
                                <label style={{ display: 'flex', gap: 4, fontSize: 13, fontWeight: 600, color: '#4a4846', marginBottom: 8 }}>
                                    Name <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Website Creation"
                                    value={name}
                                    onChange={handleNameChange}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        border: isFocused ? '1.5px solid #3b82f6' : '1px solid #d1d5db',
                                        fontSize: 15,
                                        outline: 'none',
                                        backgroundColor: '#fff',
                                        boxShadow: isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                />
                            </div>

                            {/* Instructions Input */}
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4a4846', marginBottom: 8 }}>Instructions</label>
                                <textarea
                                    placeholder="Tell Fern how to work in this project (optional)"
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        border: '1px solid #d1d5db',
                                        fontSize: 15,
                                        outline: 'none',
                                        backgroundColor: '#fff',
                                        resize: 'none'
                                    }}
                                />
                            </div>

                            {/* Add files dropzone */}
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#4a4846', marginBottom: 8 }}>Add files</label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                    onDrop={handleDrop}
                                    onClick={handleSelectFiles}
                                    style={{
                                        width: '100%',
                                        padding: '20px',
                                        borderRadius: 12,
                                        border: isDragging ? '1.5px dashed #3b82f6' : '1px dashed #d1d5db',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isDragging ? '#3b82f6' : '#8e8c85',
                                        fontSize: 14,
                                        backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.05)' : '#faf9f5',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ fontSize: 18, marginRight: 8, fontWeight: 300 }}>+</span> Drop files here or click to browse
                                    </div>
                                    {files.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, width: '100%' }}>
                                            {files.map((file, i) => {
                                                const fileName = file.split(/[\\/]/).pop();
                                                return (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#4b5563' }} onClick={e => e.stopPropagation()}>
                                                        <DocumentIcon width={14} height={14} />
                                                        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
                                                        <button onClick={() => setFiles(f => f.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                                                            <XMarkIcon width={12} height={12} color="#9ca3af" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Choose project location */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: '#4a4846' }}>Choose project location</label>
                                    <InformationCircleIcon width={16} height={16} color="#8e8c85" />
                                </div>
                                <button
                                    onClick={handleSelectFolder}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        border: '1px solid #d1d5db',
                                        backgroundColor: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        cursor: 'pointer',
                                        color: path ? '#111' : '#8e8c85',
                                        fontSize: 14,
                                        textAlign: 'left'
                                    }}
                                >
                                    <FolderIcon width={20} height={20} color="#8e8c85" />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>
                                        {path ? `\u200E${path}` : 'Select a folder...'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontSize: 13, fontWeight: 500 }}>
                                <SparklesIcon width={16} height={16} />
                                Memory is on
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: 10,
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#fff',
                                        color: '#111',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!name || !path || isCreating}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: 10,
                                        backgroundColor: (!name || !path || isCreating) ? '#e5e7eb' : '#111',
                                        color: (!name || !path || isCreating) ? '#9ca3af' : '#fff',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        border: 'none',
                                        cursor: (!name || !path || isCreating) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}
                                >
                                    {isCreating && <ArrowPathIcon width={16} height={16} className="animate-spin" />}
                                    Create
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

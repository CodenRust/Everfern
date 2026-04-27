"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FileCreationNotificationProps {
    filename: string;
    content: string;
    size: number;
    isNew: boolean; // true for new files, false for edits
    status: 'creating' | 'success' | 'error';
    duration?: number;
    onViewFile?: () => void;
    onOpenInEditor?: () => void;
}

export const FileCreationNotification: React.FC<FileCreationNotificationProps> = ({
    filename,
    content,
    size,
    isNew,
    status,
    duration,
    onViewFile,
    onOpenInEditor
}) => {
    const [copied, setCopied] = useState(false);

    const fileExtension = filename.split('.').pop()?.toUpperCase() || 'FILE';
    const fileSizeKB = (size / 1024).toFixed(1);
    const lineCount = content.split('\n').length;

    const handleCopyContent = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy content:', err);
        }
    };

    const getActionText = () => {
        if (status === 'creating') return isNew ? 'Creating' : 'Updating';
        if (status === 'success') return isNew ? 'Created' : 'Updated';
        if (status === 'error') return 'Failed to ' + (isNew ? 'create' : 'update');
        return '';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-xl border border-green-200 bg-green-50 overflow-hidden relative"
        >
            <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                    {/* File Icon */}
                    <div className="w-8 h-8 rounded-md border border-gray-300 bg-white flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0 font-mono">
                        {fileExtension}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                                {getActionText()} {filename}
                            </span>
                            {isNew && status === 'success' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                    </svg>
                                    New
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                            <span>{fileSizeKB} KB</span>
                            <span>{lineCount} lines</span>
                        </div>
                    </div>

                    {/* Status Icon */}
                    <div className="flex items-center gap-2">
                        {status === 'success' && (
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <button
                            onClick={() => onViewFile?.()}
                            className="p-1.5 hover:bg-green-100 rounded-md transition-colors"
                            title="View file"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>

                        <button
                            onClick={handleCopyContent}
                            className="p-1.5 hover:bg-green-100 rounded-md transition-colors"
                            title="Copy content"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={copied ? 'text-green-600' : 'text-gray-600'}>
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>

                        {onOpenInEditor && (
                            <button
                                onClick={onOpenInEditor}
                                className="p-1.5 hover:bg-green-100 rounded-md transition-colors"
                                title="Open in editor"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                    <polyline points="15,3 21,3 21,9"/>
                                    <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Success Message */}
                {status === 'success' && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-green-800">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <span>File {isNew ? 'created' : 'updated'} successfully</span>
                    </div>
                )}
            </div>

            {/* Copy Success Toast */}
            <AnimatePresence>
                {copied && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded shadow-lg z-10"
                    >
                        Copied to clipboard!
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default FileCreationNotification;

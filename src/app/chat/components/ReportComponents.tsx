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
        <div className="flex flex-wrap gap-2 mt-2.5">
            {links.map((link, idx) => (
                <button
                    key={idx}
                    onClick={() => onOpen(link.label, link.path)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#f4f3ef] border border-[#e0ded9] text-[#4a4846] text-xs font-medium cursor-pointer transition-all duration-150 hover:bg-[#eceae4] hover:border-[#ccc9c3] hover:text-[#201e24]"
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
                    className="fixed top-3 right-3 bottom-3 w-[65vw] max-w-[1100px] bg-white border border-[#e8e6d9] rounded-3xl shadow-[−10px_0_40px_rgba(0,0,0,0.08),0_10px_30px_rgba(0,0,0,0.03)] z-1000 flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-7 py-5 border-b border-[#f0ede8] flex items-center justify-between bg-[#faf9f7]">
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[rgba(99,102,241,0.1)] flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-[17px] font-semibold text-[#201e24] m-0">{label}</h2>
                                <p className="text-xs text-[#8a8886] mt-0.5 font-mono">{path.split(/[/\\]/).pop()}</p>
                            </div>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => window.open(fileUrl, '_blank')}
                                className="px-4 py-2 rounded-[10px] border border-[#e0ded9] bg-transparent text-[#4a4846] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-150 hover:bg-[#f4f3ef]"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Open in Browser
                            </button>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-[10px] bg-transparent border border-[#e0ded9] text-[#8a8886] cursor-pointer flex items-center justify-center transition-all duration-150 hover:bg-[#f4f3ef] hover:text-[#201e24]"
                            >
                                <XMarkIcon width={18} height={18} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden bg-[#fafaf8]">
                        {isHtml ? (
                            <iframe
                                src={fileUrl}
                                title={label}
                                className="w-full h-full border-none block"
                                sandbox="allow-same-origin allow-scripts"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full flex-col gap-4">
                                <div className="w-16 h-16 rounded-[20px] bg-[#f4f3ef] flex items-center justify-center">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a8886" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-[15px] font-semibold text-[#201e24] mb-1">Preview not available</p>
                                    <p className="text-[13px] text-[#8a8886]">Open in browser to view this file</p>
                                </div>
                                <button
                                    onClick={() => window.open(fileUrl, '_blank')}
                                    className="px-[22px] py-2.5 rounded-[10px] border-none bg-[#6366f1] text-white text-[13px] font-semibold cursor-pointer"
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

// ── Report Container (card shown in chat for generated reports) ───────────────
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
        <div className="flex flex-col gap-2.5 mt-3">
            {links.map((link, idx) => {
                const ext = link.path.split('.').pop()?.toUpperCase() || 'FILE';
                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.05 }}
                        className="flex items-center justify-between px-[18px] py-[14px] rounded-2xl bg-[#f4f3ef] border border-[#e8e6d9] transition-all duration-200 hover:bg-[#eceae4] hover:border-[#ddd9ce]"
                    >
                        {/* Left — icon + label */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <div className="w-11 h-11 rounded-[10px] bg-[rgba(99,102,241,0.1)] flex items-center justify-center shrink-0">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[14px] font-semibold text-[#201e24] whitespace-nowrap overflow-hidden text-ellipsis">
                                    {link.label}
                                </span>
                                <span className="text-[11px] text-[#8a8886] font-mono">
                                    {ext}
                                </span>
                            </div>
                        </div>

                        {/* Right — View button */}
                        <button
                            onClick={() => onView(link.label, link.path)}
                            className="px-[18px] py-2 rounded-[10px] bg-transparent border-[1.5px] border-[#c9c6be] text-[#4a4846] text-[13px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-150 shrink-0 hover:bg-[#201e24] hover:border-[#201e24] hover:text-white"
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

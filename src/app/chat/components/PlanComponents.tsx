"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDownIcon,
    CheckIcon,
    CheckCircleIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { MarkdownRenderer } from './MarkdownComponents';

const PlanReviewCard = ({ plan, onApprove, onEdit }: { plan: { content: string; chatId: string }; onApprove: (content: string) => void; onEdit: () => void }) => {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.98, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{ marginTop: '12px', marginBottom: '24px', padding: '24px', backgroundColor: 'rgba(251, 191, 36, 0.04)', border: '1px solid rgba(251, 191, 36, 0.15)', borderRadius: 24, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}
        >
            <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'radial-gradient(circle at top right, rgba(251, 191, 36, 0.12), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(251, 191, 36, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <DocumentTextIcon width={24} height={24} color="#fbbf24" />
                </div>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>Execution Plan Ready</div>
                    <div style={{ fontSize: 13, color: '#a1a1aa' }}>Review the proposed steps before I proceed</div>
                </div>
            </div>
            <div style={{ backgroundColor: '#131312', border: '1px solid #2b2a29', borderRadius: 16, padding: '20px 24px', maxHeight: 350, overflowY: 'auto', WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)' }}>
                <MarkdownRenderer content={plan.content} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4 }}>
                <button onClick={onEdit} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid #363534', backgroundColor: 'transparent', color: '#a1a1aa', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}>
                    View in Artifacts
                </button>
                <button onClick={() => onApprove(plan.content)} style={{ padding: '10px 26px', borderRadius: 12, border: 'none', backgroundColor: '#fbbf24', color: '#1a1a1a', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 15px rgba(251, 191, 36, 0.2)', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(251, 191, 36, 0.3)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(251, 191, 36, 0.2)'; }}>
                    <CheckCircleIcon width={18} height={18} />
                    Approve & Execute
                </button>
            </div>
        </motion.div>
    );
};

const AgentWorkspaceCards = ({ plan, contextItems, setTooltip }: { plan: any | null; contextItems: any[]; setTooltip: (ts: any) => void }) => {
    const [progressExpanded, setProgressExpanded] = useState(true);
    const [contextExpanded, setContextExpanded] = useState(true);

    if (!plan && contextItems.length === 0) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {plan && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", backgroundColor: "transparent" }}>
                    <div onClick={() => setProgressExpanded(!progressExpanded)} style={{ padding: "8px 0px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "#201e24" }}>Progress</span>
                        <ChevronDownIcon width={16} height={16} color="#8a8886" style={{ transform: progressExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>
                    <AnimatePresence>
                        {progressExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 12, paddingBottom: 16 }}>
                                    {plan.steps?.map((step: any, index: number) => {
                                        const isDone = step.status === 'done';
                                        const isInProgress = step.status === 'in_progress';
                                        return (
                                            <div key={step.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                                {isDone ? (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <CheckIcon width={14} height={14} color="#16a34a" strokeWidth={3} />
                                                    </div>
                                                ) : isInProgress ? (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, border: "2.5px solid #111111", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <span style={{ fontSize: 13, color: "#111111", fontWeight: 700 }}>{index + 1}</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f4f4f4", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                        <span style={{ fontSize: 12, color: "#8a8886", fontWeight: 500 }}>{index + 1}</span>
                                                    </div>
                                                )}
                                                <span style={{ fontSize: 14, fontWeight: isInProgress ? 500 : 400, color: isDone ? "#201e24" : isInProgress ? "#201e24" : "#8a8886", lineHeight: 1.5, marginTop: 4 }}>
                                                    {step.description}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {contextItems.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 16, overflow: "hidden" }}>
                    <div onClick={() => setContextExpanded(!contextExpanded)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: contextExpanded ? "1px solid #e8e6d9" : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#201e24", textTransform: "uppercase", letterSpacing: "0.03em" }}>Active Context</span>
                        <ChevronDownIcon width={14} height={14} color="#8a8886" style={{ transform: contextExpanded ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                    </div>
                    <AnimatePresence>
                        {contextExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 16px 16px" }}>
                                    {contextItems.map((item, idx) => {
                                        const isFolder = item.label.startsWith("Folder:");
                                        return (
                                            <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                                <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f5f4f0", border: "1px solid #e8e6d9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                                    {isFolder || item.type === 'file' ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                                    ) : item.type === 'web' ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1-4-10z"></path></svg>
                                                    ) : (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                                    )}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                                                    <span
                                                        onMouseEnter={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content: item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '') })}
                                                        onMouseMove={(e) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content: item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '') })}
                                                        onMouseLeave={() => setTooltip({ visible: false, x: 0, y: 0, content: "" })}
                                                        style={{ fontSize: 14, fontWeight: 400, color: "#A0A0A0", lineHeight: 1.5, marginTop: 4, wordBreak: "break-all", cursor: "default" }}
                                                    >
                                                        <span style={{ color: "#F0F0F0", fontWeight: 500 }}>{isFolder ? "Folder:" : item.type === "web" ? "URL:" : "File:"}</span> {item.label.replace(/^(Folder:|File:|URL:)?\s*/i, '').split(/[/\\]/).pop()}
                                                    </span>
                                                    {item.base64Image && (
                                                        <div style={{ marginTop: 2, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                                                            <img src={`data:image/jpeg;base64,${item.base64Image}`} alt="vision context" style={{ width: "100%", display: "block" }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
};

export { PlanReviewCard, AgentWorkspaceCards };

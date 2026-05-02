import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownComponents';
import { CodingPlanCard } from './CodingPlanCard';

// Add CSS animation for spinner
const spinnerStyle = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = spinnerStyle;
    document.head.appendChild(style);
}

// ── Tool Entry Types ─────────────────────────────────────────────────────────
interface ParsedTool {
    name: string;
    jsonValue: Record<string, any> | null;
    rawValue: string;
}

// ── Robust tool-line parser ──────────────────────────────────────────────────
// Handles: `toolName — {"key":"val"}` and `toolName — some command string`
// JSON may span multiple lines.
function parseToolEntries(text: string): ParsedTool[] {
    const lines = text.split('\n');
    const chunks: { name: string; rawValue: string }[] = [];
    let current: { name: string; rawValue: string } | null = null;

    for (const line of lines) {
        // Match:  toolName — rest   (em dash, en dash, or two hyphens)
        const match = line.match(
            /^(?:[-*•]\s*)?(?:\*{1,2})?([a-zA-Z0-9_]+)(?:\*{1,2})?\s*(?:—|–|--)\s*(.+)$/
        );
        if (match) {
            if (current) chunks.push(current);
            current = { name: match[1], rawValue: match[2] };
        } else if (current) {
            // continuation line (multi-line JSON)
            current.rawValue += '\n' + line;
        }
    }
    if (current) chunks.push(current);

    return chunks.map(({ name, rawValue }) => {
        let jsonValue: Record<string, any> | null = null;
        try {
            let s = rawValue.trim().replace(/^`+/, '').replace(/`+$/, '');
            jsonValue = JSON.parse(s);
        } catch {
            /* not JSON – use rawValue as command */
        }
        return { name, jsonValue, rawValue: rawValue.trim() };
    });
}

// ── Tool icon / colour helper ────────────────────────────────────────────────
function getToolMeta(name: string) {
    if (name.includes('write') || name.includes('file'))
        return { icon: '📝', color: '#dc3545', bg: '#fff5f5', border: '#ffc9c9' };
    if (name.includes('terminal') || name.includes('execute') || name.includes('run') || name.includes('command'))
        return { icon: '⚡', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    if (name.includes('read') || name.includes('search') || name.includes('fetch'))
        return { icon: '🔍', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
    if (name.includes('update') || name.includes('plan') || name.includes('step'))
        return { icon: '🔄', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    return { icon: '🛠️', color: '#6f42c1', bg: '#f8f0ff', border: '#e9d5ff' };
}

// ── Single tool card ─────────────────────────────────────────────────────────
const ToolCard = ({ tool }: { tool: ParsedTool }) => {
    const { icon, color, bg, border } = getToolMeta(tool.name);
    const label = tool.name.replace(/_/g, ' ');

    return (
        <div style={{
            backgroundColor: bg,
            border: `1px solid ${border}`,
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 8,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderBottom: `1px solid ${border}`,
                backgroundColor: `${color}10`,
            }}>
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{
                    color,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                }}>
                    {label}
                </span>
            </div>

            {/* Body */}
            <div style={{ padding: '10px 12px' }}>
                {tool.jsonValue ? (
                    // Render JSON fields as key-value rows
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Object.entries(tool.jsonValue).map(([k, v]) => {
                            const strVal = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v);
                            const isLong = strVal.length > 80;
                            const isCommand = k === 'command';
                            return (
                                <div key={k}>
                                    <span style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: '#9ca3af',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.07em',
                                    }}>
                                        {k.replace(/_/g, ' ')}
                                    </span>
                                    <div style={{
                                        marginTop: 3,
                                        padding: '5px 8px',
                                        borderRadius: 5,
                                        fontSize: 12,
                                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                                        wordBreak: 'break-all',
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: isLong ? 90 : 'none',
                                        overflowY: isLong ? 'auto' : 'visible',
                                        ...(isCommand
                                            ? { backgroundColor: '#1a1a1a', color: '#4ade80', border: '1px solid #333' }
                                            : { backgroundColor: '#ffffff', color: '#374151', border: `1px solid ${border}` }
                                        ),
                                    }}>
                                        {isCommand ? `$ ${strVal}` : strVal}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Non-JSON (terminal command, etc.)
                    <div style={{
                        backgroundColor: '#1a1a1a',
                        color: '#4ade80',
                        border: '1px solid #333',
                        borderRadius: 5,
                        padding: '6px 10px',
                        fontSize: 12,
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        maxHeight: 120,
                        overflowY: 'auto',
                    }}>
                        $ {tool.rawValue}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── HITL Approval Form Component ─────────────────────────────────────────────
const HitlApprovalForm = ({
    request,
    onApprove,
    onReject,
}: {
    request: {
        question: string;
        details: {
            tools: any[];
            summary: string;
            reasoning: string;
        };
        options: string[];
    };
    onApprove: (sendMessage?: boolean) => void;
    onReject: (sendMessage?: boolean) => void;
}) => {
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [showFollowUpInput, setShowFollowUpInput] = useState(false);
    const [sendAsMessage, setSendAsMessage] = useState(false);
    const [userDecision, setUserDecision] = useState<'approved' | 'rejected' | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = () => {
        setIsProcessing(true);
        setUserDecision('approved');
        setTimeout(() => onApprove(sendAsMessage), 500);
    };

    const handleReject = () => {
        setIsProcessing(true);
        setUserDecision('rejected');
        setTimeout(() => onReject(sendAsMessage), 500);
    };

    const handleAskQuestion = () => {
        if (followUpQuestion.trim()) {
            window.dispatchEvent(new CustomEvent('hitl-follow-up', { detail: { question: followUpQuestion } }));
            setFollowUpQuestion('');
            setShowFollowUpInput(false);
        }
    };

    const renderToolDetails = (tools: any[]) => {
        if (!tools || tools.length === 0) return null;
        
        // Filter out file viewing and skill tools as requested
        const filteredTools = tools.filter(tool => {
            const name = (tool.name || tool.toolName || '').toLowerCase();
            const isViewing = [
                'read_file', 'list_dir', 'view_file', 'list_screens', 
                'grep_search', 'read_url_content', 'command_status',
                'list_projects', 'get_project', 'get_screen', 'list_design_systems',
                'read_resource', 'list_resources', 'read_browser_page', 'screenshot_browser'
            ].some(safeTool => name.includes(safeTool));
            const isSkills = name.includes('skill') || name.includes('mcp') || name.includes('stitch');
            return !isViewing && !isSkills;
        });

        if (filteredTools.length === 0) return (
            <div style={{ backgroundColor: '#f0f4f8', border: '1px solid #d1d5db', borderRadius: 6, padding: 12, fontSize: 13, color: '#495057' }}>
                <div style={{ marginBottom: 4 }}><strong>Summary:</strong> Background operations (context gathering)</div>
                <div>These actions are safe and do not modify your files.</div>
            </div>
        );

        return filteredTools.map((tool, index) => {
            const parsed: ParsedTool = {
                name: tool.name || tool.toolName || 'unknown_tool',
                jsonValue: tool.arguments || tool.args || null,
                rawValue: '',
            };
            return <ToolCard key={index} tool={parsed} />;
        });
    };

    return (
        <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: 16,
            padding: 24,
            margin: '16px 0',
            maxHeight: '400px',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            border: '1px solid #ffeaa7',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: '#856404', fontSize: 14, fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                ⚠️ High-risk action requires your approval
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#dc3545', fontSize: 13, fontWeight: 500 }}>
                <span>🚨</span>
                <span>Dangerous tool detected</span>
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                {request.question}
            </h3>

            <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: '#495057', fontSize: 14 }}>
                    Actions to execute:
                </div>
                {/* Scrollable tools list */}
                <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                    {request.details.tools && request.details.tools.length > 0 ? (
                        renderToolDetails(request.details.tools)
                    ) : (
                        <div style={{ backgroundColor: '#f0f4f8', border: '1px solid #d1d5db', borderRadius: 6, padding: 12, fontSize: 13, color: '#495057' }}>
                            <div style={{ marginBottom: 4 }}><strong>Summary:</strong> {request.details.summary}</div>
                            <div><strong>Reason:</strong> {request.details.reasoning}</div>
                        </div>
                    )}
                </div>
            </div>

            {showFollowUpInput && (
                <div style={{ backgroundColor: '#f0f4f8', border: '1px solid #d1d5db', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <textarea
                        value={followUpQuestion}
                        onChange={(e) => setFollowUpQuestion(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowFollowUpInput(false); setFollowUpQuestion(''); }}
                            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                            Cancel
                        </button>
                        <button onClick={handleAskQuestion} disabled={!followUpQuestion.trim()}
                            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: followUpQuestion.trim() ? '#6366f1' : '#d1d5db', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: followUpQuestion.trim() ? 'pointer' : 'not-allowed' }}>
                            Ask Question
                        </button>
                    </div>
                </div>
            )}

            {userDecision && (
                <div style={{ backgroundColor: userDecision === 'approved' ? '#d1fae5' : '#fee2e2', border: `1px solid ${userDecision === 'approved' ? '#10b981' : '#ef4444'}`, borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{userDecision === 'approved' ? '✅' : '❌'}</span>
                    <span style={{ color: userDecision === 'approved' ? '#065f46' : '#991b1b', fontWeight: 600, fontSize: 14 }}>
                        {userDecision === 'approved'
                            ? `Operation ${sendAsMessage ? 'approved (message sent)' : 'approved (silent)'}`
                            : `Operation ${sendAsMessage ? 'rejected (message sent)' : 'rejected (silent)'}`}
                    </span>
                    {isProcessing && (
                        <div style={{ marginLeft: 'auto', width: 16, height: 16, border: '2px solid transparent', borderTop: `2px solid ${userDecision === 'approved' ? '#10b981' : '#ef4444'}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    )}
                </div>
            )}

            {!userDecision && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: 6 }}>
                    <input type="checkbox" id="sendAsMessage" checked={sendAsMessage} onChange={(e) => setSendAsMessage(e.target.checked)} style={{ margin: 0 }} />
                    <label htmlFor="sendAsMessage" style={{ fontSize: 13, color: '#495057', cursor: 'pointer', userSelect: 'none' }}>
                        Send approval/rejection as a chat message (visible in conversation)
                    </label>
                </div>
            )}

            {!userDecision && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <button onClick={() => setShowFollowUpInput(!showFollowUpInput)}
                        style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #6366f1', backgroundColor: '#ffffff', color: '#6366f1', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f0f9ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                        {showFollowUpInput ? 'Cancel' : 'Ask Question'}
                    </button>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={handleReject} disabled={isProcessing}
                            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #dc3545', backgroundColor: '#ffffff', color: '#dc3545', fontSize: 14, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                            onMouseEnter={e => { if (!isProcessing) { e.currentTarget.style.backgroundColor = '#dc3545'; e.currentTarget.style.color = '#ffffff'; } }}
                            onMouseLeave={e => { if (!isProcessing) { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#dc3545'; } }}>
                            Reject
                        </button>
                        <button onClick={handleApprove} disabled={isProcessing}
                            style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: '#28a745', color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.6 : 1 }}
                            onMouseEnter={e => { if (!isProcessing) e.currentTarget.style.backgroundColor = '#218838'; }}
                            onMouseLeave={e => { if (!isProcessing) e.currentTarget.style.backgroundColor = '#28a745'; }}>
                            Approve
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── User Question Form Component ─────────────────────────────────────────────
const UserQuestionForm = ({
    questions,
    onSubmit,
    previewMarkdown,
}: {
    questions: Array<{
        question: string;
        options: Array<{ label: string; value: string; isRecommended?: boolean; requiresFileUpload?: boolean }>;
        multiSelect: boolean;
    }>;
    onSubmit: (answers: Record<string, string[]>, attachedFiles?: Array<{ name: string; content?: string; base64?: string; mimeType?: string }>) => void;
    previewMarkdown?: string;
}) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
    const [pendingFileOption, setPendingFileOption] = React.useState<string | null>(null);
    const [attachedFiles, setAttachedFiles] = React.useState<Array<{ name: string; content?: string; base64?: string; mimeType?: string }>>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const current = questions[currentIndex];
    const total = questions.length;
    const currentAnswers = answers[current?.question] || [];
    const isAnswered = currentAnswers.length > 0;
    const allAnswered = questions.every(q => (answers[q.question] || []).length > 0);

    const handleOptionClick = (value: string, requiresFileUpload?: boolean) => {
        const q = current.question;
        if (requiresFileUpload) {
            setAnswers(prev => ({ ...prev, [q]: [value] }));
            setPendingFileOption(value);
            setTimeout(() => fileInputRef.current?.click(), 50);
            return;
        }
        setAnswers(prev => {
            if (current.multiSelect) {
                const existing = prev[q] || [];
                return { ...prev, [q]: existing.includes(value) ? existing.filter(v => v !== value) : [...existing, value] };
            }
            return { ...prev, [q]: [value] };
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            const isImage = file.type.startsWith('image/');
            setAttachedFiles(prev => [...prev, { name: file.name, mimeType: file.type, ...(isImage ? { base64: result } : { content: result }) }]);
        };
        if (file.type.startsWith('image/')) reader.readAsDataURL(file);
        else reader.readAsText(file);
        e.target.value = '';
    };

    const handleNext = () => { if (currentIndex < total - 1) setCurrentIndex(i => i + 1); };
    const handleBack = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1); };
    const handleSubmit = () => { 
        if (allAnswered) {
            // Map labels to internal [HITL_APPROVED_ALWAYS] and [HITL_APPROVED_PREFIX] tags
            const processedAnswers = { ...answers };
            for (const q in processedAnswers) {
                processedAnswers[q] = processedAnswers[q].map(val => {
                    if (val === '🚀 Approve & Allow Always — never ask for this specific command again') return '[HITL_APPROVED_ALWAYS]';
                    if (val === '📂 Approve & Allow Prefix — never ask for commands starting with this base (e.g. npm)') return '[HITL_APPROVED_PREFIX]';
                    return val;
                });
            }
            onSubmit(processedAnswers, attachedFiles.length > 0 ? attachedFiles : undefined); 
        }
    };

    if (!current) return null;

    const isHighRisk = current.question.includes('High-risk action requires your approval');

    // ── Render the high-risk approval section ──────────────────────────────
    const renderHighRiskContent = () => {
        const parts = current.question.split(/Actions to execute:/i);
        const headerPart = parts[0] || '';
        const actionsPart = parts[1] || '';

        const toolEntries = actionsPart ? parseToolEntries(actionsPart) : [];

        return (
            <div style={{ margin: '0 0 20px 0' }}>
                {/* Warning header */}
                <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '12px 12px 0 0',
                    padding: '12px 16px',
                    color: '#856404',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderBottom: 'none',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    High-risk action requires your approval
                </div>

                {/* Body */}
                <div style={{
                    backgroundColor: '#fefefe',
                    border: '1px solid #ffeaa7',
                    borderTop: 'none',
                    borderRadius: '0 0 12px 12px',
                    padding: 16,
                    fontSize: 14,
                    color: '#1f2937',
                    lineHeight: 1.6,
                }}>
                    {/* Preamble text */}
                    {headerPart.replace('⚠️ High-risk action requires your approval', '').replace('Dangerous tool detected', '').trim() && (
                        <div style={{ marginBottom: actionsPart ? 16 : 0, color: '#4b5563' }}>
                            <MarkdownRenderer content={
                                headerPart
                                    .replace('⚠️ High-risk action requires your approval', '')
                                    .replace('Dangerous tool detected', '🚨 **Dangerous tool detected**')
                                    .trim()
                            } />
                        </div>
                    )}

                    {actionsPart && (
                        <>
                            {/* Section label */}
                            <div style={{
                                fontWeight: 700,
                                marginBottom: 10,
                                color: '#374151',
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <span>⚙️</span> Actions to execute
                                {toolEntries.length > 0 && (
                                    <span style={{
                                        backgroundColor: '#6366f1',
                                        color: '#fff',
                                        borderRadius: 20,
                                        padding: '1px 7px',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        marginLeft: 4,
                                    }}>
                                        {toolEntries.length}
                                    </span>
                                )}
                            </div>

                            {/* Scrollable tool cards */}
                            <div style={{
                                maxHeight: 420,
                                overflowY: 'auto',
                                paddingRight: 6,
                            }}>
                                {toolEntries.length > 0 ? (
                                    toolEntries
                                        .filter(tool => {
                                            const name = tool.name.toLowerCase();
                                            const isViewing = [
                                                'read_file', 'list_dir', 'view_file', 'list_screens', 
                                                'grep_search', 'read_url_content', 'command_status',
                                                'list_projects', 'get_project', 'get_screen', 'list_design_systems',
                                                'read_resource', 'list_resources', 'read_browser_page', 'screenshot_browser'
                                            ].some(safeTool => name.includes(safeTool));
                                            const isSkills = name.includes('skill') || name.includes('mcp') || name.includes('stitch');
                                            return !isViewing && !isSkills;
                                        })
                                        .map((tool, idx) => (
                                            <ToolCard key={idx} tool={tool} />
                                        ))
                                ) : (
                                    // Fallback: raw markdown
                                    <div style={{
                                        backgroundColor: '#f8f9fa',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        padding: '10px 14px',
                                        fontSize: 13,
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                    }}>
                                        <MarkdownRenderer content={actionsPart.trim()} />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: 12,
            padding: 20,
            margin: '16px 0',
        }}>
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: 14, fontWeight: 600 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9,9h6v6H9z" />
                    </svg>
                    Waiting for your input
                </div>
                {total > 1 && (
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                        {currentIndex + 1} / {total}
                    </span>
                )}
            </div>

            {/* Progress bar */}
            {total > 1 && (
                <div style={{ height: 3, backgroundColor: '#e5e7eb', borderRadius: 2, marginBottom: 16 }}>
                    <div style={{
                        height: '100%',
                        backgroundColor: '#6366f1',
                        borderRadius: 2,
                        width: `${((currentIndex + 1) / total) * 100}%`,
                        transition: 'width 0.2s ease',
                    }} />
                </div>
            )}

            {/* Coding plan preview — shown when the agent presents a plan for approval */}
            {previewMarkdown && (
                <CodingPlanCard previewMarkdown={previewMarkdown} />
            )}

            {/* Question content */}
            {isHighRisk
                ? renderHighRiskContent()
                : (
                    <div style={{ margin: '0 0 20px 0', fontSize: 14, fontWeight: 500, color: '#1f2937', lineHeight: 1.6 }}>
                        <MarkdownRenderer content={current.question} />
                    </div>
                )}

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {current.options.map((option, idx) => {
                    const selected = currentAnswers.includes(option.value);
                    const isFileOption = option.requiresFileUpload;
                    const fileAttached = isFileOption && attachedFiles.some(() => pendingFileOption === option.value);
                    return (
                        <button
                            key={idx}
                            onClick={() => handleOptionClick(option.value, option.requiresFileUpload)}
                            style={{
                                padding: '14px 16px',
                                borderRadius: 10,
                                border: selected ? '1px solid #6366f1' : '1px solid transparent',
                                backgroundColor: selected ? '#eef2ff' : '#f8f9fa',
                                color: selected ? '#4338ca' : '#4b5563',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 14,
                                fontWeight: option.isRecommended ? 600 : 500,
                                transition: 'all 0.2s ease',
                                boxShadow: selected ? '0 0 0 1px #6366f1' : 'inset 0 0 0 1px rgba(0,0,0,0.02)',
                            }}
                            onMouseEnter={e => { if (!selected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                            onMouseLeave={e => { if (!selected) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 18, height: 18,
                                    borderRadius: current.multiSelect ? 4 : '50%',
                                    border: selected ? 'none' : '1px solid #cbd5e1',
                                    backgroundColor: selected ? '#6366f1' : '#ffffff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    boxShadow: selected ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.05)',
                                }}>
                                    {selected && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                                <span>{option.label}</span>
                                {isFileOption && (
                                    <span style={{ fontSize: 11, color: '#6366f1', marginLeft: 4 }}>
                                        📎 {fileAttached ? '✓ File attached' : 'Click to attach file'}
                                    </span>
                                )}
                                {option.isRecommended && (
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', backgroundColor: '#d1fae5', padding: '2px 6px', borderRadius: 4, marginLeft: 'auto' }}>
                                        RECOMMENDED
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Attached files summary */}
            {attachedFiles.length > 0 && (
                <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                    {attachedFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#166534' }}>
                            <span>📎</span>
                            <span style={{ fontWeight: 500 }}>{f.name}</span>
                            <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer: back / next / submit */}
            <div style={{ display: 'flex', justifyContent: total > 1 ? 'space-between' : 'flex-end', gap: 8 }}>
                {total > 1 && (
                    <button onClick={handleBack} disabled={currentIndex === 0}
                        style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', backgroundColor: currentIndex === 0 ? '#f3f4f6' : '#ffffff', color: currentIndex === 0 ? '#9ca3af' : '#374151', fontSize: 14, fontWeight: 500, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer' }}>
                        Back
                    </button>
                )}
                {currentIndex < total - 1 ? (
                    <button onClick={handleNext} disabled={!isAnswered}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: isAnswered ? '#6366f1' : '#d1d5db', color: '#ffffff', fontSize: 14, fontWeight: 600, cursor: isAnswered ? 'pointer' : 'not-allowed' }}>
                        Next
                    </button>
                ) : (
                    <button onClick={handleSubmit} disabled={!allAnswered}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', backgroundColor: allAnswered ? '#6366f1' : '#d1d5db', color: allAnswered ? '#ffffff' : '#9ca3af', fontSize: 14, fontWeight: 600, cursor: allAnswered ? 'pointer' : 'not-allowed' }}>
                        Submit {current.multiSelect && currentAnswers.length > 1 ? `(${currentAnswers.length} selected)` : ''}
                    </button>
                )}
            </div>
        </div>
    );
};

export { HitlApprovalForm, UserQuestionForm };

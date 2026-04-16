import React, { useState } from 'react';

// Add CSS animation for spinner
const spinnerStyle = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// Inject the CSS
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = spinnerStyle;
    document.head.appendChild(style);
}

// ── HITL Approval Form Component ────────────────────────────────────────────
const HitlApprovalForm = ({
    request,
    onApprove,
    onReject
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
        setTimeout(() => {
            onApprove(sendAsMessage);
        }, 500); // Brief delay to show the decision
    };

    const handleReject = () => {
        setIsProcessing(true);
        setUserDecision('rejected');
        setTimeout(() => {
            onReject(sendAsMessage);
        }, 500); // Brief delay to show the decision
    };

    const handleAskQuestion = () => {
        if (followUpQuestion.trim()) {
            // Send follow-up question to the agent
            const event = new CustomEvent('hitl-follow-up', {
                detail: { question: followUpQuestion }
            });
            window.dispatchEvent(event);
            setFollowUpQuestion('');
            setShowFollowUpInput(false);
        }
    };

    // Helper function to render tool details
    const renderToolDetails = (tools: any[]) => {
        if (!tools || tools.length === 0) return null;

        return tools.map((tool, index) => {
            const toolName = tool.name || tool.toolName || 'Unknown Tool';
            const args = tool.arguments || tool.args || {};

            // Get tool icon and color based on tool type
            const getToolIcon = (name: string) => {
                if (name.includes('write') || name.includes('file')) {
                    return { icon: '📝', color: '#dc3545', bg: '#fff5f5' };
                }
                if (name.includes('run') || name.includes('command') || name.includes('terminal')) {
                    return { icon: '⚡', color: '#fd7e14', bg: '#fff8f0' };
                }
                if (name.includes('read') || name.includes('search')) {
                    return { icon: '🔍', color: '#0d6efd', bg: '#f0f8ff' };
                }
                return { icon: '🛠️', color: '#6f42c1', bg: '#f8f0ff' };
            };

            const { icon, color, bg } = getToolIcon(toolName);

            return (
                <div key={index} style={{
                    backgroundColor: bg,
                    border: `1px solid ${color}20`,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: index < tools.length - 1 ? 8 : 0
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                        color: color,
                        fontSize: 14,
                        fontWeight: 600
                    }}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{ textTransform: 'capitalize' }}>{toolName.replace(/_/g, ' ')}</span>
                    </div>

                    {/* Render tool arguments */}
                    <div style={{ fontSize: 12, color: '#495057' }}>
                        {Object.entries(args).map(([key, value]) => {
                            // Special handling for different argument types
                            if (key === 'path' && typeof value === 'string') {
                                return (
                                    <div key={key} style={{ marginBottom: 4 }}>
                                        <strong>Path:</strong>
                                        <div style={{
                                            backgroundColor: '#f8f9fa',
                                            border: '1px solid #dee2e6',
                                            borderRadius: 4,
                                            padding: '4px 8px',
                                            marginTop: 2,
                                            fontFamily: 'Monaco, Consolas, monospace',
                                            fontSize: 11,
                                            wordBreak: 'break-all'
                                        }}>
                                            {value}
                                        </div>
                                    </div>
                                );
                            }

                            if (key === 'content' && typeof value === 'string') {
                                const truncatedContent = value.length > 200 ? value.substring(0, 200) + '...' : value;
                                return (
                                    <div key={key} style={{ marginBottom: 4 }}>
                                        <strong>Content:</strong>
                                        <div style={{
                                            backgroundColor: '#f8f9fa',
                                            border: '1px solid #dee2e6',
                                            borderRadius: 4,
                                            padding: '6px 8px',
                                            marginTop: 2,
                                            fontFamily: 'Monaco, Consolas, monospace',
                                            fontSize: 11,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: 120,
                                            overflowY: 'auto'
                                        }}>
                                            {truncatedContent}
                                        </div>
                                    </div>
                                );
                            }

                            if (key === 'command' && typeof value === 'string') {
                                return (
                                    <div key={key} style={{ marginBottom: 4 }}>
                                        <strong>Command:</strong>
                                        <div style={{
                                            backgroundColor: '#1a1a1a',
                                            color: '#00ff00',
                                            border: '1px solid #333',
                                            borderRadius: 4,
                                            padding: '6px 8px',
                                            marginTop: 2,
                                            fontFamily: 'Monaco, Consolas, monospace',
                                            fontSize: 11
                                        }}>
                                            $ {value}
                                        </div>
                                    </div>
                                );
                            }

                            // Default rendering for other arguments
                            return (
                                <div key={key} style={{ marginBottom: 4 }}>
                                    <strong style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</strong>{' '}
                                    <span style={{ fontFamily: 'Monaco, Consolas, monospace' }}>
                                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        });
    };

    return (
        <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: 12,
            padding: 20,
            margin: '16px 0'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                color: '#856404',
                fontSize: 14,
                fontWeight: 600
            }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                ⚠️ High-risk action requires your approval
            </div>

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: '#dc3545',
                fontSize: 13,
                fontWeight: 500
            }}>
                <span>🚨</span>
                <span>Dangerous tool detected</span>
            </div>

            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: 16,
                fontWeight: 600,
                color: '#1f2937'
            }}>
                {request.question}
            </h3>

            {/* Enhanced tool details section */}
            <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16
            }}>
                <div style={{
                    fontWeight: 600,
                    marginBottom: 12,
                    color: '#495057',
                    fontSize: 14
                }}>
                    Actions to execute:
                </div>

                {request.details.tools && request.details.tools.length > 0 ? (
                    renderToolDetails(request.details.tools)
                ) : (
                    <div style={{
                        backgroundColor: '#f0f4f8',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        padding: 12,
                        fontSize: 13,
                        color: '#495057'
                    }}>
                        <div style={{ marginBottom: 4 }}><strong>Summary:</strong> {request.details.summary}</div>
                        <div><strong>Reason:</strong> {request.details.reasoning}</div>
                    </div>
                )}
            </div>

            {showFollowUpInput && (
                <div style={{
                    backgroundColor: '#f0f4f8',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16
                }}>
                    <textarea
                        value={followUpQuestion}
                        onChange={(e) => setFollowUpQuestion(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        style={{
                            width: '100%',
                            minHeight: 60,
                            padding: 8,
                            borderRadius: 6,
                            border: '1px solid #d1d5db',
                            fontSize: 13,
                            fontFamily: 'inherit',
                            resize: 'vertical'
                        }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => {
                                setShowFollowUpInput(false);
                                setFollowUpQuestion('');
                            }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: '#374151',
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAskQuestion}
                            disabled={!followUpQuestion.trim()}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: followUpQuestion.trim() ? '#6366f1' : '#d1d5db',
                                color: '#ffffff',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: followUpQuestion.trim() ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Ask Question
                        </button>
                    </div>
                </div>
            )}

            {/* Show user's decision */}
            {userDecision && (
                <div style={{
                    backgroundColor: userDecision === 'approved' ? '#d1fae5' : '#fee2e2',
                    border: `1px solid ${userDecision === 'approved' ? '#10b981' : '#ef4444'}`,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}>
                    <span style={{ fontSize: 16 }}>
                        {userDecision === 'approved' ? '✅' : '❌'}
                    </span>
                    <span style={{
                        color: userDecision === 'approved' ? '#065f46' : '#991b1b',
                        fontWeight: 600,
                        fontSize: 14
                    }}>
                        {userDecision === 'approved'
                            ? `Operation ${sendAsMessage ? 'approved (message sent)' : 'approved (silent)'}`
                            : `Operation ${sendAsMessage ? 'rejected (message sent)' : 'rejected (silent)'}`
                        }
                    </span>
                    {isProcessing && (
                        <div style={{
                            marginLeft: 'auto',
                            width: 16,
                            height: 16,
                            border: '2px solid transparent',
                            borderTop: `2px solid ${userDecision === 'approved' ? '#10b981' : '#ef4444'}`,
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                    )}
                </div>
            )}

            {/* Option to send response as chat message */}
            {!userDecision && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e9ecef',
                    borderRadius: 6
                }}>
                    <input
                        type="checkbox"
                        id="sendAsMessage"
                        checked={sendAsMessage}
                        onChange={(e) => setSendAsMessage(e.target.checked)}
                        style={{ margin: 0 }}
                    />
                    <label
                        htmlFor="sendAsMessage"
                        style={{
                            fontSize: 13,
                            color: '#495057',
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        Send approval/rejection as a chat message (visible in conversation)
                    </label>
                </div>
            )}

            {!userDecision && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <button
                        onClick={() => setShowFollowUpInput(!showFollowUpInput)}
                        style={{
                            padding: '10px 16px',
                            borderRadius: 8,
                            border: '1px solid #6366f1',
                            backgroundColor: '#ffffff',
                            color: '#6366f1',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#f0f9ff';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                    >
                        {showFollowUpInput ? 'Cancel' : 'Ask Question'}
                    </button>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={handleReject}
                            disabled={isProcessing}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 8,
                                border: '1px solid #dc3545',
                                backgroundColor: '#ffffff',
                                color: '#dc3545',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.6 : 1,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = '#dc3545';
                                    e.currentTarget.style.color = '#ffffff';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = '#ffffff';
                                    e.currentTarget.style.color = '#dc3545';
                                }
                            }}
                        >
                            Reject
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isProcessing}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 8,
                                border: 'none',
                                backgroundColor: '#28a745',
                                color: '#ffffff',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isProcessing ? 0.6 : 1,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = '#218838';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isProcessing) {
                                    e.currentTarget.style.backgroundColor = '#28a745';
                                }
                            }}
                        >
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
    onSubmit
}: {
    questions: Array<{
        question: string;
        options: Array<{ label: string; value: string; isRecommended?: boolean; requiresFileUpload?: boolean }>;
        multiSelect: boolean;
    }>;
    onSubmit: (answers: Record<string, string[]>, attachedFiles?: Array<{ name: string; content?: string; base64?: string; mimeType?: string }>) => void;
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
            // Select the option and trigger file picker
            setAnswers(prev => ({ ...prev, [q]: [value] }));
            setPendingFileOption(value);
            setTimeout(() => fileInputRef.current?.click(), 50);
            return;
        }
        setAnswers(prev => {
            if (current.multiSelect) {
                const existing = prev[q] || [];
                return {
                    ...prev,
                    [q]: existing.includes(value)
                        ? existing.filter(v => v !== value)
                        : [...existing, value]
                };
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
            setAttachedFiles(prev => [...prev, {
                name: file.name,
                mimeType: file.type,
                ...(isImage ? { base64: result } : { content: result }),
            }]);
        };
        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleNext = () => {
        if (currentIndex < total - 1) setCurrentIndex(i => i + 1);
    };

    const handleBack = () => {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
    };

    const handleSubmit = () => {
        if (allAnswered) onSubmit(answers, attachedFiles.length > 0 ? attachedFiles : undefined);
    };

    if (!current) return null;

    return (
        <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: 12,
            padding: 20,
            margin: '16px 0'
        }}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: 14, fontWeight: 600 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9,9h6v6H9z"/>
                    </svg>
                    Waiting for your input
                </div>
                {total > 1 && (
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                        {currentIndex + 1} / {total}
                    </span>
                )}
            </div>

            {/* Progress bar (only for multiple questions) */}
            {total > 1 && (
                <div style={{ height: 3, backgroundColor: '#e5e7eb', borderRadius: 2, marginBottom: 16 }}>
                    <div style={{
                        height: '100%',
                        backgroundColor: '#6366f1',
                        borderRadius: 2,
                        width: `${((currentIndex + 1) / total) * 100}%`,
                        transition: 'width 0.2s ease'
                    }} />
                </div>
            )}

            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
                {current.question}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {current.options.map((option, idx) => {
                    const selected = currentAnswers.includes(option.value);
                    const isFileOption = option.requiresFileUpload;
                    const fileAttached = isFileOption && attachedFiles.some(f => pendingFileOption === option.value);
                    return (
                        <button
                            key={idx}
                            onClick={() => handleOptionClick(option.value, option.requiresFileUpload)}
                            style={{
                                padding: '12px 16px',
                                borderRadius: 8,
                                border: selected ? '2px solid #6366f1' : '1px solid #d1d5db',
                                backgroundColor: selected ? '#f0f9ff' : '#ffffff',
                                color: selected ? '#1e40af' : '#374151',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 14,
                                fontWeight: option.isRecommended ? 600 : 400,
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{
                                    width: 16, height: 16,
                                    borderRadius: current.multiSelect ? 4 : '50%',
                                    border: selected ? '2px solid #6366f1' : '2px solid #d1d5db',
                                    backgroundColor: selected ? '#6366f1' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    {selected && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                            <polyline points="20,6 9,17 4,12"/>
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
                                    <span style={{
                                        fontSize: 11, fontWeight: 600, color: '#059669',
                                        backgroundColor: '#d1fae5', padding: '2px 6px',
                                        borderRadius: 4, marginLeft: 'auto'
                                    }}>
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
                            <button
                                onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer: back/next/submit */}
            <div style={{ display: 'flex', justifyContent: total > 1 ? 'space-between' : 'flex-end', gap: 8 }}>
                {total > 1 && (
                    <button
                        onClick={handleBack}
                        disabled={currentIndex === 0}
                        style={{
                            padding: '10px 16px', borderRadius: 8,
                            border: '1px solid #d1d5db',
                            backgroundColor: currentIndex === 0 ? '#f3f4f6' : '#ffffff',
                            color: currentIndex === 0 ? '#9ca3af' : '#374151',
                            fontSize: 14, fontWeight: 500,
                            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Back
                    </button>
                )}
                {currentIndex < total - 1 ? (
                    <button
                        onClick={handleNext}
                        disabled={!isAnswered}
                        style={{
                            padding: '10px 20px', borderRadius: 8, border: 'none',
                            backgroundColor: isAnswered ? '#6366f1' : '#d1d5db',
                            color: '#ffffff', fontSize: 14, fontWeight: 600,
                            cursor: isAnswered ? 'pointer' : 'not-allowed', transition: 'all 0.2s'
                        }}
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={!allAnswered}
                        style={{
                            padding: '10px 20px', borderRadius: 8, border: 'none',
                            backgroundColor: allAnswered ? '#6366f1' : '#d1d5db',
                            color: allAnswered ? '#ffffff' : '#9ca3af',
                            fontSize: 14, fontWeight: 600,
                            cursor: allAnswered ? 'pointer' : 'not-allowed', transition: 'all 0.2s'
                        }}
                    >
                        Submit {current.multiSelect && currentAnswers.length > 1 ? `(${currentAnswers.length} selected)` : ''}
                    </button>
                )}
            </div>
        </div>
    );
};

export { HitlApprovalForm, UserQuestionForm };

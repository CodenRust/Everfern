import React, { useState } from 'react';

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
    onApprove: () => void;
    onReject: () => void;
}) => {
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [showFollowUpInput, setShowFollowUpInput] = useState(false);

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
                Human approval required
            </div>

            <h3 style={{
                margin: '0 0 12px 0',
                fontSize: 16,
                fontWeight: 600,
                color: '#1f2937'
            }}>
                {request.question}
            </h3>

            <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                fontSize: 13,
                color: '#495057'
            }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Operation Details:</div>
                <div style={{ marginBottom: 4 }}><strong>Tools:</strong> {request.details.summary}</div>
                <div><strong>Reason:</strong> {request.details.reasoning}</div>
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
                        onClick={onReject}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            border: '1px solid #dc3545',
                            backgroundColor: '#ffffff',
                            color: '#dc3545',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#dc3545';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.color = '#dc3545';
                        }}
                    >
                        Reject
                    </button>
                    <button
                        onClick={onApprove}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 8,
                            border: 'none',
                            backgroundColor: '#28a745',
                            color: '#ffffff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#218838';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#28a745';
                        }}
                    >
                        Approve
                    </button>
                </div>
            </div>
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
        options: Array<{ label: string; value: string; isRecommended?: boolean }>;
        multiSelect: boolean;
    }>;
    onSubmit: (answers: Record<string, string[]>) => void;
}) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [answers, setAnswers] = React.useState<Record<string, string[]>>({});

    const current = questions[currentIndex];
    const total = questions.length;
    const currentAnswers = answers[current?.question] || [];
    const isAnswered = currentAnswers.length > 0;
    const allAnswered = questions.every(q => (answers[q.question] || []).length > 0);

    const handleOptionClick = (value: string) => {
        const q = current.question;
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

    const handleNext = () => {
        if (currentIndex < total - 1) setCurrentIndex(i => i + 1);
    };

    const handleBack = () => {
        if (currentIndex > 0) setCurrentIndex(i => i - 1);
    };

    const handleSubmit = () => {
        if (allAnswered) onSubmit(answers);
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
                    return (
                        <button
                            key={idx}
                            onClick={() => handleOptionClick(option.value)}
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

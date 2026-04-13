import React from 'react';

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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
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
    );
};

// ── User Question Form Component ─────────────────────────────────────────────
const UserQuestionForm = ({
    question,
    options,
    multiSelect,
    selectedValues,
    onSelectionChange,
    onSubmit
}: {
    question: string;
    options: Array<{ label: string; value: string; isRecommended?: boolean }>;
    multiSelect: boolean;
    selectedValues: string[];
    onSelectionChange: (values: string[]) => void;
    onSubmit: () => void;
}) => {
    const handleOptionClick = (value: string) => {
        if (multiSelect) {
            const newValues = selectedValues.includes(value)
                ? selectedValues.filter(v => v !== value)
                : [...selectedValues, value];
            onSelectionChange(newValues);
        } else {
            onSelectionChange([value]);
        }
    };

    return (
        <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: 12,
            padding: 20,
            margin: '16px 0'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                color: '#6366f1',
                fontSize: 14,
                fontWeight: 600
            }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9,9h6v6H9z"/>
                </svg>
                Waiting for your input
            </div>

            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: 16,
                fontWeight: 600,
                color: '#1f2937'
            }}>
                {question}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {options.map((option, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleOptionClick(option.value)}
                        style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            border: selectedValues.includes(option.value)
                                ? '2px solid #6366f1'
                                : '1px solid #d1d5db',
                            backgroundColor: selectedValues.includes(option.value)
                                ? '#f0f9ff'
                                : '#ffffff',
                            color: selectedValues.includes(option.value)
                                ? '#1e40af'
                                : '#374151',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: 14,
                            fontWeight: option.isRecommended ? 600 : 400,
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 16,
                                height: 16,
                                borderRadius: multiSelect ? 4 : '50%',
                                border: selectedValues.includes(option.value)
                                    ? '2px solid #6366f1'
                                    : '2px solid #d1d5db',
                                backgroundColor: selectedValues.includes(option.value)
                                    ? '#6366f1'
                                    : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {selectedValues.includes(option.value) && (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                        <polyline points="20,6 9,17 4,12"/>
                                    </svg>
                                )}
                            </div>
                            <span>{option.label}</span>
                            {option.isRecommended && (
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#059669',
                                    backgroundColor: '#d1fae5',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    marginLeft: 'auto'
                                }}>
                                    RECOMMENDED
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                    onClick={onSubmit}
                    disabled={selectedValues.length === 0}
                    style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: selectedValues.length > 0 ? '#6366f1' : '#d1d5db',
                        color: selectedValues.length > 0 ? '#ffffff' : '#9ca3af',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: selectedValues.length > 0 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s'
                    }}
                >
                    Submit {multiSelect && selectedValues.length > 1 ? `(${selectedValues.length} selected)` : ''}
                </button>
            </div>
        </div>
    );
};

export { HitlApprovalForm, UserQuestionForm };

'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

interface Task {
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface TasksPanelProps {
    tasks: Task[];
    path?: string;
}

export default function TasksPanel({ tasks, path }: TasksPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    if (!tasks || tasks.length === 0) return null;

    return (
        <div style={{ 
            backgroundColor: "#ffffff", 
            border: "1px solid #e8e6d9", 
            borderRadius: 12, 
            overflow: "hidden", 
            padding: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
        }}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: 0,
                    marginBottom: isExpanded ? 16 : 0
                }}
            >
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', fontFamily: 'var(--font-sans)', letterSpacing: '0.01em' }}>Progress</span>
                <ChevronDownIcon 
                    width={16} 
                    height={16} 
                    style={{ 
                        transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', 
                        transition: '0.25s ease', 
                        color: '#a1a1aa' 
                    }} 
                />
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 12,
                            maxHeight: 320,
                            overflowY: 'auto',
                            paddingRight: 8,
                            paddingBottom: 4
                        }}>
                            {tasks.map((task, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ flexShrink: 0 }}>
                                        {task.status === 'completed' ? (
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CheckIcon width={12} height={12} color="white" strokeWidth={3.5} />
                                            </div>
                                        ) : task.status === 'in_progress' ? (
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{idx + 1}</span>
                                            </div>
                                        ) : (
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{idx + 1}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ 
                                        fontSize: 13, 
                                        color: task.status === 'completed' ? '#9ca3af' : task.status === 'in_progress' ? '#111111' : '#6b7280',
                                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                        fontWeight: task.status === 'in_progress' ? 600 : 400,
                                        lineHeight: 1.4,
                                        fontFamily: 'var(--font-sans)',
                                        letterSpacing: '-0.01em'
                                    }}>
                                        {task.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}


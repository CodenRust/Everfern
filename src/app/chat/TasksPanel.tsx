'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ListBulletIcon, CheckCircleIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';

interface Task {
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
}

interface TasksPanelProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: Task[];
    path?: string;
}

export default function TasksPanel({ isOpen, onClose, tasks, path }: TasksPanelProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                    style={{
                        position: 'fixed',
                        top: 12,
                        right: 12,
                        bottom: 12,
                        width: '400px',
                        backgroundColor: 'rgba(255, 255, 255, 0.94)',
                        backdropFilter: 'blur(16px) saturate(180%)',
                        border: '1px solid rgba(232, 230, 217, 0.8)',
                        borderRadius: 32,
                        boxShadow: '-10px 0 40px rgba(0,0,0,0.06), 0 10px 30px rgba(0,0,0,0.02)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header */}
                    <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(232, 230, 217, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(252, 251, 247, 0.5)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ListBulletIcon width={22} height={22} color="#6366f1" />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#201e24', margin: 0 }}>Project Tasks</h2>
                                <p style={{ fontSize: 12, color: '#8a8886', margin: '2px 0 0' }}>{tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            style={{ background: 'rgba(0,0,0,0.05)', border: 'none', color: '#8a8886', cursor: 'pointer', padding: 6, borderRadius: 10, display: 'flex', alignItems: 'center' }}
                        >
                            <XMarkIcon width={18} height={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {tasks.map((task, idx) => (
                                <div 
                                    key={idx} 
                                    style={{ 
                                        padding: '16px', 
                                        backgroundColor: task.status === 'in_progress' ? 'rgba(99, 102, 241, 0.04)' : 'white',
                                        border: task.status === 'in_progress' ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #e8e6d9',
                                        borderRadius: 16,
                                        display: 'flex',
                                        gap: 12,
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <div style={{ marginTop: 2 }}>
                                        {task.status === 'completed' ? (
                                            <CheckCircleIcon width={20} height={20} color="#22c55e" />
                                        ) : task.status === 'in_progress' ? (
                                            <div style={{ position: 'relative' }}>
                                                <PlayIcon width={20} height={20} color="#6366f1" />
                                                <motion.div 
                                                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: '#6366f1' }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #e8e6d9' }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ 
                                            fontSize: 14, 
                                            color: task.status === 'completed' ? '#8a8886' : '#201e24',
                                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                                            fontWeight: task.status === 'in_progress' ? 500 : 400,
                                            lineHeight: 1.5
                                        }}>
                                            {task.description}
                                        </div>
                                        {task.status === 'in_progress' && (
                                            <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                In Progress
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    {path && (
                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(232, 230, 217, 0.5)', background: 'rgba(255, 255, 255, 0.8)' }}>
                            <div style={{ fontSize: 11, color: '#8a8886', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <StopIcon width={14} height={14} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    Synced to {path.split(/[\\/]/).pop()}
                                </span>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

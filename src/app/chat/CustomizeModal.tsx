'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, BriefcaseIcon } from '@heroicons/react/24/outline';

interface CustomizeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CustomizeModal({ isOpen, onClose }: CustomizeModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 400,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(4px)',
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            width: '90%',
                            maxWidth: 600,
                            backgroundColor: '#ffffff',
                            borderRadius: 24,
                            overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '85vh',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid #f4f4f4', backgroundColor: '#fafafa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111111' }}>
                                    <BriefcaseIcon width={20} height={20} />
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#111111' }}>Customize</h2>
                                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#8a8886' }}>Personalize your EverFern workspace</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#8a8886', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f4f4f4'; e.currentTarget.style.color = '#111111'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#8a8886'; }}
                            >
                                <XMarkIcon width={20} height={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '32px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <div style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', margin: '0 auto 16px' }}>
                                    <BriefcaseIcon width={32} height={32} />
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111111', margin: '0 0 8px' }}>Coming Soon</h3>
                                <p style={{ fontSize: 14, color: '#8a8886', margin: 0, lineHeight: 1.5 }}>
                                    The workspace customization features are currently under development. Soon you'll be able to manage your workspace settings here.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '20px 32px', borderTop: '1px solid #f4f4f4', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={onClose}
                                style={{ padding: '10px 24px', backgroundColor: '#111111', color: '#ffffff', border: 'none', borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'background-color 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333333'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111111'}
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

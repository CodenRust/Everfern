'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface VoiceAssistantUIProps {
    isOpen: boolean;
    onClose: () => void;
    isRecording: boolean;
    voiceLoading: boolean;
    voiceTranscript: string;
    voicePlayback: boolean;
    onRecordToggle: () => void;
    onOutputToggle: () => void;
    voiceOutputEnabled: boolean;
    voiceProvider: 'deepgram' | 'elevenlabs' | null | string;
    voiceDeepgramKey: string;
    voiceElevenlabsKey: string;
}

export default function VoiceAssistantUI({
    isOpen,
    onClose,
    isRecording,
    voiceLoading,
    voiceTranscript,
    voicePlayback,
    onRecordToggle,
    onOutputToggle,
    voiceOutputEnabled,
    voiceProvider,
    voiceDeepgramKey,
    voiceElevenlabsKey,
}: VoiceAssistantUIProps) {
    const isConfigured = voiceProvider && (voiceDeepgramKey || voiceElevenlabsKey);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Full Screen Page Overlay */}
                    <motion.div
                        key="voice-page"
                        initial={{ x: '100%', opacity: 0.5 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0.5 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '100vw',
                            backgroundColor: '#f5f4f0',
                            zIndex: 1001,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '24px',
                            borderBottom: '1px solid #e8e6d9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div>
                                <h2 style={{
                                    margin: 0,
                                    fontSize: 24,
                                    fontWeight: 600,
                                    color: '#111111',
                                }}>
                                    🎤 Voice Assistant
                                </h2>
                                <p style={{
                                    margin: '4px 0 0',
                                    fontSize: 13,
                                    color: '#717171',
                                }}>
                                    {isConfigured ? 'Voice mode active' : 'Configure voice in settings first'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#717171',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <XMarkIcon width={24} height={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{
                            flex: 1,
                            padding: '32px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 32,
                            overflow: 'auto',
                        }}>
                            {!isConfigured ? (
                                <div style={{
                                    textAlign: 'center',
                                    color: '#717171',
                                }}>
                                    <h3 style={{ fontSize: 20, color: '#111', fontWeight: 500, marginBottom: 12 }}>Voice Mode Not Configured</h3>
                                    <p style={{ fontSize: 16, margin: '0 0 12px' }}>
                                        Voice mode is not configured yet.
                                    </p>
                                    <p style={{ fontSize: 14, color: '#a1a1aa', margin: 0, maxWidth: 500 }}>
                                        Please select a provider (Deepgram or ElevenLabs) and add your API key in Settings to activate the full-screen voice assistant.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Waveform Visualization */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-end',
                                        justifyContent: 'center',
                                        gap: 6,
                                        height: 100,
                                    }}>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <motion.div
                                                key={i}
                                                animate={{
                                                    height: isRecording || voicePlayback ? [20, 60, 40, 50, 35, 55, 30, 60, 45][i - 1] : 20,
                                                    backgroundColor: isRecording ? '#ef4444' : voicePlayback ? '#3b82f6' : '#a1a1aa',
                                                }}
                                                transition={{
                                                    duration: 0.4,
                                                    delay: i * 0.05,
                                                    repeat: isRecording || voicePlayback ? Infinity : 0,
                                                }}
                                                style={{
                                                    width: 8,
                                                    borderRadius: 4,
                                                    background: '#a1a1aa',
                                                }}
                                            />
                                        ))}
                                    </div>

                                    {/* Status Text */}
                                    <div style={{
                                        textAlign: 'center',
                                        minHeight: 60,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        {isRecording && (
                                            <motion.div
                                                animate={{ opacity: [0.6, 1] }}
                                                transition={{ duration: 0.6, repeat: Infinity }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                <div style={{
                                                    width: 10,
                                                    height: 10,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#ef4444',
                                                }} />
                                                <span style={{ fontSize: 16, color: '#111111', fontWeight: 500 }}>
                                                    Listening...
                                                </span>
                                            </motion.div>
                                        )}

                                        {voiceLoading && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}>
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    style={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        borderTop: '2px solid #a1a1aa',
                                                        borderRight: '2px solid transparent',
                                                    }}
                                                />
                                                <span style={{ fontSize: 16, color: '#111111', fontWeight: 500 }}>
                                                    Transcribing...
                                                </span>
                                            </div>
                                        )}

                                        {voicePlayback && (
                                            <motion.div
                                                animate={{ opacity: [0.6, 1] }}
                                                transition={{ duration: 0.6, repeat: Infinity }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="#3b82f6"
                                                    strokeWidth="2"
                                                    style={{ width: 20, height: 20 }}
                                                >
                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                    <path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path>
                                                </svg>
                                                <span style={{ fontSize: 16, color: '#111111', fontWeight: 500 }}>
                                                    Playing response...
                                                </span>
                                            </motion.div>
                                        )}

                                        {!isRecording && !voiceLoading && !voicePlayback && (
                                            <span style={{ fontSize: 16, color: '#717171' }}>
                                                Ready to listen
                                            </span>
                                        )}

                                        {voiceTranscript && !isRecording && (
                                            <motion.p
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                style={{
                                                    margin: '12px 0 0',
                                                    fontSize: 13,
                                                    color: '#717171',
                                                    fontStyle: 'italic',
                                                    maxWidth: '90%',
                                                }}
                                            >
                                                ✓ {voiceTranscript}
                                            </motion.p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Controls */}
                        {isConfigured && (
                            <div style={{
                                padding: '24px',
                                borderTop: '1px solid #e8e6d9',
                                display: 'flex',
                                gap: 12,
                                justifyContent: 'center',
                            }}>
                                {/* Record Button */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={onRecordToggle}
                                    disabled={voiceLoading || voicePlayback}
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: '50%',
                                        border: 'none',
                                        backgroundColor: isRecording ? '#ef4444' : '#a1a1aa',
                                        color: 'white',
                                        cursor: voiceLoading || voicePlayback ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: voiceLoading || voicePlayback ? 0.6 : 1,
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        style={{ width: 24, height: 24 }}
                                    >
                                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                        <path d="M12 1C6.48 1 2 5.48 2 11s4.48 10 10 10 10-4.48 10-10S17.52 1 12 1z" opacity="0.3" />
                                    </svg>
                                </motion.button>

                                {/* Output Toggle */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={onOutputToggle}
                                    disabled={voiceLoading}
                                    style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: '50%',
                                        border: `2px solid ${voiceOutputEnabled ? '#a1a1aa' : '#e8e6d9'}`,
                                        backgroundColor: voiceOutputEnabled ? 'rgba(113, 113, 113, 0.1)' : '#f4f4f4',
                                        color: voiceOutputEnabled ? '#717171' : '#a1a1aa',
                                        cursor: voiceLoading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: voiceLoading ? 0.6 : 1,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        style={{ width: 24, height: 24 }}
                                    >
                                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                        <path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path>
                                    </svg>
                                </motion.button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

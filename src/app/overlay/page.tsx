"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';

const matrixData = [
  { bot: [0.6, 0.9, 0.7, 1.0, 0.6], mid: [0.3, 0.7, 0.4, 0.8, 0.3], top: [0.1, 0.4, 0.2, 0.5, 0.1], dur: 0.8 },
  { bot: [0.7, 1.0, 0.8, 1.0, 0.7], mid: [0.4, 0.8, 0.5, 0.9, 0.4], top: [0.2, 0.6, 0.3, 0.7, 0.2], dur: 0.9 },
  { bot: [0.8, 1.0, 0.9, 1.0, 0.8], mid: [0.6, 1.0, 0.7, 1.0, 0.6], top: [0.3, 0.8, 0.4, 0.9, 0.3], dur: 0.75 },
  { bot: [0.7, 1.0, 0.8, 1.0, 0.7], mid: [0.5, 0.9, 0.6, 1.0, 0.5], top: [0.2, 0.7, 0.3, 0.8, 0.2], dur: 0.85 },
  { bot: [0.6, 0.9, 0.7, 1.0, 0.6], mid: [0.3, 0.6, 0.4, 0.7, 0.3], top: [0.1, 0.3, 0.2, 0.4, 0.1], dur: 0.95 },
];

export default function OverlayPage() {
  const [state, setState] = useState<'idle' | 'listening' | 'executing'>('idle');

  useEffect(() => {
    // Make body transparent for the overlay window
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    document.body.className = '';

    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI.voiceOverlay.onStateChange((data: any) => {
        setState(data.state);
      });
      return () => (window as any).electronAPI.voiceOverlay.removeListeners();
    }
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
      paddingBottom: 24,
      background: 'transparent',
      overflow: 'hidden'
    }}>
      <AnimatePresence>
        {state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              background: '#4a2f21',
              borderRadius: 30,
              padding: '14px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minWidth: 380,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 500, fontFamily: '"Figtree", sans-serif' }}>
              {state === 'listening' ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <motion.div 
                    animate={{ opacity: [0.5, 1, 0.5] }} 
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200% 100%' }}
                  >
                    Listening...
                  </motion.div>
                  Listening...
                </div>
              ) : 'Executing tasks...'}
            </div>
            
            {state === 'listening' && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 4 }}>
                <Mic size={18} color="#ffb088" style={{ strokeWidth: 2.5 }} />
                
                <div style={{ display: 'flex', gap: 4 }}>
                  {matrixData.map((col, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <motion.div
                        animate={{ opacity: col.top }}
                        transition={{ duration: col.dur, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#ffb088' }}
                      />
                      <motion.div
                        animate={{ opacity: col.mid }}
                        transition={{ duration: col.dur, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#ffb088' }}
                      />
                      <motion.div
                        animate={{ opacity: col.bot }}
                        transition={{ duration: col.dur, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ width: 4, height: 4, borderRadius: '50%', background: '#ffb088' }}
                      />
                    </div>
                  ))}
                </div>
                
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#ffb088', opacity: 0.8 }} />
              </div>
            )}
            
            {state === 'executing' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 20, height: 20, border: '3px solid rgba(255,176,136,0.2)', borderTopColor: '#ffb088', borderRadius: '50%' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
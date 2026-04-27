"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SimpleFileNotificationProps {
  filename: string;
  content: string;
  size: number;
  isNew: boolean;
  status: "creating" | "success" | "error";
  onViewFile?: () => void;
  onCopyContent?: () => void;
  onOpenInEditor?: () => void;
}

export const SimpleFileNotification: React.FC<SimpleFileNotificationProps> = ({
  filename,
  content,
  size,
  isNew,
  status,
  onViewFile,
  onCopyContent,
  onOpenInEditor,
}) => {
  const [copied, setCopied] = useState(false);

  const ext = filename.split(".").pop()?.toUpperCase() ?? "FILE";
  const fileSizeKB = (size / 1024).toFixed(1);
  const lineCount = content.split("\n").length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      onCopyContent?.();
    } catch {}
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative flex items-center gap-4 p-3 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* ── Left Side: Thumbnail Preview ── */}
      <div className="relative flex-shrink-0 w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-7 h-9 rounded bg-white border border-gray-200 shadow-sm flex items-end justify-center pb-1">
            <span className="text-[7px] font-bold tracking-tighter text-gray-400">
              {ext}
            </span>
          </div>

          {status === "creating" && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 h-0.5 rounded-full bg-blue-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>

        {isNew && status === "success" && (
          <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white" />
        )}
      </div>

      {/* ── Right Side: Content & Actions ── */}
      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
        {/* File Details */}
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-gray-900 truncate leading-snug">
            {filename}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-gray-500 font-medium">
              {fileSizeKB} KB
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-[12px] text-gray-400">
              {lineCount} lines
            </span>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
          <ToolbarBtn title="View" onClick={() => onViewFile?.()}>
            <EyeIcon />
          </ToolbarBtn>

          <ToolbarBtn title={copied ? "Copied!" : "Copy"} onClick={handleCopy}>
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <CheckIcon className="text-emerald-500" />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <CopyIcon />
                </motion.span>
              )}
            </AnimatePresence>
          </ToolbarBtn>

          {onOpenInEditor && (
            <ToolbarBtn title="Download" onClick={onOpenInEditor}>
              <DownloadIcon />
            </ToolbarBtn>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ── Refined Toolbar button ── */
const ToolbarBtn: React.FC<{
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, onClick, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm transition-all active:scale-95"
  >
    {children}
  </button>
);

/* ── Standardized SVG icons (16px) ── */
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = "" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default SimpleFileNotification;

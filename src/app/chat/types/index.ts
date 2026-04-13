import React from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolCallDisplay {
    id: string;
    toolName: string;
    icon?: React.ReactNode;
    label?: string;
    color?: string;
    status: 'running' | 'done' | 'error';
    output?: string;
    durationMs?: number;
    data?: any;
    base64Image?: string;
    args?: Record<string, unknown>;
    displayName?: string;
    description?: string;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    thought?: string;
    thinkingDuration?: number; // Duration in milliseconds
    timestamp: Date;
    toolCalls?: ToolCallDisplay[];
    attachments?: FileAttachment[];
}

export interface FileAttachment {
    id: string;
    path?: string;
    name: string;
    size: number;
    mimeType: string;
    base64?: string;
    content?: string;
}

export interface FolderContext {
    id: string;
    path: string;
    name: string;
}

export interface ModelOption {
    id: string;
    name: string;
    provider: string;
    providerType: string;
    logo: any;
}

export type {
    ToolCallDisplay as ToolCallDisplayType,
    Message as MessageType,
    FileAttachment as FileAttachmentType,
    FolderContext as FolderContextType,
    ModelOption as ModelOptionType
};

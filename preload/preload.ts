/**
 * EverFern Desktop — Preload Script
 *
 * Exposes a secure, typed API to the renderer process via contextBridge.
 * All IPC calls go through this bridge — the renderer never touches
 * Electron internals directly.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window Controls ────────────────────────────────────────────
  window: {
    minimize:    () => ipcRenderer.invoke('window:minimize'),
    maximize:    () => ipcRenderer.invoke('window:maximize'),
    close:       () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },

  // ── System ───────────────────────────────────────────────────────
  system: {
    getUsername:    () => ipcRenderer.invoke('system:get-username'),
    openFilePicker: (options?: any) => ipcRenderer.invoke('system:open-file-picker', options),
    openFolderPicker: () => ipcRenderer.invoke('system:open-folder-picker'),
    wipeAccount:    () => ipcRenderer.invoke('system:wipe-account'),
    getPermissionStatus: () => ipcRenderer.invoke('permissions:status'),
    grantPermission:     () => ipcRenderer.invoke('permissions:grant'),
    onPermissionRequest: (cb: () => void) => {
      ipcRenderer.on('system:request-permission', () => cb());
    },
    ollamaStatus:  () => ipcRenderer.invoke('system:ollama-status'),
    ollamaInstall: () => ipcRenderer.invoke('system:ollama-install'),
    ollamaPull:    (modelName: string) => ipcRenderer.invoke('system:ollama-pull', modelName),
    onOllamaInstallLine: (cb: (data: { line: string, type: 'stdout'|'stderr' }) => void) => {
      ipcRenderer.on('system:ollama-install-line', (_e, data) => cb(data));
      ipcRenderer.on('system:ollama-pull-line', (_e, data) => cb(data));
    },
    removeOllamaListeners: () => {
      ipcRenderer.removeAllListeners('system:ollama-install-line');
      ipcRenderer.removeAllListeners('system:ollama-pull-line');
    }
  },

  // ── Config Store ───────────────────────────────────────────────
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  loadConfig: ()            => ipcRenderer.invoke('load-config'),

  // ── ACP (AI Completion Provider) ───────────────────────────────
  acp: {
    listProviders: ()            => ipcRenderer.invoke('acp:list-providers'),
    setProvider:   (cfg: any)   => ipcRenderer.invoke('acp:set-provider', cfg),
    healthCheck:   ()            => ipcRenderer.invoke('acp:health-check'),
    listModels:    ()            => ipcRenderer.invoke('acp:list-models'),
    chat:          (req: any)   => ipcRenderer.invoke('acp:chat', req),
    stream:        (req: any)   => ipcRenderer.invoke('acp:stream', req),
    stop:          ()            => ipcRenderer.invoke('acp:stop'),

    onStreamChunk: (cb: (chunk: { delta: string; done: boolean }) => void) => {
      ipcRenderer.on('acp:stream-chunk', (_e, chunk) => cb(chunk));
    },
    onThought: (cb: (data: { content: string }) => void) => {
      ipcRenderer.on('acp:thought', (_e, data) => cb(data));
    },
    onModelCallInfo: (cb: (data: { model: string; toolsCount: number }) => void) => {
      ipcRenderer.on('acp:model-call-info', (_e, data) => cb(data));
    },
    onToolStart: (cb: (record: { toolName: string; toolArgs: Record<string, unknown> }) => void) => {
      ipcRenderer.on('acp:tool-start', (_e, record) => cb(record));
    },
    onToolCall: (cb: (record: any) => void) => {
      ipcRenderer.on('acp:tool-call', (_e, record) => cb(record));
    },
    onToolUpdate: (cb: (data: { toolName: string; update: string }) => void) => {
      ipcRenderer.on('acp:tool-update', (_e, data) => cb(data));
    },
    onOptima: (cb: (data: { event: string; details: string }) => void) => {
      ipcRenderer.on('acp:optima', (_e, data) => cb(data));
    },
    onShowArtifact: (cb: (data: { name: string }) => void) => {
      ipcRenderer.on('acp:show-artifact', (_e, data) => cb(data));
    },
    onShowPlan: (cb: (data: { chatId: string; content: string }) => void) => {
      ipcRenderer.on('acp:show-plan', (_e, data) => cb(data));
    },
    onViewSkill: (cb: (data: { name: string }) => void) => {
      ipcRenderer.on('acp:view-skill', (_e, data) => cb(data));
    },
    onSkillDetected: (cb: (data: { skillName: string; skillDescription: string; reason: string }) => void) => {
      ipcRenderer.on('acp:skill-detected', (_e, data) => cb(data));
    },
    onUsage: (cb: (data: { promptTokens: number; completionTokens: number; totalTokens: number }) => void) => {
      ipcRenderer.on('acp:usage', (_e, data) => cb(data));
    },
    onAgentPermissionRequest: (cb: () => void) => {
      ipcRenderer.on('agent:permission-request', () => cb());
    },
    agentPermissionResponse: (granted: boolean) => ipcRenderer.invoke('agent:permission-response', granted),
    getPermissionSoundUrl: () => '/sounds/permission.mp3',
    playSound: (soundPath: string) => ipcRenderer.invoke('audio:play-sound', soundPath),
    validateNvidiaModel: (modelId: string, apiKey: string) => ipcRenderer.invoke('acp:validate-nvidia-model', modelId, apiKey),
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('acp:stream-chunk');
      ipcRenderer.removeAllListeners('acp:thought');
      ipcRenderer.removeAllListeners('acp:tool-start');
      ipcRenderer.removeAllListeners('acp:tool-call');
      ipcRenderer.removeAllListeners('acp:tool-update');
      ipcRenderer.removeAllListeners('acp:optima');
      ipcRenderer.removeAllListeners('acp:show-artifact');
      ipcRenderer.removeAllListeners('acp:show-plan');
      ipcRenderer.removeAllListeners('acp:view-skill');
      ipcRenderer.removeAllListeners('acp:skill-detected');
      ipcRenderer.removeAllListeners('acp:usage');
      ipcRenderer.removeAllListeners('agent:permission-request');
    },
  },

  // ── Chat History ───────────────────────────────────────────────
  history: {
    list:   ()                => ipcRenderer.invoke('history:list'),
    load:   (id: string)     => ipcRenderer.invoke('history:load', id),
    save:   (conv: any)      => ipcRenderer.invoke('history:save', conv),
    delete: (id: string)     => ipcRenderer.invoke('history:delete', id),
  },

  // ── Memory ───────────────────────────────────────────────────────
  memory: {
    saveDirect: (content: string, metadata?: string) => ipcRenderer.invoke('memory:save-direct', content, metadata),
  },

  // ── Artifacts ────────────────────────────────────────────────
  artifacts: {
    list:   (chatId?: string)                            => ipcRenderer.invoke('artifacts:list', chatId),
    read:   (chatId: string, filename: string)           => ipcRenderer.invoke('artifacts:read', chatId, filename),
    write:  (chatId: string, filename: string, content: string) => ipcRenderer.invoke('artifacts:write', chatId, filename, content),
    delete: (chatId: string, filename: string)           => ipcRenderer.invoke('artifacts:delete', chatId, filename),
  },

  // ── Plans ───────────────────────────────────────────────────────
  plans: {
    list:   (chatId: string)                             => ipcRenderer.invoke('plans:list', chatId),
    read:   (chatId: string, filename: string)          => ipcRenderer.invoke('plans:read', chatId, filename),
    write:  (chatId: string, filename: string, content: string) => ipcRenderer.invoke('plans:write', chatId, filename, content),
    delete: (chatId: string, filename: string)          => ipcRenderer.invoke('plans:delete', chatId, filename),
  },

  // ── Sites ─────────────────────────────────────────────────────────
  sites: {
    list:   (chatId?: string)                           => ipcRenderer.invoke('sites:list', chatId),
    read:   (chatId: string, filename: string)          => ipcRenderer.invoke('sites:read', chatId, filename),
    write:  (chatId: string, filename: string, content: string) => ipcRenderer.invoke('sites:write', chatId, filename, content),
    delete: (chatId: string, filename?: string)         => ipcRenderer.invoke('sites:delete', chatId, filename),
    openFolder: (chatId: string)                         => ipcRenderer.invoke('sites:open-folder', chatId),
  },

  // ── Terminal Processes ─────────────────────────────────────────────
  terminal: {
    listProcesses: () => ipcRenderer.invoke('terminal:list-processes'),
    killProcess:   (id: string) => ipcRenderer.invoke('terminal:kill-process', id),
  },

  // ── ShowUI Local ──────────────────────────────────────────────────
  showui: {
    install: () => ipcRenderer.invoke('showui:install'),
    launch:  () => ipcRenderer.invoke('showui:launch'),
    onInstallLine: (cb: (data: { line: string, step: number, kind: 'out' | 'err' | 'info' | 'done' | 'fail' }) => void) => {
      ipcRenderer.on('showui:install-line', (_e, data) => cb(data));
    },
    removeInstallListeners: () => ipcRenderer.removeAllListeners('showui:install-line'),
  },

  // ── Vectors ────────────────────────────────────────────────────────
  vectors: {
    search: (query: string, topK?: number, chatId?: string) => ipcRenderer.invoke('vectors:search', query, topK, chatId),
    get: (chatId: string) => ipcRenderer.invoke('vectors:get', chatId),
    delete: (chatId: string) => ipcRenderer.invoke('vectors:delete', chatId),
    stats: () => ipcRenderer.invoke('vectors:stats'),
    indexMessage: (id: string, chatId: string, role: string, content: string, createdAt: number) => 
      ipcRenderer.invoke('vectors:index-message', id, chatId, role, content, createdAt),
    refreshConfig: () => ipcRenderer.invoke('vectors:refresh-config'),
  },

  // ── Debug ──────────────────────────────────────────────────────────
  debug: {
    getLastEvent: () => ipcRenderer.invoke('debug:get-last-event'),
    getChatHistory: () => ipcRenderer.invoke('debug:get-chat-history'),
  },
});

// ── Type Export (for renderer use) ────────────────────────────────

export type ElectronAPI = {
  window: {
    minimize:    () => Promise<void>;
    maximize:    () => Promise<void>;
    close:       () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  system: {
    getUsername:    () => Promise<string>;
    openFilePicker: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<{ path: string; name: string; content?: string; base64?: string; mimeType?: string; size?: number; success: boolean, error?: string } | null>;
    openFolderPicker: () => Promise<{ path: string; name: string; success: boolean; error?: string } | null>;
    wipeAccount:    () => Promise<{ success: boolean; error?: string }>;
    getPermissionStatus: () => Promise<{ granted: boolean }>;
    grantPermission:     () => Promise<{ success: boolean }>;
    onPermissionRequest: (cb: () => void) => void;
    ollamaStatus:        () => Promise<{ installed: boolean; modelInstalled: boolean }>;
    ollamaInstall:       () => Promise<{ success: boolean; code: number }>;
    ollamaPull:          (modelName: string) => Promise<{ success: boolean; code: number }>;
    onOllamaInstallLine: (cb: (data: { line: string, type: 'stdout'|'stderr' }) => void) => void;
    removeOllamaListeners: () => void;
  };
  saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  loadConfig: ()            => Promise<{ success: boolean; config: any; error?: string }>;
  acp: {
    listProviders:         () => Promise<any[]>;
    setProvider:           (cfg: any) => Promise<{ ok: boolean; error?: string }>;
    healthCheck:           () => Promise<{ ok: boolean; error?: string; provider?: string }>;
    listModels:            () => Promise<{ success: boolean; models: string[] }>;
    chat:                  (req: any) => Promise<any>;
    stream:                (req: any) => Promise<any>;
    onStreamChunk:         (cb: (chunk: { delta: string; done: boolean }) => void) => void;
    onThought:             (cb: (data: { content: string }) => void) => void;
    onToolStart:           (cb: (record: { toolName: string; toolArgs: Record<string, unknown> }) => void) => void;
    onToolCall:            (cb: (record: any) => void) => void;
    onToolUpdate:          (cb: (data: { toolName: string; update: string }) => void) => void;
    onOptima:              (cb: (data: { event: string; details: string }) => void) => void;
    onShowArtifact:        (cb: (data: { name: string }) => void) => void;
    onShowPlan:            (cb: (data: { chatId: string; content: string }) => void) => void;
    onViewSkill:           (cb: (data: { name: string }) => void) => void;
    onSkillDetected:       (cb: (data: { skillName: string; skillDescription: string; reason: string }) => void) => void;
    onAgentPermissionRequest: (cb: () => void) => void;
    agentPermissionResponse: (granted: boolean) => Promise<{ success: boolean }>;
    playSound: (soundPath: string) => Promise<boolean>;
    validateNvidiaModel: (modelId: string, apiKey: string) => Promise<{ valid: boolean; hasVision?: boolean; error?: string }>;
    removeStreamListeners: () => void;
  };
  history: {
    list:   () => Promise<any[]>;
    load:   (id: string) => Promise<any>;
    save:   (conv: any)  => Promise<{ success: boolean; error?: string }>;
    delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  };
  memory: {
    saveDirect: (content: string, metadata?: string) => Promise<{ success: boolean; output: string }>;
  };
  artifacts: {
    list:   (chatId?: string) => Promise<any[]>;
    read:   (chatId: string, filename: string) => Promise<string | null>;
    write:  (chatId: string, filename: string, content: string) => Promise<{ success: boolean; error?: string }>;
    delete: (chatId: string, filename: string) => Promise<{ success: boolean }>;
  };
  plans: {
    list:   (chatId: string) => Promise<string[]>;
    read:   (chatId: string, filename: string) => Promise<string | null>;
    write:  (chatId: string, filename: string, content: string) => Promise<{ success: boolean; error?: string }>;
    delete: (chatId: string, filename: string) => Promise<{ success: boolean }>;
  };
  sites: {
    list:   (chatId?: string) => Promise<any[]>;
    read:   (chatId: string, filename: string) => Promise<string | null>;
    write:  (chatId: string, filename: string, content: string) => Promise<{ success: boolean; error?: string }>;
    delete: (chatId: string, filename?: string) => Promise<{ success: boolean }>;
    openFolder: (chatId: string) => Promise<void>;
  };
  terminal: {
    listProcesses: () => Promise<{ id: string; commandLine: string; status: 'running' | 'done'; exitCode?: number | null; bufferSize: number }[]>;
    killProcess:   (id: string) => Promise<{ success: boolean }>;
  };
  showui: {
    install: () => Promise<{ success: boolean; showuiDir?: string; error?: string }>;
    launch:  () => Promise<{ success: boolean; error?: string }>;
    onInstallLine: (cb: (data: { line: string, step: number, kind: 'out' | 'err' | 'info' | 'done' | 'fail' }) => void) => void;
    removeInstallListeners: () => void;
  };
  vectors: {
    search: (query: string, topK?: number, chatId?: string) => Promise<any[]>;
    get: (chatId: string) => Promise<any[]>;
    delete: (chatId: string) => Promise<{ success: boolean; error?: string }>;
    stats: () => Promise<{ messageCount: number; storageSize: number; dimensionCount: number | null }>;
    indexMessage: (id: string, chatId: string, role: string, content: string, createdAt: number) => Promise<{ success: boolean; error?: string }>;
    refreshConfig: () => Promise<{ success: boolean; error?: string }>;
  };
  skills: {
    listCustom: () => Promise<{ name: string; description: string; path: string }[]>;
    saveCustom: (data: { name: string; description: string; content: string }) => Promise<{ success: boolean; error?: string }>;
    deleteCustom: (name: string) => Promise<{ success: boolean; error?: string }>;
    getCustomPath: () => Promise<string>;
  };
  debug: {
    getLastEvent: () => Promise<any>;
    getChatHistory: () => Promise<any>;
  };
};

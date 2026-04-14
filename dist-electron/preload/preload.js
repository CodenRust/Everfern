"use strict";
/**
 * EverFern Desktop — Preload Script
 *
 * Exposes a secure, typed API to the renderer process via contextBridge.
 * All IPC calls go through this bridge — the renderer never touches
 * Electron internals directly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // ── Window Controls ────────────────────────────────────────────
    window: {
        minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
        maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
        close: () => electron_1.ipcRenderer.invoke('window:close'),
        isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    },
    // ── System ───────────────────────────────────────────────────────
    system: {
        getUsername: () => electron_1.ipcRenderer.invoke('system:get-username'),
        openFilePicker: (options) => electron_1.ipcRenderer.invoke('system:open-file-picker', options),
        openFolderPicker: () => electron_1.ipcRenderer.invoke('system:open-folder-picker'),
        wipeAccount: () => electron_1.ipcRenderer.invoke('system:wipe-account'),
        getPermissionStatus: () => electron_1.ipcRenderer.invoke('permissions:status'),
        grantPermission: () => electron_1.ipcRenderer.invoke('permissions:grant'),
        onPermissionRequest: (cb) => {
            electron_1.ipcRenderer.on('system:request-permission', () => cb());
        },
        ollamaStatus: () => electron_1.ipcRenderer.invoke('system:ollama-status'),
        ollamaInstall: () => electron_1.ipcRenderer.invoke('system:ollama-install'),
        ollamaPull: (modelName) => electron_1.ipcRenderer.invoke('system:ollama-pull', modelName),
        onOllamaInstallLine: (cb) => {
            electron_1.ipcRenderer.on('system:ollama-install-line', (_e, data) => cb(data));
            electron_1.ipcRenderer.on('system:ollama-pull-line', (_e, data) => cb(data));
        },
        removeOllamaListeners: () => {
            electron_1.ipcRenderer.removeAllListeners('system:ollama-install-line');
            electron_1.ipcRenderer.removeAllListeners('system:ollama-pull-line');
        }
    },
    // ── Config Store ───────────────────────────────────────────────
    saveConfig: (config) => electron_1.ipcRenderer.invoke('save-config', config),
    loadConfig: () => electron_1.ipcRenderer.invoke('load-config'),
    // ── ACP (AI Completion Provider) ───────────────────────────────
    acp: {
        listProviders: () => electron_1.ipcRenderer.invoke('acp:list-providers'),
        setProvider: (cfg) => electron_1.ipcRenderer.invoke('acp:set-provider', cfg),
        healthCheck: () => electron_1.ipcRenderer.invoke('acp:health-check'),
        listModels: () => electron_1.ipcRenderer.invoke('acp:list-models'),
        chat: (req) => electron_1.ipcRenderer.invoke('acp:chat', req),
        stream: (req) => electron_1.ipcRenderer.invoke('acp:stream', req),
        stop: () => electron_1.ipcRenderer.invoke('acp:stop'),
        onStreamChunk: (cb) => {
            electron_1.ipcRenderer.on('acp:stream-chunk', (_e, chunk) => cb(chunk));
        },
        onThought: (cb) => {
            electron_1.ipcRenderer.on('acp:thought', (_e, data) => cb(data));
        },
        onModelCallInfo: (cb) => {
            electron_1.ipcRenderer.on('acp:model-call-info', (_e, data) => cb(data));
        },
        onToolStart: (cb) => {
            electron_1.ipcRenderer.on('acp:tool-start', (_e, record) => {
                if (record.toolName === 'ask_user_question') {
                    console.log('[Preload] Received ask_user_question tool-start:', JSON.stringify(record, null, 2));
                }
                cb(record);
            });
        },
        onToolCall: (cb) => {
            electron_1.ipcRenderer.on('acp:tool-call', (_e, record) => {
                if (record.toolName === 'ask_user_question') {
                    console.log('[Preload] Received ask_user_question tool-call:', JSON.stringify(record, null, 2));
                }
                cb(record);
            });
        },
        onToolUpdate: (cb) => {
            electron_1.ipcRenderer.on('acp:tool-update', (_e, data) => cb(data));
        },
        onOptima: (cb) => {
            electron_1.ipcRenderer.on('acp:optima', (_e, data) => cb(data));
        },
        onShowArtifact: (cb) => {
            electron_1.ipcRenderer.on('acp:show-artifact', (_e, data) => cb(data));
        },
        onShowPlan: (cb) => {
            electron_1.ipcRenderer.on('acp:show-plan', (_e, data) => cb(data));
        },
        onViewSkill: (cb) => {
            electron_1.ipcRenderer.on('acp:view-skill', (_e, data) => cb(data));
        },
        onSkillDetected: (cb) => {
            electron_1.ipcRenderer.on('acp:skill-detected', (_e, data) => cb(data));
        },
        onSurfaceAction: (cb) => {
            electron_1.ipcRenderer.on('acp:surface-action', (_e, data) => cb(data));
        },
        onUsage: (cb) => {
            electron_1.ipcRenderer.on('acp:usage', (_e, data) => cb(data));
        },
        onAgentPermissionRequest: (cb) => {
            electron_1.ipcRenderer.on('agent:permission-request', () => cb());
        },
        agentPermissionResponse: (granted) => electron_1.ipcRenderer.invoke('agent:permission-response', granted),
        getPermissionSoundUrl: () => '/sounds/permission.mp3',
        playSound: (soundPath) => electron_1.ipcRenderer.invoke('audio:play-sound', soundPath),
        validateNvidiaModel: (modelId, apiKey) => electron_1.ipcRenderer.invoke('acp:validate-nvidia-model', modelId, apiKey),
        // Mission Timeline Events
        onMissionStepUpdate: (cb) => {
            electron_1.ipcRenderer.on('acp:mission-step-update', (_e, data) => cb(data));
        },
        onMissionPhaseChange: (cb) => {
            electron_1.ipcRenderer.on('acp:mission-phase-change', (_e, data) => cb(data));
        },
        onMissionComplete: (cb) => {
            electron_1.ipcRenderer.on('acp:mission-complete', (_e, data) => cb(data));
        },
        onPlanCreated: (cb) => {
            electron_1.ipcRenderer.on('acp:plan-created', (_e, data) => cb(data));
        },
        onHitlRequest: (cb) => {
            console.log('[Preload] 🔧 Setting up HITL request listener');
            electron_1.ipcRenderer.on('acp:hitl-request', (_e, data) => {
                console.log('[Preload] ✅ HITL request received from main process:', data);
                cb(data);
            });
        },
        removeStreamListeners: () => {
            electron_1.ipcRenderer.removeAllListeners('acp:stream-chunk');
            electron_1.ipcRenderer.removeAllListeners('acp:thought');
            electron_1.ipcRenderer.removeAllListeners('acp:tool-start');
            electron_1.ipcRenderer.removeAllListeners('acp:tool-call');
            electron_1.ipcRenderer.removeAllListeners('acp:tool-update');
            electron_1.ipcRenderer.removeAllListeners('acp:optima');
            electron_1.ipcRenderer.removeAllListeners('acp:show-artifact');
            electron_1.ipcRenderer.removeAllListeners('acp:show-plan');
            electron_1.ipcRenderer.removeAllListeners('acp:view-skill');
            electron_1.ipcRenderer.removeAllListeners('acp:skill-detected');
            electron_1.ipcRenderer.removeAllListeners('acp:surface-action');
            electron_1.ipcRenderer.removeAllListeners('acp:usage');
            electron_1.ipcRenderer.removeAllListeners('agent:permission-request');
            electron_1.ipcRenderer.removeAllListeners('acp:mission-step-update');
            electron_1.ipcRenderer.removeAllListeners('acp:mission-phase-change');
            electron_1.ipcRenderer.removeAllListeners('acp:mission-complete');
            electron_1.ipcRenderer.removeAllListeners('acp:plan-created');
            electron_1.ipcRenderer.removeAllListeners('acp:hitl-request');
        },
    },
    // ── Chat History ───────────────────────────────────────────────
    history: {
        list: () => electron_1.ipcRenderer.invoke('history:list'),
        load: (id) => electron_1.ipcRenderer.invoke('history:load', id),
        save: (conv) => electron_1.ipcRenderer.invoke('history:save', conv),
        delete: (id) => electron_1.ipcRenderer.invoke('history:delete', id),
    },
    // ── Memory ───────────────────────────────────────────────────────
    memory: {
        saveDirect: (content, metadata) => electron_1.ipcRenderer.invoke('memory:save-direct', content, metadata),
    },
    // ── Artifacts ────────────────────────────────────────────────
    artifacts: {
        list: (chatId) => electron_1.ipcRenderer.invoke('artifacts:list', chatId),
        read: (chatId, filename) => electron_1.ipcRenderer.invoke('artifacts:read', chatId, filename),
        write: (chatId, filename, content) => electron_1.ipcRenderer.invoke('artifacts:write', chatId, filename, content),
        delete: (chatId, filename) => electron_1.ipcRenderer.invoke('artifacts:delete', chatId, filename),
    },
    // ── Plans ───────────────────────────────────────────────────────
    plans: {
        list: (chatId) => electron_1.ipcRenderer.invoke('plans:list', chatId),
        read: (chatId, filename) => electron_1.ipcRenderer.invoke('plans:read', chatId, filename),
        write: (chatId, filename, content) => electron_1.ipcRenderer.invoke('plans:write', chatId, filename, content),
        delete: (chatId, filename) => electron_1.ipcRenderer.invoke('plans:delete', chatId, filename),
    },
    // ── Sites ─────────────────────────────────────────────────────────
    sites: {
        list: (chatId) => electron_1.ipcRenderer.invoke('sites:list', chatId),
        read: (chatId, filename) => electron_1.ipcRenderer.invoke('sites:read', chatId, filename),
        write: (chatId, filename, content) => electron_1.ipcRenderer.invoke('sites:write', chatId, filename, content),
        delete: (chatId, filename) => electron_1.ipcRenderer.invoke('sites:delete', chatId, filename),
        openFolder: (chatId) => electron_1.ipcRenderer.invoke('sites:open-folder', chatId),
    },
    // ── Terminal Processes ─────────────────────────────────────────────
    terminal: {
        listProcesses: () => electron_1.ipcRenderer.invoke('terminal:list-processes'),
        killProcess: (id) => electron_1.ipcRenderer.invoke('terminal:kill-process', id),
    },
    // ── ShowUI Local ──────────────────────────────────────────────────
    showui: {
        install: () => electron_1.ipcRenderer.invoke('showui:install'),
        launch: () => electron_1.ipcRenderer.invoke('showui:launch'),
        onInstallLine: (cb) => {
            electron_1.ipcRenderer.on('showui:install-line', (_e, data) => cb(data));
        },
        removeInstallListeners: () => electron_1.ipcRenderer.removeAllListeners('showui:install-line'),
    },
    // ── Vectors ────────────────────────────────────────────────────────
    vectors: {
        search: (query, topK, chatId) => electron_1.ipcRenderer.invoke('vectors:search', query, topK, chatId),
        get: (chatId) => electron_1.ipcRenderer.invoke('vectors:get', chatId),
        delete: (chatId) => electron_1.ipcRenderer.invoke('vectors:delete', chatId),
        stats: () => electron_1.ipcRenderer.invoke('vectors:stats'),
        indexMessage: (id, chatId, role, content, createdAt) => electron_1.ipcRenderer.invoke('vectors:index-message', id, chatId, role, content, createdAt),
        refreshConfig: () => electron_1.ipcRenderer.invoke('vectors:refresh-config'),
    },
    // ── Debug ──────────────────────────────────────────────────────────
    debug: {
        getLastEvent: () => electron_1.ipcRenderer.invoke('debug:get-last-event'),
        getChatHistory: () => electron_1.ipcRenderer.invoke('debug:get-chat-history'),
    },
});

import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Components
import { FileExplorerView } from "../components/FileExplorerView";
import {
    PlusIcon,
    PaperAirplaneIcon,
    ChevronDownIcon,
    XMarkIcon,
    PaperClipIcon,
    StopIcon,
    KeyIcon,
    ArrowDownOnSquareIcon,
    GlobeAltIcon,
    SparklesIcon,
    CpuChipIcon,
    TrashIcon,
    ArrowTopRightOnSquareIcon,
    ChevronRightIcon,
    BellIcon,
    UserCircleIcon,
    Bars3CenterLeftIcon,
    AcademicCapIcon,
    SparklesIcon as SparklesIcon2,
} from "@heroicons/react/24/outline";

import { AgentTimeline } from "../../components/AgentTimeline";
import StreamView from "../../components/StreamView";
import WindowControls from "../components/WindowControls";
import Sidebar from "../components/Sidebar";
import PermissionDialog from "../components/PermissionDialog";
import ArtifactsPanel from './ArtifactsPanel';
import ArtifactsList from './ArtifactsList';
import SitePreview from './SitePreview';
import SettingsPage from './SettingsPage';
import DirectoryModal from '../components/DirectoryModal';
import FileArtifact from './FileArtifact';
import VoiceAssistantUI from './VoiceAssistantUI';
import PlanViewerPanel from './PlanViewerPanel';

// Modular Components
// Modularized Components
import { VoiceButton } from "./components/VoiceButton";
import { JsonViewerModal } from "./components/JsonViewerModal";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { ToolTimeline, WriteDiffCard, PlanApprovalBanner } from "./components/ToolGroup";
import { ReasoningPane, ReasoningBranch } from "./components/ReasoningPane";
import { AgentWorkspaceCards, PlanReviewCard } from "./components/AgentWorkspace";
import { ReportPane } from "./components/ReportPane";
import { ReportLink } from "./components/ReportLink";
import { StreamingMarkdown } from "./components/StreamingMarkdown";
import { RateLimitContinueButton } from "./components/UIElements";

import { ToolCallDisplay } from "./types";

// ── Provider Logos ──────────────────────────────────────────────────────────

const OpenAILogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/openai.svg" alt="OpenAI Logo" width={size} height={size} className="invert opacity-90" />
);

const AnthropicLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/claude.svg" alt="Anthropic Logo" width={size} height={size} className="grayscale opacity-90" />
);

const DeepSeekLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/deepseek.svg" alt="DeepSeek Logo" width={size} height={size} className="grayscale opacity-90" />
);

const GeminiLogo = ({ size = 20 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/gemini.svg" alt="Gemini Logo" width={size} height={size} className="grayscale opacity-80" />
);

const NvidiaLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/nvidia.svg" alt="Nvidia Logo" width={size} height={size} className="grayscale opacity-90" />
);

const OllamaLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/ollama.svg" alt="Ollama Logo" width={size} height={size} className="invert opacity-90" />
);

const LMStudioLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/lm-studio.png" alt="LM Studio Logo" width={size} height={size} className="grayscale opacity-80" />
);

const HuggingFaceLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/ai-providers/hf-logo.svg" alt="HuggingFace Logo" width={size} height={size} className="grayscale opacity-90" />
);

const EverFernBglessLogo = ({ size = 16 }: { size?: number }) => (
    <Image unoptimized src="/images/logos/black-logo-withoutbg.png" alt="" width={size} height={size} />
);

// ── Utilities ────────────────────────────────────────────────────────────────
function stripAnsi(str: string) {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function extractFileArtifacts(content: string) {
    if (!content) return { cleanContent: '', artifacts: [] };
    const artifactRegex = /📄 \*\*([^*]+)\*\*\n\s*Path: `([^`]+)`/g;
    const artifacts: { description: string, path: string }[] = [];
    let match;
    while ((match = artifactRegex.exec(content)) !== null) {
        artifacts.push({ description: match[1], path: match[2] });
    }

    let cleanContent = content;
    if (artifacts.length > 0) {
        const blockRegex = /Files presented to the user:\n\n(?:📄 \*\*[\s\S]*?\*\*\n\s*Path: `[^`]+`\n\n?)+\n*Task complete\./g;
        const replaced = cleanContent.replace(blockRegex, '');
        if (replaced !== cleanContent) {
            cleanContent = replaced;
        } else {
            cleanContent = cleanContent.replace(/Files presented to the user:\n\n/g, '');
            cleanContent = cleanContent.replace(artifactRegex, '');
            cleanContent = cleanContent.replace(/Task complete\./g, '');
        }
    }
    return { cleanContent: cleanContent.trim(), artifacts };
}

function resolveToolDisplay(toolName: string, args: Record<string, unknown>): { icon: React.ReactNode; label: string; color?: string } {
    switch (toolName) {
        case 'run_command':
        case 'bash':
        case 'run_terminal':
            return { icon: <CpuChipIcon width={14} height={14} />, label: 'Terminal', color: '#6366f1' };
        case 'web_search':
            return { icon: <GlobeAltIcon width={14} height={14} />, label: `Search: ${args.query || '...'}` };
        case 'read_file':
            return { icon: <PaperClipIcon width={14} height={14} />, label: `Read: ${args.path || '...'}` };
        case 'write_file':
        case 'write':
            return { icon: <SparklesIcon width={14} height={14} />, label: `Write: ${args.path || '...'}` };
        case 'create_plan':
            return { icon: <AcademicCapIcon width={14} height={14} />, label: 'Planning' };
        default:
            return { icon: <SparklesIcon width={14} height={14} />, label: toolName };
    }
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    providerType: string;
    logo: (({ size }: { size?: number }) => JSX.Element) | null;
}

interface FileAttachment {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    base64?: string;
    content?: string;
    path?: string;
}

interface FolderContext {
    id: string;
    path: string;
    name: string;
}

interface ToolCallRecord {
    id: string;
    toolName: string;
    icon?: React.ReactNode;
    label?: string;
    color?: string;
    status: "running" | "done" | "error";
    args?: Record<string, unknown>;
    output?: string;
    data?: unknown;
    base64Image?: string;
    durationMs?: number;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    thought?: string;
    timestamp: Date;
    attachments?: FileAttachment[];
    toolCalls?: ToolCallRecord[];
}
// ── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [attachments, setAttachments] = useState<FileAttachment[]>([]);
    const [folderContexts, setFolderContexts] = useState<FolderContext[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [folderHover, setFolderHover] = useState(false);
    const [tooltipState, setTooltipState] = useState<{ visible: boolean; x: number; y: number; content: string }>({ visible: false, x: 0, y: 0, content: "" });
    const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
    const [showArtifacts, setShowArtifacts] = useState(false);
    const [selectedArtifactName, setSelectedArtifactName] = useState<string | null>(null);
    const [showPlanViewer, setShowPlanViewer] = useState(false);
    const [planViewerContent, setPlanViewerContent] = useState("");
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState("everfern-1");
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showDirectoryModal, setShowDirectoryModal] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [randomGreeting, setRandomGreeting] = useState("");
    const [currentSites, setCurrentSites] = useState<any[]>([]);
    const [settingsMotionBlur, setSettingsMotionBlur] = useState(true);

    const greetingMessages = [
        "What do you want to do, {name}?",
        "Ready to build, {name}?",
        "Back at it, {name}?"
    ];

    const [config, setConfig] = useState<any>(null);
    const [currentPlan, setCurrentPlan] = useState<any | null>(null);
    const [executionPlan, setExecutionPlan] = useState<{ title?: string; content: string } | null>(null);
    const [isExecutionPlanPaneOpen, setIsExecutionPlanPaneOpen] = useState<boolean>(true);
    const [reportPane, setReportPane] = useState<{ label: string; path: string } | null>(null);
    const [contextItems, setContextItems] = useState<{ id: string; type: 'file' | 'web' | 'app'; label: string; base64Image?: string }[]>([]);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState<"name" | "vlm">("name");
    const [onboardingName, setOnboardingName] = useState("");
    const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
    const [modelInstalled, setModelInstalled] = useState<boolean | null>(null);
    const [ollamaLogs, setOllamaLogs] = useState<string[]>([]);
    const [isInstallingOllama, setIsInstallingOllama] = useState(false);
    const [ollamaInstallDone, setOllamaInstallDone] = useState(false);
    const [ollamaInstallPct, setOllamaInstallPct] = useState(0);
    const [ollamaInstallPhase, setOllamaInstallPhase] = useState<"downloading" | "finalizing" | "done">("downloading");
    const [isPullingModel, setIsPullingModel] = useState(false);
    const [pullPct, setPullPct] = useState(0);
    const [isComputerUseActive, setIsComputerUseActive] = useState(false);
    const [computerUseStep, setComputerUseStep] = useState("");
    const [liveToolCalls, setLiveToolCalls] = useState<ToolCallDisplay[]>([]);
    const [streamingContent, setStreamingContent] = useState("");
    const [streamingThought, setStreamingThought] = useState("");

    // Settings
    const [settingsEngine, setSettingsEngine] = useState<"online" | "local" | "everfern" | null>("everfern");
    const [settingsProvider, setSettingsProvider] = useState<string | null>(null);
    const [settingsApiKey, setSettingsApiKey] = useState("");
    const [settingsCustomModel, setSettingsCustomModel] = useState("");
    const [settingsShowuiUrl, setSettingsShowuiUrl] = useState("http://127.0.0.1:7860");
    const [settingsVlmMode, setSettingsVlmMode] = useState<"local" | "cloud">("local");
    const [settingsVlmCloudProvider, setSettingsVlmCloudProvider] = useState("ollama");
    const [settingsVlmCloudModel, setSettingsVlmCloudModel] = useState("qwen3-vl:235b-instruct-cloud");
    const [settingsVlmCloudUrl, setSettingsVlmCloudUrl] = useState("https://ollama.com");
    const [settingsVlmCloudKey, setSettingsVlmCloudKey] = useState("");

    // Voice state
    const [voiceProvider, setVoiceProvider] = useState<"deepgram" | "elevenlabs" | null>(null);
    const [voiceDeepgramKey, setVoiceDeepgramKey] = useState("");
    const [voiceElevenlabsKey, setVoiceElevenlabsKey] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState("");
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [voicePlayback, setVoicePlayback] = useState(false);
    const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
    const [voiceVoiceId, setVoiceVoiceId] = useState("21m00Tcm4TlvDq8ikWAM");
    const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);

    // Permission state
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    // JSON Viewer state
    const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
    const [lastEventJson, setLastEventJson] = useState<string>("");
    const [lastEventType, setLastEventType] = useState<string>("");
    const [contextTokens, setContextTokens] = useState<{ used: number; max: number }>({ used: 0, max: 128000 });

    const liveToolCallsRef = useRef<ToolCallDisplay[]>([]);
    const streamingContentRef = useRef("");
    const streamingThoughtRef = useRef("");
    const toolCallMap = useRef<Map<string, string>>(new Map());
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const voiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
    const hasReceivedUsageData = useRef(false);
    const isMessageCommittedRef = useRef(false);
    const isHandlingPlanRef = useRef(false);

    const isEmpty = messages.length === 0;
    const displayName = (config?.userName || onboardingName || "there").toString();

    useEffect(() => {
        if (displayName) {
            const nameStr = displayName.charAt(0).toUpperCase() + displayName.slice(1);
            const msg = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
            setRandomGreeting(msg.replace("{name}", nameStr));
        } else {
            const msg = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
            setRandomGreeting(msg.replace(", {name}", ""));
        }
    }, [displayName]);

    useEffect(() => {
        if (messages.length === 0) {
            setContextTokens({ used: 0, max: 128000 });
            return;
        }
        if (hasReceivedUsageData.current) return;
        const estimateTokens = (text: string) => Math.ceil(text.length / 4);
        let totalChars = 0;
        for (const msg of messages) {
            if (msg.content) totalChars += estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            if (msg.thought) totalChars += estimateTokens(msg.thought);
            if (msg.toolCalls) {
                for (const tc of msg.toolCalls) {
                    totalChars += estimateTokens(JSON.stringify(tc.args || {}));
                    if (tc.output) totalChars += estimateTokens(tc.output);
                }
            }
        }
        const inputChars = estimateTokens(inputValue);
        totalChars += inputChars;
        const totalTokens = Math.ceil(totalChars * 1.1);
        setContextTokens({ used: totalTokens, max: 128000 });
    }, [messages, inputValue]);

    useEffect(() => {
        if (!settingsMotionBlur) return;
        let ticking = false;
        const handleMouseMove = (e: MouseEvent) => {
            if (!ticking) {
                window.requestAnimationFrame(() => { setMousePos({ x: e.clientX, y: e.clientY }); ticking = false; });
                ticking = true;
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [settingsMotionBlur]);

    useEffect(() => {
        const loadInitialData = async () => {
            if ((window as any).electronAPI?.loadConfig) {
                const res = await (window as any).electronAPI.loadConfig();
                if (res.success && res.config) {
                    setConfig(res.config);
                    if (res.config.model) setSelectedModel(res.config.model);
                    if (res.config.motionBlur !== undefined) setSettingsMotionBlur(res.config.motionBlur);
                    if (res.config.voice) {
                        setVoiceProvider(res.config.voice.provider || null);
                        setVoiceDeepgramKey(res.config.voice.deepgramKey || "");
                        setVoiceElevenlabsKey(res.config.voice.elevenlabsKey || "");
                    }
                    if (!res.config.userName) setShowOnboarding(true);
                } else {
                    setShowOnboarding(true);
                }
            }
        };
        loadInitialData();
    }, []);

    const fetchModels = useCallback(async () => {
        if ((window as any).electronAPI?.acp?.listModels) {
            const res = await (window as any).electronAPI.acp.listModels();
            if (res.success && res.models) {
                const formatted = res.models.map((m: any) => ({
                    id: m.id, name: m.name, provider: m.provider, providerType: m.providerType,
                    logo: (m.providerType === 'ollama' || m.providerType === 'local') ? OllamaLogo : m.providerType === 'openai' ? OpenAILogo : m.providerType === 'anthropic' ? AnthropicLogo : m.providerType === 'deepseek' ? DeepSeekLogo : m.providerType === 'nvidia' ? NvidiaLogo : (m.providerType === 'gemini' || m.providerType === 'google') ? GeminiLogo : m.providerType === 'lmstudio' ? LMStudioLogo : m.providerType === 'everfern' ? EverFernBglessLogo : null
                }));
                const finalModels = (formatted.length > 0 ? formatted : [
                    { id: "everfern-1", name: "Fern-1", provider: "EverFern", providerType: "everfern", logo: EverFernBglessLogo },
                    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", providerType: "openai", logo: OpenAILogo },
                    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", providerType: "anthropic", logo: AnthropicLogo },
                    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "Google Gemini", providerType: "gemini", logo: GeminiLogo },
                    { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google Gemini", providerType: "gemini", logo: GeminiLogo },
                    { id: "google/gemma-4-31b-it", name: "Gemma 4 31B IT", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                    { id: "nvidia/llama-nemotron-32b-instruct", name: "Nemotron 32B", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                    { id: "mistralai/mistral-nemo-12b-instruct", name: "Mistral Nemo 12B", provider: "NVIDIA NIM", providerType: "nvidia", logo: NvidiaLogo },
                ]).filter((m: any) => m.id !== 'qwen3-vl:2b');
                setAvailableModels(finalModels);
                setSelectedModel(prev => {
                    const validIds = finalModels.filter((m: ModelOption) => !m.id.endsWith('-error') && !m.id.endsWith('-empty')).map((m: ModelOption) => m.id);
                    if (!validIds.includes(prev)) return validIds[0] ?? prev;
                    return prev;
                });
            }
        }
    }, [config]);

    useEffect(() => { if (config) fetchModels(); }, [config, fetchModels]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showModelSelector && config) { fetchModels(); interval = setInterval(fetchModels, 3000); }
        return () => { if (interval) clearInterval(interval); };
    }, [showModelSelector, config, fetchModels]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => { if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target as Node)) setShowModelSelector(false); };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
    }, [inputValue]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    useEffect(() => {
        if (showSettings && config) {
            setSettingsEngine(config.engine || "everfern");
            setSettingsProvider(config.provider || null);
            setSettingsApiKey(config.keys?.[config.provider || ""] || config.apiKey || "");
            setSettingsCustomModel(config.customModel || "z-ai/glm5");
            setSettingsShowuiUrl(config.showuiUrl || "http://127.0.0.1:7860");
            setSettingsVlmMode(config.vlm?.engine === "cloud" ? "cloud" : "local");
            setSettingsVlmCloudProvider(config.vlm?.engine === "cloud" ? (config.vlm.provider || "ollama") : "ollama");
            setSettingsVlmCloudModel(config.vlm?.engine === "cloud" ? (config.vlm.model || "qwen3-vl:235b-instruct-cloud") : "qwen3-vl:235b-instruct-cloud");
            setSettingsVlmCloudUrl(config.vlm?.engine === "cloud" ? (config.vlm.baseUrl || "https://ollama.com") : "https://ollama.com");
            setSettingsVlmCloudKey(config.vlm?.engine === "cloud" ? (config.keys?.[`vlm-${config.vlm.provider || 'ollama'}`] || config.vlm.apiKey || "") : "");
        }
    }, [showSettings]);

    useEffect(() => {
        if (settingsProvider && config) setSettingsApiKey(config.keys?.[settingsProvider] || "");
    }, [settingsProvider, config]);

    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
            if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
            if (voiceTimeoutRef.current) clearTimeout(voiceTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: Event) => {
            const ke = e as unknown as KeyboardEvent<HTMLDivElement>;
            if ((ke.metaKey || ke.ctrlKey) && ke.shiftKey && ke.key === "J") {
                ke.preventDefault();
                handleShowJsonViewer();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        const handleShowJsonViewerEvent = async () => {
            handleShowJsonViewer();
        };
        window.addEventListener("acp:show-json-viewer", handleShowJsonViewerEvent as EventListener);
        return () => window.removeEventListener("acp:show-json-viewer", handleShowJsonViewerEvent as EventListener);
    }, []);

    const handleShowJsonViewer = async () => {
        try {
            const chatHistory = await (window as any).electronAPI?.debug?.getChatHistory();
            if (chatHistory) {
                setLastEventJson(JSON.stringify(chatHistory, null, 2));
                setLastEventType(chatHistory.type || "chat_history");
                setIsJsonViewerOpen(true);
            } else {
                const lastEvent = await (window as any).electronAPI?.debug?.getLastEvent();
                if (lastEvent) {
                    setLastEventJson(JSON.stringify(lastEvent, null, 2));
                    setLastEventType(lastEvent.type || "unknown");
                    setIsJsonViewerOpen(true);
                }
            }
        } catch (err) {
            console.error("Failed to get JSON:", err);
        }
    };

    const handleAttachment = async (type?: 'image' | 'document') => {
        if ((window as any).electronAPI?.system?.openFilePicker) {
            let options = {};
            if (type === 'image') options = { filters: [{ name: 'Images', extensions: ['jpg', 'png', 'webp', 'gif', 'jpeg'] }] };
            else if (type === 'document') options = { filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'json', 'csv', 'docx'] }] };
            const file = await (window as any).electronAPI.system.openFilePicker(options);
            if (file && file.success) {
                const newAttachment: FileAttachment = { id: crypto.randomUUID(), name: file.name, size: file.size || 0, mimeType: file.mimeType || 'application/octet-stream', base64: file.base64, content: file.content, path: file.path };
                setAttachments(prev => [...prev, newAttachment]);
            }
        }
    };

    const handleAddContextFolder = async () => {
        const picker = (window as any).electronAPI?.system?.openFolderPicker;
        if (!picker) return;
        const folder = await picker();
        if (folder && folder.success && folder.path) {
            setFolderContexts(prev => { if (prev.some(f => f.path === folder.path)) return prev; return [...prev, { id: crypto.randomUUID(), path: folder.path, name: folder.name || folder.path }]; });
            setContextItems(prev => { const label = `Folder: ${folder.path}`; if (prev.some(i => i.label === label)) return prev; return [...prev, { id: crypto.randomUUID(), type: 'file', label }]; });
        }
    };

    const checkForPlan = useCallback(async (chatId: string) => {
        const api = (window as any).electronAPI;
        if (!api?.plans?.read) return;
        try {
            const planContent = await api.plans.read(chatId, 'execution_plan.md');
            if (planContent) setCurrentPlan({ content: planContent, chatId });
            else setCurrentPlan(null);
        } catch (e) { console.error("Failed to check for plan", e); }
    }, []);

    const checkForSites = useCallback(async (chatId: string) => {
        const api = (window as any).electronAPI;
        if (!api?.sites?.list) return;
        try {
            const results = await api.sites.list(chatId);
            const chatSites = (results || []).filter((s: any) => s.chatId === chatId);
            setCurrentSites(chatSites);
        }
        catch (e) { console.error("Failed to check for sites:", e); }
    }, []);

    useEffect(() => {
        if (currentPlan?.content) {
            setPlanViewerContent(currentPlan.content);
        }
    }, [currentPlan]);

    const handleApprovePlan = useCallback(async (content: string) => {
        if (!activeConversationId) return;
        const api = (window as any).electronAPI;
        setCurrentPlan(null);
        setIsExecutionPlanPaneOpen(false);
        try { await api.plans.delete(activeConversationId, 'execution_plan.md'); } catch (e) { console.error("Failed to delete plan", e); }
        const approvalMsg = `[PLAN_APPROVED]\nI have reviewed and approved your execution plan. Please proceed with the execution as planned.`;
        const cleanMessages = messages.filter(m => {
            if (m.role !== 'assistant') return true;
            const content = typeof m.content === 'string' ? m.content : '';
            return !content.includes('[PLAN_APPROVED]') && !content.includes('execution plan');
        });
        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: approvalMsg, timestamp: new Date() };
        const newMessages = [...cleanMessages, userMsg];
        setMessages(newMessages);
        setIsLoading(true);
        setLiveToolCalls([]);
        setStreamingContent("");
        setStreamingThought("");
        hasReceivedUsageData.current = false;
        isMessageCommittedRef.current = false;
        isHandlingPlanRef.current = false;
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";
        const currentM = availableModels.find(m => m.id === selectedModel) || availableModels[0];
        (async () => {
            const acpApi = (window as any).electronAPI?.acp;
            if (!acpApi?.stream) return;
            acpApi.removeStreamListeners();
            acpApi.onAgentPermissionRequest(() => {
                const soundUrl = acpApi?.getPermissionSoundUrl?.();
                if (soundUrl) {
                    try {
                        const audio = new Audio(soundUrl);
                        audio.volume = 0.7;
                        audio.play().catch(e => console.log('[Audio] Could not play permission sound:', e));
                    } catch (e) { console.log('[Audio] Error:', e); }
                }
                setShowPermissionModal(true);
            });
            acpApi.onToolStart(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
                const display = resolveToolDisplay(toolName, toolArgs);
                const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName, ...display, status: 'running', args: toolArgs };
                liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                setLiveToolCalls([...liveToolCallsRef.current]);
            });
            acpApi.onToolCall((record: any) => {
                const existingIdx = liveToolCallsRef.current.findIndex(t => t.toolName === record.toolName && t.status === 'running');
                if (existingIdx >= 0) {
                    const updated = [...liveToolCallsRef.current];
                    updated[existingIdx] = { ...updated[existingIdx], status: 'done' as const, output: typeof record.result === 'string' ? record.result : JSON.stringify(record.result) };
                    liveToolCallsRef.current = updated;
                    setLiveToolCalls(updated);
                }
            });
            acpApi.onThought(({ content }: { content: string }) => { streamingThoughtRef.current += content; setStreamingThought(streamingThoughtRef.current); });
            acpApi.onUsage(({ totalTokens }: { promptTokens: number; completionTokens: number; totalTokens: number }) => { hasReceivedUsageData.current = true; setContextTokens({ used: totalTokens, max: 128000 }); });
            acpApi.onStreamChunk(({ delta, done }: { delta: string; done: boolean }) => {
                if (isMessageCommittedRef.current) return;
                if (!done) {
                    if (delta) {
                        streamingContentRef.current += delta;
                        setStreamingContent(streamingContentRef.current);
                    }
                } else {
                    acpApi.removeStreamListeners();
                    isMessageCommittedRef.current = true;
                    const finalToolCalls = liveToolCallsRef.current.map(
                        t => t.status === 'running' ? { ...t, status: 'done' as const } : t
                    );

                    const assistantMsg: Message = {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: streamingContentRef.current || "Done.",
                        thought: streamingThoughtRef.current,
                        timestamp: new Date(),
                        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined
                    };
                    setMessages(prev => {
                        const final = [...prev, assistantMsg];
                        saveConversation(final);
                        return final;
                    });
                    setStreamingContent("");
                    setStreamingThought("");
                    setIsLoading(false);
                    setLiveToolCalls([]);

                }
            });
            try {
                await acpApi.stream({
                    messages: newMessages.map(m => ({ role: m.role, content: m.content })),
                    model: currentM?.id,
                    providerType: currentM?.providerType,
                    conversationId: activeConversationId,
                });
            } catch (err) { console.error("Stream error:", err); }
            finally { setIsLoading(false); }
        })();
    }, [activeConversationId, messages, selectedModel, availableModels]);

    const saveConversation = useCallback(async (msgs: Message[]) => {
        if (msgs.length === 0) return;
        const id = activeConversationId || crypto.randomUUID();
        if (!activeConversationId) setActiveConversationId(id);
        const conversation = { id, title: msgs[0].content.slice(0, 60) + (msgs[0].content.length > 60 ? "..." : ""), messages: msgs.map(m => ({ id: m.id || crypto.randomUUID(), role: m.role, content: m.content, thought: m.thought, toolCalls: m.toolCalls ? m.toolCalls.map(({ icon, ...rest }) => rest) : undefined })), provider: config?.provider || "everfern", createdAt: msgs[0].timestamp.toISOString(), updatedAt: new Date().toISOString() };
        if ((window as any).electronAPI?.history?.save) await (window as any).electronAPI.history.save(conversation);
    }, [activeConversationId, config?.provider]);

    const handlePlayVoiceResponse = useCallback(async (text: string) => {
        if (!voiceOutputEnabled || !voiceProvider || !voiceElevenlabsKey) return;
        try {
            setVoicePlayback(true);
            if (voiceProvider === "elevenlabs") {
                const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceVoiceId}?optimize_streaming_latency=0`, { method: 'POST', headers: { 'xi-api-key': voiceElevenlabsKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) });
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    if (!audioPlaybackRef.current) audioPlaybackRef.current = new Audio();
                    const audio = audioPlaybackRef.current;
                    audio.src = audioUrl;
                    audio.onended = () => { setVoicePlayback(false); URL.revokeObjectURL(audioUrl); };
                    audio.onerror = () => { setVoicePlayback(false); URL.revokeObjectURL(audioUrl); };
                    await audio.play();
                } else { setVoicePlayback(false); }
            }
        } catch (error) { console.error('Voice playback error:', error); setVoicePlayback(false); }
    }, [voiceOutputEnabled, voiceProvider, voiceElevenlabsKey, voiceVoiceId]);

    const handleSend = useCallback((overrideValue?: any) => {
        const textToUse = typeof overrideValue === 'string' ? overrideValue : inputValue;
        if ((!textToUse.trim() && attachments.length === 0 && folderContexts.length === 0) || isLoading) return;
        const folderContextText = folderContexts.length > 0 ? `\n\n[Shared folder context]\n${folderContexts.map(f => `- ${f.path}`).join('\n')}\n\nNote: This folder structure is provided as passive context. You do not need to process, scan, or organize these files automatically. However, if the user explicitly asks you to take an action on these files in this message, you MUST fulfill their request using your tools immediately without asking for extra confirmation.` : '';
        const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: (textToUse.trim() + folderContextText).trim(), timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        if (typeof overrideValue !== 'string') setInputValue("");
        setAttachments([]);
        setFolderContexts([]);
        setIsLoading(true);
        setLiveToolCalls([]);
        setStreamingContent("");
        setStreamingThought("");
        liveToolCallsRef.current = [];
        streamingContentRef.current = "";
        streamingThoughtRef.current = "";
        toolCallMap.current.clear();
        hasReceivedUsageData.current = false;

        const currentM = availableModels.find(m => m.id === selectedModel) || availableModels[0];

        (async () => {
            const api = (window as any).electronAPI?.acp;
            isMessageCommittedRef.current = false;
            isHandlingPlanRef.current = false;
            try {
                if (!api?.stream) throw new Error('No AI provider configured.');
                api.removeStreamListeners();
                api.onAgentPermissionRequest(() => {
                    const soundUrl = api?.getPermissionSoundUrl?.();
                    if (soundUrl) {
                        try {
                            const audio = new Audio(soundUrl);
                            audio.volume = 0.7;
                            audio.play().catch(e => console.log('[Audio] Could not play permission sound:', e));
                        } catch (e) { console.log('[Audio] Error:', e); }
                    }
                    setShowPermissionModal(true);
                });
                api.onToolStart(({ toolName, toolArgs }: { toolName: string; toolArgs: Record<string, unknown> }) => {
                    if (toolName === 'computer_use') { setIsComputerUseActive(true); setComputerUseStep('Starting...'); }
                    const display = resolveToolDisplay(toolName, toolArgs);
                    const newTc: ToolCallDisplay = { id: crypto.randomUUID(), toolName, ...display, status: 'running', args: toolArgs };
                    toolCallMap.current.set(toolName + '_running', newTc.id);
                    liveToolCallsRef.current = [...liveToolCallsRef.current, newTc];
                    setLiveToolCalls(liveToolCallsRef.current);
                });
                api.onToolCall((record: any) => {
                    if (record.toolName === 'computer_use') { setIsComputerUseActive(false); setComputerUseStep(''); }
                    if (record.toolName === 'create_plan' || record.toolName === 'update_plan_step') { if (record.result?.success && record.result?.data) setCurrentPlan(record.result.data); }
                    if (record.toolName === 'execution_plan') {
                        if (record.result?.success && record.result?.data) {
                            const planData = record.result.data;
                            setExecutionPlan({ title: planData.title, content: planData.content });
                            setIsExecutionPlanPaneOpen(true);
                            if (activeConversationId) {
                                localStorage.setItem(`everfern_execution_plan_${activeConversationId}`, JSON.stringify(planData));
                            }
                            if (isMessageCommittedRef.current || isHandlingPlanRef.current) return;
                            isMessageCommittedRef.current = true;
                            isHandlingPlanRef.current = true;
                            api.removeStreamListeners();
                            setLiveToolCalls(prevTools => {
                                const finalToolCalls = prevTools.map(t => t.status === 'running' ? { ...t, status: 'done' as const } : t);
                                const assistantMsg: Message = {
                                    id: crypto.randomUUID(),
                                    role: "assistant",
                                    content: streamingContentRef.current || "I have created an execution plan for your request.",
                                    thought: streamingThoughtRef.current,
                                    timestamp: new Date(),
                                    toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined
                                };
                                setMessages(prev => {
                                    const final = [...prev, assistantMsg];
                                    saveConversation(final);
                                    return final;
                                });
                                setStreamingContent("");
                                setStreamingThought("");
                                setIsLoading(false);
                                return [];
                            });
                        }
                    }
                    if (record.result?.success) {
                        if (record.toolName === 'read_file') { setContextItems(prev => { const exists = prev.some(i => i.label === record.result.data?.name || i.label === record.args.path); if (!exists) return [...prev, { id: crypto.randomUUID(), type: 'file', label: record.result.data?.name || record.args.path }]; return prev; }); }
                        else if (record.toolName === 'web_search') { setContextItems(prev => [...prev, { id: crypto.randomUUID(), type: 'web', label: record.args.query }]); }
                        else if (record.toolName === 'computer_use') { setContextItems(prev => { const action = record.args.action || 'computer_use'; const target = record.args.query ? ` "${record.args.query}"` : ''; return [...prev.filter(i => i.type !== 'app'), { id: crypto.randomUUID(), type: 'app', label: `Computer Use: ${action}${target}`, base64Image: record.result?.base64Image }]; }); }
                    }
                    const key = record.toolName + '_running';
                    const existingId = toolCallMap.current.get(key);
                    if (existingId) {
                        const updatedToolCalls = liveToolCallsRef.current.map(t => t.id === existingId ? { ...t, status: 'done' as const, output: typeof record.result === 'string' ? record.result : (record.result?.output || JSON.stringify({ ...record.result, base64Image: undefined }, null, 2)), data: record.result?.data, base64Image: record.result?.base64Image, durationMs: record.durationMs } : t);
                        toolCallMap.current.delete(key);
                        liveToolCallsRef.current = updatedToolCalls;
                        setLiveToolCalls(updatedToolCalls);
                    }
                });
                api.onThought(({ content }: { content: string }) => { streamingThoughtRef.current += content; setStreamingThought(streamingThoughtRef.current); });
                api.onUsage(({ promptTokens, completionTokens, totalTokens }: { promptTokens: number; completionTokens: number; totalTokens: number }) => {
                    hasReceivedUsageData.current = true;
                    setContextTokens({ used: totalTokens, max: 128000 });
                });
                api.onStreamChunk(({ delta, done }: { delta: string; done: boolean }) => {
                    if (isMessageCommittedRef.current) return;
                    if (!done) { streamingContentRef.current += delta; setStreamingContent(streamingContentRef.current); }
                    else {
                        api.removeStreamListeners();
                        isMessageCommittedRef.current = true;
                        const finalToolCalls = liveToolCallsRef.current.map(
                            t => t.status === 'running' ? { ...t, status: 'done' as const } : t
                        );

                        const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: streamingContentRef.current || "Done.", thought: streamingThoughtRef.current, timestamp: new Date(), toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined };
                        setMessages(prev => {
                            const final = [...prev, assistantMsg];
                            saveConversation(final);
                            return final;
                        });
                        setStreamingContent("");
                        setStreamingThought("");
                        setIsLoading(false);
                        setIsComputerUseActive(false);
                        if (voiceOutputEnabled && voiceProvider === "elevenlabs" && voiceElevenlabsKey) handlePlayVoiceResponse(assistantMsg.content);
                        if (activeConversationId) { checkForPlan(activeConversationId); checkForSites(activeConversationId); }
                        setLiveToolCalls([]);

                    }
                });
                await api.stream({
                    messages: newMessages.map(m => {
                        if (m.attachments && m.attachments.length > 0 && m.role === 'user') {
                            const blocks: any[] = [];
                            if (m.content) blocks.push({ type: 'text', text: m.content });
                            m.attachments.forEach(a => { if (a.mimeType.startsWith('image/') && a.base64) blocks.push({ type: 'image_url', image_url: { url: a.base64 } }); else blocks.push({ type: 'text', text: `[Attached File: ${a.name}]\n[Location: ${a.path || 'unknown'}]\n${a.content ? a.content : 'Content not loaded. Use your skills to read the file directly at the provided Location path.'}` }); });
                            return { role: m.role, content: blocks };
                        }
                        return { role: m.role, content: m.content };
                    }),
                    model: selectedModel,
                    providerType: currentM?.providerType || 'everfern',
                    conversationId: activeConversationId || crypto.randomUUID()
                });
            } catch (err) {
                if (isMessageCommittedRef.current) return;
                isMessageCommittedRef.current = true;
                const errorMessage = err instanceof Error ? err.message : String(err);
                api?.removeStreamListeners?.();
                const finalToolCalls = liveToolCallsRef.current.map(t => t.status === 'running' ? { ...t, status: 'error' as const } : t);
                const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: streamingContentRef.current ? streamingContentRef.current + `\n\n❌ ${errorMessage}` : `❌ ${errorMessage}`, thought: streamingThoughtRef.current, toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined, timestamp: new Date() };
                setMessages(prev => {
                    const final = [...prev, assistantMsg];
                    saveConversation(final);
                    return final;
                });
                setLiveToolCalls([]);
                setStreamingContent("");
                setStreamingThought("");
                setIsLoading(false);
                setIsComputerUseActive(false);
            }
        })();
    }, [inputValue, attachments, folderContexts, isLoading, messages, saveConversation, selectedModel, availableModels, activeConversationId, checkForPlan, checkForSites, handlePlayVoiceResponse, voiceOutputEnabled, voiceProvider, voiceElevenlabsKey]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }, [handleSend]);

    const handleNewChat = () => { setMessages([]); setInputValue(""); setAttachments([]); setActiveConversationId(null); setCurrentPlan(null); setContextItems([]); setExecutionPlan(null); setIsExecutionPlanPaneOpen(false); };

    const handleSelectConversation = async (id: string) => {
        try {
            if ((window as any).electronAPI?.history?.load) {
                const conv = await (window as any).electronAPI.history.load(id);
                if (conv?.messages) {
                    setActiveConversationId(id);
                    setMessages(conv.messages.map((m: any) => ({ id: m.id || crypto.randomUUID(), role: m.role, content: m.content, thought: m.thought, toolCalls: m.toolCalls, attachments: m.attachments || [], timestamp: new Date(conv.updatedAt) })));
                    setCurrentPlan(null);
                    setContextItems([]);
                    setExecutionPlan(null);
                    setIsExecutionPlanPaneOpen(false);
                    const savedPlan = localStorage.getItem(`everfern_execution_plan_${id}`);
                    if (savedPlan) {
                        try {
                            setExecutionPlan(JSON.parse(savedPlan));
                            const isClosed = localStorage.getItem(`everfern_exec_pane_closed_${id}`);
                            setIsExecutionPlanPaneOpen(!isClosed);
                        } catch (e) { }
                    }
                    checkForPlan(id);
                }
            }
        } catch (err) { console.error("Failed to load conversation:", err); }
    };

    const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0] || { id: "fern", name: "EverFern-1", provider: "EverFern", providerType: "everfern", logo: null };

    const handleSaveSettings = async () => {
        const updated: any = { ...config, engine: settingsEngine, provider: settingsEngine === "online" ? settingsProvider : settingsEngine, apiKey: settingsEngine === "online" ? settingsApiKey : undefined, customModel: settingsEngine === "online" && settingsProvider === "nvidia" ? settingsCustomModel : undefined, showuiUrl: settingsShowuiUrl || undefined };
        if (settingsEngine === "local") { updated.provider = "ollama"; updated.baseUrl = "http://localhost:11434"; }
        if (settingsVlmMode === "cloud" && settingsVlmCloudModel.trim()) { updated.vlm = { engine: "cloud", provider: settingsVlmCloudProvider, model: settingsVlmCloudModel.trim(), baseUrl: settingsVlmCloudUrl.trim() || undefined, apiKey: settingsVlmCloudKey.trim() || undefined }; }
        else if (config?.vlm) { updated.vlm = config.vlm; }
        if (voiceProvider && (voiceDeepgramKey.trim() || voiceElevenlabsKey.trim())) { updated.voice = { provider: voiceProvider, deepgramKey: voiceDeepgramKey.trim() || undefined, elevenlabsKey: voiceElevenlabsKey.trim() || undefined }; }
        setConfig(updated);
        if ((window as any).electronAPI?.saveConfig) await (window as any).electronAPI.saveConfig(updated);
        setShowSettings(false);
    };

    const checkOllamaStatus = async () => {
        if ((window as any).electronAPI?.system?.ollamaStatus) { const res = await (window as any).electronAPI.system.ollamaStatus(); setOllamaInstalled(res.installed); setModelInstalled(res.modelInstalled); }
    };

    const handleNextFromName = async () => { if (!onboardingName.trim()) return; await checkOllamaStatus(); setOnboardingStep("vlm"); };

    const finalizeOnboarding = async (useOllama: boolean = false) => {
        const name = onboardingName.trim() || "User";
        let updated: any = { ...config, userName: name };
        if (useOllama) { updated.vlm = { engine: "local", provider: "ollama", model: "qwen3-vl:2b", baseUrl: "http://localhost:11434" }; if (updated.engine === "local") updated.provider = "ollama"; }
        setConfig(updated);
        if ((window as any).electronAPI?.saveConfig) await (window as any).electronAPI.saveConfig(updated);
        if ((window as any).electronAPI?.memory?.saveDirect) await (window as any).electronAPI.memory.saveDirect(`The user's preferred name is ${name}. Always refer to them as ${name}.`, '[User Profile]');
        setShowOnboarding(false);
    };

    const handleInstallOllama = async () => {
        setIsInstallingOllama(true); setOllamaInstallDone(false); setOllamaInstallPct(0); setOllamaInstallPhase("downloading"); setOllamaLogs([]);
        if ((window as any).electronAPI?.system?.onOllamaInstallLine) {
            (window as any).electronAPI.system.onOllamaInstallLine((data: { line: string }) => {
                const pctMatch = data.line.match(/(\d+\.?\d*)%/);
                if (pctMatch) { const pct = parseFloat(pctMatch[1]); setOllamaInstallPct(pct); setOllamaInstallPhase(pct >= 100 ? "finalizing" : "downloading"); }
                setOllamaLogs(prev => [...prev.slice(-40), data.line]);
            });
        }
        if ((window as any).electronAPI?.system?.ollamaInstall) {
            const res = await (window as any).electronAPI.system.ollamaInstall();
            if (res.success) { setOllamaInstalled(true); setOllamaInstallPct(100); setOllamaInstallPhase("done"); setOllamaInstallDone(true); setOllamaLogs(["✔ Ollama installed successfully!"]); }
            else { setOllamaLogs(prev => [...prev, `✘ Installation failed with code ${res.code}`]); }
        }
        setIsInstallingOllama(false);
    };

    const handlePullModel = async () => {
        setIsPullingModel(true); setPullPct(0); setOllamaLogs([]);
        if ((window as any).electronAPI?.system?.onOllamaInstallLine) {
            (window as any).electronAPI.system.onOllamaInstallLine((data: { line: string }) => {
                const cleanLine = stripAnsi(data.line);
                const pctMatch = cleanLine.match(/(\d+\.?\d*)%/);
                if (pctMatch && (cleanLine.includes("pulling") || cleanLine.includes("verifying"))) setPullPct(parseFloat(pctMatch[1]));
                setOllamaLogs(prev => { const last = prev[prev.length - 1] || ""; if (cleanLine.includes("pulling") && last.includes("pulling")) { const newLogs = [...prev]; newLogs[newLogs.length - 1] = cleanLine; return newLogs; } return [...prev.slice(-30), cleanLine]; });
            });
        }
        if ((window as any).electronAPI?.system?.ollamaPull) {
            const res = await (window as any).electronAPI.system.ollamaPull("qwen3-vl:2b");
            if (res.success) { setPullPct(100); await finalizeOnboarding(true); }
            else { setOllamaLogs(prev => [...prev, `✘ Model pull failed with code ${res.code}`]); }
        }
        setIsPullingModel(false);
    };

    const renderComposerLeftActions = () => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setShowAddMenu(!showAddMenu)} title="Attach menu"
                    style={{ background: "transparent", border: "none", color: "#717171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = "#111111"}
                    onMouseLeave={e => e.currentTarget.style.color = "#717171"}
                >
                    <PlusIcon width={22} height={22} style={{ transform: showAddMenu ? 'rotate(45deg)' : 'none', transition: '0.2s' }} />
                </button>
                <AnimatePresence>
                    {showAddMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #e8e6d9", padding: 6, display: "flex", flexDirection: "column", gap: 2, minWidth: 180, zIndex: 50, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
                            <button type="button" onClick={() => { setShowAddMenu(false); handleAttachment('image'); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "none", backgroundColor: "transparent", color: "#111111", cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" ry="3"></rect><path d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path><path d="M21 15l-5-5L5 21"></path></svg>
                                Upload Image
                            </button>
                            <button type="button" onClick={() => { setShowAddMenu(false); handleAttachment('document'); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 8, border: "none", backgroundColor: "transparent", color: "#111111", cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)"} onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Upload Document
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <button type="button"
                onClick={folderContexts.length > 0 && folderHover ? () => setFolderContexts([]) : handleAddContextFolder}
                title={folderContexts.length > 0 && folderHover ? "Remove context" : "Add context folder"}
                style={{ display: "flex", alignItems: "center", gap: 6, background: folderHover && folderContexts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "transparent", border: folderHover && folderContexts.length > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #e8e6d9", borderRadius: 14, color: folderHover && folderContexts.length > 0 ? "#ef4444" : "#201e24", cursor: "pointer", padding: "6px 14px", fontSize: 13, fontWeight: 500, transition: "0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = folderContexts.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(0,0,0,0.04)"; e.currentTarget.style.color = folderContexts.length > 0 ? "#ef4444" : "#111111"; if (folderContexts.length > 0) e.currentTarget.style.border = "1px solid rgba(239, 68, 68, 0.3)"; setFolderHover(true); }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#201e24"; e.currentTarget.style.border = "1px solid #e8e6d9"; setFolderHover(false); }}
            >
                {folderHover && folderContexts.length > 0 ? <XMarkIcon width={15} height={15} /> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>}
                {folderContexts.length > 0 ? folderContexts[folderContexts.length - 1].name : "Add context"}
            </button>
        </div>
    );

    const renderComposerRightActions = (showVolumeToggle = false) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: 'relative', width: 32, height: 32, cursor: 'default' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3" />
                    <circle cx="16" cy="16" r="12" fill="none" stroke={contextTokens.used / contextTokens.max > 0.85 ? '#ef4444' : '#22c55e'} strokeWidth="3" strokeDasharray={`${2 * Math.PI * 12 * Math.min(contextTokens.used / contextTokens.max, 1)} 1000`} strokeLinecap="round" />
                </svg>
            </div>

            {showVolumeToggle && voiceProvider && voiceElevenlabsKey && (
                <button type="button" onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)} title={voiceOutputEnabled ? "Sound on" : "Sound off"}
                    style={{ width: 32, height: 32, borderRadius: 10, background: voicePlayback ? "rgba(59, 130, 246, 0.15)" : voiceOutputEnabled ? "transparent" : "rgba(0,0,0,0.05)", border: voiceOutputEnabled ? "1px solid #a1a1aa" : "1px solid #e8e6d9", color: voicePlayback ? "#3b82f6" : voiceOutputEnabled ? "#717171" : "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = voiceOutputEnabled ? "rgba(16, 185, 129, 0.1)" : "rgba(0,0,0,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = voicePlayback ? "rgba(59, 130, 246, 0.15)" : voiceOutputEnabled ? "transparent" : "rgba(0,0,0,0.05)"; }}
                >
                    {voicePlayback ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, animation: "pulse 1s infinite" }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path></svg>
                    ) : voiceOutputEnabled ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 3.54a9 9 0 0 1 0 12.72M19.07 4.93a16 16 0 0 1 0 14.14"></path></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                    )}
                </button>
            )}

            <VoiceButton
                isRecording={isRecording}
                voiceProvider={voiceProvider}
                voiceDeepgramKey={voiceDeepgramKey}
                voiceElevenlabsKey={voiceElevenlabsKey}
                onClick={() => setShowVoiceAssistant(true)}
            />

            <div ref={modelSelectorRef} style={{ position: "relative" }}>
                <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0, 0, 0, 0.04)", border: "1px solid #e8e6d9", color: "#201e24", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "0 12px", borderRadius: 8, height: 36, transition: "all 0.15s" }}
                >
                    {currentModel.logo && <currentModel.logo size={14} />}
                    {currentModel.name}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
            </div>

            {isLoading ? (
                <button onClick={() => { (window as any).electronAPI?.acp?.stop?.(); setIsLoading(false); }}
                    style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(239, 68, 68, 0.15)", border: "none", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <StopIcon width={16} height={16} />
                </button>
            ) : (
                <button type="button" onClick={handleSend} disabled={!inputValue.trim() && attachments.length === 0 && folderContexts.length === 0} title="Send"
                    style={{ width: 32, height: 32, borderRadius: 10, background: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "#201e24" : "#f4f4f4", border: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "none" : "1px solid #e8e6d9", color: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "#ffffff" : "#a1a1aa", cursor: (inputValue.trim() || attachments.length > 0 || folderContexts.length > 0) ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}
        </div>
    );

    const renderAttachmentStrip = () => (
        <>
            {attachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 0" }}>
                    {attachments.map(a => (
                        <div key={a.id} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", backgroundColor: "#f5f4f0", borderRadius: 8, border: "1px solid #e8e6d9" }}>
                            {a.mimeType.startsWith("image/") && a.base64 ? (
                                <div style={{ width: 40, height: 40, borderRadius: 6, backgroundImage: `url(${a.base64})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: "rgba(0, 0, 0, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <PaperClipIcon width={20} height={20} color="#717171" />
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, paddingRight: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#111111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{a.name}</span>
                                <span style={{ fontSize: 11, color: "#8a8886" }}>{(a.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button onClick={() => setAttachments(prev => prev.filter(att => att.id !== a.id))}
                                style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#ffffff", border: "1px solid #dcdad0", display: "flex", alignItems: "center", justifyContent: "center", color: "#111111", cursor: "pointer", zIndex: 10 }}>
                                <XMarkIcon width={12} height={12} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );

    return (
        <>
            <div style={{ height: "100vh", backgroundColor: "#f5f4f0", color: "#201e24", fontFamily: "var(--font-sans)", display: "flex", overflow: "hidden" }}>
                <PermissionDialog
                    isOpen={showPermissionModal}
                    onClose={() => setShowPermissionModal(false)}
                />
                <ArtifactsPanel isOpen={showArtifacts} onClose={() => { setShowArtifacts(false); setSelectedArtifactName(null); }} activeChatId={activeConversationId} selectedFileName={selectedArtifactName} />
                <PlanViewerPanel isOpen={showPlanViewer} onClose={() => setShowPlanViewer(false)} content={planViewerContent} onApprove={handleApprovePlan} />
                {reportPane && (
                    <ReportPane isOpen={!!reportPane} onClose={() => setReportPane(null)} label={reportPane.label} path={reportPane.path} />
                )}
                <VoiceAssistantUI
                    isOpen={showVoiceAssistant}
                    onClose={() => setShowVoiceAssistant(false)}
                    isRecording={isRecording}
                    voiceLoading={voiceLoading}
                    voiceTranscript={voiceTranscript}
                    voicePlayback={voicePlayback}
                    onRecordToggle={async () => {
                        if (!isRecording) {
                            setVoiceLoading(true);
                            setVoiceTranscript("");
                            try {
                                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                                const mediaRecorder = new MediaRecorder(stream);
                                const audioChunks: BlobPart[] = [];
                                mediaRecorderRef.current = mediaRecorder;
                                audioStreamRef.current = stream;
                                mediaRecorder.ondataavailable = (event) => { audioChunks.push(event.data); };
                                mediaRecorder.onstop = async () => {
                                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                                    const arrayBuffer = await audioBlob.arrayBuffer();
                                    if (voiceProvider === "deepgram" && voiceDeepgramKey) {
                                        try {
                                            const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en', { method: 'POST', headers: { 'Authorization': `Token ${voiceDeepgramKey}`, 'Content-Type': 'audio/webm' }, body: arrayBuffer });
                                            if (response.ok) { const result = await response.json(); const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''; setVoiceTranscript(transcript); setInputValue(transcript); }
                                            else { setVoiceTranscript("Failed to transcribe audio"); }
                                        } catch (error) { setVoiceTranscript("Error transcribing audio"); }
                                    }
                                    stream.getTracks().forEach(track => track.stop());
                                    setVoiceLoading(false);
                                    mediaRecorderRef.current = null;
                                    audioStreamRef.current = null;
                                };
                                mediaRecorder.start();
                                setIsRecording(true);
                                voiceTimeoutRef.current = setTimeout(() => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); setIsRecording(false); } }, 30000);
                            } catch (error) { setVoiceLoading(false); }
                        } else {
                            setIsRecording(false);
                            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
                            if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
                            if (voiceTimeoutRef.current) { clearTimeout(voiceTimeoutRef.current); voiceTimeoutRef.current = null; }
                        }
                    }}
                    onOutputToggle={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                    voiceOutputEnabled={voiceOutputEnabled}
                    voiceProvider={voiceProvider}
                    voiceDeepgramKey={voiceDeepgramKey}
                    voiceElevenlabsKey={voiceElevenlabsKey}
                />
                <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeConversationId={activeConversationId} onSelectConversation={handleSelectConversation} onNewChat={handleNewChat} onSettingsClick={() => setShowSettings(true)} onArtifactsClick={() => setShowArtifacts(true)} onCustomizeClick={() => setShowDirectoryModal(true)} />

                <motion.div
                    initial={false}
                    animate={{ marginLeft: sidebarOpen ? 260 : 68 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", backgroundColor: "#f5f4f0", position: "relative" }}
                >
                    <header style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", WebkitAppRegion: "drag" } as any}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, WebkitAppRegion: "no-drag" } as any}>
                            {executionPlan && !isExecutionPlanPaneOpen && (
                                <button onClick={() => { setIsExecutionPlanPaneOpen(true); }} style={{ fontSize: 12, fontWeight: 600, color: "#201e24", backgroundColor: "rgba(0,0,0,0.04)", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    View Plan
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, WebkitAppRegion: "no-drag" } as any}>
                            <WindowControls />
                        </div>
                    </header>

                    <div style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "row", backgroundColor: "#ffffff", margin: "0 12px 12px 0", borderRadius: 28, border: "1px solid #e8e6d9", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", overflow: "hidden" }}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 32px" }}>
                                <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 32px" }}>
                                    {isEmpty && (
                                        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", duration: 0.7 }}
                                            style={{ marginTop: "14vh", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 36, fontWeight: 400, margin: 0, color: "#201e24", letterSpacing: "-0.01em" }}>{randomGreeting}</h1>
                                            <div style={{ width: "100%", maxWidth: 740, marginTop: 28 }}>
                                                <div style={{ backgroundColor: "#f4f4f4", border: "1px solid #e8e6d9", borderRadius: 16, display: "flex", flexDirection: "column", minHeight: 120 }}>
                                                    {renderAttachmentStrip()}
                                                    <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="How can I help you today?" rows={1}
                                                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 16, color: "#111111", lineHeight: 1.5, padding: "20px 24px", minHeight: 70, maxHeight: 240 }} />
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 24px 16px" }}>
                                                        {renderComposerLeftActions()}
                                                        {renderComposerRightActions(false)}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <AnimatePresence mode="popLayout">
                                        {messages.map((msg, idx) => (
                                            <motion.div key={msg.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} layout style={{ marginBottom: 28, display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: "#8a8886", marginBottom: 6 }}>{msg.role === "user" ? "You" : "Fern"}</div>
                                                <div style={{ maxWidth: msg.role === "user" ? "80%" : "100%", padding: msg.role === "user" ? "12px 18px" : "0", borderRadius: msg.role === "user" ? 16 : 0, background: msg.role === "user" ? "#f5f4f0" : "transparent", border: msg.role === "user" ? "1px solid #e8e6d9" : "none", fontSize: 15, lineHeight: 1.7 }}>
                                                    {msg.role === "user" ? (
                                                        <span style={{ color: "#111111", whiteSpace: "pre-wrap" }}>{msg.content}</span>
                                                    ) : (
                                                        <>
                                                            <ToolTimeline toolCalls={msg.toolCalls || []} thought={msg.thought} isLive={false} />
                                                            <StreamingMarkdown content={msg.content} isLive={false} isLatest={idx === messages.length - 1} />
                                                            <RateLimitContinueButton content={msg.content} onContinue={() => handleSend("continue")} />
                                                        </>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>
                            {!isEmpty && (
                                <div style={{ padding: "0 24px 12px", width: "100%", maxWidth: 848, margin: "0 auto" }}>
                                    <div style={{ width: "100%", backgroundColor: "#ffffff", border: "1px solid #e8e6d9", borderRadius: 16, display: "flex", flexDirection: "column" }}>
                                        {renderAttachmentStrip()}
                                        <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder="How can I help you today?" rows={1}
                                            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 16, color: "#111111", lineHeight: 1.5, padding: "16px 20px", minHeight: 50, maxHeight: 240 }} />
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "10px 24px 16px" }}>
                                            {renderComposerLeftActions()}
                                            {renderComposerRightActions(true)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                <JsonViewerModal
                    isOpen={isJsonViewerOpen}
                    onClose={() => setIsJsonViewerOpen(false)}
                    lastEventJson={lastEventJson}
                    lastEventType={lastEventType}
                />

                {showSettings && (
                    <SettingsPage
                        onClose={() => setShowSettings(false)}
                        config={config}
                        username={onboardingName || config?.name || 'User'}
                        settingsEngine={settingsEngine}
                        setSettingsEngine={setSettingsEngine}
                        settingsProvider={settingsProvider}
                        setSettingsProvider={setSettingsProvider}
                        settingsApiKey={settingsApiKey}
                        setSettingsApiKey={setSettingsApiKey}
                        settingsCustomModel={settingsCustomModel}
                        setSettingsCustomModel={setSettingsCustomModel}
                        settingsShowuiUrl={settingsShowuiUrl}
                        setSettingsShowuiUrl={setSettingsShowuiUrl}
                        settingsVlmMode={settingsVlmMode}
                        setSettingsVlmMode={setSettingsVlmMode}
                        settingsVlmCloudProvider={settingsVlmCloudProvider}
                        setSettingsVlmCloudProvider={setSettingsVlmCloudProvider}
                        settingsVlmCloudModel={settingsVlmCloudModel}
                        setSettingsVlmCloudModel={setSettingsVlmCloudModel}
                        settingsVlmCloudUrl={settingsVlmCloudUrl}
                        setSettingsVlmCloudUrl={setSettingsVlmCloudUrl}
                        settingsVlmCloudKey={settingsVlmCloudKey}
                        setSettingsVlmCloudKey={setSettingsVlmCloudKey}
                        voiceProvider={voiceProvider}
                        setVoiceProvider={setVoiceProvider}
                        voiceDeepgramKey={voiceDeepgramKey}
                        setVoiceDeepgramKey={setVoiceDeepgramKey}
                        voiceElevenlabsKey={voiceElevenlabsKey}
                        setVoiceElevenlabsKey={setVoiceElevenlabsKey}
                        modelValidationStatus={"none"}
                        setModelValidationStatus={() => { }}
                        isValidatingModel={false}
                        setIsValidatingModel={() => { }}
                        ollamaInstalled={ollamaInstalled}
                        modelInstalled={modelInstalled}
                        handleSaveSettings={handleSaveSettings}
                        onOpenVlmOnboarding={() => { setShowSettings(false); checkOllamaStatus(); setOnboardingStep('vlm'); setShowOnboarding(true); }}
                    />
                )}
                <DirectoryModal isOpen={showDirectoryModal} onClose={() => setShowDirectoryModal(false)} />
                {settingsMotionBlur && (
                    <motion.div animate={{ x: mousePos.x - 150, y: mousePos.y - 150 }} transition={{ type: "spring", damping: 30, stiffness: 200, mass: 0.5 }}
                        style={{ position: 'fixed', top: 0, left: 0, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 70%)', pointerEvents: 'none', zIndex: 0, filter: 'blur(40px)' }} />
                )}
            </div>
        </>
    );
}

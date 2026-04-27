"use strict";
/**
 * Context Manager for AI Coding Assistant
 *
 * Manages the context and state of the coding session, including file changes,
 * user interactions, project understanding, and conversation history.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextManager = void 0;
exports.getContextManager = getContextManager;
exports.resetContextManager = resetContextManager;
class ContextManager {
    sessions = new Map();
    currentSessionId = null;
    contextHistory = [];
    maxHistorySize = 50;
    /**
     * Start a new coding session
     */
    startSession(projectPath, userPreferences) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
            id: sessionId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            projectPath,
            conversationHistory: [],
            fileChanges: [],
            activeFiles: [],
            userPreferences: {
                codingStyle: 'mixed',
                preferredFrameworks: [],
                testingApproach: 'unit-first',
                codeVerbosity: 'moderate',
                securityLevel: 'standard',
                performancePriority: 'balanced',
                documentationLevel: 'standard',
                ...userPreferences
            }
        };
        this.sessions.set(sessionId, session);
        this.currentSessionId = sessionId;
        this.addSystemMessage(`Started new coding session for project: ${projectPath}`);
        return sessionId;
    }
    /**
     * Get current active session
     */
    getCurrentSession() {
        if (!this.currentSessionId)
            return null;
        return this.sessions.get(this.currentSessionId) || null;
    }
    /**
     * Update codebase analysis for current session
     */
    updateCodebaseAnalysis(analysis) {
        const session = this.getCurrentSession();
        if (session) {
            session.codebaseAnalysis = analysis;
            session.lastActivity = Date.now();
            this.createContextSnapshot();
        }
    }
    /**
     * Add conversation entry
     */
    addConversationEntry(type, content, metadata) {
        const session = this.getCurrentSession();
        if (!session)
            throw new Error('No active session');
        const entryId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const entry = {
            id: entryId,
            timestamp: Date.now(),
            type,
            content,
            metadata
        };
        session.conversationHistory.push(entry);
        session.lastActivity = Date.now();
        // Keep conversation history manageable
        if (session.conversationHistory.length > 100) {
            session.conversationHistory = session.conversationHistory.slice(-80);
        }
        return entryId;
    }
    /**
     * Add system message
     */
    addSystemMessage(content) {
        this.addConversationEntry('system', content);
    }
    /**
     * Record file change
     */
    recordFileChange(file, type, reason, before, after, relatedConversation) {
        const session = this.getCurrentSession();
        if (!session)
            throw new Error('No active session');
        const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const change = {
            id: changeId,
            timestamp: Date.now(),
            file,
            type,
            before,
            after,
            reason,
            relatedConversation
        };
        session.fileChanges.push(change);
        session.lastActivity = Date.now();
        // Update active files
        if (type === 'create' || type === 'modify') {
            if (!session.activeFiles.includes(file)) {
                session.activeFiles.push(file);
            }
        }
        else if (type === 'delete') {
            session.activeFiles = session.activeFiles.filter(f => f !== file);
        }
        // Keep file changes history manageable
        if (session.fileChanges.length > 200) {
            session.fileChanges = session.fileChanges.slice(-150);
        }
        return changeId;
    }
    /**
     * Start a new task
     */
    startTask(description, type, estimatedEffort, relatedFiles = []) {
        const session = this.getCurrentSession();
        if (!session)
            throw new Error('No active session');
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = {
            id: taskId,
            description,
            type,
            status: 'planning',
            startTime: Date.now(),
            estimatedEffort,
            relatedFiles,
            subtasks: [],
            progress: 0
        };
        session.currentTask = task;
        session.lastActivity = Date.now();
        this.addSystemMessage(`Started new task: ${description} (${type}, ${estimatedEffort} effort)`);
        return taskId;
    }
    /**
     * Update task progress
     */
    updateTaskProgress(progress, status) {
        const session = this.getCurrentSession();
        if (!session || !session.currentTask)
            return;
        session.currentTask.progress = Math.max(0, Math.min(100, progress));
        if (status) {
            session.currentTask.status = status;
        }
        session.lastActivity = Date.now();
        if (status === 'completed') {
            this.addSystemMessage(`Task completed: ${session.currentTask.description}`);
            this.createContextSnapshot();
        }
    }
    /**
     * Add subtask to current task
     */
    addSubTask(description, file, estimatedTime) {
        const session = this.getCurrentSession();
        if (!session || !session.currentTask)
            throw new Error('No active task');
        const subtaskId = `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const subtask = {
            id: subtaskId,
            description,
            status: 'pending',
            file,
            estimatedTime
        };
        session.currentTask.subtasks.push(subtask);
        session.lastActivity = Date.now();
        return subtaskId;
    }
    /**
     * Update subtask status
     */
    updateSubTaskStatus(subtaskId, status) {
        const session = this.getCurrentSession();
        if (!session || !session.currentTask)
            return;
        const subtask = session.currentTask.subtasks.find(st => st.id === subtaskId);
        if (subtask) {
            subtask.status = status;
            session.lastActivity = Date.now();
            // Update overall task progress based on completed subtasks
            const completedSubtasks = session.currentTask.subtasks.filter(st => st.status === 'completed').length;
            const totalSubtasks = session.currentTask.subtasks.length;
            if (totalSubtasks > 0) {
                const progress = Math.round((completedSubtasks / totalSubtasks) * 100);
                this.updateTaskProgress(progress);
            }
        }
    }
    /**
     * Get context for AI assistant
     */
    getContextForAssistant() {
        const session = this.getCurrentSession();
        if (!session) {
            return {
                session: null,
                recentConversation: [],
                recentChanges: [],
                projectSummary: 'No active session'
            };
        }
        const recentConversation = session.conversationHistory.slice(-10);
        const recentChanges = session.fileChanges.slice(-20);
        const projectSummary = this.generateProjectSummary(session);
        return {
            session,
            recentConversation,
            recentChanges,
            currentTask: session.currentTask,
            projectSummary
        };
    }
    /**
     * Generate project summary
     */
    generateProjectSummary(session) {
        const analysis = session.codebaseAnalysis;
        if (!analysis)
            return 'Project analysis pending...';
        const summary = [
            `Project: ${analysis.projectType} using ${analysis.framework.primary}`,
            `Language: ${analysis.language.primary}`,
            `Architecture: ${analysis.architecture.pattern}`,
            `Complexity: ${analysis.complexity}`,
            `Active files: ${session.activeFiles.length}`,
            `Recent changes: ${session.fileChanges.length}`,
            `Conversation entries: ${session.conversationHistory.length}`
        ];
        if (session.currentTask) {
            summary.push(`Current task: ${session.currentTask.description} (${session.currentTask.progress}% complete)`);
        }
        return summary.join(' | ');
    }
    /**
     * Create context snapshot for history
     */
    createContextSnapshot() {
        const session = this.getCurrentSession();
        if (!session)
            return;
        const snapshot = {
            timestamp: Date.now(),
            activeFiles: [...session.activeFiles],
            currentTask: session.currentTask ? { ...session.currentTask } : undefined,
            recentChanges: session.fileChanges.slice(-10),
            conversationSummary: this.generateConversationSummary(session.conversationHistory.slice(-5)),
            codebaseState: {
                totalFiles: session.activeFiles.length,
                linesOfCode: 0, // Would be calculated from actual files
                complexity: session.codebaseAnalysis?.complexity || 'simple'
            }
        };
        this.contextHistory.push(snapshot);
        // Keep history manageable
        if (this.contextHistory.length > this.maxHistorySize) {
            this.contextHistory = this.contextHistory.slice(-this.maxHistorySize + 10);
        }
    }
    /**
     * Generate conversation summary
     */
    generateConversationSummary(entries) {
        if (entries.length === 0)
            return 'No recent conversation';
        const userMessages = entries.filter(e => e.type === 'user').length;
        const assistantMessages = entries.filter(e => e.type === 'assistant').length;
        const lastEntry = entries[entries.length - 1];
        return `${userMessages} user messages, ${assistantMessages} assistant responses. Last: ${lastEntry.content.substring(0, 100)}...`;
    }
    /**
     * Get session statistics
     */
    getSessionStats() {
        const session = this.getCurrentSession();
        if (!session) {
            return {
                duration: 0,
                filesModified: 0,
                conversationLength: 0,
                tasksCompleted: 0,
                productivity: 'low'
            };
        }
        const duration = Date.now() - session.startTime;
        const filesModified = new Set(session.fileChanges.map(c => c.file)).size;
        const conversationLength = session.conversationHistory.length;
        const tasksCompleted = session.currentTask?.status === 'completed' ? 1 : 0;
        // Simple productivity calculation
        const productivity = filesModified > 5 && conversationLength > 10 ? 'high' :
            filesModified > 2 && conversationLength > 5 ? 'medium' : 'low';
        return {
            duration,
            filesModified,
            conversationLength,
            tasksCompleted,
            productivity
        };
    }
    /**
     * End current session
     */
    endSession() {
        const session = this.getCurrentSession();
        if (session) {
            this.addSystemMessage('Session ended');
            this.createContextSnapshot();
            this.currentSessionId = null;
        }
    }
    /**
     * Clear session data (for testing or reset)
     */
    clearSessions() {
        this.sessions.clear();
        this.currentSessionId = null;
        this.contextHistory = [];
    }
}
exports.ContextManager = ContextManager;
/**
 * Singleton instance for global access
 */
let contextManagerInstance = null;
function getContextManager() {
    if (!contextManagerInstance) {
        contextManagerInstance = new ContextManager();
    }
    return contextManagerInstance;
}
function resetContextManager() {
    contextManagerInstance = null;
}

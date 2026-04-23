"use strict";
/**
 * EverFern Desktop — Interaction Analyzer
 *
 * Evaluates interactions for learning value and success indicators.
 * Filters out failed interactions, error states, and incomplete tasks.
 * Extracts relevant context and metadata from successful interactions.
 * Identifies different types of learning opportunities.
 * Sanitizes data to remove PII and session-specific information.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.interactionAnalyzer = exports.InteractionAnalyzer = void 0;
const logger_1 = require("./logger");
const error_handler_1 = require("./error-handler");
class InteractionAnalyzer {
    logger = (0, logger_1.getLearningLogger)();
    piiPatterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card pattern
        /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
        /[C-F]:\\[^\s\\]+/gi, // Windows file paths
        /\/[^\s]+/g, // Unix file paths
    ];
    sessionDataPatterns = [
        /session[_-]?id[:\s]*[a-zA-Z0-9-]+/gi,
        /temp[_-]?file[:\s]*[^\s]+/gi,
        /\.tmp\b/gi,
        /\/tmp\//gi,
        /temp\//gi,
    ];
    completionIndicators = [
        'task completed',
        'successfully finished',
        'done',
        'completed successfully',
        'task finished',
        'execution complete',
        'finished processing',
        'operation completed',
    ];
    /**
     * Helper function to extract text content from ChatMessage content
     */
    extractTextFromContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join(' ');
        }
        return '';
    }
    async analyzeInteraction(context) {
        this.logger.logAnalysisStart(context);
        try {
            // First, check if this is a successful interaction worth analyzing
            const isSuccessful = this.isSuccessfulInteraction(context);
            if (!isSuccessful) {
                return this.createEmptyAnalysis(context, 'Interaction not successful');
            }
            // Sanitize the interaction data
            const sanitizedContext = this.sanitizeInteractionData(context);
            // Extract success indicators
            const successIndicators = this.extractSuccessIndicators(sanitizedContext);
            // Extract patterns from the interaction
            const extractedPatterns = await this.extractPatterns(sanitizedContext);
            // Identify learning opportunities
            const learningOpportunities = await this.extractLearningOpportunities(sanitizedContext);
            // Track what was filtered out
            const filteredContent = this.getFilteredContent(context, sanitizedContext);
            const analysis = {
                interactionId: context.interactionId,
                analysisTimestamp: new Date(),
                successIndicators,
                extractedPatterns,
                learningOpportunities,
                filteredContent,
            };
            this.logger.logAnalysisComplete(context, analysis);
            return analysis;
        }
        catch (error) {
            const learningError = {
                type: 'analysis',
                code: 'ANALYSIS_FAILED',
                message: error.message,
                context: { interactionId: context.interactionId },
                timestamp: new Date(),
                recoverable: true
            };
            await error_handler_1.learningErrorHandler.handleAnalysisError(learningError, context);
            return this.createEmptyAnalysis(context, `Analysis failed: ${error.message}`);
        }
    }
    isSuccessfulInteraction(context) {
        // Check basic success indicators
        if (!context.success) {
            return false;
        }
        // Check outcome type
        if (context.outcome.type === 'failure' || context.outcome.type === 'error') {
            return false;
        }
        // Check if interaction had meaningful duration (at least 1 second)
        const duration = context.endTime - context.startTime;
        if (duration < 1000) {
            return false;
        }
        // Check if any tools were used successfully
        const successfulTools = context.tools.filter(tool => tool.result && tool.result.success && !tool.error);
        if (context.tools.length > 0 && successfulTools.length === 0) {
            return false;
        }
        // Check for meaningful output (at least one assistant message)
        const assistantMessages = context.messages.filter(msg => msg.role === 'assistant');
        if (assistantMessages.length === 0) {
            return false;
        }
        // Check for error patterns in messages
        const hasErrors = context.messages.some(msg => {
            const contentText = this.extractTextFromContent(msg.content);
            return contentText && (contentText.toLowerCase().includes('error') ||
                contentText.toLowerCase().includes('failed') ||
                contentText.toLowerCase().includes('exception'));
        });
        if (hasErrors) {
            return false;
        }
        return true;
    }
    async extractLearningOpportunities(context) {
        const opportunities = [];
        // User preference opportunities
        const userPreferenceOpportunities = this.identifyUserPreferenceOpportunities(context);
        opportunities.push(...userPreferenceOpportunities);
        // Tool pattern opportunities
        const toolPatternOpportunities = this.identifyToolPatternOpportunities(context);
        opportunities.push(...toolPatternOpportunities);
        // Problem-solving opportunities
        const problemSolvingOpportunities = this.identifyProblemSolvingOpportunities(context);
        opportunities.push(...problemSolvingOpportunities);
        // Workflow optimization opportunities
        const workflowOpportunities = this.identifyWorkflowOpportunities(context);
        opportunities.push(...workflowOpportunities);
        return opportunities;
    }
    sanitizeInteractionData(context) {
        const sanitized = {
            ...context,
            messages: context.messages.map(msg => ({
                ...msg,
                content: this.sanitizeContent(msg.content),
            })),
            tools: context.tools.map(tool => ({
                ...tool,
                args: this.sanitizeObject(tool.args),
                result: tool.result ? {
                    ...tool.result,
                    data: this.sanitizeObject(tool.result.data),
                } : tool.result,
            })),
        };
        return sanitized;
    }
    sanitizeContent(content) {
        if (typeof content === 'string') {
            return this.sanitizeText(content);
        }
        if (Array.isArray(content)) {
            return content.map(item => {
                if (item.type === 'text') {
                    return {
                        ...item,
                        text: this.sanitizeText(item.text)
                    };
                }
                return item;
            });
        }
        return content;
    }
    extractSuccessIndicators(context) {
        const duration = context.endTime - context.startTime;
        const hasTools = context.tools.length > 0;
        const successfulTools = context.tools.filter(tool => tool.result?.success).length;
        const assistantMessages = context.messages.filter(msg => msg.role === 'assistant');
        return {
            taskCompleted: context.outcome.type === 'success',
            userSatisfied: !context.messages.some(msg => {
                const contentText = this.extractTextFromContent(msg.content);
                return contentText && (contentText.toLowerCase().includes('not what i wanted') ||
                    contentText.toLowerCase().includes('try again') ||
                    contentText.toLowerCase().includes('that\'s wrong'));
            }),
            noErrors: !context.tools.some(tool => tool.error) &&
                context.outcome.type !== 'error',
            meaningfulOutput: assistantMessages.length > 0 &&
                assistantMessages.some(msg => {
                    const contentText = this.extractTextFromContent(msg.content);
                    return contentText.length > 50;
                }),
        };
    }
    async extractPatterns(context) {
        return {
            userPreferences: this.extractUserPreferences(context),
            toolUsagePatterns: this.extractToolUsagePatterns(context),
            problemSolvingApproaches: this.extractProblemSolvingPatterns(context),
            workflowOptimizations: this.extractWorkflowPatterns(context),
        };
    }
    extractUserPreferences(context) {
        const preferences = [];
        // Analyze user messages for preference indicators
        const userMessages = context.messages.filter(msg => msg.role === 'user');
        for (const message of userMessages) {
            const content = this.extractTextFromContent(message.content).toLowerCase();
            // Formatting preferences
            if (content.includes('format') || content.includes('style')) {
                preferences.push({
                    category: 'formatting',
                    description: 'User has specific formatting preferences',
                    confidence: 0.7,
                    evidence: [content.substring(0, 100)],
                    applicableContexts: ['text_formatting', 'code_formatting'],
                });
            }
            // Output preferences
            if (content.includes('verbose') || content.includes('detailed') || content.includes('brief')) {
                const isVerbose = content.includes('verbose') || content.includes('detailed');
                preferences.push({
                    category: 'output',
                    description: isVerbose ? 'User prefers detailed output' : 'User prefers brief output',
                    confidence: 0.8,
                    evidence: [content.substring(0, 100)],
                    applicableContexts: ['response_generation'],
                });
            }
            // Technology preferences
            if (content.includes('typescript') || content.includes('javascript') || content.includes('python')) {
                const tech = content.match(/(typescript|javascript|python|react|vue|angular)/gi)?.[0];
                if (tech) {
                    preferences.push({
                        category: 'technology',
                        description: `User prefers ${tech}`,
                        confidence: 0.9,
                        evidence: [content.substring(0, 100)],
                        applicableContexts: ['code_generation', 'technology_selection'],
                    });
                }
            }
        }
        return preferences;
    }
    extractToolUsagePatterns(context) {
        const patterns = [];
        if (context.tools.length < 2) {
            return patterns;
        }
        // Analyze tool sequences
        const toolSequence = context.tools.map(tool => tool.name);
        const uniqueTools = Array.from(new Set(toolSequence));
        // Check for common tool combinations
        if (toolSequence.includes('readFile') && toolSequence.includes('strReplace')) {
            patterns.push({
                toolCombination: ['readFile', 'strReplace'],
                sequence: true,
                parallel: false,
                effectiveness: this.calculateToolEffectiveness(context.tools, ['readFile', 'strReplace']),
                context: 'file_editing',
                frequency: 1,
            });
        }
        if (toolSequence.includes('fsWrite') && toolSequence.includes('executePwsh')) {
            patterns.push({
                toolCombination: ['fsWrite', 'executePwsh'],
                sequence: true,
                parallel: false,
                effectiveness: this.calculateToolEffectiveness(context.tools, ['fsWrite', 'executePwsh']),
                context: 'file_creation_and_execution',
                frequency: 1,
            });
        }
        return patterns;
    }
    extractProblemSolvingPatterns(context) {
        const patterns = [];
        // Analyze the sequence of actions to identify problem-solving approaches
        const toolSequence = context.tools.map(tool => tool.name);
        const userMessages = context.messages.filter(msg => msg.role === 'user');
        if (userMessages.length > 0) {
            const firstUserMessage = this.extractTextFromContent(userMessages[0].content).toLowerCase();
            // Debugging pattern
            if (firstUserMessage.includes('error') || firstUserMessage.includes('bug') || firstUserMessage.includes('fix')) {
                patterns.push({
                    problemType: 'debugging',
                    approach: 'systematic_investigation',
                    steps: this.extractStepsFromTools(context.tools),
                    successRate: context.outcome.type === 'success' ? 1.0 : 0.0,
                    applicableScenarios: ['error_resolution', 'bug_fixing'],
                });
            }
            // Implementation pattern
            if (firstUserMessage.includes('implement') || firstUserMessage.includes('create') || firstUserMessage.includes('build')) {
                patterns.push({
                    problemType: 'implementation',
                    approach: 'incremental_development',
                    steps: this.extractStepsFromTools(context.tools),
                    successRate: context.outcome.type === 'success' ? 1.0 : 0.0,
                    applicableScenarios: ['feature_development', 'code_creation'],
                });
            }
        }
        return patterns;
    }
    extractWorkflowPatterns(context) {
        const patterns = [];
        // Analyze tool usage for workflow optimizations
        const toolSequence = context.tools.map(tool => tool.name);
        const duration = context.endTime - context.startTime;
        // File editing workflow
        if (toolSequence.includes('readFile') && toolSequence.includes('strReplace')) {
            patterns.push({
                workflowType: 'file_editing',
                optimizations: ['read_before_edit', 'targeted_replacement'],
                timesSaved: Math.max(0, 5000 - duration), // Assume 5s baseline
                applicableContexts: ['code_modification', 'content_editing'],
            });
        }
        // Testing workflow
        if (toolSequence.includes('fsWrite') && toolSequence.includes('executePwsh')) {
            patterns.push({
                workflowType: 'test_and_execute',
                optimizations: ['write_then_test', 'immediate_validation'],
                timesSaved: Math.max(0, 10000 - duration), // Assume 10s baseline
                applicableContexts: ['code_development', 'script_creation'],
            });
        }
        return patterns;
    }
    identifyUserPreferenceOpportunities(context) {
        const opportunities = [];
        const userMessages = context.messages.filter(msg => msg.role === 'user');
        for (const message of userMessages) {
            const content = this.extractTextFromContent(message.content).toLowerCase();
            if (this.containsPreferenceIndicators(content)) {
                opportunities.push({
                    id: `pref_${context.interactionId}_${Date.now()}`,
                    type: 'user_preference',
                    priority: 8,
                    context,
                    extractedData: { messageContent: content },
                    confidence: 0.7,
                    timestamp: new Date(),
                });
            }
        }
        return opportunities;
    }
    identifyToolPatternOpportunities(context) {
        const opportunities = [];
        if (context.tools.length >= 2) {
            opportunities.push({
                id: `tool_${context.interactionId}_${Date.now()}`,
                type: 'tool_pattern',
                priority: 6,
                context,
                extractedData: { toolSequence: context.tools.map(t => t.name) },
                confidence: 0.8,
                timestamp: new Date(),
            });
        }
        return opportunities;
    }
    identifyProblemSolvingOpportunities(context) {
        const opportunities = [];
        const userMessages = context.messages.filter(msg => msg.role === 'user');
        if (userMessages.length > 0 && context.outcome.type === 'success') {
            const firstMessage = this.extractTextFromContent(userMessages[0].content).toLowerCase();
            if (this.containsProblemSolvingIndicators(firstMessage)) {
                opportunities.push({
                    id: `problem_${context.interactionId}_${Date.now()}`,
                    type: 'problem_solving',
                    priority: 7,
                    context,
                    extractedData: { problemType: this.classifyProblemType(firstMessage) },
                    confidence: 0.75,
                    timestamp: new Date(),
                });
            }
        }
        return opportunities;
    }
    identifyWorkflowOpportunities(context) {
        const opportunities = [];
        if (context.tools.length >= 2 && context.outcome.type === 'success') {
            const duration = context.endTime - context.startTime;
            // If the interaction was completed efficiently, it might be a good workflow pattern
            if (duration < 30000) { // Less than 30 seconds
                opportunities.push({
                    id: `workflow_${context.interactionId}_${Date.now()}`,
                    type: 'workflow_optimization',
                    priority: 5,
                    context,
                    extractedData: { duration, toolCount: context.tools.length },
                    confidence: 0.6,
                    timestamp: new Date(),
                });
            }
        }
        return opportunities;
    }
    sanitizeText(text) {
        let sanitized = text;
        // Remove PII patterns
        for (const pattern of this.piiPatterns) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        // Remove session-specific data
        for (const pattern of this.sessionDataPatterns) {
            sanitized = sanitized.replace(pattern, '[SESSION_DATA]');
        }
        // Remove completion indicators that could confuse future conversations
        for (const indicator of this.completionIndicators) {
            const regex = new RegExp(indicator, 'gi');
            sanitized = sanitized.replace(regex, '[COMPLETION_INDICATOR]');
        }
        return sanitized;
    }
    sanitizeObject(obj) {
        if (!obj)
            return obj;
        if (typeof obj === 'string') {
            return this.sanitizeText(obj);
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                // Skip potentially sensitive keys
                if (this.isSensitiveKey(key)) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = this.sanitizeObject(value);
                }
            }
            return sanitized;
        }
        return obj;
    }
    isSensitiveKey(key) {
        const sensitiveKeys = [
            'password', 'token', 'key', 'secret', 'auth', 'credential',
            'email', 'phone', 'address', 'ssn', 'credit', 'card',
            'userId', 'username', 'personalInfo', 'path', 'filePath'
        ];
        return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()));
    }
    getFilteredContent(original, sanitized) {
        const removedSessionData = [];
        const removedPII = [];
        const removedCompletionIndicators = [];
        // Compare original and sanitized to identify what was removed
        for (let i = 0; i < original.messages.length; i++) {
            const originalContent = this.extractTextFromContent(original.messages[i].content);
            const sanitizedContent = this.extractTextFromContent(sanitized.messages[i].content);
            if (originalContent !== sanitizedContent) {
                // Check what type of data was removed
                for (const pattern of this.sessionDataPatterns) {
                    const matches = originalContent.match(pattern);
                    if (matches) {
                        removedSessionData.push(...matches);
                    }
                }
                for (const pattern of this.piiPatterns) {
                    const matches = originalContent.match(pattern);
                    if (matches) {
                        removedPII.push(...matches);
                    }
                }
                for (const indicator of this.completionIndicators) {
                    if (originalContent.toLowerCase().includes(indicator.toLowerCase())) {
                        removedCompletionIndicators.push(indicator);
                    }
                }
            }
        }
        return {
            removedSessionData: Array.from(new Set(removedSessionData)),
            removedPII: Array.from(new Set(removedPII)),
            removedCompletionIndicators: Array.from(new Set(removedCompletionIndicators)),
        };
    }
    createEmptyAnalysis(context, reason) {
        return {
            interactionId: context.interactionId,
            analysisTimestamp: new Date(),
            successIndicators: {
                taskCompleted: false,
                userSatisfied: false,
                noErrors: false,
                meaningfulOutput: false,
            },
            extractedPatterns: {
                userPreferences: [],
                toolUsagePatterns: [],
                problemSolvingApproaches: [],
                workflowOptimizations: [],
            },
            learningOpportunities: [],
            filteredContent: {
                removedSessionData: [],
                removedPII: [],
                removedCompletionIndicators: [],
            },
        };
    }
    calculateToolEffectiveness(tools, targetTools) {
        const relevantTools = tools.filter(tool => targetTools.includes(tool.name));
        const successfulTools = relevantTools.filter(tool => tool.result?.success);
        return relevantTools.length > 0 ? successfulTools.length / relevantTools.length : 0;
    }
    extractStepsFromTools(tools) {
        return tools.map(tool => `${tool.name}: ${tool.result?.success ? 'success' : 'failed'}`);
    }
    containsPreferenceIndicators(content) {
        const indicators = [
            'prefer', 'like', 'want', 'need', 'always', 'never',
            'format', 'style', 'way', 'approach', 'method'
        ];
        return indicators.some(indicator => content.includes(indicator));
    }
    containsProblemSolvingIndicators(content) {
        const indicators = [
            'error', 'bug', 'fix', 'solve', 'debug', 'issue',
            'problem', 'implement', 'create', 'build', 'develop'
        ];
        return indicators.some(indicator => content.includes(indicator));
    }
    classifyProblemType(content) {
        if (content.includes('error') || content.includes('bug') || content.includes('fix')) {
            return 'debugging';
        }
        if (content.includes('implement') || content.includes('create') || content.includes('build')) {
            return 'implementation';
        }
        if (content.includes('optimize') || content.includes('improve') || content.includes('enhance')) {
            return 'optimization';
        }
        return 'general';
    }
}
exports.InteractionAnalyzer = InteractionAnalyzer;
// Export singleton instance
exports.interactionAnalyzer = new InteractionAnalyzer();

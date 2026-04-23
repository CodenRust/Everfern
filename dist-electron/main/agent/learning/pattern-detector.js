"use strict";
/**
 * EverFern Desktop — Pattern Detection System
 *
 * Detects recurring patterns across multiple interactions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patternDetector = exports.PatternDetector = void 0;
class PatternDetector {
    async detectUserPreferences(interactions) {
        const preferences = [];
        // Analyze formatting preferences
        const formattingPatterns = this.analyzeFormattingPatterns(interactions);
        preferences.push(...formattingPatterns);
        // Analyze workflow preferences
        const workflowPatterns = this.analyzeWorkflowPreferences(interactions);
        preferences.push(...workflowPatterns);
        return preferences;
    }
    async detectToolUsagePatterns(interactions) {
        const patterns = [];
        // Analyze tool sequences
        for (const interaction of interactions) {
            const toolSequence = interaction.tools.map(t => t.name);
            if (toolSequence.length > 1) {
                patterns.push({
                    toolCombination: toolSequence,
                    sequence: true,
                    parallel: false,
                    effectiveness: interaction.success ? 1.0 : 0.0,
                    context: interaction.outcome.description,
                    frequency: 1
                });
            }
        }
        return patterns;
    }
    async detectProblemSolvingPatterns(interactions) {
        const patterns = [];
        // Group interactions by problem type
        const problemGroups = this.groupByProblemType(interactions);
        for (const [problemType, problemInteractions] of problemGroups) {
            const successfulApproaches = problemInteractions
                .filter(i => i.success)
                .map(i => this.extractApproach(i));
            if (successfulApproaches.length > 0) {
                patterns.push({
                    problemType,
                    approach: successfulApproaches[0], // Simplified
                    steps: this.extractSteps(problemInteractions[0]),
                    successRate: successfulApproaches.length / problemInteractions.length,
                    applicableScenarios: [problemType]
                });
            }
        }
        return patterns;
    }
    async detectWorkflowOptimizations(interactions) {
        const patterns = [];
        // Analyze workflow efficiency
        const workflowGroups = this.groupByWorkflowType(interactions);
        for (const [workflowType, workflowInteractions] of workflowGroups) {
            const optimizations = this.identifyOptimizations(workflowInteractions);
            if (optimizations.length > 0) {
                patterns.push({
                    workflowType,
                    optimizations,
                    timesSaved: this.calculateTimeSaved(workflowInteractions),
                    applicableContexts: [workflowType]
                });
            }
        }
        return patterns;
    }
    async detectMetaPatterns(knowledge) {
        // Placeholder for meta-pattern detection
        return [];
    }
    async validatePatterns(patterns) {
        // Placeholder for pattern validation
        return patterns.filter(p => p.confidence > 0.5);
    }
    analyzeFormattingPatterns(interactions) {
        // Placeholder implementation
        return [];
    }
    analyzeWorkflowPreferences(interactions) {
        // Placeholder implementation
        return [];
    }
    groupByProblemType(interactions) {
        const groups = new Map();
        for (const interaction of interactions) {
            const problemType = this.inferProblemType(interaction);
            if (!groups.has(problemType)) {
                groups.set(problemType, []);
            }
            groups.get(problemType).push(interaction);
        }
        return groups;
    }
    groupByWorkflowType(interactions) {
        const groups = new Map();
        for (const interaction of interactions) {
            const workflowType = this.inferWorkflowType(interaction);
            if (!groups.has(workflowType)) {
                groups.set(workflowType, []);
            }
            groups.get(workflowType).push(interaction);
        }
        return groups;
    }
    inferProblemType(interaction) {
        // Simple heuristic based on tools used
        const toolNames = interaction.tools.map(t => t.name);
        if (toolNames.some(name => name.includes('file') || name.includes('write'))) {
            return 'file-management';
        }
        if (toolNames.some(name => name.includes('terminal') || name.includes('shell'))) {
            return 'system-administration';
        }
        if (toolNames.some(name => name.includes('web') || name.includes('fetch'))) {
            return 'web-browsing';
        }
        return 'general';
    }
    inferWorkflowType(interaction) {
        // Simple heuristic based on interaction outcome
        return interaction.outcome.type === 'success' ? 'efficient' : 'inefficient';
    }
    extractApproach(interaction) {
        return interaction.outcome.description;
    }
    extractSteps(interaction) {
        return interaction.tools.map(t => `Use ${t.name}`);
    }
    identifyOptimizations(interactions) {
        // Placeholder for optimization identification
        return ['Use fewer tools', 'Combine similar operations'];
    }
    calculateTimeSaved(interactions) {
        // Placeholder calculation
        return interactions.length * 1000; // 1 second per interaction
    }
}
exports.PatternDetector = PatternDetector;
exports.patternDetector = new PatternDetector();

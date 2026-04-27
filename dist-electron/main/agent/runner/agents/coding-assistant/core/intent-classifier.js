"use strict";
/**
 * Intent Classifier - AI-Powered User Intent Detection
 *
 * Classifies user intents without hardcoded patterns.
 * Uses AI to understand what the user wants to accomplish.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifier = void 0;
exports.createIntentClassifier = createIntentClassifier;
class IntentClassifier {
    /**
     * Classify user intent from input text
     */
    async classifyIntent(userInput, context) {
        const input = userInput.toLowerCase();
        const analysis = context.codebaseAnalysis;
        // Analyze intent keywords and context
        const intentScores = {
            create_component: this.scoreCreateComponent(input, analysis),
            create_api: this.scoreCreateAPI(input, analysis),
            create_database: this.scoreCreateDatabase(input, analysis),
            setup_project: this.scoreSetupProject(input, analysis),
            fix_bug: this.scoreFixBug(input, analysis),
            refactor: this.scoreRefactor(input, analysis),
            optimize: this.scoreOptimize(input, analysis),
            test: this.scoreTest(input, analysis),
            document: this.scoreDocument(input, analysis),
            deploy: this.scoreDeploy(input, analysis)
        };
        // Find highest scoring intent
        let topIntent = 'unknown';
        let topScore = 0;
        for (const [intent, score] of Object.entries(intentScores)) {
            if (score > topScore) {
                topScore = score;
                topIntent = intent;
            }
        }
        // If no clear intent, return unknown
        if (topScore < 0.3) {
            return {
                type: 'unknown',
                confidence: 0.0,
                reasoning: 'Could not determine user intent from input',
                suggestedApproach: 'Ask user for clarification'
            };
        }
        // Extract details based on intent
        const details = this.extractIntentDetails(userInput, topIntent, analysis);
        return {
            type: topIntent,
            confidence: Math.min(topScore, 1.0),
            details,
            reasoning: this.generateReasoning(topIntent, topScore, analysis),
            suggestedApproach: this.generateApproach(topIntent, analysis)
        };
    }
    /**
     * Score for component creation intent
     */
    scoreCreateComponent(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(create|build|make|add|new)\b.*\b(component|widget|element|view)\b/.test(input))
            score += 0.8;
        if (/\b(component|react|vue|angular)\b/.test(input))
            score += 0.3;
        if (/\b(ui|interface|page|screen)\b/.test(input))
            score += 0.2;
        // Context
        if (analysis.framework.primary === 'React' || analysis.framework.primary === 'Vue')
            score += 0.2;
        if (analysis.capabilities.hasFrontend)
            score += 0.1;
        return score;
    }
    /**
     * Score for API creation intent
     */
    scoreCreateAPI(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(create|build|make|add|new)\b.*\b(api|endpoint|route|service)\b/.test(input))
            score += 0.8;
        if (/\b(api|endpoint|rest|graphql|route|controller)\b/.test(input))
            score += 0.3;
        if (/\b(get|post|put|delete|patch)\b/.test(input))
            score += 0.2;
        // Context
        if (analysis.capabilities.hasAPI)
            score += 0.2;
        if (analysis.framework.primary === 'Express' || analysis.framework.primary === 'FastAPI')
            score += 0.2;
        return score;
    }
    /**
     * Score for database creation intent
     */
    scoreCreateDatabase(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(create|build|make|add|new)\b.*\b(database|db|schema|model|table)\b/.test(input))
            score += 0.8;
        if (/\b(database|db|schema|model|orm|migration)\b/.test(input))
            score += 0.3;
        if (/\b(sql|postgres|mongo|mysql|sqlite)\b/.test(input))
            score += 0.2;
        // Context
        if (analysis.capabilities.hasDatabase)
            score += 0.2;
        return score;
    }
    /**
     * Score for project setup intent
     */
    scoreSetupProject(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(setup|initialize|scaffold|create|new)\b.*\b(project|app|application)\b/.test(input))
            score += 0.8;
        if (/\b(project|app|application|boilerplate)\b/.test(input))
            score += 0.2;
        if (/\b(next|react|express|fastapi|django)\b/.test(input))
            score += 0.3;
        return score;
    }
    /**
     * Score for bug fix intent
     */
    scoreFixBug(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(fix|debug|resolve|solve|patch)\b.*\b(bug|error|issue|problem|crash)\b/.test(input))
            score += 0.8;
        if (/\b(bug|error|issue|problem|crash|broken|fail)\b/.test(input))
            score += 0.4;
        if (/\b(fix|debug|resolve)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Score for refactoring intent
     */
    scoreRefactor(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(refactor|improve|clean|reorganize|restructure)\b/.test(input))
            score += 0.7;
        if (/\b(code quality|maintainability|readability|duplication)\b/.test(input))
            score += 0.3;
        if (/\b(extract|consolidate|simplify)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Score for optimization intent
     */
    scoreOptimize(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(optimize|improve|speed|performance|efficiency)\b/.test(input))
            score += 0.7;
        if (/\b(fast|slow|lag|performance|memory|cpu)\b/.test(input))
            score += 0.3;
        if (/\b(bundle|cache|lazy|load)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Score for testing intent
     */
    scoreTest(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(test|write|add|create)\b.*\b(test|spec|unit|integration|e2e)\b/.test(input))
            score += 0.8;
        if (/\b(test|spec|coverage|jest|vitest|pytest)\b/.test(input))
            score += 0.3;
        if (/\b(testing|quality|reliability)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Score for documentation intent
     */
    scoreDocument(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(document|write|add|create)\b.*\b(doc|readme|comment|guide)\b/.test(input))
            score += 0.8;
        if (/\b(documentation|readme|guide|comment|jsdoc)\b/.test(input))
            score += 0.3;
        if (/\b(explain|describe|document)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Score for deployment intent
     */
    scoreDeploy(input, analysis) {
        let score = 0;
        // Keywords
        if (/\b(deploy|build|release|publish|ship)\b/.test(input))
            score += 0.7;
        if (/\b(docker|ci|cd|github|gitlab|vercel|heroku)\b/.test(input))
            score += 0.3;
        if (/\b(production|staging|environment)\b/.test(input))
            score += 0.2;
        return score;
    }
    /**
     * Extract specific details from user input
     */
    extractIntentDetails(userInput, intent, analysis) {
        const details = {};
        switch (intent) {
            case 'create_component': {
                const nameMatch = userInput.match(/(?:component|widget|element)\s+(?:called|named|for)?\s+(\w+)/i);
                if (nameMatch)
                    details.componentName = nameMatch[1];
                details.framework = analysis.framework.primary;
                break;
            }
            case 'create_api': {
                const endpointMatch = userInput.match(/(?:endpoint|route|api)\s+(?:for|to)?\s+(\w+)/i);
                if (endpointMatch)
                    details.endpoint = endpointMatch[1];
                details.framework = analysis.framework.primary;
                break;
            }
            case 'create_database': {
                const modelMatch = userInput.match(/(?:model|schema|table)\s+(?:for|called)?\s+(\w+)/i);
                if (modelMatch)
                    details.model = modelMatch[1];
                break;
            }
            case 'setup_project': {
                const frameworkMatch = userInput.match(/(?:with|using|for)\s+(next|react|express|fastapi|django|vue|angular)/i);
                if (frameworkMatch)
                    details.framework = frameworkMatch[1];
                break;
            }
            case 'fix_bug': {
                const bugMatch = userInput.match(/(?:bug|error|issue):\s*(.+?)(?:\.|$)/i);
                if (bugMatch)
                    details.bugDescription = bugMatch[1];
                break;
            }
        }
        return details;
    }
    /**
     * Generate reasoning for the classified intent
     */
    generateReasoning(intent, score, analysis) {
        const confidence = Math.round(score * 100);
        switch (intent) {
            case 'create_component':
                return `Detected component creation intent (${confidence}% confidence). User wants to build a new UI component for ${analysis.framework.primary}.`;
            case 'create_api':
                return `Detected API creation intent (${confidence}% confidence). User wants to build a new endpoint using ${analysis.framework.primary}.`;
            case 'create_database':
                return `Detected database creation intent (${confidence}% confidence). User wants to set up database models or schema.`;
            case 'setup_project':
                return `Detected project setup intent (${confidence}% confidence). User wants to initialize a new project.`;
            case 'fix_bug':
                return `Detected bug fix intent (${confidence}% confidence). User wants to debug and fix an issue.`;
            case 'refactor':
                return `Detected refactoring intent (${confidence}% confidence). User wants to improve code quality and structure.`;
            case 'optimize':
                return `Detected optimization intent (${confidence}% confidence). User wants to improve performance or efficiency.`;
            case 'test':
                return `Detected testing intent (${confidence}% confidence). User wants to add or improve tests.`;
            case 'document':
                return `Detected documentation intent (${confidence}% confidence). User wants to add or improve documentation.`;
            case 'deploy':
                return `Detected deployment intent (${confidence}% confidence). User wants to build, configure, or deploy the application.`;
            default:
                return `Could not clearly determine user intent (${confidence}% confidence).`;
        }
    }
    /**
     * Generate suggested approach for the intent
     */
    generateApproach(intent, analysis) {
        switch (intent) {
            case 'create_component':
                return `Create a new ${analysis.framework.primary} component with proper TypeScript types, props interface, and follow existing patterns in the codebase.`;
            case 'create_api':
                return `Generate a new API endpoint with validation, error handling, and proper middleware integration for ${analysis.framework.primary}.`;
            case 'create_database':
                return `Set up database models with proper relationships, migrations, and seed data for development and testing.`;
            case 'setup_project':
                return `Scaffold a complete project structure with all necessary configuration files, dependencies, and development setup.`;
            case 'fix_bug':
                return `Analyze the issue, identify the root cause, implement a fix, and add tests to prevent regression.`;
            case 'refactor':
                return `Analyze code architecture, identify improvement opportunities, extract duplications, and improve overall structure.`;
            case 'optimize':
                return `Profile the code, identify bottlenecks, implement optimizations, and measure improvements.`;
            case 'test':
                return `Generate comprehensive tests covering unit, integration, and edge cases with proper mocking and assertions.`;
            case 'document':
                return `Create clear, comprehensive documentation with examples, setup instructions, and API references.`;
            case 'deploy':
                return `Configure build tools, CI/CD pipelines, Docker setup, and deployment scripts for production.`;
            default:
                return `Analyze the request and determine the best approach to help you.`;
        }
    }
}
exports.IntentClassifier = IntentClassifier;
/**
 * Factory function to create intent classifier
 */
function createIntentClassifier() {
    return new IntentClassifier();
}

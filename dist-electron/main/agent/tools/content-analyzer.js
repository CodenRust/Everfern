"use strict";
/**
 * ContentAnalyzer Implementation for Intelligent Site Selection
 *
 * This module provides two-tier content analysis: fast heuristic pre-filtering
 * and deep AI-powered content evaluation for the browser-use tool.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentAnalyzer = void 0;
const intelligent_site_selection_base_1 = require("./intelligent-site-selection-base");
const intelligent_site_selection_1 = require("./intelligent-site-selection");
/**
 * ContentAnalyzer provides fast heuristic and deep AI-powered content analysis
 * with structured data extraction capabilities.
 */
class ContentAnalyzer extends intelligent_site_selection_base_1.BaseContentAnalyzer {
    HEURISTIC_TIME_LIMIT = 200; // milliseconds
    MIN_CONTENT_LENGTH = 100;
    MIN_INFORMATION_DENSITY = 0.3;
    constructor(aiClient, config) {
        super(aiClient, config);
    }
    /**
     * Performs fast heuristic analysis for pre-filtering (< 200ms)
     */
    performHeuristicAnalysis(pageContent, context) {
        const startTime = Date.now();
        try {
            const contentText = this.extractContentText(pageContent);
            const contentType = this.determineContentType(pageContent);
            const informationDensity = this.calculateInformationDensity(pageContent);
            const relevanceScore = this.calculateHeuristicRelevance(pageContent, context);
            // Fast rejection checks
            const fastRejectReasons = this.getFastRejectReasons(pageContent, contentText);
            const processingRecommendation = this.determineProcessingLevel(relevanceScore, informationDensity, fastRejectReasons.length > 0);
            const analysis = {
                relevanceScore,
                contentType,
                informationDensity,
                processingRecommendation,
                fastRejectReasons: fastRejectReasons.length > 0 ? fastRejectReasons : undefined
            };
            // Ensure we stay within time limit
            const elapsed = Date.now() - startTime;
            if (elapsed > this.HEURISTIC_TIME_LIMIT) {
                console.warn(`Heuristic analysis took ${elapsed}ms, exceeding ${this.HEURISTIC_TIME_LIMIT}ms limit`);
            }
            return analysis;
        }
        catch (error) {
            console.error('Error in heuristic analysis:', error);
            // Return safe fallback
            return {
                relevanceScore: 30,
                contentType: intelligent_site_selection_1.ContentType.IRRELEVANT,
                informationDensity: 0,
                processingRecommendation: intelligent_site_selection_1.ProcessingLevel.SKIP,
                fastRejectReasons: ['Analysis error']
            };
        }
    }
    /**
     * Performs deep AI-powered content evaluation
     */
    async performDeepAnalysis(pageContent, context) {
        try {
            const contentText = this.extractContentText(pageContent);
            if (contentText.length < this.MIN_CONTENT_LENGTH) {
                return {
                    semanticRelevance: 20,
                    informationValue: 10,
                    contentGaps: ['Insufficient content'],
                    extractionPriority: 1,
                    nextActionRecommendations: ['Skip this page']
                };
            }
            const prompt = this.buildDeepAnalysisPrompt(pageContent, context);
            const response = await this.aiClient.chat({
                messages: [{ role: 'user', content: prompt }],
                model: 'claude-3-haiku-20240307', // Fast model for content analysis
                maxTokens: 500,
                temperature: 0.1 // Low temperature for consistent analysis
            });
            const responseText = typeof response.content === 'string'
                ? response.content
                : Array.isArray(response.content)
                    ? response.content.map(c => c.type === 'text' ? c.text : '').join('')
                    : '';
            return this.parseDeepAnalysisResponse(responseText);
        }
        catch (error) {
            console.error('Error in deep analysis:', error);
            // Return fallback analysis
            return {
                semanticRelevance: 40,
                informationValue: 30,
                contentGaps: ['Analysis unavailable'],
                extractionPriority: 2,
                nextActionRecommendations: ['Proceed with caution']
            };
        }
    }
    /**
     * Extracts structured data for pricing, ratings, and other key information
     */
    extractStructuredData(content) {
        const contentText = this.extractContentText(content);
        return {
            pricing: this.extractPricingData(content, contentText),
            features: this.extractFeatureData(content, contentText),
            ratings: this.extractRatingData(content, contentText),
            contacts: this.extractContactData(content, contentText)
        };
    }
    /**
     * Override base class method to use proper content extraction
     */
    assessContentQuality(content) {
        const contentText = this.extractContentText(content);
        const textLength = contentText.length;
        const hasTitle = !!content.title && content.title.length > 10;
        const hasStructure = this.hasStructuredContent(content);
        const hasSubstantialContent = textLength > 500;
        return {
            readability: this.calculateReadability(contentText),
            completeness: hasTitle && hasSubstantialContent ? 0.8 : 0.4,
            accuracy: 0.7, // Default assumption, would need external validation
            freshness: 0.6, // Default assumption, would need date analysis
            authority: hasStructure ? 0.7 : 0.5
        };
    }
    /**
     * Override base class method to use proper content extraction
     */
    hasStructuredContent(content) {
        const text = this.extractContentText(content);
        return text.includes('$') || // Pricing indicators
            text.includes('•') || // Bullet points
            text.includes('\n\n') || // Paragraphs
            content.headings.length > 0 ||
            content.tables.length > 0 ||
            !!content.title;
    }
    // ============================================================================
    // Private Helper Methods
    // ============================================================================
    extractContentText(content) {
        // Combine all text content with proper spacing
        const parts = [
            content.title || '',
            content.metaDescription || '',
            content.headings.join(' '),
            content.paragraphs.join(' '),
            content.rawText || ''
        ].filter(part => part.trim().length > 0);
        return parts.join(' ').trim();
    }
    calculateHeuristicRelevance(content, context) {
        let score = 50; // Base score
        const contentText = this.extractContentText(content).toLowerCase();
        const url = content.url.toLowerCase();
        const title = (content.title || '').toLowerCase();
        // Fast rejection for administrative pages - override other scoring
        if (url.includes('login') || url.includes('signup') || url.includes('admin') ||
            title.includes('login') || title.includes('admin')) {
            return 15; // Very low score for admin pages
        }
        // Keyword matching (30% weight)
        const keywordScore = this.calculateKeywordMatch(contentText, context.keywords);
        score += keywordScore * 0.3;
        // URL relevance (20% weight)
        const urlScore = this.calculateUrlRelevance(url, context.keywords);
        score += urlScore * 0.2;
        // Title relevance (25% weight)
        const titleScore = this.calculateKeywordMatch(title, context.keywords);
        score += titleScore * 0.25;
        // Content structure (15% weight)
        const structureScore = this.calculateStructureScore(content);
        score += structureScore * 0.15;
        // Goal alignment (10% weight)
        const goalScore = this.calculateGoalAlignment(contentText, context.goals);
        score += goalScore * 0.1;
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    calculateKeywordMatch(text, keywords) {
        if (keywords.length === 0)
            return 0;
        let matches = 0;
        let totalWeight = 0;
        for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();
            const weight = keyword.length > 5 ? 2 : 1; // Longer keywords are more important
            totalWeight += weight;
            if (text.includes(keywordLower)) {
                matches += weight;
            }
        }
        return totalWeight > 0 ? (matches / totalWeight) * 100 : 0;
    }
    calculateUrlRelevance(url, keywords) {
        let score = 0;
        // Positive URL patterns
        const positivePatterns = [
            { pattern: /pricing|price|cost|plan/i, score: 30 },
            { pattern: /features|capabilities/i, score: 25 },
            { pattern: /docs|documentation/i, score: 20 },
            { pattern: /review|rating/i, score: 15 },
            { pattern: /product|service/i, score: 15 }
        ];
        // Negative URL patterns - stronger penalties
        const negativePatterns = [
            { pattern: /login|signin|signup/i, score: -60 },
            { pattern: /cookie|privacy|terms/i, score: -50 },
            { pattern: /admin|dashboard/i, score: -55 },
            { pattern: /\.(jpg|jpeg|png|gif|pdf)$/i, score: -70 }
        ];
        // Apply positive patterns
        for (const { pattern, score: patternScore } of positivePatterns) {
            if (pattern.test(url)) {
                score += patternScore;
            }
        }
        // Apply negative patterns
        for (const { pattern, score: patternScore } of negativePatterns) {
            if (pattern.test(url)) {
                score += patternScore;
            }
        }
        // Keyword matching in URL
        for (const keyword of keywords) {
            if (url.includes(keyword.toLowerCase())) {
                score += 20;
            }
        }
        return Math.max(0, Math.min(100, score + 50)); // Normalize to 0-100
    }
    calculateStructureScore(content) {
        let score = 0;
        // Has title
        if (content.title && content.title.length > 10)
            score += 20;
        // Has meta description
        if (content.metaDescription && content.metaDescription.length > 50)
            score += 15;
        // Has headings
        if (content.headings.length > 0)
            score += 15;
        // Has substantial paragraphs
        const substantialParagraphs = content.paragraphs.filter(p => p.length > 100);
        score += Math.min(25, substantialParagraphs.length * 5);
        // Has structured data
        if (content.prices && content.prices.length > 0)
            score += 10;
        if (content.ratings && content.ratings.length > 0)
            score += 10;
        if (content.tables && content.tables.length > 0)
            score += 5;
        return Math.min(100, score);
    }
    calculateGoalAlignment(text, goals) {
        if (goals.length === 0)
            return 50; // Neutral if no specific goals
        let alignmentScore = 0;
        const textLower = text.toLowerCase();
        for (const goal of goals) {
            const goalLower = goal.toLowerCase();
            if (goalLower.includes('pricing') && (textLower.includes('price') || textLower.includes('cost') || textLower.includes('$'))) {
                alignmentScore += 25;
            }
            if (goalLower.includes('features') && (textLower.includes('feature') || textLower.includes('capability'))) {
                alignmentScore += 20;
            }
            if (goalLower.includes('review') && (textLower.includes('review') || textLower.includes('rating'))) {
                alignmentScore += 20;
            }
            if (goalLower.includes('contact') && (textLower.includes('contact') || textLower.includes('support'))) {
                alignmentScore += 15;
            }
        }
        return Math.min(100, alignmentScore);
    }
    calculateInformationDensity(content) {
        const contentText = this.extractContentText(content);
        if (contentText.length === 0)
            return 0;
        // Calculate various density metrics
        const wordCount = contentText.split(/\s+/).length;
        const uniqueWords = new Set(contentText.toLowerCase().split(/\s+/)).size;
        const sentences = contentText.split(/[.!?]+/).length;
        // Information indicators
        let infoScore = 0;
        // Unique word ratio (higher is better)
        const uniqueRatio = uniqueWords / Math.max(wordCount, 1);
        infoScore += uniqueRatio * 30;
        // Sentence complexity (moderate is better)
        const avgWordsPerSentence = wordCount / Math.max(sentences, 1);
        if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
            infoScore += 20;
        }
        // Structured content indicators
        if (content.headings.length > 0)
            infoScore += 15;
        if (content.tables.length > 0)
            infoScore += 15;
        if (content.prices && content.prices.length > 0)
            infoScore += 10;
        if (content.ratings && content.ratings.length > 0)
            infoScore += 10;
        return Math.min(1, infoScore / 100);
    }
    getFastRejectReasons(content, contentText) {
        const reasons = [];
        const url = content.url.toLowerCase();
        // Too little content
        if (contentText.length < this.MIN_CONTENT_LENGTH) {
            reasons.push('Insufficient content length');
        }
        // Administrative pages
        if (url.includes('login') || url.includes('signup') || url.includes('admin')) {
            reasons.push('Administrative page');
        }
        // Media files
        if (url.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
            reasons.push('Media file');
        }
        // Cookie/privacy pages
        if (url.includes('cookie') || url.includes('privacy') || url.includes('terms')) {
            reasons.push('Legal/policy page');
        }
        // No meaningful title
        if (!content.title || content.title.length < 5) {
            reasons.push('No meaningful title');
        }
        // Very low information density
        const density = this.calculateInformationDensity(content);
        if (density < this.MIN_INFORMATION_DENSITY) {
            reasons.push('Low information density');
        }
        return reasons;
    }
    determineProcessingLevel(relevanceScore, informationDensity, hasRejectReasons) {
        if (hasRejectReasons || relevanceScore < 20) {
            return intelligent_site_selection_1.ProcessingLevel.SKIP;
        }
        if (relevanceScore < 40 || informationDensity < 0.3) {
            return intelligent_site_selection_1.ProcessingLevel.HEURISTIC_ONLY;
        }
        if (relevanceScore < 70 || informationDensity < 0.6) {
            return intelligent_site_selection_1.ProcessingLevel.LIGHT_AI;
        }
        return intelligent_site_selection_1.ProcessingLevel.DEEP_AI;
    }
    buildDeepAnalysisPrompt(content, context) {
        const contentText = this.extractContentText(content);
        const truncatedContent = contentText.substring(0, 2000); // Limit content for prompt
        return `Analyze this web page content for research relevance:

RESEARCH CONTEXT:
Task: ${context.taskDescription}
Goals: ${context.goals.join(', ')}
Keywords: ${context.keywords.join(', ')}

PAGE CONTENT:
URL: ${content.url}
Title: ${content.title}
Content: ${truncatedContent}

Please provide a JSON response with:
{
  "semanticRelevance": <0-100 score for how well content matches research goals>,
  "informationValue": <0-100 score for information quality and usefulness>,
  "contentGaps": [<list of missing information types>],
  "extractionPriority": <1-5 priority for data extraction>,
  "nextActionRecommendations": [<list of recommended next actions>]
}

Focus on semantic understanding and research value assessment.`;
    }
    parseDeepAnalysisResponse(response) {
        try {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    semanticRelevance: Math.max(0, Math.min(100, parsed.semanticRelevance || 40)),
                    informationValue: Math.max(0, Math.min(100, parsed.informationValue || 30)),
                    contentGaps: Array.isArray(parsed.contentGaps) ? parsed.contentGaps : [],
                    extractionPriority: Math.max(1, Math.min(5, parsed.extractionPriority || 3)),
                    nextActionRecommendations: Array.isArray(parsed.nextActionRecommendations)
                        ? parsed.nextActionRecommendations
                        : ['Continue analysis']
                };
            }
        }
        catch (error) {
            console.error('Error parsing deep analysis response:', error);
        }
        // Fallback parsing
        return {
            semanticRelevance: 40,
            informationValue: 30,
            contentGaps: ['Unable to analyze'],
            extractionPriority: 3,
            nextActionRecommendations: ['Manual review recommended']
        };
    }
    extractPricingData(content, contentText) {
        const pricingData = [];
        // Use existing prices from content if available
        if (content.prices && content.prices.length > 0) {
            for (const price of content.prices) {
                pricingData.push({
                    plan: 'Standard', // Default plan name
                    price: price,
                    currency: this.extractCurrency(price),
                    period: this.extractPeriod(price),
                    features: []
                });
            }
        }
        // Extract from text patterns
        const pricePatterns = [
            /\$(\d+(?:\.\d{2})?)\s*(?:\/\s*(month|year|mo|yr))?/gi,
            /(\d+(?:\.\d{2})?)\s*(?:USD|EUR|GBP)\s*(?:\/\s*(month|year|mo|yr))?/gi
        ];
        for (const pattern of pricePatterns) {
            let match;
            while ((match = pattern.exec(contentText)) !== null && pricingData.length < 10) {
                pricingData.push({
                    plan: 'Extracted',
                    price: match[1],
                    currency: this.extractCurrency(match[0]),
                    period: match[2] || 'unknown',
                    features: []
                });
            }
        }
        return pricingData;
    }
    extractFeatureData(content, contentText) {
        const features = [];
        // Look for feature lists in headings and paragraphs
        const featurePatterns = [
            /(?:features?|capabilities|benefits?):\s*([^.]+)/gi,
            /✓\s*([^.\n]+)/gi,
            /•\s*([^.\n]+)/gi
        ];
        for (const pattern of featurePatterns) {
            let match;
            while ((match = pattern.exec(contentText)) !== null && features.length < 20) {
                const featureText = match[1].trim();
                if (featureText.length > 5 && featureText.length < 200) {
                    features.push({
                        name: featureText,
                        description: featureText,
                        category: 'general',
                        availability: 'standard'
                    });
                }
            }
        }
        return features;
    }
    extractRatingData(content, contentText) {
        const ratings = [];
        // Use existing ratings from content if available
        if (content.ratings && content.ratings.length > 0) {
            for (const rating of content.ratings) {
                const numericRating = this.extractNumericRating(rating);
                if (numericRating > 0) {
                    ratings.push({
                        score: numericRating,
                        maxScore: 5, // Assume 5-star scale
                        reviewCount: 0,
                        source: 'page'
                    });
                }
            }
        }
        // Extract from text patterns
        const ratingPatterns = [
            /(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*(?:stars?|rating)/gi,
            /(\d+(?:\.\d+)?)\s*stars?/gi,
            /rating:\s*(\d+(?:\.\d+)?)/gi
        ];
        for (const pattern of ratingPatterns) {
            let match;
            while ((match = pattern.exec(contentText)) !== null && ratings.length < 5) {
                ratings.push({
                    score: parseFloat(match[1]),
                    maxScore: match[2] ? parseFloat(match[2]) : 5,
                    reviewCount: 0,
                    source: 'extracted'
                });
            }
        }
        return ratings;
    }
    extractContactData(content, contentText) {
        const contacts = [];
        // Email patterns
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        let match;
        while ((match = emailPattern.exec(contentText)) !== null && contacts.length < 10) {
            contacts.push({
                type: 'email',
                value: match[1],
                verified: false
            });
        }
        // Phone patterns
        const phonePattern = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        while ((match = phonePattern.exec(contentText)) !== null && contacts.length < 10) {
            contacts.push({
                type: 'phone',
                value: match[0],
                verified: false
            });
        }
        return contacts;
    }
    extractCurrency(priceText) {
        if (priceText.includes('$'))
            return 'USD';
        if (priceText.includes('€'))
            return 'EUR';
        if (priceText.includes('£'))
            return 'GBP';
        if (priceText.includes('USD'))
            return 'USD';
        if (priceText.includes('EUR'))
            return 'EUR';
        if (priceText.includes('GBP'))
            return 'GBP';
        return 'USD'; // Default
    }
    extractPeriod(priceText) {
        const text = priceText.toLowerCase();
        if (text.includes('month') || text.includes('/mo'))
            return 'month';
        if (text.includes('year') || text.includes('/yr'))
            return 'year';
        if (text.includes('week'))
            return 'week';
        if (text.includes('day'))
            return 'day';
        return 'unknown';
    }
    extractNumericRating(ratingText) {
        const match = ratingText.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }
}
exports.ContentAnalyzer = ContentAnalyzer;

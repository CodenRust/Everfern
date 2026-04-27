/**
 * URLClassifier Implementation for Intelligent Site Selection
 *
 * This module provides fast pre-filtering and pattern-based URL evaluation
 * with adaptive scoring based on research task keywords.
 */

import {
  URLClassifier,
  URLClassification,
  URLCategory,
  MatchedPattern,
  PatternLearningData,
  ResearchContext,
  RiskLevel,
  ProcessingLevel,
  IntelligentSelectionConfig
} from './intelligent-site-selection';
import { BaseURLClassifier } from './intelligent-site-selection-base';

/**
 * Pattern definition for URL classification
 */
interface URLPattern {
  pattern: RegExp;
  category: URLCategory;
  score: number;
  confidence: number;
  description: string;
}

/**
 * Concrete implementation of URLClassifier with pattern-based scoring
 */
export class URLClassifierImpl extends BaseURLClassifier {
  private positivePatterns: URLPattern[] = [];
  private negativePatterns: URLPattern[] = [];
  private adaptiveWeights: Map<string, number> = new Map();

  constructor(config: IntelligentSelectionConfig) {
    super(config);
    this.initializePatterns();
    this.initializeAdaptiveWeights();
  }

  /**
   * Classify a URL and return detailed classification results
   */
  classifyURL(url: string, context: ResearchContext): URLClassification {
    const baseScore = this.generateURLScore(url, context.keywords);
    const matchedPatterns = this.findMatchingPatterns(url);
    const category = this.determineURLCategory(url);
    const riskLevel = this.assessRisk(url, baseScore);
    const processingRecommendation = this.determineProcessingLevel(baseScore, category);

    // Apply context-aware scoring adaptation
    const adaptedScore = this.applyContextualAdaptation(baseScore, url, context);

    return {
      category,
      score: Math.max(0, Math.min(100, adaptedScore)),
      patterns: matchedPatterns,
      riskLevel,
      processingRecommendation
    };
  }

  /**
   * Update patterns based on learning data
   */
  updatePatterns(learningData: PatternLearningData): void {
    // Update pattern confidence based on success/failure patterns
    for (const successPattern of learningData.successPatterns) {
      this.updatePatternConfidence(successPattern.pattern, successPattern.confidence, true);
    }

    for (const failurePattern of learningData.failurePatterns) {
      this.updatePatternConfidence(failurePattern.pattern, failurePattern.confidence, false);
    }

    // Update adaptive weights based on contextual factors
    for (const [factor, weight] of Object.entries(learningData.contextualFactors)) {
      this.adaptiveWeights.set(factor, weight);
    }
  }

  /**
   * Generate URL score with keyword-based adaptation
   */
  generateURLScore(url: string, taskKeywords: string[]): number {
    let score = 50; // Base score

    // Apply positive patterns
    for (const pattern of this.positivePatterns) {
      if (pattern.pattern.test(url)) {
        const boost = pattern.score * pattern.confidence;
        score += boost;
      }
    }

    // Apply negative patterns (penalties)
    for (const pattern of this.negativePatterns) {
      if (pattern.pattern.test(url)) {
        const penalty = pattern.score * pattern.confidence;
        score += penalty; // pattern.score is already negative
      }
    }

    // Apply keyword-based scoring adaptation
    score += this.calculateKeywordBoost(url, taskKeywords);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Initialize default URL patterns for classification
   */
  private initializePatterns(): void {
    // Positive patterns (boost scores)
    this.positivePatterns = [
      {
        pattern: /pricing|price|cost|plan|subscription|billing/i,
        category: URLCategory.PRICING,
        score: 25,
        confidence: 0.9,
        description: 'Pricing information pages'
      },
      {
        pattern: /features|capabilities|functionality|benefits|specs/i,
        category: URLCategory.FEATURES,
        score: 20,
        confidence: 0.85,
        description: 'Feature description pages'
      },
      {
        pattern: /docs|documentation|guide|tutorial|help|api/i,
        category: URLCategory.DOCUMENTATION,
        score: 18,
        confidence: 0.8,
        description: 'Documentation and help pages'
      },
      {
        pattern: /review|rating|testimonial|feedback|comparison/i,
        category: URLCategory.REVIEWS,
        score: 15,
        confidence: 0.75,
        description: 'Review and rating pages'
      },
      {
        pattern: /product|service|solution|offering|tool/i,
        category: URLCategory.PRODUCT,
        score: 12,
        confidence: 0.7,
        description: 'Product information pages'
      },
      {
        pattern: /demo|trial|free|sample|preview/i,
        category: URLCategory.PRODUCT,
        score: 10,
        confidence: 0.8,
        description: 'Demo and trial pages'
      }
    ];

    // Negative patterns (penalties)
    this.negativePatterns = [
      {
        pattern: /login|signin|sign-in|auth|authenticate/i,
        category: URLCategory.ADMINISTRATIVE,
        score: -35,
        confidence: 0.95,
        description: 'Login and authentication pages'
      },
      {
        pattern: /signup|sign-up|register|registration|join/i,
        category: URLCategory.ADMINISTRATIVE,
        score: -35,
        confidence: 0.95,
        description: 'Registration and signup pages'
      },
      {
        pattern: /cookie|privacy|terms|legal|gdpr|ccpa/i,
        category: URLCategory.ADMINISTRATIVE,
        score: -30,
        confidence: 0.9,
        description: 'Legal and privacy pages'
      },
      {
        pattern: /admin|dashboard|settings|config|manage/i,
        category: URLCategory.ADMINISTRATIVE,
        score: -25,
        confidence: 0.85,
        description: 'Administrative and management pages'
      },
      {
        pattern: /\.(jpg|jpeg|png|gif|svg|pdf|mp4|mp3|avi|mov|zip|exe|dmg)$/i,
        category: URLCategory.MEDIA,
        score: -40,
        confidence: 0.98,
        description: 'Media files and downloads'
      },
      {
        pattern: /tracking|analytics|ads|advertisement|banner/i,
        category: URLCategory.IRRELEVANT,
        score: -30,
        confidence: 0.9,
        description: 'Tracking and advertising URLs'
      },
      {
        pattern: /404|error|not-found|maintenance|unavailable/i,
        category: URLCategory.IRRELEVANT,
        score: -50,
        confidence: 0.95,
        description: 'Error and maintenance pages'
      },
      {
        pattern: /logout|signout|sign-out|exit/i,
        category: URLCategory.ADMINISTRATIVE,
        score: -40,
        confidence: 0.9,
        description: 'Logout pages'
      }
    ];
  }

  /**
   * Initialize adaptive weights for contextual scoring
   */
  private initializeAdaptiveWeights(): void {
    this.adaptiveWeights.set('pricing_focus', 1.5);
    this.adaptiveWeights.set('features_focus', 1.3);
    this.adaptiveWeights.set('documentation_focus', 1.2);
    this.adaptiveWeights.set('reviews_focus', 1.1);
    this.adaptiveWeights.set('technical_focus', 1.4);
    this.adaptiveWeights.set('commercial_focus', 1.3);
  }

  /**
   * Find all patterns that match the given URL
   */
  private findMatchingPatterns(url: string): MatchedPattern[] {
    const matches: MatchedPattern[] = [];

    // Check positive patterns
    for (const pattern of this.positivePatterns) {
      if (pattern.pattern.test(url)) {
        matches.push({
          pattern: pattern.description,
          confidence: pattern.confidence,
          impact: pattern.score
        });
      }
    }

    // Check negative patterns
    for (const pattern of this.negativePatterns) {
      if (pattern.pattern.test(url)) {
        matches.push({
          pattern: pattern.description,
          confidence: pattern.confidence,
          impact: pattern.score
        });
      }
    }

    return matches;
  }

  /**
   * Calculate keyword-based boost for URL scoring
   */
  private calculateKeywordBoost(url: string, taskKeywords: string[]): number {
    let boost = 0;
    const urlLower = url.toLowerCase();

    for (const keyword of taskKeywords) {
      const keywordLower = keyword.toLowerCase();

      if (urlLower.includes(keywordLower)) {
        // Base keyword match boost
        boost += 15;

        // Additional boost for exact matches in path segments
        const pathSegments = url.split('/');
        for (const segment of pathSegments) {
          if (segment.toLowerCase() === keywordLower) {
            boost += 10;
            break;
          }
        }

        // Additional boost for keyword in domain
        const domain = this.extractDomain(url);
        if (domain.toLowerCase().includes(keywordLower)) {
          boost += 8;
        }
      }
    }

    return Math.min(boost, 50); // Cap keyword boost at 50 points
  }

  /**
   * Apply contextual adaptation based on research context
   */
  private applyContextualAdaptation(
    baseScore: number,
    url: string,
    context: ResearchContext
  ): number {
    let adaptedScore = baseScore;

    // Apply goal-based adaptations
    for (const goal of context.goals) {
      const goalLower = goal.toLowerCase();

      if (goalLower.includes('pricing') && this.isPricingURL(url)) {
        adaptedScore *= this.adaptiveWeights.get('pricing_focus') || 1.0;
      } else if (goalLower.includes('features') && this.isFeaturesURL(url)) {
        adaptedScore *= this.adaptiveWeights.get('features_focus') || 1.0;
      } else if (goalLower.includes('documentation') && this.isDocumentationURL(url)) {
        adaptedScore *= this.adaptiveWeights.get('documentation_focus') || 1.0;
      } else if (goalLower.includes('review') && this.isReviewURL(url)) {
        adaptedScore *= this.adaptiveWeights.get('reviews_focus') || 1.0;
      }
    }

    // Apply phase-based adaptations
    switch (context.currentPhase) {
      case 'discovery':
        // Boost general product and feature pages during discovery
        if (this.isProductURL(url) || this.isFeaturesURL(url)) {
          adaptedScore *= 1.2;
        }
        break;
      case 'analysis':
        // Boost detailed documentation and comparison pages during analysis
        if (this.isDocumentationURL(url) || this.isReviewURL(url)) {
          adaptedScore *= 1.3;
        }
        break;
      case 'validation':
        // Boost authoritative sources during validation
        if (this.isAuthoritativeSource(url)) {
          adaptedScore *= 1.4;
        }
        break;
    }

    return Math.min(100, adaptedScore);
  }

  /**
   * Determine processing level based on score and category
   */
  private determineProcessingLevel(score: number, category: URLCategory): ProcessingLevel {
    // Skip processing for very low scores or irrelevant categories
    if (score < 20 || category === URLCategory.IRRELEVANT || category === URLCategory.MEDIA) {
      return ProcessingLevel.SKIP;
    }

    // Use heuristic-only for administrative pages
    if (category === URLCategory.ADMINISTRATIVE) {
      return ProcessingLevel.HEURISTIC_ONLY;
    }

    // Use deep AI for high-value content
    if (score >= 70 && (
      category === URLCategory.PRICING ||
      category === URLCategory.FEATURES ||
      category === URLCategory.DOCUMENTATION
    )) {
      return ProcessingLevel.DEEP_AI;
    }

    // Use light AI for moderate scores
    if (score >= 40) {
      return ProcessingLevel.LIGHT_AI;
    }

    // Default to heuristic-only for low scores
    return ProcessingLevel.HEURISTIC_ONLY;
  }

  /**
   * Update pattern confidence based on learning outcomes
   */
  private updatePatternConfidence(
    patternString: string,
    newConfidence: number,
    wasSuccessful: boolean
  ): void {
    // Find and update matching patterns
    const allPatterns = [...this.positivePatterns, ...this.negativePatterns];

    for (const pattern of allPatterns) {
      if (pattern.pattern.source.includes(patternString) ||
          pattern.description.toLowerCase().includes(patternString.toLowerCase())) {

        // Adjust confidence based on success/failure
        const adjustment = wasSuccessful ? 0.05 : -0.03;
        pattern.confidence = Math.max(0.1, Math.min(1.0, pattern.confidence + adjustment));

        // Update pattern in our internal storage
        this.patterns.set(patternString, {
          pattern: patternString,
          confidence: pattern.confidence,
          impact: pattern.score
        });
      }
    }
  }

  /**
   * Helper methods for URL category detection
   */
  private determineURLCategory(url: string): URLCategory {
    const urlLower = url.toLowerCase();

    // Check positive patterns first (more specific)
    for (const pattern of this.positivePatterns) {
      if (pattern.pattern.test(url)) {
        return pattern.category;
      }
    }

    // Check negative patterns
    for (const pattern of this.negativePatterns) {
      if (pattern.pattern.test(url)) {
        return pattern.category;
      }
    }

    // Fallback to basic categorization
    if (urlLower.includes('pricing') || urlLower.includes('price')) {
      return URLCategory.PRICING;
    }
    if (urlLower.includes('features') || urlLower.includes('capabilities')) {
      return URLCategory.FEATURES;
    }
    if (urlLower.includes('docs') || urlLower.includes('documentation')) {
      return URLCategory.DOCUMENTATION;
    }
    if (urlLower.includes('review') || urlLower.includes('rating')) {
      return URLCategory.REVIEWS;
    }
    if (urlLower.includes('product') || urlLower.includes('service')) {
      return URLCategory.PRODUCT;
    }
    if (urlLower.includes('admin') || urlLower.includes('login')) {
      return URLCategory.ADMINISTRATIVE;
    }
    if (urlLower.match(/\.(jpg|jpeg|png|gif|pdf|mp4|mp3)$/)) {
      return URLCategory.MEDIA;
    }

    return URLCategory.IRRELEVANT;
  }
  private isPricingURL(url: string): boolean {
    return /pricing|price|cost|plan|subscription|billing/i.test(url);
  }

  private isFeaturesURL(url: string): boolean {
    return /features|capabilities|functionality|benefits|specs/i.test(url);
  }

  private isDocumentationURL(url: string): boolean {
    return /docs|documentation|guide|tutorial|help|api/i.test(url);
  }

  private isReviewURL(url: string): boolean {
    return /review|rating|testimonial|feedback|comparison/i.test(url);
  }

  private isProductURL(url: string): boolean {
    return /product|service|solution|offering|tool/i.test(url);
  }

  private isAuthoritativeSource(url: string): boolean {
    const domain = this.extractDomain(url);
    const authoritativeDomains = [
      'github.com', 'stackoverflow.com', 'docs.microsoft.com',
      'developer.mozilla.org', 'aws.amazon.com', 'cloud.google.com'
    ];

    return authoritativeDomains.some(authDomain => domain.includes(authDomain));
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      // Fallback for malformed URLs
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1].toLowerCase() : '';
    }
  }

  /**
   * Assess risk level based on URL and score
   */
  private assessRisk(url: string, score: number): RiskLevel {
    // High risk for very low scores or suspicious patterns
    if (score < 20 || /malware|phishing|spam|suspicious/i.test(url)) {
      return RiskLevel.HIGH;
    }

    // Medium risk for administrative or unknown domains
    if (score < 50 || this.isAdministrativeURL(url) || this.isUnknownDomain(url)) {
      return RiskLevel.MEDIUM;
    }

    return RiskLevel.LOW;
  }

  private isAdministrativeURL(url: string): boolean {
    return /admin|login|signup|auth|manage|dashboard/i.test(url);
  }

  private isUnknownDomain(url: string): boolean {
    const domain = this.extractDomain(url);
    // Simple heuristic: domains with unusual TLDs or very short names might be riskier
    return domain.length < 4 || /\.(tk|ml|ga|cf)$/.test(domain);
  }
}

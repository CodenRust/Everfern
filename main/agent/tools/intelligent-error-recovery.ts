/**
 * Intelligent Error Recovery and Graceful Degradation
 *
 * Implements error handling strategies for intelligent site selection,
 * including fallback mechanisms, retry logic, and circuit breaker patterns.
 *
 * Requirements: 8.1, 8.2
 */

import {
  RelevanceAssessment,
  URLClassification,
  ResearchContext,
  PageContent,
  SiteEvaluation,
  NavigationPlan
} from './intelligent-site-selection';

/**
 * Error recovery strategies
 */
export enum ErrorRecoveryStrategy {
  USE_HEURISTICS = 'heuristics',
  USE_CACHED_ASSESSMENT = 'cached',
  USE_DEFAULT_SCORING = 'default',
  SKIP_INTELLIGENT_ANALYSIS = 'skip'
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult<T> {
  success: boolean;
  value?: T;
  fallbackUsed: boolean;
  strategy: ErrorRecoveryStrategy;
  error?: Error;
  message: string;
}

/**
 * Circuit breaker for managing persistent failures
 *
 * Requirements: 8.1, 8.2
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;

  constructor(
    failureThreshold: number = 5,
    successThreshold: number = 2,
    timeout: number = 60000 // 1 minute
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
  }

  /**
   * Record a failure
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  /**
   * Record a success
   */
  recordSuccess(): void {
    this.successCount++;

    if (this.state === CircuitBreakerState.HALF_OPEN && this.successCount >= this.successThreshold) {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.successCount = 0;
    }
  }

  /**
   * Check if circuit breaker allows operation
   */
  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }

    if (this.state === CircuitBreakerState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state
    return true;
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration with exponential backoff
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Retry mechanism with exponential backoff
 *
 * Requirements: 8.1, 8.2
 */
export class RetryMechanism {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<ErrorRecoveryResult<T>> {
    let lastError: Error | null = null;
    let delay = this.config.initialDelayMs;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          value: result,
          fallbackUsed: false,
          strategy: ErrorRecoveryStrategy.USE_HEURISTICS,
          message: `${operationName} succeeded on attempt ${attempt}`
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`${operationName} failed on attempt ${attempt}: ${lastError.message}`);

        if (attempt < this.config.maxAttempts) {
          // Wait before retrying
          await this.sleep(delay);
          delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelayMs);
        }
      }
    }

    return {
      success: false,
      fallbackUsed: false,
      strategy: ErrorRecoveryStrategy.USE_HEURISTICS,
      error: lastError || undefined,
      message: `${operationName} failed after ${this.config.maxAttempts} attempts`
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Intelligent error recovery system
 *
 * Requirements: 8.1, 8.2
 */
export class IntelligentErrorRecovery {
  private circuitBreaker: CircuitBreaker;
  private retryMechanism: RetryMechanism;
  private fallbackCache: Map<string, any> = new Map();

  constructor(
    circuitBreakerConfig?: {
      failureThreshold?: number;
      successThreshold?: number;
      timeout?: number;
    },
    retryConfig?: Partial<RetryConfig>
  ) {
    this.circuitBreaker = new CircuitBreaker(
      circuitBreakerConfig?.failureThreshold,
      circuitBreakerConfig?.successThreshold,
      circuitBreakerConfig?.timeout
    );
    this.retryMechanism = new RetryMechanism(retryConfig);
  }

  /**
   * Handle relevance assessment failure with fallback
   *
   * Requirements: 8.1
   */
  async handleRelevanceAssessmentFailure(
    error: Error,
    fallbackStrategy: ErrorRecoveryStrategy,
    content?: PageContent,
    context?: ResearchContext
  ): Promise<ErrorRecoveryResult<RelevanceAssessment>> {
    console.warn('Relevance assessment failed:', error.message);

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        fallbackUsed: true,
        strategy: ErrorRecoveryStrategy.SKIP_INTELLIGENT_ANALYSIS,
        error,
        message: 'Circuit breaker open - skipping intelligent analysis'
      };
    }

    this.circuitBreaker.recordFailure();

    // Try fallback strategies
    switch (fallbackStrategy) {
      case ErrorRecoveryStrategy.USE_CACHED_ASSESSMENT:
        const cached = this.fallbackCache.get(`relevance_${content?.url}`);
        if (cached) {
          this.circuitBreaker.recordSuccess();
          return {
            success: true,
            value: cached,
            fallbackUsed: true,
            strategy: ErrorRecoveryStrategy.USE_CACHED_ASSESSMENT,
            message: 'Using cached relevance assessment'
          };
        }
        // Fall through to default

      case ErrorRecoveryStrategy.USE_DEFAULT_SCORING:
        const defaultAssessment = this.createDefaultRelevanceAssessment(content, context);
        this.circuitBreaker.recordSuccess();
        return {
          success: true,
          value: defaultAssessment,
          fallbackUsed: true,
          strategy: ErrorRecoveryStrategy.USE_DEFAULT_SCORING,
          message: 'Using default relevance assessment'
        };

      case ErrorRecoveryStrategy.USE_HEURISTICS:
        const heuristicAssessment = this.createHeuristicRelevanceAssessment(content, context);
        this.circuitBreaker.recordSuccess();
        return {
          success: true,
          value: heuristicAssessment,
          fallbackUsed: true,
          strategy: ErrorRecoveryStrategy.USE_HEURISTICS,
          message: 'Using heuristic relevance assessment'
        };

      default:
        return {
          success: false,
          fallbackUsed: false,
          strategy: ErrorRecoveryStrategy.SKIP_INTELLIGENT_ANALYSIS,
          error,
          message: 'No fallback strategy available'
        };
    }
  }

  /**
   * Handle navigation decision failure with fallback
   *
   * Requirements: 8.1, 8.2
   */
  async handleNavigationDecisionFailure(
    error: Error,
    context: ResearchContext
  ): Promise<ErrorRecoveryResult<NavigationPlan>> {
    console.warn('Navigation decision failed:', error.message);

    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        fallbackUsed: true,
        strategy: ErrorRecoveryStrategy.SKIP_INTELLIGENT_ANALYSIS,
        error,
        message: 'Circuit breaker open - using default navigation'
      };
    }

    this.circuitBreaker.recordFailure();

    // Create default navigation plan
    const defaultPlan: NavigationPlan = {
      primaryTargets: [],
      secondaryTargets: [],
      avoidanceList: [],
      reasoning: 'Default navigation plan due to error',
      confidence: 0.3
    };

    this.circuitBreaker.recordSuccess();
    return {
      success: true,
      value: defaultPlan,
      fallbackUsed: true,
      strategy: ErrorRecoveryStrategy.USE_DEFAULT_SCORING,
      message: 'Using default navigation plan'
    };
  }

  /**
   * Handle learning system failure
   *
   * Requirements: 8.1
   */
  handleLearningSystemFailure(error: Error): void {
    console.warn('Learning system failure:', error.message);
    this.circuitBreaker.recordFailure();

    // Learning system failures should not block research
    // Just log and continue
  }

  /**
   * Handle cache failure
   *
   * Requirements: 8.1
   */
  handleCacheFailure(error: Error, operation: string): void {
    console.warn(`Cache operation failed (${operation}):`, error.message);
    // Cache failures should not block research
    // Continue without caching
  }

  /**
   * Create default relevance assessment
   */
  private createDefaultRelevanceAssessment(
    content?: PageContent,
    context?: ResearchContext
  ): RelevanceAssessment {
    return {
      overallScore: 50,
      categoryScores: {
        pricing: 50,
        features: 50,
        documentation: 50,
        reviews: 50,
        technical: 50,
        competitive: 50
      },
      contentQuality: 0.5,
      informationDensity: 0.5,
      uniquenessScore: 0.5,
      contextualFit: 0.5
    };
  }

  /**
   * Create heuristic relevance assessment
   */
  private createHeuristicRelevanceAssessment(
    content?: PageContent,
    context?: ResearchContext
  ): RelevanceAssessment {
    let score = 50;

    if (content) {
      // Simple heuristic scoring
      if (content.title && context?.keywords.some(kw => content.title.toLowerCase().includes(kw))) {
        score += 20;
      }
      if (content.metaDescription && context?.keywords.some(kw => content.metaDescription.toLowerCase().includes(kw))) {
        score += 15;
      }
      if (content.structuredData) {
        score += 10;
      }
    }

    return {
      overallScore: Math.min(100, score),
      categoryScores: {
        pricing: score,
        features: score,
        documentation: score,
        reviews: score,
        technical: score,
        competitive: score
      },
      contentQuality: Math.min(1, score / 100),
      informationDensity: 0.6,
      uniquenessScore: 0.5,
      contextualFit: 0.5
    };
  }

  /**
   * Cache fallback value
   */
  cacheFallbackValue(key: string, value: any): void {
    this.fallbackCache.set(key, value);

    // Keep cache size manageable
    if (this.fallbackCache.size > 100) {
      const firstKey = this.fallbackCache.keys().next().value;
      if (firstKey) this.fallbackCache.delete(firstKey);
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset error recovery system
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.fallbackCache.clear();
  }
}

/**
 * Create error recovery system
 */
export function createErrorRecoverySystem(
  circuitBreakerConfig?: {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
  },
  retryConfig?: Partial<RetryConfig>
): IntelligentErrorRecovery {
  return new IntelligentErrorRecovery(circuitBreakerConfig, retryConfig);
}

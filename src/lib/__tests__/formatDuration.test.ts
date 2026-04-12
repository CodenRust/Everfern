import { describe, it, expect } from 'vitest';
import { formatDuration } from '../formatDuration';

describe('formatDuration', () => {
  describe('durations less than 60 seconds', () => {
    it('should format 5000ms (5s) as "5.0s"', () => {
      expect(formatDuration(5000)).toBe('5.0s');
    });

    it('should format 30500ms (30.5s) as "30.5s"', () => {
      expect(formatDuration(30500)).toBe('30.5s');
    });

    it('should format 59999ms (59.999s) as "60.0s"', () => {
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format with 1 decimal place', () => {
      expect(formatDuration(12345)).toBe('12.3s');
    });
  });

  describe('durations between 60 seconds and 1 hour', () => {
    it('should format 60000ms (1m) as "1m 0s"', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
    });

    it('should format 90000ms (1m 30s) as "1m 30s"', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
    });

    it('should format 217500ms (3m 37s) as "3m 37s"', () => {
      expect(formatDuration(217500)).toBe('3m 37s');
    });

    it('should format 3599000ms (59m 59s) as "59m 59s"', () => {
      expect(formatDuration(3599000)).toBe('59m 59s');
    });
  });

  describe('durations 1 hour or more', () => {
    it('should format 3600000ms (1h) as "1h 0m"', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
    });

    it('should format 3660000ms (1h 1m) as "1h 1m"', () => {
      expect(formatDuration(3660000)).toBe('1h 1m');
    });

    it('should format 7200000ms (2h) as "2h 0m"', () => {
      expect(formatDuration(7200000)).toBe('2h 0m');
    });

    it('should format 86400000ms (24h) as "24h 0m"', () => {
      expect(formatDuration(86400000)).toBe('24h 0m');
    });

    it('should format 90060000ms (25h 1m) as "25h 1m"', () => {
      expect(formatDuration(90060000)).toBe('25h 1m');
    });
  });

  describe('edge cases and invalid values', () => {
    it('should return fallback text for zero (per Requirement 2.5)', () => {
      expect(formatDuration(0)).toBe('Thought for a moment');
    });

    it('should return fallback text for undefined', () => {
      expect(formatDuration(undefined)).toBe('Thought for a moment');
    });

    it('should return fallback text for negative values', () => {
      expect(formatDuration(-100)).toBe('Thought for a moment');
      expect(formatDuration(-5000)).toBe('Thought for a moment');
    });

    it('should return fallback text for NaN', () => {
      expect(formatDuration(NaN)).toBe('Thought for a moment');
    });

    it('should return fallback text for null (type coercion)', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(formatDuration(null)).toBe('Thought for a moment');
    });

    it('should handle very large durations (days)', () => {
      // 2 days = 172800000ms = 2880 minutes = 48 hours
      expect(formatDuration(172800000)).toBe('48h 0m');
    });

    it('should handle fractional seconds correctly', () => {
      // 1234ms = 1.234s should round to 1.2s
      expect(formatDuration(1234)).toBe('1.2s');
    });
  });

  describe('consistency', () => {
    it('should produce identical output for the same input', () => {
      const duration = 123456;
      const result1 = formatDuration(duration);
      const result2 = formatDuration(duration);
      const result3 = formatDuration(duration);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});

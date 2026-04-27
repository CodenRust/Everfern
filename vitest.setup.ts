import '@testing-library/jest-dom';
import { expect } from 'vitest';

// Extend Vitest matchers with custom toBeOneOf
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeOneOf(options: any[]): T;
  }
  interface AsymmetricMatchersContaining {
    toBeOneOf(options: any[]): any;
  }
}

// Custom matcher for checking if a value is one of the provided options
expect.extend({
  toBeOneOf(received: any, options: any[]) {
    const pass = options.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${JSON.stringify(options)}`
          : `expected ${received} to be one of ${JSON.stringify(options)}`
    };
  }
});

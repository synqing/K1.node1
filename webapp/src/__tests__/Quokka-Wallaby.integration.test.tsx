import { describe, it, expect } from '@jest/globals';

/**
 * Integration Test: Demonstrates Wallaby + Quokka workflow
 * - Wallaby shows real-time pass/fail status on this file
 * - Quokka can import and inspect individual functions/components separately
 */

describe('Quokka + Wallaby Integration', () => {
  it('demonstrates real-time test feedback', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  it('encourages TDD red-green-refactor', () => {
    const values = [1, 2, 3];
    expect(values.reduce((a, b) => a + b, 0)).toBe(6);
  });
});


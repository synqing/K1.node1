import { describe, expect, it } from '@jest/globals';
import { generatePerformanceMetrics } from './mockData';

describe('generatePerformanceMetrics', () => {
  it('returns metrics within expected ranges', () => {
    const snapshot = generatePerformanceMetrics('Spectrum');

    expect(snapshot.fps).toBeGreaterThanOrEqual(55);
    expect(snapshot.fps).toBeLessThanOrEqual(65);
    expect(snapshot.frameTime).toBeGreaterThan(14);
    expect(snapshot.frameTime).toBeLessThan(20);
    expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
  });
});


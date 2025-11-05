// Quokka Sandbox: Live debugging environment
// Run Quokka on this file to explore helper logic with instant feedback.

import { generatePerformanceMetrics } from '@/lib/mockData';

const modes = ['Spectrum', 'Analog', 'Bass'] as const;

modes.forEach((m) => {
  const metrics = generatePerformanceMetrics(m);
  console.log(`[${m}] fps:`, metrics.fps, 'cpu:', metrics.cpuUsage);
});

// Example: quick assertion-like checks
const sample = generatePerformanceMetrics('Spectrum');
console.log('FPS in expected range (50-70):', sample.fps >= 50 && sample.fps <= 70);


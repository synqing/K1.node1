import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock env and overrides to ensure module import stability
jest.mock('../lib/env', () => ({
  getEnvSafe: () => ({ MODE: 'development', DEV: true, VITE_SHOW_DEV_WIDGET: '1' }),
}));

jest.mock('../lib/analysisClient', () => ({
  k1ApiClient: { getBaseUrl: () => 'http://localhost/api' },
}));

jest.mock('../config/overrides', () => ({
  useRtpOverrides: () => [{ }],
  getEffectiveRtpConfig: () => ({
    coalesceDelayMs: 50,
    coalesceMaxWaitMs: 200,
    leadingEdge: true,
    persistSaveDelayMs: 100,
  }),
}));

describe('DiagnosticsView component', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('can be imported and instantiated as a React element', async () => {
    const mod = await import('../components/views/DiagnosticsView');
    expect(typeof mod.DiagnosticsView).toBe('function');

    const connectionState = { connected: true, deviceIp: '127.0.0.1', serialPort: '' } as const;
    const el = React.createElement(mod.DiagnosticsView, { connectionState });
    expect(el.type).toBe(mod.DiagnosticsView);
    expect(el.props.connectionState.connected).toBe(true);
  });

  it('buildDiagnosticsReport returns stable JSON fields', async () => {
    const mod = await import('../components/views/DiagnosticsView');
    const connectionState = { connected: true, deviceIp: '127.0.0.1', serialPort: '' } as const;
    const env = { MODE: 'development', DEV: true, VITE_SHOW_DEV_WIDGET: '1' } as const;
    const baseUrl = 'http://localhost/api';
    const effective = {
      coalesceDelayMs: 50,
      coalesceMaxWaitMs: 200,
      leadingEdge: true,
      persistSaveDelayMs: 100,
    };

    const report = mod.buildDiagnosticsReport(connectionState, env, baseUrl, effective);
    expect(report.environment.MODE).toBe('development');
    expect(report.analysisApiBaseUrl).toBe('http://localhost/api');
    expect(report.connectionState.connected).toBe(true);
    expect(report.rtpEffective).toMatchObject({
      coalesceDelayMs: 50,
      coalesceMaxWaitMs: 200,
      leadingEdge: true,
      persistSaveDelayMs: 100,
    });
    expect(typeof report.generatedAt).toBe('string');
  });
});

import type { EnvLike } from '../lib/env';

describe('analysisClient base URL resolution', () => {
  const mockEnvModulePath = '../lib/env';

  beforeEach(() => {
    jest.resetModules();
  });

  it('uses VITE_ANALYSIS_API_BASE_URL when provided', async () => {
    jest.doMock(mockEnvModulePath, () => ({
      getEnvSafe: () => ({ VITE_ANALYSIS_API_BASE_URL: 'https://analysis.example.com/v1' } as EnvLike),
    }));

    const client = await import('../lib/analysisClient');
    expect(client.analysisApiBaseUrl).toBe('https://analysis.example.com/v1');
    expect(client.k1ApiClient.getBaseUrl()).toBe('https://analysis.example.com/v1');
  });
    jest.doMock(mockEnvModulePath, () => ({
      getEnvSafe: () => ({ VITE_ANALYSIS_API_BASE_URL: 'https://analysis.example.com/v1' } as EnvLike),
    }));

    const client = await import('../lib/analysisClient');
    expect(client.analysisApiBaseUrl).toBe('https://analysis.example.com/v1');
    expect(client.k1ApiClient.getBaseUrl()).toBe('https://analysis.example.com/v1');
  });

  it('falls back to same-origin /api/v1 when env not set', async () => {
    jest.doMock(mockEnvModulePath, () => ({
      getEnvSafe: () => (undefined as EnvLike),
    }));

    const client = await import('../lib/analysisClient');
    // In JSDOM, window.location.origin is available
    const expected = new URL('/api/v1', window.location.origin).toString();
    expect(client.analysisApiBaseUrl).toBe(expected);
    expect(client.k1ApiClient.getBaseUrl()).toBe(expected);
  });
});


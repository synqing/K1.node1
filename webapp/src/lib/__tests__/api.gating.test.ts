import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getParams, postParams } from '../api';

function makeResponse(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    type: 'default',
    json: async () => body,
  } as any;
}

describe('API GET/POST gating for /api/params', () => {
  const ip = '192.168.1.103';
  let fetchMock: any;
  const calls: { method: string; url: string; at: number }[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    calls.length = 0;
    fetchMock = jest.fn((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = (init?.method || 'GET').toUpperCase();
      calls.push({ method, url, at: Date.now() });
      if (method === 'POST' && url.includes('/api/params')) {
        // Delay POST by 50ms to simulate processing
        return new Promise((resolve) => {
          setTimeout(() => resolve(makeResponse(200, { ok: true })), 50);
        });
      }
      if (method === 'GET' && url.includes('/api/params')) {
        // Immediate response
        return Promise.resolve(makeResponse(200, { brightness: 0.5 }));
      }
      // Default: 200
      return Promise.resolve(makeResponse(200, {}));
    });
    // @ts-ignore
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defers GET /api/params while POST is in flight', async () => {
    // Start POST and GET nearly simultaneously
    const postP = postParams(ip, { brightness: 0.5 });
    const getP = getParams(ip);

    // Initially only POST should have been invoked
    expect(calls.filter(c => c.method === 'POST').length).toBe(1);
    expect(calls.filter(c => c.method === 'GET').length).toBe(0);

    // Advance time to just before POST completes
    jest.advanceTimersByTime(40);
    expect(calls.filter(c => c.method === 'GET').length).toBe(0);

    // Complete POST
    jest.advanceTimersByTime(20);
    await postP; // ensure POST resolved and gate released

    // Allow gate poll to proceed
    jest.advanceTimersByTime(40);

    // Now GET should be issued
    expect(calls.filter(c => c.method === 'GET').length).toBe(1);

    const params = await getP;
    expect(params).toEqual(expect.objectContaining({ brightness: 0.5 }));
  });
});


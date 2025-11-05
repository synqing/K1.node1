// Simple API client for K1 firmware endpoints
// Base URL is built from device IP (e.g., http://192.168.1.100)

export type FirmwarePattern = {
  index: number;
  id: string;
  name: string;
  description?: string;
  is_audio_reactive?: boolean;
};

export type FirmwarePalette = {
  id: number;
  name: string;
  colors: Array<{ r: number; g: number; b: number }>;
  keyframes?: number;
};

export type FirmwareParams = {
  brightness: number;
  softness: number;
  color: number;
  color_range?: number;
  saturation: number;
  warmth: number;
  background: number;
  dithering?: number;
  speed: number;
  palette_id: number;
  custom_param_1?: number;
  custom_param_2?: number;
  custom_param_3?: number;
};

function base(ip: string) {
  const trimmed = (ip || '').trim();
  if (!trimmed) throw new Error('Device IP not set');
  // If ip already includes protocol, respect it
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `http://${trimmed.replace(/\/+$/, '')}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// Lightweight fetch with timeout for connectivity checks
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function getPatterns(ip: string): Promise<{ patterns: FirmwarePattern[]; current_pattern: number } | FirmwarePattern[] > {
  // Some builds may return array only; handle both shapes
  const data = await getJson<any>(`${base(ip)}/api/patterns`);
  return data;
}

export async function getParams(ip: string): Promise<FirmwareParams> {
  // Gate GET /api/params to avoid colliding with an in-flight POST
  const url = `${base(ip)}/api/params`;
  if (postInFlight && postDonePromise) {
    await postDonePromise;
  }
  return getJson<FirmwareParams>(url);
}

export async function getPalettes(ip: string): Promise<FirmwarePalette[] | { palettes: FirmwarePalette[] }> {
  const data = await getJson<any>(`${base(ip)}/api/palettes`);
  return data;
}



export interface FirmwareMutationResult<T = undefined> {
  ok: boolean;
  confirmed: boolean;
  status?: number;
  data?: T;
  fallback?: 'no-cors';
}

async function handleJsonMutation<T>(
  url: string,
  options: RequestInit & { body: string },
): Promise<FirmwareMutationResult<T>> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const confirmed = res.type !== 'opaque';
  let data: T | undefined;
  try {
    data = (await res.json()) as T;
  } catch {
    data = undefined;
  }

  return {
    ok: true,
    confirmed,
    status: res.status,
    data,
  };
}

async function sendWithoutCors(url: string, body: string): Promise<void> {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    body,
  });
}

// GET/POST interference gate for /api/params
let activeParamsPost = 0;
let postInFlight = false;
let postDoneResolver: (() => void) | null = null;
let postDonePromise: Promise<void> | null = null;

export async function postParams(
  ip: string,
  partial: Partial<FirmwareParams>,
): Promise<FirmwareMutationResult<FirmwareParams>> {
  activeParamsPost++;
  if (!postInFlight) {
    postInFlight = true;
    postDonePromise = new Promise<void>((resolve) => {
      postDoneResolver = resolve;
    });
  }
  try {
    return await handleJsonMutation<FirmwareParams>(`${base(ip)}/api/params`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  } catch (err: any) {
    const msg = err && err.message ? String(err.message) : '';
    const isNetwork = msg.toLowerCase().includes('failed to fetch');
    if (!isNetwork) throw err;
    // Fallback: try sending without CORS-sensitive headers
    try {
      await sendWithoutCors(`${base(ip)}/api/params`, JSON.stringify(partial));
      return { ok: true, confirmed: false, fallback: 'no-cors' };
    } catch (err2) {
      throw err;
    }
  } finally {
    activeParamsPost = Math.max(0, activeParamsPost - 1);
    if (activeParamsPost === 0) {
      postInFlight = false;
      if (postDoneResolver) {
        try { postDoneResolver(); } catch {}
      }
      postDoneResolver = null;
      postDonePromise = null;
    }
  }
}

export async function postSelect(
  ip: string,
  opts: { id?: string; index?: number },
): Promise<FirmwareMutationResult<{ ok: boolean }>> {
  try {
    return await handleJsonMutation<{ ok: boolean }>(`${base(ip)}/api/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
  } catch (err: any) {
    const msg = err && err.message ? String(err.message) : '';
    const isNetwork = msg.toLowerCase().includes('failed to fetch');
    if (!isNetwork) throw err;
    // Fallback: attempt opaque request without CORS-preflight or headers; response cannot be read
    try {
      await sendWithoutCors(`${base(ip)}/api/select`, JSON.stringify(opts));
      return { ok: true, confirmed: false, fallback: 'no-cors' };
    } catch (err2) {
      throw err;
    }
  }
}

// Audio configuration
export type FirmwareAudioConfig = {
  microphone_gain: number;
  vu_floor_pct?: number;
  active?: boolean;
};

export async function getAudioConfig(ip: string): Promise<FirmwareAudioConfig> {
  return getJson<FirmwareAudioConfig>(`${base(ip)}/api/audio-config`);
}

export async function postAudioConfig(
  ip: string,
  partial: Partial<FirmwareAudioConfig>,
): Promise<FirmwareMutationResult<FirmwareAudioConfig | { ok: boolean }>> {
  try {
    return await handleJsonMutation<FirmwareAudioConfig | { ok: boolean }>(
      `${base(ip)}/api/audio-config`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      },
    );
  } catch (err: any) {
    const msg = err && err.message ? String(err.message) : '';
    const isNetwork = msg.toLowerCase().includes('failed to fetch');
    if (!isNetwork) throw err;
    // Fallback: opaque request
    try {
      await sendWithoutCors(`${base(ip)}/api/audio-config`, JSON.stringify(partial));
      return { ok: true, confirmed: false, fallback: 'no-cors' };
    } catch (err2) {
      throw err;
    }
  }
}

// Audio noise calibration
export async function postAudioNoiseCalibrate(ip: string): Promise<FirmwareMutationResult<{ status?: string }>> {
  const candidates = [
    '/api/audio/noise-calibrate', // current
    '/api/audio/noise/calibrate', // legacy alt
    '/api/calibrate_noise',       // legacy
  ];

  // Try with readable response first to detect 404 and parse JSON
  for (let i = 0; i < candidates.length; i++) {
    const url = `${base(ip)}${candidates[i]}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const confirmed = res.type !== 'opaque';
        let data: { status?: string } | undefined;
        try { data = await res.json(); } catch { data = undefined; }
        return { ok: true, confirmed, status: res.status, data };
      }
      // If explicit 404, continue to next candidate
      if (res.status === 404) {
        continue;
      }
      // For other HTTP errors, throw to outer catch of this attempt
      throw new Error(`Request failed: ${res.status}`);
    } catch (err: any) {
      const msg = err && err.message ? String(err.message) : '';
      const isNetwork = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror');
      if (!isNetwork) {
        // Non-network error (e.g., 5xx) — if not last candidate, try next; else rethrow
        if (i === candidates.length - 1) throw err;
        continue;
      }
      // Network/CORS path: try opaque no-cors for this candidate
      try {
        await sendWithoutCors(url, JSON.stringify({}));
        return { ok: true, confirmed: false, fallback: 'no-cors' };
      } catch {
        // Try next candidate on failure
        if (i === candidates.length - 1) throw err;
      }
    }
  }

  // If we exhaust all candidates without return, throw a 404-like error
  throw new Error('Request failed: 404');
}

export async function postDeployBundle(
  ip: string,
  payload: Record<string, unknown>,
): Promise<FirmwareMutationResult<{ ok?: boolean }>> {
  try {
    return await handleJsonMutation<{ ok?: boolean }>(`${base(ip)}/api/config/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    const msg = err && err.message ? String(err.message) : '';
    const isNetwork = msg.toLowerCase().includes('failed to fetch');
    if (!isNetwork) throw err;
    try {
      await sendWithoutCors(`${base(ip)}/api/config/restore`, JSON.stringify(payload));
      return { ok: true, confirmed: false, fallback: 'no-cors' };
    } catch (err2) {
      throw err;
    }
  }
}

// Performance metrics
export type FirmwarePerformanceMetrics = {
  fps: number;
  frame_time_us: number;
  cpu_percent: number;
  memory_percent: number;
  memory_free_kb: number;
  memory_total_kb: number;
  fps_history: number[];
};

export async function getPerformanceMetrics(ip: string): Promise<FirmwarePerformanceMetrics> {
  return getJson(`${base(ip)}/api/device/performance`);
}

// Test device connectivity using the dedicated firmware endpoint with a short timeout
export async function testConnection(ip: string): Promise<{ connected: boolean; error?: string }> {
  const url = `${base(ip)}/api/test-connection`;
  try {
    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) {
      return { connected: false, error: `HTTP ${res.status} on test-connection` };
    }
    try {
      const json = await res.json();
      if (json && json.status === 'ok') return { connected: true };
      return { connected: false, error: 'Unexpected test-connection response' };
    } catch {
      // If response body isn’t readable for any reason, still treat 200 OK as connected
      return { connected: true };
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    const aborted = err?.name === 'AbortError' || msg.includes('AbortError') || msg.toLowerCase().includes('signal is aborted');
    if (aborted) {
      return { connected: false, error: 'Timeout reaching device (5s)' };
    }
    const isNetwork = msg.toLowerCase().includes('failed to fetch');
    return { connected: false, error: isNetwork ? 'Network error (device unreachable)' : msg };
  }
}

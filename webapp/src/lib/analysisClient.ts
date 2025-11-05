// Minimal local analysis client to avoid unresolved alias imports
// Prefer env override; otherwise use same-origin relative path so API hits the same port as the app
let baseUrl: string = (() => {
  const fallback =
    typeof window !== 'undefined'
      ? new URL('/api/v1', window.location.origin).toString()
      : '/api/v1';
  const fromEnv = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANALYSIS_API_BASE_URL) || undefined;
  return fromEnv || fallback;
})();

function resolve(path: string): string {
  try {
    const url = new URL(path, baseUrl);
    return url.toString();
  } catch {
    // If baseUrl is relative, fallback to simple concatenation
    return `${String(baseUrl).replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}

export const k1ApiClient = {
  getBaseUrl(): string {
    return baseUrl;
  },
  setBaseUrl(url: string): void {
    baseUrl = url;
  },
  async get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(resolve(path), init);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  },
  async post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const res = await fetch(resolve(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...init,
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    try {
      return (await res.json()) as T;
    } catch {
      return undefined as T;
    }
  },
};

export const analysisApiBaseUrl = baseUrl;

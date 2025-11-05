// Lightweight client for the local memory-proxy service
// Defaults to http://localhost:4001, override via VITE_MEMORY_PROXY

export type MemorySearchItem = {
  id: string | number;
  score: number;
  payload: Record<string, any>;
};

export type MemorySearchResponse = {
  results: MemorySearchItem[];
};

function baseUrl(): string {
  const envVal = (import.meta?.env?.VITE_MEMORY_PROXY as string) || '';
  const trimmed = envVal.trim();
  return trimmed || 'http://localhost:4001';
}

export async function searchMemories(query: string, limit: number = 5): Promise<MemorySearchItem[]> {
  const url = `${baseUrl()}/memory/search`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`memory search failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as MemorySearchResponse;
  return Array.isArray(data?.results) ? data.results : [];
}

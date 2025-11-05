import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { k1ApiClient } from '../lib/analysisClient';
// Fallbacks to ensure UI stays functional if API is unavailable
import { MOCK_TRACKS, MOCK_METRICS, MOCK_ACTIVITY, MOCK_ARTIFACTS } from '../components/analysis/mock-data';

// Types for analysis datasets
export interface Track {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  bpm?: number;
  fMeasure?: number;
  status: 'selected' | 'processing' | 'ready' | 'warning' | 'failed';
}

export interface MetricItem {
  label: string;
  value: string;
  delta?: string;
  tone?: 'positive' | 'neutral' | 'warning';
}

export interface ActivityItem {
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface ArtifactItem {
  name: string;
  type: string;
  size?: string; // human-readable size string
  age?: string;  // relative time string
  sha?: string;
  status?: 'active' | 'missing' | 'soft-deleted';
}

export interface TrackParams {
  status?: 'processing' | 'ready' | 'warning' | 'failed';
  preset?: string;
  search?: string;
  limit?: number; // default 20
  offset?: number; // default 0
}

export function useTracks(params: TrackParams = {}) {
  const queryKey = ['analysis', 'tracks', params] as const;
  return useQuery<Track[]>({
    queryKey,
    queryFn: async () => {
      try {
        const { status, preset, search, limit = 20, offset = 0 } = params;
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        if (preset) qs.set('preset', preset);
        if (search) qs.set('search', search);
        qs.set('limit', String(limit));
        qs.set('offset', String(offset));
        return await k1ApiClient.get<Track[]>(`/api/v1/tracks?${qs.toString()}`);
      } catch {
        return [...MOCK_TRACKS];
      }
    },
    placeholderData: (prev) => prev,
  });
}

export function useInfiniteTracks(params: Omit<TrackParams, 'offset'> = {}) {
  const baseKey = ['analysis', 'tracks', 'infinite', params] as const;
  return useInfiniteQuery<{ items: Track[]; total: number }>({
    queryKey: baseKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const { status, preset, search, limit = 20 } = params;
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        if (preset) qs.set('preset', preset);
        if (search) qs.set('search', search);
        qs.set('limit', String(limit));
        qs.set('offset', String(pageParam));
        return await k1ApiClient.get<{ items: Track[]; total: number }>(`/api/v1/tracks.page?${qs.toString()}`);
      } catch {
        return { items: [...MOCK_TRACKS], total: MOCK_TRACKS.length };
      }
    },
    getNextPageParam: (lastPage, pages) => {
      const fetched = pages.reduce((acc, p) => acc + p.items.length, 0);
      return fetched < lastPage.total ? fetched : undefined;
    },
    placeholderData: (prev) => prev,
  });
}

export function useMetrics() {
  return useQuery<MetricItem[]>({
    queryKey: ['analysis', 'metrics'],
    queryFn: async () => {
      try {
        return await k1ApiClient.get<MetricItem[]>('/api/v1/metrics');
      } catch {
        return [...MOCK_METRICS];
      }
    },
  });
}

export function useActivityLog() {
  return useQuery<ActivityItem[]>({
    queryKey: ['analysis', 'activity'],
    queryFn: async () => {
      try {
        return await k1ApiClient.get<ActivityItem[]>('/api/v1/activity');
      } catch {
        return [...MOCK_ACTIVITY];
      }
    },
  });
}

export function useArtifacts() {
  return useQuery<ArtifactItem[]>({
    queryKey: ['analysis', 'artefacts'],
    queryFn: async () => {
      try {
        return await k1ApiClient.get<ArtifactItem[]>(
          '/api/v1/tracks/current/versions/latest/artefacts'
        );
      } catch {
        return [...MOCK_ARTIFACTS];
      }
    },
  });
}

// Track detail and version hooks
export function useTrackDetail(trackId: string | undefined) {
  return useQuery<Track>({
    queryKey: ['analysis', 'track', trackId],
    queryFn: async () => {
      if (!trackId) throw new Error('trackId required');
      return await k1ApiClient.get<Track>(`/api/v1/tracks/${trackId}`);
    },
    enabled: !!trackId,
  });
}

export function useTrackVersion(trackId: string | undefined, version: number) {
  return useQuery<Track>({
    queryKey: ['analysis', 'track', trackId, 'version', version],
    queryFn: async () => {
      if (!trackId) throw new Error('trackId required');
      return await k1ApiClient.get<Track>(`/api/v1/tracks/${trackId}/versions/${version}`);
    },
    enabled: !!trackId && Number.isFinite(version),
  });
}

// SSE Telemetry hook using EventSource
export interface TelemetryEvent {
  trackId: string;
  seq: number;
  type: string;
  timestamp: number;
  message?: string;
}

export function useTelemetryStream(trackId: string | null | undefined) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // disconnect previous
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnected(false);
    setError(null);
    setEvents([]);

    if (!trackId) return;
    try {
      const base = k1ApiClient.getBaseUrl();
      const url = new URL(`/tracks/${trackId}/telemetry/stream`, base).toString();
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        setError('Telemetry stream error');
      };
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as TelemetryEvent;
          setEvents((prev) => (prev.length > 200 ? [...prev.slice(-200), data] : [...prev, data]));
        } catch {
          // ignore malformed events
        }
      };
    } catch (err) {
      setError('Failed to connect telemetry');
    }

    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [trackId]);

  return { connected, error, events } as const;
}

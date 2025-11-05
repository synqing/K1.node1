import { useQuery } from '@tanstack/react-query';
import { k1ApiClient } from '../lib/analysisClient';

export interface DeviceRecommendation {
  trackId: string;
  timestamp: string;
  expiresAt: string;
  recommendations: {
    brightness: {
      value: number;
      confidence: number;
    };
    saturation: {
      value: number;
      confidence: number;
    };
    speed: {
      value: number;
      confidence: number;
    };
    effect: {
      value: string;
      confidence: number;
    };
    palette_id: {
      value: number;
      confidence: number;
    };
  };
  analysis_metadata: {
    beat_count: number;
    dominant_frequency: number;
    energy_level: number;
    bpm: number;
    duration_ms: number;
  };
}

/**
 * Hook to fetch device recommendations for a track
 * Returns null if no recommendations are available yet
 */
export function useAnalysisRecommendations(trackId: string | null | undefined) {
  return useQuery<DeviceRecommendation | null>({
    queryKey: ['recommendations', trackId],
    queryFn: async () => {
      if (!trackId) return null;
      
      try {
        const response = await k1ApiClient.get<DeviceRecommendation>(
          `/tracks/${trackId}/recommendations`
        );
        return response;
      } catch (error: any) {
        // Return null for 404 (no recommendations yet)
        if (error.message?.includes('404')) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!trackId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry 404s (no recommendations available)
      if (error?.message?.includes('404')) {
        return false;
      }
      // Retry other errors up to 3 times
      return failureCount < 3;
    },
  });
}
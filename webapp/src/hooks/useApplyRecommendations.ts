import { useMutation } from '@tanstack/react-query';
import { k1ApiClient } from '../lib/analysisClient';
import { FirmwareParams } from '../lib/api';

interface ApplyRecommendationRequest {
  pattern_id?: string;
  brightness?: number;
  saturation?: number;
  speed?: number;
  palette_id?: number;
  effect?: string;
}

interface ApplyRecommendationResponse {
  success: boolean;
  device_id: string;
  applied_params: Record<string, any>;
  timestamp: string;
  message: string;
}

/**
 * Hook to apply analysis recommendations to device state via backend API.
 * Replaces local-only implementation with backend-integrated variant.
 */
export function useApplyRecommendations() {
  return useMutation<
    ApplyRecommendationResponse,
    Error,
    { deviceId: string; params: ApplyRecommendationRequest }
  >({
    mutationFn: async ({ deviceId, params }) => {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      try {
        const response = await k1ApiClient.post<ApplyRecommendationResponse>(
          `/recommendations/apply/${deviceId}`,
          params
        );

        if (!response) {
          throw new Error('No response from backend');
        }

        return response;
      } catch (error: any) {
        const message = error.message || 'Failed to apply recommendations';
        throw new Error(message);
      }
    },
  });
}

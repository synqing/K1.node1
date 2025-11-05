import { useQuery } from '@tanstack/react-query';
import { k1ApiClient } from '../lib/analysisClient';
import { postParams, postSelect, FirmwareParams } from '../lib/api';

export interface DeviceRecommendedState {
  pattern?: string;
  params?: Partial<FirmwareParams>;
  palette_id?: number;
  confidence?: number;
  timestamp?: number;
}

/**
 * Fetch recommended state for a device from backend Option C store.
 * Treats deviceId as the device IP for current PoC.
 */
export function useDeviceRecommendedState(
  deviceId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<DeviceRecommendedState | null>({
    queryKey: ['device', 'recommended_state', deviceId],
    queryFn: async () => {
      if (!deviceId) throw new Error('deviceId required');
      try {
        return await k1ApiClient.get<DeviceRecommendedState>(`/api/v1/devices/${deviceId}/state`);
      } catch {
        // Not found or backend unavailable
        return null;
      }
    },
    enabled: !!deviceId && (options?.enabled ?? true),
    retry: false,
    placeholderData: (prev) => prev ?? null,
  });
}

/**
 * Apply a backend-recommended state to a connected device.
 * Performs pattern select (if provided) and params+palette post.
 */
export async function applyRecommendedStateToDevice(
  deviceIp: string,
  rec: DeviceRecommendedState
): Promise<{ ok: boolean; confirmedSelect?: boolean; confirmedParams?: boolean }> {
  let confirmedSelect: boolean | undefined = undefined;
  let confirmedParams: boolean | undefined = undefined;

  // Select pattern by id if provided
  if (rec.pattern && rec.pattern.trim()) {
    try {
      const sel = await postSelect(deviceIp, { id: String(rec.pattern) });
      confirmedSelect = !!sel.confirmed;
      // Small settle delay to allow firmware to switch patterns
      await new Promise((res) => setTimeout(res, 400));
    } catch (e) {
      // Continue to params even if select fails
      confirmedSelect = false;
    }
  }

  // Compose params payload including palette if present
  const payload: Partial<FirmwareParams> = { ...(rec.params || {}) };
  if (typeof rec.palette_id === 'number') {
    payload.palette_id = rec.palette_id;
  }

  if (Object.keys(payload).length > 0) {
    try {
      const r = await postParams(deviceIp, payload);
      confirmedParams = !!r.confirmed;
    } catch (e) {
      confirmedParams = false;
    }
  }

  const ok = (confirmedSelect !== false) && (confirmedParams !== false);
  return { ok, confirmedSelect, confirmedParams };
}


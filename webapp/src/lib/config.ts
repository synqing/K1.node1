// Simple config helpers for environment-driven defaults
export function getDefaultDeviceIp(): string {
  const env = import.meta?.env ?? {};
  const candidates = [
    env.VITE_DEVICE_IP,
    env.VITE_TARGET_DEVICE_IP,
    env.VITE_DEVICE_API_URL,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '192.168.1.104';
}

export function shouldAutoConnect(): boolean {
  const raw = (import.meta?.env?.VITE_AUTO_CONNECT as string) || '';
  const val = raw.trim().toLowerCase();
  return val === '1' || val === 'true' || val === 'yes';
}

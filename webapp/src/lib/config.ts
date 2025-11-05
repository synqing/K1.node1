// Simple config helpers for environment-driven defaults
export function getDefaultDeviceIp(): string {
  const ip = (import.meta?.env?.VITE_DEVICE_IP as string) || '';
  const trimmed = ip.trim();
  return trimmed || '192.168.1.104';
}

export function shouldAutoConnect(): boolean {
  const raw = (import.meta?.env?.VITE_AUTO_CONNECT as string) || '';
  const val = raw.trim().toLowerCase();
  return val === '1' || val === 'true' || val === 'yes';
}

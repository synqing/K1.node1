import { useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ConnectionState } from '../../lib/types';
import { getDefaultDeviceIp } from '../../lib/config';

interface ApiIndexViewProps {
  connectionState?: ConnectionState;
}

export function ApiIndexView({ connectionState }: ApiIndexViewProps) {
  const baseHost = useMemo(() => {
    const ip = connectionState?.deviceIp || getDefaultDeviceIp() || 'k1-reinvented.local';
    return `http://${ip}`;
  }, [connectionState]);

  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const endpoints: { path: string; method?: 'GET' | 'POST'; body?: any; note?: string }[] = [
    { path: '/api/health' },
    { path: '/api/test-connection' },
    { path: '/api/device/info' },
    { path: '/api/device/performance' },
    { path: '/api/params' },
    { path: '/api/realtime/config' },
    { path: '/api/rmt/diag' },
    { path: '/api/rmt/reset', method: 'POST', body: {} },
    { path: '/api/wifi/status' },
    { path: '/api/wifi/scan', method: 'POST', body: {} },
    { path: '/api/wifi/scan/results' },
  ];

  async function callEndpoint(path: string, method: 'GET' | 'POST' = 'GET', body?: any) {
    setLoading(true);
    setOutput('');
    try {
      const url = `${baseHost}${path}`;
      const resp = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await resp.text();
      setOutput(`${resp.status} ${resp.statusText}\n\n${text}`);
    } catch (e: any) {
      setOutput(`Error: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">API Index (Dev)</h2>
        <Badge variant="outline" className="border-[var(--prism-info)] text-[var(--prism-info)] bg-[var(--prism-info)]/10">
          {connectionState?.connected ? connectionState.deviceIp || 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
          <h3 className="text-sm font-medium mb-4">Endpoints</h3>
          <div className="space-y-2">
            {endpoints.map((e) => (
              <div key={e.path} className="flex items-center justify-between gap-2">
                <code className="text-xs text-[var(--prism-text-secondary)]">{e.method || 'GET'} {e.path}</code>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => callEndpoint(e.path, e.method || 'GET', e.body)}
                >
                  Call
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
          <h3 className="text-sm font-medium mb-4">Response</h3>
          <pre className="text-xs whitespace-pre-wrap font-jetbrains min-h-48 p-3 bg-[var(--prism-bg-elevated)]/40 rounded border border-[var(--prism-bg-canvas)]">
            {output || 'No request yet.'}
          </pre>
        </div>
      </div>

      <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
        <h3 className="text-sm font-medium mb-2">Docs & Tools</h3>
        <ul className="text-xs text-[var(--prism-text-secondary)] list-disc pl-6">
          <li><a href="/docs/09-implementation/api-quick-tests.md" target="_blank" rel="noreferrer">API Quick Tests</a></li>
          <li><a href="/docs/06-reference/endpoint-specs.md" target="_blank" rel="noreferrer">Endpoint Specs</a></li>
          <li><a href="/docs/06-reference/realtime-websocket.md" target="_blank" rel="noreferrer">Realtime WebSocket</a></li>
          <li><a href="/docs/06-reference/rate-limit-policy.md" target="_blank" rel="noreferrer">Rate‑Limit Policy</a></li>
          <li><a href="/docs/09-implementation/http-architecture.md" target="_blank" rel="noreferrer">HTTP Server Architecture</a></li>
        </ul>
      </div>
    </div>
  );
}

export default ApiIndexView;


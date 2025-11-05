import { Activity, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

interface TopNavProps {
  currentView: 'control' | 'analysis' | 'profiling' | 'terminal' | 'graph';
  onViewChange: (view: 'control' | 'analysis' | 'profiling' | 'terminal' | 'graph') => void;
  connected: boolean;
  deviceIp?: string;
  defaultIp?: string;
  onConnect?: (ip: string) => void;
  onDisconnect?: () => void;
}

export function TopNav({ currentView, onViewChange, connected, deviceIp, defaultIp, onConnect, onDisconnect }: TopNavProps) {
  const showPreviewLink = import.meta.env.DEV || (import.meta.env.VITE_SHOW_PREVIEW_LINK === 'true');
  const [ip, setIp] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);

  useEffect(() => {
    // Initialize IP input from deviceIp or defaultIp
    setIp(deviceIp || defaultIp || ip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIp, defaultIp]);
  return (
    <div className="h-14 border-b border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)] flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--prism-gold)]" />
          <span className="font-bebas text-lg tracking-wide text-[var(--prism-text-primary)]">
            PRISM.node2
          </span>
        </div>
        
        <div className="h-6 w-px bg-[var(--prism-bg-elevated)] mx-2" />
        
        <nav className="flex gap-1">
          {(['control', 'analysis', 'profiling', 'terminal', 'graph'] as const).map((view) => (
            <button
              key={view}
              onMouseEnter={() => {
                // Prefetch view bundles on hover for snappier nav
                if (view === 'analysis') {
                  void import('../components/views/AnalysisView');
                  void import('recharts');
                } else if (view === 'profiling') {
                  void import('./views/ProfilingView');
                  void import('./profiling/ProfilingCharts');
                  void import('recharts');
                } else if (view === 'terminal') {
                  void import('./views/TerminalView');
                } else if (view === 'graph') {
                  void import('./views/GraphEditorView');
                  // Defer Radix UI until needed; prefetch on hover
                  void import('@radix-ui/react-dialog');
                  void import('@radix-ui/react-tabs');
                }
              }}
              onClick={() => onViewChange(view)}
              aria-current={currentView === view ? 'page' : undefined}
              className={`px-4 py-1.5 rounded-md transition-colors capitalize ${
                currentView === view
                  ? 'bg-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]'
                  : 'text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50'
              }`}
            >
              {view}
            </button>
          ))}
        </nav>

        {showPreviewLink && (
          <>
            <div className="h-6 w-px bg-[var(--prism-bg-elevated)] mx-2" />
            <a
              href="/quick-preview.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 rounded-md transition-colors text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50"
            >
              Quick Preview
            </a>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {connected ? (
          <>
            <Wifi className="w-4 h-4 text-[var(--prism-success)]" />
            <Badge variant="outline" className="border-[var(--prism-success)] text-[var(--prism-success)] bg-[var(--prism-success)]/10">
              {deviceIp || 'Connected'}
            </Badge>
            {onDisconnect && (
              <Button
                variant="outline"
                className="text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
                onClick={() => onDisconnect()}
              >
                Disconnect
              </Button>
            )}
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-[var(--prism-text-secondary)]" />
            <Badge variant="outline" className="border-[var(--prism-text-secondary)] text-[var(--prism-text-secondary)]">
              Disconnected
            </Badge>
            {onConnect && (
              <div className="flex items-center gap-2">
                <Input
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="Device IP"
                  className="w-40"
                  disabled={connecting}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !connecting) {
                      setConnecting(true);
                      Promise.resolve(onConnect(ip)).finally(() => setConnecting(false));
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
                  disabled={connecting}
                  onClick={() => {
                    setConnecting(true);
                    Promise.resolve(onConnect(ip)).finally(() => setConnecting(false));
                  }}
                >
                  {connecting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting
                    </span>
                  ) : (
                    'Connect'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { Activity, Wifi, WifiOff, Loader2, Menu, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

interface TopNavProps {
  currentView: 'control' | 'profiling' | 'terminal' | 'node' | 'api';
  onViewChange: (view: 'control' | 'profiling' | 'terminal' | 'node' | 'api') => void;
  connected: boolean;
  deviceIp?: string;
  defaultIp?: string;
  onConnect?: (ip: string) => void;
  onDisconnect?: () => void;
}

export function TopNav({ currentView, onViewChange, connected, deviceIp, defaultIp, onConnect, onDisconnect }: TopNavProps) {
  const showPreviewLink = import.meta.env.DEV || (import.meta.env.VITE_SHOW_PREVIEW_LINK === 'true');
  const showApiIndex = import.meta.env.DEV || (import.meta.env.VITE_SHOW_API_INDEX === 'true');
  const [ip, setIp] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    // Initialize IP input from deviceIp or defaultIp
    setIp(deviceIp || defaultIp || ip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIp, defaultIp]);
  const navItems = ['control', 'profiling', 'terminal', 'node', ...(showApiIndex ? ['api'] as const : [])] as const;

  const handleNavClick = (view: typeof navItems[number]) => {
    onViewChange(view);
    setMobileMenuOpen(false);
  };

  const handlePrefetch = (view: typeof navItems[number]) => {
    if (view === 'profiling') {
      void import('./views/ProfilingView');
      void import('./profiling/ProfilingCharts');
      void import('recharts');
    } else if (view === 'terminal') {
      void import('./views/TerminalView');
    } else if (view === 'node') {
      void import('./views/NodeEditorView');
      void import('@radix-ui/react-dialog');
      void import('@radix-ui/react-tabs');
    } else if (view === 'api') {
      void import('./views/ApiIndexView');
    }
  };

  return (
    <div className="border-b border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-surface)]">
      <div className="h-14 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--prism-gold)]" />
          <span className="font-bebas text-lg tracking-wide text-[var(--prism-text-primary)] hidden sm:inline">
            PRISM.node2
          </span>
        </div>

        {/* Desktop Navigation - Hidden on mobile */}
        <nav className="hidden md:flex gap-1 flex-1 mx-6">
          {navItems.map((view) => (
            <button
              key={view}
              onMouseEnter={() => handlePrefetch(view)}
              onClick={() => handleNavClick(view)}
              aria-current={currentView === view ? 'page' : undefined}
              className={`px-4 py-1.5 rounded-md transition-all capitalize text-sm font-medium border-b-2 focus:outline-none ${
                currentView === view
                  ? 'bg-[var(--prism-bg-elevated)] text-[var(--prism-gold)] border-[var(--prism-gold)] shadow-[0_0_8px_var(--prism-gold)/20]'
                  : 'text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50 border-transparent focus:ring-2 focus:ring-[var(--prism-info)] focus:ring-offset-2 focus:ring-offset-[var(--prism-bg-surface)]'
              }`}
            >
              {view}
            </button>
          ))}
          {showPreviewLink && (
            <>
              <div className="h-6 w-px bg-[var(--prism-bg-elevated)] mx-2" />
              <a
                href="/quick-preview.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-md transition-colors text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50 text-sm"
              >
                Quick Preview
              </a>
            </>
          )}
        </nav>

        {/* Right: Status & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {connected ? (
            <>
              <Wifi className="w-4 h-4 text-[var(--prism-success)]" />
              <Badge variant="outline" className="border-[var(--prism-success)] text-[var(--prism-success)] bg-[var(--prism-success)]/10 hidden sm:inline-flex">
                {deviceIp || 'Connected'}
              </Badge>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-[var(--prism-text-secondary)]" />
              <Badge variant="outline" className="border-[var(--prism-text-secondary)] text-[var(--prism-text-secondary)] hidden sm:inline-flex text-xs">
                Disconnected
              </Badge>
            </>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden h-10 w-10 rounded-md hover:bg-[var(--prism-bg-elevated)] flex items-center justify-center text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--prism-gold)]"
            aria-label="Toggle navigation menu"
            title={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation - Shown when menu is open */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--prism-bg-elevated)] bg-[var(--prism-bg-canvas)] p-4 space-y-2">
          <nav className="flex flex-col gap-1">
            {navItems.map((view) => (
              <button
                key={view}
                onTouchStart={() => handlePrefetch(view)}
                onClick={() => handleNavClick(view)}
                aria-current={currentView === view ? 'page' : undefined}
                className={`w-full text-left px-4 py-2 rounded-md transition-all capitalize text-sm ${
                  currentView === view
                    ? 'bg-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]'
                    : 'text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50'
                }`}
              >
                {view}
              </button>
            ))}
            {showPreviewLink && (
              <a
                href="/quick-preview.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left px-4 py-2 rounded-md transition-colors text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]/50 text-sm"
              >
                Quick Preview
              </a>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}

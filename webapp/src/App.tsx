import { useState, Suspense, lazy, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import { ControlPanelView } from './components/views/ControlPanelView';

const ProfilingView = lazy(() => import('./components/views/ProfilingView').then(m => ({ default: m.ProfilingView })));
const TerminalView = lazy(() => import('./components/views/TerminalView').then(m => ({ default: m.TerminalView })));
const GraphEditorView = lazy(() => import('./components/views/GraphEditorView').then(m => ({ default: m.GraphEditorView })));
const AnalysisView = lazy(() => import('./components/views/AnalysisView').then(m => ({ default: m.AnalysisView })));
const ApiIndexView = lazy(() => import('./components/views/ApiIndexView').then(m => ({ default: m.ApiIndexView })));
import { ConnectionState } from './lib/types';
import { toast } from 'sonner';
import { testConnection } from './lib/api';
import { getDefaultDeviceIp, shouldAutoConnect } from './lib/config';

export default function App() {
  const [currentView, setCurrentView] = useState<'control' | 'analysis' | 'profiling' | 'terminal' | 'graph' | 'api'>('control');
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    deviceIp: '',
    serialPort: '',
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [idlePrefetch, setIdlePrefetch] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('prefs.idlePrefetch');
      return raw === null ? true : raw === 'true';
    } catch {
      return true;
    }
  });
  
  const handleConnect = async (ip: string, port: string) => {
    const target = (ip || '').trim();
    if (!target) {
      toast.error('Connection failed', { description: 'Device IP is empty' });
      return;
    }

    const connectingToast = toast.loading('Connecting to device...', {
      description: `Testing connection to ${target}`,
    });

    try {
      const result = await testConnection(target);

      if (result.connected) {
        setConnectionState({
          connected: true,
          deviceIp: target,
          serialPort: port,
          lastSyncTime: Date.now(),
        });

        toast.success('Connected to device', {
          id: connectingToast,
          description: `${target}${port ? ` via ${port}` : ''}`,
        });
      } else {
        toast.error('Connection failed', {
          id: connectingToast,
          description: result.error || 'Unable to reach device',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Connection failed', {
        id: connectingToast,
        description: msg,
      });
    }
  };
  
  const handleDisconnect = () => {
    setConnectionState({
      connected: false,
      deviceIp: connectionState.deviceIp,
      serialPort: connectionState.serialPort,
    });
    
    toast.info('Disconnected from device');
  };

  // Auto-connect on load if configured
  useEffect(() => {
    const auto = shouldAutoConnect();
    const defaultIp = getDefaultDeviceIp();
    if (!connectionState.connected && auto && defaultIp) {
      // Fire and forget; UI toasts will reflect outcome
      void handleConnect(defaultIp, '');
    }
    // Only run once on mount or when connectionState changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist idle prefetch preference
  useEffect(() => {
    try {
      localStorage.setItem('prefs.idlePrefetch', String(idlePrefetch));
    } catch {}
  }, [idlePrefetch]);

  // Idle prefetch likely next views and heavy libs
  useEffect(() => {
    if (!idlePrefetch) return;
    const requestIdle: (cb: IdleRequestCallback) => number =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback.bind(window)
        : (cb: IdleRequestCallback) =>
            window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 600);
    const cancelIdle: (handle: number) => void =
      typeof window !== 'undefined' && 'cancelIdleCallback' in window
        ? window.cancelIdleCallback.bind(window)
        : (handle: number) => clearTimeout(handle);

    const id = requestIdle(() => {
      // Basic heuristic: when on control, prefetch profiling (charts) & terminal
      if (currentView === 'control') {
        void import('./components/views/ProfilingView');
        void import('./components/profiling/ProfilingCharts');
        // Prefetch heavy vendors
        void import('recharts');
        void import('@radix-ui/react-dialog');
        void import('@radix-ui/react-tabs');
        void import('./components/views/TerminalView');
      }
      // When on profiling, prefetch graph editor and its modals
      if (currentView === 'profiling') {
        void import('./components/views/GraphEditorView');
        void import('@radix-ui/react-dialog');
        void import('@radix-ui/react-tabs');
      }
      // When on terminal, prefetch profiling
      if (currentView === 'terminal') {
        void import('./components/views/ProfilingView');
        void import('./components/profiling/ProfilingCharts');
        void import('recharts');
      }
    });
    return () => cancelIdle(id);
  }, [currentView, idlePrefetch]);
  
  return (
    <div className="h-screen w-screen bg-[var(--prism-bg-canvas)] text-[var(--prism-text-primary)] flex flex-col overflow-hidden dark">
      <TopNav
        currentView={currentView}
        onViewChange={setCurrentView}
        connected={connectionState.connected}
        deviceIp={connectionState.deviceIp}
        defaultIp={getDefaultDeviceIp()}
        onConnect={(ip) => handleConnect(ip, '')}
        onDisconnect={handleDisconnect}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          connectionState={connectionState}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          idlePrefetchEnabled={idlePrefetch}
          onSetIdlePrefetch={setIdlePrefetch}
        />
        
        <main className="flex-1 flex flex-col overflow-hidden" role="main">
          <Suspense
            fallback={
              <div className="flex-1 p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-1/3 bg-[var(--prism-bg-elevated)]/50 rounded" />
                  <div className="h-64 w-full bg-[var(--prism-bg-elevated)]/50 rounded" />
                </div>
              </div>
            }
          >
            {currentView === 'control' && <ControlPanelView connectionState={connectionState} />}
            {currentView === 'analysis' && <AnalysisView connectionState={connectionState} />}
            {currentView === 'profiling' && <ProfilingView />}
            {currentView === 'terminal' && <TerminalView />}
            {currentView === 'graph' && <GraphEditorView />}
            {currentView === 'api' && <ApiIndexView connectionState={connectionState} />}
          </Suspense>
        </main>
      </div>
      
      <Toaster 
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--prism-bg-elevated)',
            border: '1px solid var(--prism-bg-canvas)',
            color: 'var(--prism-text-primary)',
          },
        }}
      />
    </div>
  );
}

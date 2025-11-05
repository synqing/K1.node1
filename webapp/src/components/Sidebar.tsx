import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Wifi, Settings, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ConnectionState } from '../lib/types';
import { getDefaultDeviceIp } from '../lib/config';
import { DeviceManager } from './DeviceManager';

// Minimal Web Serial typing used for enumeration and labeling
interface WebSerialUsbInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface WebSerialPort {
  getInfo?: () => WebSerialUsbInfo;
}

type SerialEvent = { port?: WebSerialPort; target?: WebSerialPort };

type NavigatorWithSerial = Navigator & {
  serial?: {
    getPorts: () => Promise<WebSerialPort[]>;
    requestPort: () => Promise<WebSerialPort>;
    addEventListener: (type: 'connect' | 'disconnect', handler: (event: SerialEvent) => void) => void;
    removeEventListener: (type: 'connect' | 'disconnect', handler: (event: SerialEvent) => void) => void;
  };
};

function formatPortLabel(port: WebSerialPort) {
  try {
    const info = port?.getInfo?.() || {};
    const vid = info.usbVendorId ? `0x${info.usbVendorId.toString(16).padStart(4, '0')}` : 'unknown';
    const pid = info.usbProductId ? `0x${info.usbProductId.toString(16).padStart(4, '0')}` : 'unknown';
    return `USB ${vid}:${pid}`;
  } catch {
    return 'USB unknown';
  }
}

function supportsWebSerial() {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as NavigatorWithSerial).serial);
}

function getNavigatorSerial() {
  if (typeof navigator === 'undefined') return undefined;
  const candidate = (navigator as NavigatorWithSerial).serial;
  if (!candidate) return undefined;
  return candidate;
}

interface SidebarProps {
  connectionState: ConnectionState;
  onConnect: (ip: string, port: string) => Promise<void> | void;
  onDisconnect: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  idlePrefetchEnabled: boolean;
  onSetIdlePrefetch: (enabled: boolean) => void;
}

export function Sidebar({ connectionState, onConnect, onDisconnect, isCollapsed, onToggleCollapse, idlePrefetchEnabled, onSetIdlePrefetch }: SidebarProps) {
  const [ip, setIp] = useState<string>(connectionState.deviceIp || getDefaultDeviceIp());
  const [port, setPort] = useState<string>(connectionState.serialPort || '');
  const [availablePorts, setAvailablePorts] = useState<Array<{ port: WebSerialPort; label: string }>>([]);
  const [serialSupported, setSerialSupported] = useState<boolean>(supportsWebSerial());

  useEffect(() => {
    if (!serialSupported) return;
    const serial = getNavigatorSerial();
    if (!serial) return;
    const refreshPorts = async () => {
      try {
        const ports: WebSerialPort[] = await serial.getPorts();
        const entries = ports.map((p: WebSerialPort) => ({ port: p, label: formatPortLabel(p) }));
        setAvailablePorts(entries);
        // If no selected port yet, select first available
        if (!port && entries.length > 0) {
          setPort(entries[0].label);
        }
      } catch (err) {
        console.warn('Failed to enumerate serial ports', err);
      }
    };

    refreshPorts();
    const onConnect = (event: SerialEvent) => {
      const p: WebSerialPort | undefined = event?.port || event?.target; // browser dependent
      if (!p) return;
      setAvailablePorts((prev: Array<{ port: WebSerialPort; label: string }>) => {
        const label = formatPortLabel(p);
        // Avoid duplicates
        const has = prev.some((e: { port: WebSerialPort; label: string }) => e.label === label);
        const next = has ? prev : [...prev, { port: p, label }];
        return next;
      });
    };
    const onDisconnect = (event: SerialEvent) => {
      const p: WebSerialPort | undefined = event?.port || event?.target;
      if (!p) return;
      const label = formatPortLabel(p);
      setAvailablePorts((prev: Array<{ port: WebSerialPort; label: string }>) =>
        prev.filter((e: { port: WebSerialPort; label: string }) => e.label !== label)
      );
      setPort((cur: string) => (cur === label ? '' : cur));
    };

    try {
      serial.addEventListener('connect', onConnect);
      serial.addEventListener('disconnect', onDisconnect);
    } catch {}

    return () => {
      try {
        serial.removeEventListener('connect', onConnect);
        serial.removeEventListener('disconnect', onDisconnect);
      } catch {}
    };
  }, [serialSupported, port]);

  const handleRequestPort = async () => {
    if (!serialSupported) return;
    const serial = getNavigatorSerial();
    if (!serial) return;
    try {
      const granted: WebSerialPort = await serial.requestPort();
      const label = formatPortLabel(granted);
      setAvailablePorts((prev: Array<{ port: WebSerialPort; label: string }>) => {
        const has = prev.some((e: { port: WebSerialPort; label: string }) => e.label === label);
        const next = has ? prev : [...prev, { port: granted, label }];
        return next;
      });
      setPort(label);
      // Port access granted
    } catch (err) {
      // user cancelled or error
    }
  };
  
  if (isCollapsed) {
    return (
      <div className="w-12 bg-[var(--prism-bg-surface)] border-r border-[var(--prism-bg-elevated)] flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="w-8 h-8 rounded-md bg-[var(--prism-bg-elevated)] hover:bg-[var(--prism-bg-canvas)] flex items-center justify-center text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="mt-6 flex flex-col gap-4">
          <Settings className="w-5 h-5 text-[var(--prism-text-secondary)]" />
          {connectionState.connected ? (
            <div className="w-2 h-2 rounded-full bg-[var(--prism-success)] shadow-[0_0_8px_var(--prism-success)]" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[var(--prism-text-secondary)]" />
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-64 bg-[var(--prism-bg-surface)] border-r border-[var(--prism-bg-elevated)] flex flex-col">
      <div className="p-4 border-b border-[var(--prism-bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-[var(--prism-gold)]" />
          <span className="text-sm font-medium text-[var(--prism-text-primary)]">Device Connection</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 rounded hover:bg-[var(--prism-bg-elevated)] flex items-center justify-center text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Enhanced Device Manager */}
        <DeviceManager
          connectionState={connectionState}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
        
        {/* Legacy Serial Port Support (kept for compatibility) */}
        {serialSupported && (
          <div className="space-y-2 pt-4 border-t border-[var(--prism-bg-elevated)]">
            <Label htmlFor="serial-port" className="text-xs text-[var(--prism-text-secondary)]">
              Serial Port (Legacy)
            </Label>
            <div className="space-y-2">
              <Select value={port} onValueChange={setPort} disabled={connectionState.connected}>
                <SelectTrigger className="bg-[var(--prism-bg-canvas)] border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)]">
                  <SelectValue placeholder={availablePorts.length ? 'Select a port' : 'No ports granted'} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--prism-bg-elevated)] border-[var(--prism-bg-canvas)]">
                  {availablePorts.length === 0 && (
                    <div className="px-3 py-2 text-xs text-[var(--prism-text-secondary)]">No ports</div>
                  )}
                  {availablePorts.map((p: { port: WebSerialPort; label: string }, idx: number) => (
                    <SelectItem key={`${p.label}-${idx}`} value={p.label} className="text-[var(--prism-text-primary)]">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestPort}
                  disabled={connectionState.connected}
                  className="text-xs"
                >
                  Grant Port Access…
                </Button>
              </div>
          </div>
        )}
        
        <div className="pt-4 border-t border-[var(--prism-bg-elevated)] space-y-2">
          <h4 className="text-xs font-medium text-[var(--prism-text-secondary)]">Quick Actions</h4>
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
              disabled={!connectionState.connected}
            >
              Reset Device
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
              disabled={!connectionState.connected}
            >
              Export Config
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
              disabled={!connectionState.connected}
            >
              Import Config
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--prism-bg-elevated)] space-y-3">
          <h4 className="text-xs font-medium text-[var(--prism-text-secondary)]">App Settings</h4>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--prism-text-primary)]">Idle Prefetch</div>
              <div className="text-[10px] text-[var(--prism-text-secondary)]">Preload non‑critical bundles when idle</div>
            </div>
            <Switch
              checked={idlePrefetchEnabled}
              onCheckedChange={(v: boolean) => onSetIdlePrefetch(v)}
            />
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-[var(--prism-bg-elevated)]">
        <div className="text-xs text-[var(--prism-text-secondary)] space-y-1">
          <div>PRISM.node2 Control v2.4.1</div>
          <div className="font-jetbrains">Build 2024.10.29</div>
        </div>
      </div>
    </div>
  );
}

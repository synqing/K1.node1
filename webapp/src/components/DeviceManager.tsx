/**
 * Enhanced Device Manager Component
 * 
 * Implements Task 3: Enhanced Device Management for Dual Architecture
 * - Device discovery with backend registry integration
 * - Manual IP validation and connection
 * - Auto-reconnect with exponential backoff
 * - Dual status display (backend + direct connection)
 * - Professional error handling and retry UX
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, Star, Wifi, WifiOff, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { ConnectionState } from '../lib/types';
import { testConnection } from '../lib/api';
import { k1ApiClient } from '../lib/analysisClient';
import { toast } from 'sonner';

// Device discovery types (simplified for current architecture)
interface DiscoveredDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  firmware?: string;
  lastSeen: Date;
  discoveryCount: number;
  rssi?: number;
}

interface ManualDevice {
  id: string;
  name: string;
  ip: string;
  port?: number;
}

const MANUAL_DEVICES_KEY = 'deviceManager.manualDevices';
const DEFAULT_FALLBACK_DISCOVERY_URL = 'http://localhost:8080/api/devices';
const allowMockDiscovery = Boolean(import.meta.env.DEV || import.meta.env.VITE_DEVICE_DISCOVERY_FALLBACK_URL);

function loadManualDevicesFromStorage(): ManualDevice[] {
  try {
    const raw = localStorage.getItem(MANUAL_DEVICES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.ip === 'string')
      .map((entry, idx) => ({
        id: entry.id || `manual-${idx}`,
        name: entry.name || entry.ip,
        ip: entry.ip,
        port: entry.port,
      }));
  } catch {
    return [];
  }
}

function persistManualDevices(devices: ManualDevice[]) {
  try {
    localStorage.setItem(MANUAL_DEVICES_KEY, JSON.stringify(devices));
  } catch {}
}

function getFallbackDiscoveryUrl() {
  return (import.meta.env.VITE_DEVICE_DISCOVERY_FALLBACK_URL as string) || DEFAULT_FALLBACK_DISCOVERY_URL;
}

interface DeviceManagerProps {
  connectionState: ConnectionState;
  onConnect: (ip: string, port: string) => Promise<boolean>;
  onDisconnect: () => void;
}

// Device discovery with backend API integration
const discoverDevices = async (): Promise<DiscoveredDevice[]> => {
  try {
    // Fetch devices from backend API endpoint
    const response = await k1ApiClient.get<{
      items: Array<{
        id: string;
        name: string;
        ip: string;
        port: number;
        firmware?: string;
        last_seen?: string;
        discovery_count?: number;
        rssi?: number;
      }>;
      total: number;
    }>('/devices');

    // Transform backend response to UI format
    return (response.items || []).map(device => ({
      id: device.id,
      name: device.name,
      ip: device.ip,
      port: device.port,
      firmware: device.firmware,
      rssi: device.rssi,
      lastSeen: device.last_seen ? new Date(device.last_seen) : new Date(),
      discoveryCount: device.discovery_count || 1
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to discover devices';
    throw new Error(`Device discovery failed: ${errorMsg}`);
  }
};

const discoverMockDevices = async (): Promise<DiscoveredDevice[]> => {
  if (!allowMockDiscovery) return [];
  try {
    const res = await fetch(getFallbackDiscoveryUrl(), { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items: Array<{ id?: string; name?: string; ip?: string; port?: number; firmware?: string; rssi?: number }> =
      Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items
      .filter((item) => typeof item.ip === 'string')
      .map((device, index) => ({
        id: device.id || `mock-${index}`,
        name: device.name || device.ip || `Mock Device ${index + 1}`,
        ip: device.ip as string,
        port: device.port ?? 80,
        firmware: device.firmware || 'mock-firmware',
        rssi: device.rssi ?? -50,
        lastSeen: new Date(),
        discoveryCount: 1,
      }));
  } catch (error) {
    console.warn('Mock device discovery failed', error);
    return [];
  }
};

// Device cache for deduplication and persistence
class DeviceCache {
  private devices = new Map<string, DiscoveredDevice>();
  
  addDevices(newDevices: DiscoveredDevice[]) {
    newDevices.forEach(device => {
      const existing = this.devices.get(device.id);
      if (existing) {
        // Update existing device with new discovery info
        this.devices.set(device.id, {
          ...existing,
          ...device,
          lastSeen: device.lastSeen,
          discoveryCount: existing.discoveryCount + 1,
          // Keep the better RSSI if available
          rssi: device.rssi !== undefined ? device.rssi : existing.rssi
        });
      } else {
        // Add new device
        this.devices.set(device.id, device);
      }
    });
  }
  
  getDevicesSortedByLastSeen(): DiscoveredDevice[] {
    return Array.from(this.devices.values())
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }
  
  clear() {
    this.devices.clear();
  }
  
  getDevice(id: string): DiscoveredDevice | undefined {
    return this.devices.get(id);
  }
}

// Auto-reconnect hook with exponential backoff
function useAutoReconnect(onConnect: (ip: string) => Promise<boolean>) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [nextDelay, setNextDelay] = useState(0);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('deviceManager.autoReconnect') === 'true';
    } catch {
      return false;
    }
  });
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastEndpointRef = useRef<string>('');
  
  const start = useCallback((endpoint?: string) => {
    if (endpoint) {
      lastEndpointRef.current = endpoint;
    }
    
    if (!lastEndpointRef.current || !enabled) return;
    
    setIsReconnecting(true);
    setAttempt(1);
    
    const attemptReconnect = async (attemptNum: number) => {
      if (attemptNum > 10) {
        setIsReconnecting(false);
        setAttempt(0);
        toast.error('Auto-reconnect failed', {
          description: 'Maximum retry attempts reached'
        });
        return;
      }
      
      try {
        const ok = await onConnect(lastEndpointRef.current);
        if (ok) {
          setIsReconnecting(false);
          setAttempt(0);
          toast.success('Reconnected successfully');
          return;
        }
        throw new Error('Device unreachable');
      } catch (error) {
        // Calculate next delay with exponential backoff + jitter
        const baseDelay = Math.min(30000, 1000 * Math.pow(2, attemptNum - 1));
        const jitter = baseDelay * 0.2 * Math.random();
        const delay = baseDelay + jitter;
        
        setAttempt(attemptNum + 1);
        setNextDelay(delay);
        
        timeoutRef.current = setTimeout(() => {
          attemptReconnect(attemptNum + 1);
        }, delay);
      }
    };
    
    attemptReconnect(1);
  }, [enabled, onConnect]);
  
  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsReconnecting(false);
    setAttempt(0);
    setNextDelay(0);
  }, []);
  
  const setAutoReconnectEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    try {
      localStorage.setItem('deviceManager.autoReconnect', String(enabled));
    } catch {}
    
    if (!enabled) {
      stop();
    }
  }, [stop]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    isReconnecting,
    attempt,
    nextDelay,
    enabled,
    start,
    stop,
    setEnabled: setAutoReconnectEnabled
  };
}

// IP/endpoint validation
function validateEndpoint(input: string): { isValid: boolean; error?: string; normalized?: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Endpoint cannot be empty' };
  }
  
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = trimmed.match(ipv4Pattern);
  
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    if (octets.some(octet => octet > 255)) {
      return { isValid: false, error: 'Invalid IPv4 address (octets must be 0-255)' };
    }
    return { isValid: true, normalized: trimmed };
  }
  
  // IPv6 pattern (basic)
  if (trimmed.includes(':') && !trimmed.includes('.')) {
    const normalized = trimmed.startsWith('[') ? trimmed : `[${trimmed}]`;
    return { isValid: true, normalized };
  }
  
  // Hostname pattern
  const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (hostnamePattern.test(trimmed)) {
    return { isValid: true, normalized: trimmed };
  }
  
  return { isValid: false, error: 'Invalid IP address or hostname' };
}

export function DeviceManager({ connectionState, onConnect, onDisconnect }: DeviceManagerProps) {
  const [manualIp, setManualIp] = useState(connectionState.deviceIp || '');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [validationError, setValidationError] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');
  const [showAllDevices, setShowAllDevices] = useState(false);
  const [manualDevices, setManualDevices] = useState<ManualDevice[]>([]);
  const [manualDeviceName, setManualDeviceName] = useState('');
  const [manualDeviceIpInput, setManualDeviceIpInput] = useState('');
  
  const deviceCacheRef = useRef(new DeviceCache());
  const autoReconnect = useAutoReconnect(async (ip: string) => onConnect(ip, ''));
  
  // Validate manual IP input
  useEffect(() => {
    if (!manualIp.trim()) {
      setValidationError('');
      return;
    }
    
    const validation = validateEndpoint(manualIp);
    setValidationError(validation.error || '');
  }, [manualIp]);

  const handleAddManualDevice = useCallback(() => {
    if (!manualDeviceIpInput.trim()) {
      toast.error('Invalid endpoint', { description: 'Device IP/hostname is required' });
      return;
    }
    const validation = validateEndpoint(manualDeviceIpInput);
    if (!validation.isValid) {
      toast.error('Invalid endpoint', { description: validation.error });
      return;
    }
    const entry: ManualDevice = {
      id: `manual-${Date.now()}`,
      name: manualDeviceName.trim() || validation.normalized!,
      ip: validation.normalized!,
    };
    setManualDevices((prev) => [...prev, entry]);
    toast.success('Device saved', { description: entry.name });
    setManualDeviceName('');
    setManualDeviceIpInput('');
  }, [manualDeviceIpInput, manualDeviceName]);

  const handleRemoveManualDevice = useCallback((id: string) => {
    setManualDevices((prev) => prev.filter((device) => device.id !== id));
  }, []);

  const handleConnectSavedDevice = useCallback(async (device: ManualDevice) => {
    const connectingToast = toast.loading(`Connecting to ${device.name}...`, {
      description: `Testing connection to ${device.ip}`,
    });
    try {
      const success = await onConnect(device.ip, '');
      if (success) {
        toast.success(`Connected to ${device.name}`, {
          id: connectingToast,
          description: device.ip,
        });
        try {
          localStorage.setItem('deviceManager.lastEndpoint', device.ip);
        } catch {}
      } else {
        toast.error(`Failed to connect to ${device.name}`, {
          id: connectingToast,
          description: 'Device did not respond',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      toast.error(`Failed to connect to ${device.name}`, {
        id: connectingToast,
        description: errorMsg,
      });
    }
  }, [onConnect]);

  useEffect(() => {
    setManualDevices(loadManualDevicesFromStorage());
  }, []);

  useEffect(() => {
    persistManualDevices(manualDevices);
  }, [manualDevices]);

  // Prefer mDNS/hostname defaults over specific IPs
  useEffect(() => {
    if (!manualIp) {
      let defaultHost = '';
      try {
        defaultHost = localStorage.getItem('deviceManager.lastEndpoint') || '';
      } catch {}
      if (!defaultHost) {
        // Use env default if provided, otherwise prefer an mDNS hostname
        defaultHost = (import.meta as any).env?.VITE_DEFAULT_DEVICE_HOST || 'k1-reinvented.local';
      }
      setManualIp(defaultHost);
    }
  }, [manualIp]);
  
  // Handle manual connection with enhanced error handling
  const handleManualConnect = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateEndpoint(manualIp);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid endpoint');
      toast.error('Invalid endpoint', {
        description: validation.error
      });
      return;
    }
    
    const connectingToast = toast.loading('Connecting to device...', {
      description: `Testing connection to ${validation.normalized}`
    });
    
    try {
      const success = await onConnect(validation.normalized!, '');
      if (success) {
        setLastError('');
        try {
          localStorage.setItem('deviceManager.lastEndpoint', validation.normalized!);
        } catch {}
        toast.success('Connected successfully', {
          id: connectingToast,
          description: `Connected to ${validation.normalized}`
        });
      } else {
        const errMsg = 'Device did not respond';
        setLastError(errMsg);
        toast.error('Connection failed', {
          id: connectingToast,
          description: errMsg
        });
      }
      if (autoReconnect.enabled) {
        autoReconnect.start(validation.normalized!);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMsg);
      toast.error('Connection failed', {
        id: connectingToast,
        description: errorMsg
      });
      if (autoReconnect.enabled) {
        autoReconnect.start(validation.normalized!);
      }
    }
  }, [manualIp, onConnect, autoReconnect]);
  
  // Handle device discovery with deduplication
  const handleDiscovery = useCallback(async () => {
    setIsDiscovering(true);
    try {
      let source: 'registry' | 'mock' = 'registry';
      let newDevices = await discoverDevices();
      if ((!newDevices || newDevices.length === 0) && allowMockDiscovery) {
        const fallbackDevices = await discoverMockDevices();
        if (fallbackDevices.length) {
          newDevices = fallbackDevices;
          source = 'mock';
        }
      }

      deviceCacheRef.current.addDevices(newDevices);
      const allDevices = deviceCacheRef.current.getDevicesSortedByLastSeen();
      setDiscoveredDevices(allDevices);

      const uniqueCount = newDevices.length;
      const totalCount = allDevices.length;

      if (uniqueCount > 0) {
        toast.success(`Discovery complete`, {
          description: `Found ${uniqueCount} device${uniqueCount !== 1 ? 's' : ''} (${totalCount} total cached${source === 'mock' ? ', mock registry' : ''})`
        });
      } else {
        toast.info('No new devices found', {
          description: `${totalCount} device${totalCount !== 1 ? 's' : ''} in cache`
        });
      }
    } catch (error) {
      const fallbackDevices = await discoverMockDevices();
      if (fallbackDevices.length) {
        deviceCacheRef.current.addDevices(fallbackDevices);
        const allDevices = deviceCacheRef.current.getDevicesSortedByLastSeen();
        setDiscoveredDevices(allDevices);
        toast.success('Discovery complete (mock)', {
          description: `Loaded ${fallbackDevices.length} mock device${fallbackDevices.length !== 1 ? 's' : ''}`
        });
      } else {
        toast.error('Discovery failed', {
          description: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      setIsDiscovering(false);
    }
  }, []);
  
  // Connect to discovered device with enhanced feedback
  const handleConnectToDevice = useCallback(async (device: DiscoveredDevice) => {
    const connectingToast = toast.loading(`Connecting to ${device.name}...`, {
      description: `Testing connection to ${device.ip}:${device.port}`
    });
    
    try {
      const success = await onConnect(device.ip, '');
      if (success) {
        setLastError('');
        try {
          localStorage.setItem('deviceManager.lastEndpoint', device.ip);
        } catch {}
        toast.success(`Connected to ${device.name}`, {
          id: connectingToast,
          description: `${device.ip}:${device.port} • ${device.firmware || 'Unknown firmware'}`
        });
        const updatedDevice = { ...device, lastSeen: new Date() };
        deviceCacheRef.current.addDevices([updatedDevice]);
        setDiscoveredDevices(deviceCacheRef.current.getDevicesSortedByLastSeen());
      } else {
        const msg = 'Device did not respond';
        setLastError(msg);
        toast.error(`Failed to connect to ${device.name}`, {
          id: connectingToast,
          description: msg
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMsg);
      toast.error(`Failed to connect to ${device.name}`, {
        id: connectingToast,
        description: errorMsg
      });
    }
  }, [onConnect]);
  
  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    autoReconnect.stop();
    onDisconnect();
    setLastError('');
  }, [onDisconnect, autoReconnect]);
  
  // Handle retry
  const handleRetry = useCallback(async () => {
    const lastEndpoint = localStorage.getItem('deviceManager.lastEndpoint') || manualIp;
    if (!lastEndpoint) return;
    
    try {
      setLastError('');
      const ok = await onConnect(lastEndpoint, '');
      if (!ok) {
        setLastError('Device did not respond');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setLastError(errorMsg);
    }
  }, [manualIp, onConnect]);
  
  // Format relative time
  const formatLastSeen = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };
  
  // Auto-connect on mount if enabled and no connection
  useEffect(() => {
    if (!connectionState.connected && autoReconnect.enabled) {
      const lastEndpoint = localStorage.getItem('deviceManager.lastEndpoint');
      if (lastEndpoint) {
        autoReconnect.start(lastEndpoint);
      }
    }
  }, [connectionState.connected, autoReconnect]);
  
  return (
    <div className="space-y-6">
      {/* Auto-reconnect status */}
      {autoReconnect.isReconnecting && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <div className="text-sm">
              <div className="font-medium text-amber-900">
                Reconnecting... (attempt {autoReconnect.attempt}/10)
              </div>
              {autoReconnect.nextDelay > 0 && (
                <div className="text-amber-700">
                  Next attempt in {Math.ceil(autoReconnect.nextDelay / 1000)}s
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Connection Status */}
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)] flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Connection Status
          </h3>
          <div className="flex items-center gap-2">
            {connectionState.connected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-[var(--prism-text-secondary)]" />
            )}
            <Badge variant={connectionState.connected ? "default" : "secondary"}>
              {connectionState.connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
        
        {connectionState.connected && (
          <div className="space-y-2 text-xs text-[var(--prism-text-secondary)]">
            <div className="flex justify-between">
              <span>Device IP:</span>
              <span className="font-mono text-[var(--prism-text-primary)]">
                {connectionState.deviceIp}
              </span>
            </div>
            {connectionState.lastSyncTime && (
              <div className="flex justify-between">
                <span>Last Sync:</span>
                <span className="text-[var(--prism-text-primary)]">
                  {new Date(connectionState.lastSyncTime).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}
        
        {lastError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Connection Error</div>
                <div>{lastError}</div>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-3 flex gap-2">
          {connectionState.connected ? (
            <Button
              onClick={handleDisconnect}
              variant="outline"
              size="sm"
              className="text-xs border-red-200 text-red-600 hover:bg-red-50"
            >
              Disconnect
            </Button>
          ) : (
            <>
              {lastError && (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
              {autoReconnect.isReconnecting && (
                <Button
                  onClick={autoReconnect.stop}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Stop Retrying
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Device Discovery */}
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Device Discovery
          </h3>
          <Button
            onClick={handleDiscovery}
            disabled={isDiscovering}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            {isDiscovering ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 mr-1" />
                Discover
              </>
            )}
          </Button>
        </div>
        
        <div className="space-y-2">
          {/* Display devices with show more/less functionality */}
          {(showAllDevices ? discoveredDevices : discoveredDevices.slice(0, 3)).map((device, index) => (
            <div
              key={device.id}
              className="flex items-center justify-between p-2 bg-[var(--prism-bg-canvas)] border border-[var(--prism-bg-elevated)] rounded text-xs hover:bg-[var(--prism-bg-surface)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span className="font-medium text-[var(--prism-text-primary)] truncate">
                    {device.name}
                  </span>
                  {device.discoveryCount >= 3 && (
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                  )}
                  {index === 0 && discoveredDevices.length > 1 && (
                    <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">
                      Recent
                    </span>
                  )}
                </div>
                <div className="text-[var(--prism-text-secondary)] space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span>{device.ip}:{device.port}</span>
                    {device.rssi && (
                      <span className={`text-[10px] px-1 py-0.5 rounded ${
                        device.rssi > -50 ? 'bg-green-100 text-green-700' :
                        device.rssi > -70 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {device.rssi}dBm
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatLastSeen(device.lastSeen)}</span>
                    {device.firmware && (
                      <span className="text-[10px] px-1 py-0.5 bg-[var(--prism-bg-elevated)] rounded">
                        {device.firmware}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--prism-text-secondary)]">
                      Seen {device.discoveryCount}x
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => handleConnectToDevice(device)}
                disabled={connectionState.connected}
                variant="outline"
                size="sm"
                className="text-xs ml-2"
              >
                Connect
              </Button>
            </div>
          ))}
          
          {/* Show more/less toggle */}
          {discoveredDevices.length > 3 && (
            <Button
              onClick={() => setShowAllDevices(!showAllDevices)}
              variant="ghost"
              size="sm"
              className="w-full text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
            >
              {showAllDevices 
                ? `Show less (${discoveredDevices.length - 3} hidden)`
                : `Show all ${discoveredDevices.length} devices`
              }
            </Button>
          )}
          
          {/* Clear cache option */}
          {discoveredDevices.length > 0 && (
            <Button
              onClick={() => {
                deviceCacheRef.current.clear();
                setDiscoveredDevices([]);
                toast.info('Device cache cleared');
              }}
              variant="ghost"
              size="sm"
              className="w-full text-xs text-[var(--prism-text-secondary)] hover:text-red-600"
            >
              Clear Cache
            </Button>
          )}
          
          {discoveredDevices.length === 0 && !isDiscovering && (
            <div className="text-center py-4 text-xs text-[var(--prism-text-secondary)]">
              No devices found. Click "Discover" to scan your network.
            </div>
          )}
        </div>
      </div>
      
      {/* Manual Connection */}
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-3">
          Manual Connection
        </h3>
        
        <form onSubmit={handleManualConnect} className="space-y-3">
          <div>
            <Label htmlFor="manual-ip" className="text-xs text-[var(--prism-text-secondary)]">
              Device IP Address
            </Label>
            <Input
              id="manual-ip"
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="k1-reinvented.local or device.local"
              disabled={connectionState.connected}
              className="mt-1 text-xs"
            />
            {validationError && (
              <div className="mt-1 text-xs text-red-600">{validationError}</div>
            )}
          </div>
          
          <Button
            type="submit"
            disabled={connectionState.connected || !!validationError || !manualIp.trim()}
            className="w-full text-xs"
            size="sm"
          >
            <Wifi className="w-3 h-3 mr-1" />
            Connect
          </Button>
        </form>
      </div>
      
      {/* Saved Devices */}
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Saved Devices</h3>
          <span className="text-[10px] text-[var(--prism-text-secondary)]">Stored locally</span>
        </div>
        <div className="space-y-2">
          <div>
            <Label htmlFor="manual-name" className="text-xs text-[var(--prism-text-secondary)]">Display Name</Label>
            <Input
              id="manual-name"
              type="text"
              value={manualDeviceName}
              onChange={(e) => setManualDeviceName(e.target.value)}
              placeholder="Studio Controller"
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label htmlFor="manual-device-ip" className="text-xs text-[var(--prism-text-secondary)]">Device IP / Hostname</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="manual-device-ip"
                type="text"
                value={manualDeviceIpInput}
                onChange={(e) => setManualDeviceIpInput(e.target.value)}
                placeholder="192.168.1.50"
                className="text-xs"
              />
              <Button type="button" size="sm" onClick={handleAddManualDevice} className="text-xs whitespace-nowrap">
                Save
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {manualDevices.length === 0 && (
            <div className="text-[10px] text-[var(--prism-text-secondary)]">
              No saved devices yet. Add one for quick access.
            </div>
          )}
          {manualDevices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between rounded border border-[var(--prism-bg-canvas)]/40 px-3 py-2 text-xs"
            >
              <div>
                <div className="text-[var(--prism-text-primary)] font-medium">{device.name}</div>
                <div className="text-[var(--prism-text-secondary)] font-jetbrains text-[11px]">{device.ip}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => handleConnectSavedDevice(device)}
                  disabled={connectionState.connected}
                >
                  Connect
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[10px] text-[var(--prism-text-secondary)] hover:text-red-500"
                  onClick={() => handleRemoveManualDevice(device.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Auto-reconnect Settings */}
      <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-[var(--prism-text-primary)]">
              Auto-reconnect
            </div>
            <div className="text-[10px] text-[var(--prism-text-secondary)]">
              Automatically reconnect on disconnect
            </div>
          </div>
          <Switch
            checked={autoReconnect.enabled}
            onCheckedChange={autoReconnect.setEnabled}
          />
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Play, Square, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { GraphState } from '../../lib/types';

interface TestDeviceProps {
  open: boolean;
  onClose: () => void;
  graphState: GraphState;
  patternName?: string;
}

export function TestDevice({ open, onClose, graphState, patternName = 'Graph' }: TestDeviceProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const checkDeviceConnection = async () => {
    try {
      const response = await fetch('/api/device/info');
      if (response.ok) {
        const info = await response.json();
        setDeviceInfo(info);
        setIsConnected(true);
        setStatusMessage('Device connected');
        toast.success('Device connected');
        return true;
      } else {
        setIsConnected(false);
        setStatusMessage('Failed to connect to device');
        toast.error('Device not found');
        return false;
      }
    } catch (error) {
      setIsConnected(false);
      setStatusMessage('Device connection error');
      toast.error('Connection error');
      return false;
    }
  };

  const sendTestPattern = async () => {
    if (!isConnected) {
      const connected = await checkDeviceConnection();
      if (!connected) return;
    }

    if (graphState.nodes.length === 0) {
      toast.error('Graph is empty');
      return;
    }

    try {
      setIsRunning(true);
      setStatusMessage('Sending pattern to device...');

      const payload = {
        name: patternName,
        graph: {
          nodes: graphState.nodes,
          connections: graphState.connections,
        },
        duration: 10000, // 10 seconds
      };

      const response = await fetch('/api/patterns/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatusMessage('Pattern running on device (10 seconds)');
        toast.success('Pattern sent to device');

        // Auto-stop after 10 seconds
        setTimeout(() => {
          stopTestPattern();
        }, 10000);
      } else {
        const error = await response.text();
        setStatusMessage(`Error: ${error}`);
        toast.error('Failed to send pattern');
        setIsRunning(false);
      }
    } catch (error) {
      setStatusMessage('Connection error');
      toast.error('Failed to connect to device');
      setIsRunning(false);
    }
  };

  const stopTestPattern = async () => {
    try {
      const response = await fetch('/api/patterns/test/stop', {
        method: 'POST',
      });

      if (response.ok) {
        setIsRunning(false);
        setStatusMessage('Pattern stopped');
        toast.success('Pattern stopped');
      } else {
        toast.error('Failed to stop pattern');
      }
    } catch (error) {
      toast.error('Connection error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--prism-bg-surface)] border-[var(--prism-bg-elevated)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--prism-text-primary)]">
            <Zap className="w-5 h-5" />
            Test on Device
          </DialogTitle>
          <DialogDescription className="text-[var(--prism-text-secondary)]">
            Send your graph pattern to the device for testing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Device Status */}
          <div className="p-4 rounded-lg bg-[var(--prism-bg-elevated)]">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-[var(--prism-success)]' : 'bg-[var(--prism-error)]'
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--prism-text-primary)]">
                  {isConnected ? 'Device Connected' : 'Device Disconnected'}
                </p>
                {deviceInfo && (
                  <p className="text-xs text-[var(--prism-text-secondary)] mt-1">
                    {deviceInfo.model || 'K1 Device'} • FW v{deviceInfo.firmware_version || 'unknown'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pattern Info */}
          <div className="space-y-2 p-3 bg-[var(--prism-bg-canvas)] rounded-lg border border-[var(--prism-bg-elevated)]">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--prism-text-secondary)]">Pattern Name</span>
              <span className="text-[var(--prism-text-primary)] font-medium">{patternName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--prism-text-secondary)]">Nodes</span>
              <span className="text-[var(--prism-text-primary)] font-medium">{graphState.nodes.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--prism-text-secondary)]">Connections</span>
              <span className="text-[var(--prism-text-primary)] font-medium">{graphState.connections.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--prism-text-secondary)]">Duration</span>
              <span className="text-[var(--prism-text-primary)] font-medium">10 seconds</span>
            </div>
          </div>

          {/* Status */}
          {statusMessage && (
            <div className="p-3 bg-[var(--prism-bg-canvas)] rounded-lg border border-[var(--prism-bg-elevated)]">
              <p className="text-xs text-[var(--prism-text-primary)]">{statusMessage}</p>
            </div>
          )}

          {/* Running Indicator */}
          {isRunning && (
            <div className="p-3 bg-[var(--prism-info)]/10 rounded-lg border border-[var(--prism-info)] flex items-center gap-2">
              <div className="w-2 h-2 bg-[var(--prism-info)] rounded-full animate-pulse" />
              <span className="text-xs text-[var(--prism-info)]">
                Pattern is running on device...
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <>
                <Button
                  onClick={checkDeviceConnection}
                  variant="outline"
                  className="flex-1 border-[var(--prism-bg-elevated)] text-[var(--prism-text-primary)] hover:bg-[var(--prism-bg-elevated)]"
                >
                  Check Connection
                </Button>
                <Button
                  onClick={sendTestPattern}
                  disabled={graphState.nodes.length === 0}
                  className="flex-1 bg-[var(--prism-success)] hover:bg-[var(--prism-success-dark)] text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test Pattern
                </Button>
              </>
            ) : (
              <Button
                onClick={stopTestPattern}
                className="w-full bg-[var(--prism-error)] hover:bg-[var(--prism-error-dark)] text-white"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

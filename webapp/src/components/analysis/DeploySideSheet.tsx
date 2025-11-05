import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Separator } from '../ui/separator';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useState } from 'react';
import type { ConnectionState } from '../../lib/types';
import { postDeployBundle } from '../../lib/api';

interface DeploySideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionState?: ConnectionState;
}

const DEVICES = [
  { id: 'Device-01', firmware: '2.6.1', status: 'online', lastSuccess: 'Today 12:30' },
  { id: 'Device-02', firmware: '2.4.0', status: 'warning', lastSuccess: 'Yesterday 21:04' },
  { id: 'Device-03', firmware: '2.6.1', status: 'online', lastSuccess: 'Today 11:12' },
];

type DeployState = 'idle' | 'pending' | 'confirmed' | 'unconfirmed' | 'error';

export function DeploySideSheet({ open, onOpenChange, connectionState }: DeploySideSheetProps) {
  const [deployState, setDeployState] = useState<DeployState>('idle');
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  const handleDeploy = async () => {
    if (!connectionState?.connected || !connectionState.deviceIp) {
      setDeployState('error');
      setDeployMessage('Connect to a device before deploying a bundle.');
      return;
    }

    setDeployState('pending');
    setDeployMessage('Sending bundle to device…');

    try {
      const payload = {
        bundle_id: 'analysis-mock-bundle',
        generated_at: new Date().toISOString(),
        track_count: DEVICES.length,
      };
      const result = await postDeployBundle(connectionState.deviceIp, payload);

      if (!result.ok) {
        setDeployState('error');
        setDeployMessage('Firmware rejected the bundle.');
        return;
      }

      if (!result.confirmed) {
        setDeployState('unconfirmed');
        setDeployMessage('Bundle sent but firmware did not confirm. Check the device logs to verify deployment.');
        return;
      }

      setDeployState('confirmed');
      setDeployMessage('Bundle deployed successfully.');
    } catch (err: any) {
      const description = err?.message ? String(err.message) : 'Deployment request failed.';
      setDeployState('error');
      setDeployMessage(description);
    }
  };

  const isDeploying = deployState === 'pending';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] space-y-4 border-l"
        style={{
          backgroundColor: 'var(--color-prism-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <SheetHeader>
          <SheetTitle
            className="font-['Bebas_Neue',sans-serif] uppercase tracking-wide"
            style={{ color: 'var(--color-prism-text-primary)' }}
          >
            Deploy Bundle
          </SheetTitle>
          <SheetDescription style={{ color: 'var(--color-prism-text-secondary)' }}>
            Firmware minimum: 2.5.0 · Map version: v4.0 · Runtime risk: 7.3 ms
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="space-y-3">
          {DEVICES.map((device) => (
            <div
              key={device.id}
              className="rounded-lg border px-3 py-2"
              style={{
                backgroundColor: 'var(--color-prism-bg-elevated)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-prism-text-primary)' }}>
                  {device.id}
                </span>
                <Badge
                  variant="outline"
                  style={{
                    borderColor:
                      device.status === 'warning'
                        ? 'var(--color-prism-warning)'
                        : 'var(--color-prism-success)',
                    color:
                      device.status === 'warning'
                        ? 'var(--color-prism-warning)'
                        : 'var(--color-prism-success)',
                  }}
                >
                  FW {device.firmware}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs"
                style={{ color: 'var(--color-prism-text-secondary)' }}
              >
                <span>Last success: {device.lastSuccess}</span>
                <Button size="sm" variant="ghost" className="text-xs">
                  View logs
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-3 text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>
          <p>
            Deployment is enabled because bundle compatibility checks passed and
            runtime risk is below 8 ms target.
          </p>
          <Button className="w-full" onClick={handleDeploy} disabled={isDeploying}>
            {isDeploying ? 'Deploying…' : 'Deploy bundle'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <div
            aria-live="polite"
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor:
                deployState === 'confirmed'
                  ? 'var(--color-prism-success)'
                  : deployState === 'unconfirmed'
                    ? 'var(--color-prism-warning)'
                    : deployState === 'error'
                      ? 'var(--color-prism-error)'
                      : 'var(--color-border)',
              backgroundColor: 'var(--color-prism-bg-elevated)',
              color:
                deployState === 'confirmed'
                  ? 'var(--color-prism-success)'
                  : deployState === 'unconfirmed'
                    ? 'var(--color-prism-warning)'
                    : deployState === 'error'
                      ? 'var(--color-prism-error)'
                      : 'var(--color-prism-text-secondary)',
            }}
          >
            {deployMessage ||
              (connectionState?.connected
                ? 'Ready to deploy the currently analysed bundle.'
                : 'Connect to a device to deploy the analysed bundle.')}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

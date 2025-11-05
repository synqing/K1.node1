import { Activity, Cpu, HardDrive } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { PerformanceMetrics, ConnectionState } from '../../lib/types';
import { generatePerformanceMetrics } from '../../lib/mockData';
import { getPerformanceMetrics, FirmwarePerformanceMetrics } from '../../lib/api';

interface StatusBarProps {
  connectionState: ConnectionState;
}

export function StatusBar({ connectionState }: StatusBarProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(generatePerformanceMetrics());
  const isConnected = !!connectionState?.connected && !!connectionState?.deviceIp;
  const srOnlyStyles: CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };
  
  useEffect(() => {
    if (!isConnected) {
      // When disconnected, clear the interval and show static/empty data
      setMetrics({
        fps: 0,
        frameTime: 0,
        effectTime: 0,
        gpuTime: 0,
        driverTime: 0,
        otherTime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        timestamp: Date.now(),
      });
      return;
    }

    // When connected, poll real performance data
    const fetchMetrics = async () => {
      try {
        const fwMetrics: FirmwarePerformanceMetrics = await getPerformanceMetrics(connectionState.deviceIp);
        // Convert firmware metrics to webapp format
        setMetrics({
          fps: fwMetrics.fps,
          frameTime: fwMetrics.frame_time_us / 1000, // Convert μs to ms
          effectTime: fwMetrics.frame_time_us, // Keep as μs for display
          gpuTime: 0, // Not available from firmware
          driverTime: 0, // Not available from firmware
          otherTime: 0, // Not available from firmware
          cpuUsage: fwMetrics.cpu_percent,
          memoryUsage: fwMetrics.memory_percent,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.warn('Failed to fetch performance metrics:', error);
        // Keep previous metrics on error, don't reset to mock data
      }
    };

    // Initial fetch
    fetchMetrics();
    
    // Set up polling interval
    const interval = setInterval(fetchMetrics, 500); // 2Hz update rate for real data
    
    return () => clearInterval(interval);
  }, [isConnected, connectionState.deviceIp]);
  
  const getFpsColor = (fps: number) => {
    if (fps >= 58) return 'var(--prism-success)';
    if (fps >= 50) return 'var(--prism-warning)';
    return 'var(--prism-error)';
  };
  
  const getCpuColor = (cpu: number) => {
    if (cpu < 50) return 'var(--prism-success)';
    if (cpu < 75) return 'var(--prism-warning)';
    return 'var(--prism-error)';
  };
  
  const getMemColor = (mem: number) => {
    if (mem < 70) return 'var(--prism-success)';
    if (mem < 85) return 'var(--prism-warning)';
    return 'var(--prism-error)';
  };
  
  return (
    <div className="relative h-12 bg-[var(--prism-bg-surface)] border-t border-[var(--prism-bg-elevated)] flex items-center justify-between px-6">
      <div aria-live="polite" style={srOnlyStyles}>
        {`FPS ${metrics.fps.toFixed(1)}, CPU ${metrics.cpuUsage.toFixed(1)} percent, Memory ${metrics.memoryUsage.toFixed(1)} percent.`}
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4" style={{ color: getFpsColor(metrics.fps) }} />
          <span className="text-xs text-[var(--prism-text-secondary)]">FPS:</span>
          <span 
            className="text-sm font-jetbrains font-medium"
            style={{ color: getFpsColor(metrics.fps) }}
          >
            {metrics.fps.toFixed(1)}
          </span>
        </div>
        
        <div className="h-4 w-px bg-[var(--prism-bg-elevated)]" />
        
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4" style={{ color: getCpuColor(metrics.cpuUsage) }} />
          <span className="text-xs text-[var(--prism-text-secondary)]">CPU:</span>
          <span 
            className="text-sm font-jetbrains font-medium"
            style={{ color: getCpuColor(metrics.cpuUsage) }}
          >
            {metrics.cpuUsage.toFixed(1)}%
          </span>
        </div>
        
        <div className="h-4 w-px bg-[var(--prism-bg-elevated)]" />
        
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4" style={{ color: getMemColor(metrics.memoryUsage) }} />
          <span className="text-xs text-[var(--prism-text-secondary)]">Memory:</span>
          <span 
            className="text-sm font-jetbrains font-medium"
            style={{ color: getMemColor(metrics.memoryUsage) }}
          >
            {metrics.memoryUsage.toFixed(1)}%
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-xs text-[var(--prism-text-secondary)]">
          Frame Time:{' '}
          <span className="font-jetbrains text-[var(--prism-text-primary)]">
            {metrics.frameTime.toFixed(2)}ms
          </span>
        </div>
        
        <div className="text-xs text-[var(--prism-text-secondary)]">
          Effect:{' '}
          <span className="font-jetbrains text-[var(--prism-text-primary)]">
            {metrics.effectTime}μs
          </span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { generatePerformanceMetrics } from '../../lib/mockData';
import { PerformanceMetrics } from '../../lib/types';

export function LiveStatistics() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(generatePerformanceMetrics());
  const [previousMetrics, setPreviousMetrics] = useState<PerformanceMetrics>(generatePerformanceMetrics());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPreviousMetrics(metrics);
      setMetrics(generatePerformanceMetrics());
    }, 500); // 2Hz update rate
    
    return () => clearInterval(interval);
  }, [metrics]);
  
  const getTrend = (current: number, previous: number) => {
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) return 'stable';
    return diff > 0 ? 'up' : 'down';
  };
  
  const TrendIndicator = ({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) => {
    const trend = getTrend(current, previous);
    
    if (trend === 'stable') {
      return <Minus className="w-3 h-3 text-[var(--prism-text-secondary)]" />;
    }
    
    const isGood = inverse ? trend === 'down' : trend === 'up';
    const Icon = trend === 'up' ? TrendingUp : TrendingDown;
    const color = isGood ? 'var(--prism-success)' : 'var(--prism-error)';
    
    return <Icon className="w-3 h-3" style={{ color }} />;
  };
  
  const stats = [
    { label: 'Current FPS', value: metrics.fps.toFixed(1), unit: '', inverse: false, prev: previousMetrics.fps },
    { label: 'Avg FPS', value: '60.2', unit: '', inverse: false, prev: 60.1 },
    { label: 'Min FPS', value: '55.3', unit: '', inverse: false, prev: 55.5 },
    { label: 'Max FPS', value: '64.8', unit: '', inverse: false, prev: 64.7 },
    { label: 'Frame Time', value: metrics.frameTime.toFixed(2), unit: 'ms', inverse: true, prev: previousMetrics.frameTime },
    { label: 'Effect Time', value: metrics.effectTime.toString(), unit: 'μs', inverse: true, prev: previousMetrics.effectTime },
    { label: 'GPU Time', value: metrics.gpuTime.toString(), unit: 'μs', inverse: true, prev: previousMetrics.gpuTime },
    { label: 'Driver Time', value: metrics.driverTime.toString(), unit: 'μs', inverse: true, prev: previousMetrics.driverTime },
    { label: 'CPU Usage', value: metrics.cpuUsage.toFixed(1), unit: '%', inverse: true, prev: previousMetrics.cpuUsage },
    { label: 'Memory Usage', value: metrics.memoryUsage.toFixed(1), unit: '%', inverse: true, prev: previousMetrics.memoryUsage },
    { label: 'Free Heap', value: (100 - metrics.memoryUsage).toFixed(1), unit: '%', inverse: false, prev: 100 - previousMetrics.memoryUsage },
    { label: 'Dropped Frames', value: '0', unit: '', inverse: true, prev: 0 },
  ];
  
  return (
    <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)]">
      <div className="p-4 border-b border-[var(--prism-bg-elevated)]">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">Live Statistics</h3>
        <p className="text-xs text-[var(--prism-text-secondary)] mt-1">Real-time performance metrics</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--prism-bg-elevated)]">
              <th className="text-left text-xs text-[var(--prism-text-secondary)] px-4 py-2">Metric</th>
              <th className="text-right text-xs text-[var(--prism-text-secondary)] px-4 py-2">Value</th>
              <th className="text-center text-xs text-[var(--prism-text-secondary)] px-4 py-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, index) => (
              <tr 
                key={stat.label}
                className="border-b border-[var(--prism-bg-elevated)] hover:bg-[var(--prism-bg-elevated)]/30 transition-colors"
              >
                <td className="text-xs text-[var(--prism-text-primary)] px-4 py-2.5">
                  {stat.label}
                </td>
                <td className="text-xs font-jetbrains text-[var(--prism-text-primary)] px-4 py-2.5 text-right">
                  {stat.value}
                  {stat.unit && <span className="text-[var(--prism-text-secondary)] ml-1">{stat.unit}</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex justify-center">
                    <TrendIndicator current={parseFloat(stat.value)} previous={stat.prev} inverse={stat.inverse} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

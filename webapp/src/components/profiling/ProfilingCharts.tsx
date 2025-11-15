import { useEffect, useState, Suspense } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PerformanceMetrics, EffectType } from '../../lib/types';
import { generateHistoricalMetrics, EFFECTS } from '../../lib/mockData';
import { LazyVisible } from '../common/LazyVisible';

interface ProfilingChartsProps {
  selectedEffect: EffectType | 'all';
  timeRange: number;
}

export function ProfilingCharts({ selectedEffect, timeRange }: ProfilingChartsProps) {
  const [fpsData, setFpsData] = useState<PerformanceMetrics[]>([]);
  const [frameTimeData, setFrameTimeData] = useState<PerformanceMetrics[]>([]);
  const [cpuData, setCpuData] = useState<any[]>([]);
  const [memoryData, setMemoryData] = useState<PerformanceMetrics[]>([]);
  
  useEffect(() => {
    // Initialize historical data
    const initialData = generateHistoricalMetrics(timeRange, selectedEffect === 'all' ? undefined : selectedEffect);
    setFpsData(initialData);
    setFrameTimeData(initialData);
    setMemoryData(initialData);
    
    // Generate CPU comparison data across effects
    const cpuComparison = EFFECTS.map(effect => ({
      effect: effect.name,
      cpu: 150 + Math.random() * 200,
    }));
    setCpuData(cpuComparison);
  }, [selectedEffect, timeRange]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--prism-bg-elevated)] border border-[var(--prism-bg-canvas)] rounded-lg p-3 shadow-lg">
          <p className="text-xs text-[var(--prism-text-secondary)] mb-1">Frame {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs font-jetbrains" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              {entry.unit || ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  
  // Using static imports for Recharts primitives

  const chartFallback = <div className="h-[200px] w-full rounded bg-[var(--prism-bg-elevated)]/50" />;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* FPS Over Time */}
      <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">FPS Over Time</h3>
        <LazyVisible
          placeholder={<div className="h-[200px] w-full bg-[var(--prism-bg-elevated)]/50 rounded" />}
        >
        <Suspense fallback={chartFallback}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fpsData.slice(-100)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                domain={[50, 70]}
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={60} stroke="var(--prism-success)" strokeDasharray="3 3" label={{ value: 'Target', fontSize: 10, fill: 'var(--prism-success)' }} />
              <ReferenceLine y={55} stroke="var(--prism-warning)" strokeDasharray="3 3" label={{ value: 'Min', fontSize: 10, fill: 'var(--prism-warning)' }} />
              <Line 
                type="monotone" 
                dataKey="fps" 
                stroke="var(--prism-info)" 
                strokeWidth={2}
                dot={false}
                name="FPS"
              />
            </LineChart>
          </ResponsiveContainer>
        </Suspense>
        </LazyVisible>
      </div>
      
      {/* Frame Time Breakdown */}
      <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">Frame Time Breakdown</h3>
        <LazyVisible placeholder={<div className="h-[200px] w-full bg-[var(--prism-bg-elevated)]/50 rounded" />}>
        <Suspense fallback={chartFallback}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={frameTimeData.slice(-100)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
                label={{ value: 'μs', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--prism-text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Area 
                type="monotone" 
                dataKey="effectTime" 
                stackId="1"
                stroke="var(--prism-scalar)" 
                fill="var(--prism-scalar)"
                fillOpacity={0.6}
                name="Effect"
              />
              <Area 
                type="monotone" 
                dataKey="gpuTime" 
                stackId="1"
                stroke="var(--prism-field)" 
                fill="var(--prism-field)"
                fillOpacity={0.6}
                name="GPU"
              />
              <Area 
                type="monotone" 
                dataKey="driverTime" 
                stackId="1"
                stroke="var(--prism-color)" 
                fill="var(--prism-color)"
                fillOpacity={0.6}
                name="Driver"
              />
              <Area 
                type="monotone" 
                dataKey="otherTime" 
                stackId="1"
                stroke="var(--prism-output)" 
                fill="var(--prism-output)"
                fillOpacity={0.6}
                name="Other"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Suspense>
        </LazyVisible>
      </div>
      
      {/* CPU Usage Comparison */}
      <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">CPU Usage by Effect</h3>
        <LazyVisible placeholder={<div className="h-[200px] w-full bg-[var(--prism-bg-elevated)]/50 rounded" />}>
        <Suspense fallback={chartFallback}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
              <XAxis 
                dataKey="effect" 
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
                label={{ value: 'μs', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--prism-text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="cpu" 
                fill="var(--prism-gold)"
                name="CPU Time"
              />
            </BarChart>
          </ResponsiveContainer>
        </Suspense>
        </LazyVisible>
      </div>
      
      {/* Memory Usage */}
      <div className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
        <h3 className="text-sm font-medium text-[var(--prism-text-primary)] mb-4">Memory Usage</h3>
        <LazyVisible placeholder={<div className="h-[200px] w-full bg-[var(--prism-bg-elevated)]/50 rounded" />}>
        <Suspense fallback={chartFallback}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={memoryData.slice(-100)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--prism-bg-elevated)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                domain={[0, 100]}
                stroke="var(--prism-text-secondary)"
                tick={{ fontSize: 10 }}
                label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--prism-text-secondary)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke="var(--prism-warning)" strokeDasharray="3 3" label={{ value: 'Warning', fontSize: 10, fill: 'var(--prism-warning)' }} />
              <ReferenceLine y={85} stroke="var(--prism-error)" strokeDasharray="3 3" label={{ value: 'Critical', fontSize: 10, fill: 'var(--prism-error)' }} />
              <Area 
                type="monotone" 
                dataKey="memoryUsage" 
                stroke="var(--prism-info)" 
                fill="var(--prism-info)"
                fillOpacity={0.4}
                name="Memory"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Suspense>
        </LazyVisible>
      </div>
    </div>
  );
}

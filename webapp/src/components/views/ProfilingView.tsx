import { Suspense, lazy, useState } from 'react';
import { EffectType } from '../../lib/types';
import { ProfilingFilters } from '../profiling/ProfilingFilters';
import { LiveStatistics } from '../profiling/LiveStatistics';
import { toast } from 'sonner';

// Lazy-load heavy charts bundle (recharts)
const ProfilingCharts = lazy(() =>
  import('../profiling/ProfilingCharts').then((m) => ({ default: m.ProfilingCharts }))
);

export function ProfilingView() {
  const [selectedEffect, setSelectedEffect] = useState<EffectType | 'all'>('all');
  const [timeRange, setTimeRange] = useState(500);
  const [showPhaseComparison, setShowPhaseComparison] = useState(false);
  
  const handleExport = () => {
    toast.success('Profiling data exported successfully', {
      description: 'CSV file downloaded to your device',
    });
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <ProfilingFilters
        selectedEffect={selectedEffect}
        onEffectChange={setSelectedEffect}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        showPhaseComparison={showPhaseComparison}
        onPhaseComparisonToggle={setShowPhaseComparison}
        onExport={handleExport}
      />
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-6" role="status" aria-label="Loading charts">
            {[0,1,2,3].map((i) => (
              <div key={i} className="bg-[var(--prism-bg-surface)] rounded-lg border border-[var(--prism-bg-elevated)] p-4">
                <div className="h-4 w-40 mb-4 bg-[var(--prism-bg-elevated)]/50 rounded" />
                <div className="h-48 w-full bg-[var(--prism-bg-elevated)]/50 rounded" />
              </div>
            ))}
          </div>
        }
      >
        <ProfilingCharts selectedEffect={selectedEffect} timeRange={timeRange} />
      </Suspense>
      
      <LiveStatistics />
    </div>
  );
}

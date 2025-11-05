import { cn } from "@/components/ui/utils";
import { lazy, Suspense } from "react";
import type { EffectType } from "@/lib/types";

// Lazy-load heavy charts bundle to align with view-level lazy imports
const ProfilingCharts = lazy(() =>
  import("@/components/profiling/ProfilingCharts").then((m) => ({ default: m.ProfilingCharts }))
);

export interface ProfilingChartsWrapperProps {
  selectedEffect: EffectType | "all";
  timeRange: number;
  className?: string;
}

export function ProfilingChartsWrapper({
  selectedEffect,
  timeRange,
  className,
}: ProfilingChartsWrapperProps) {
  return (
    <div className={cn("w-full", className)} aria-label="Profiling Charts">
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 w-full bg-[var(--prism-bg-elevated)]/50 rounded" />
            ))}
          </div>
        }
      >
        <ProfilingCharts selectedEffect={selectedEffect} timeRange={timeRange} />
      </Suspense>
    </div>
  );
}

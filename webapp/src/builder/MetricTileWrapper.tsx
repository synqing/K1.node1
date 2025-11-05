import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type MetricTrend = "up" | "down" | "flat";
type MetricTone = "default" | "success" | "warning" | "error" | "info";

const toneClassName: Record<MetricTone, string> = {
  default:
    "bg-[var(--prism-bg-elevated)] text-[var(--prism-text-secondary)] border border-[var(--prism-bg-canvas)]/40",
  success:
    "bg-[var(--prism-success)]/15 text-[var(--prism-success)] border border-[var(--prism-success)]/30",
  warning:
    "bg-[var(--prism-warning)]/15 text-[var(--prism-warning)] border border-[var(--prism-warning)]/30",
  error:
    "bg-[var(--prism-error)]/15 text-[var(--prism-error)] border border-[var(--prism-error)]/30",
  info:
    "bg-[var(--prism-info)]/15 text-[var(--prism-info)] border border-[var(--prism-info)]/30",
};

export interface MetricTileProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: MetricTrend;
  tone?: MetricTone;
  decimals?: number;
  icon?: ReactNode;
  className?: string;
}

function formatValue(value: number | string, decimals?: number) {
  if (typeof value === "number") {
    const precision = typeof decimals === "number" ? Math.max(0, decimals) : 0;
    return value.toFixed(precision);
  }
  return value;
}

export function MetricTileWrapper({
  label,
  value,
  unit,
  trend = "flat",
  tone = "default",
  decimals,
  icon,
  className,
}: MetricTileProps) {
  const toneBadgeClass = toneClassName[tone] ?? toneClassName.default;

  return (
    <div
      role="group"
      aria-label={`Metric ${label}`}
      className={cn(
        "bg-[var(--prism-bg-surface)] text-[var(--prism-text-primary)] rounded-xl border border-[var(--prism-bg-elevated)] p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs text-[var(--prism-text-secondary)]">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-[var(--prism-gold)]">{icon}</span> : null}
          <span className="uppercase tracking-wide">{label}</span>
        </div>
        {trend !== "flat" && (
          <span className="sr-only">trend {trend}</span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {formatValue(value, decimals)}
        </span>
        {unit ? (
          <span className="text-sm text-[var(--prism-text-secondary)]">{unit}</span>
        ) : null}
      </div>

      {trend !== "flat" ? (
        <div className="mt-4 text-xs font-medium">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1", toneBadgeClass)}>
            <span aria-hidden>
              {trend === "up" ? "▲" : "▼"}
            </span>
            <span className="capitalize">{tone === "default" ? trend : tone}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}


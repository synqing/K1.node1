import { cn } from "@/components/ui/utils";
import { lazy, Suspense } from "react";

const TerminalView = lazy(() =>
  import("@/components/views/TerminalView").then((m) => ({ default: m.TerminalView }))
);

export interface TerminalPanelWrapperProps {
  initialCommand?: string;
  autoScroll?: boolean;
  historyLimit?: number;
  className?: string;
}

export function TerminalPanelWrapper({
  className,
  initialCommand,
  autoScroll,
  historyLimit,
}: TerminalPanelWrapperProps) {
  return (
    <div role="region" aria-label="Terminal" className={cn(className)}>
      <Suspense
        fallback={
          <div className="flex flex-col gap-2">
            <div className="h-8 w-64 bg-[var(--prism-bg-elevated)]/50 rounded" />
            <div className="h-64 w-full bg-[var(--prism-bg-elevated)]/50 rounded" />
          </div>
        }
      >
        <TerminalView
          initialCommand={initialCommand}
          autoScroll={autoScroll}
          historyLimit={historyLimit}
        />
      </Suspense>
    </div>
  );
}

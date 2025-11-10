import { AlertCircle, X } from 'lucide-react';
import { NodeError } from '../../lib/types';
import { Button } from '../ui/button';

interface ErrorPanelProps {
  errors: NodeError[];
  onErrorClick: (nodeId: string) => void;
  onClearErrors: () => void;
}

export function ErrorPanel({ errors, onErrorClick, onClearErrors }: ErrorPanelProps) {
  return (
    <div className="w-80 bg-[var(--prism-bg-surface)] border-l border-[var(--prism-bg-elevated)] overflow-y-auto">
      <div className="p-4 border-b border-[var(--prism-bg-elevated)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--prism-error)]" />
          <h3 className="text-sm font-medium text-[var(--prism-text-primary)]">
            Errors ({errors.length})
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearErrors}
          className="h-6 px-2 text-xs text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)]"
        >
          Clear
        </Button>
      </div>
      
      <div className="p-2 space-y-2">
        {errors.map((error) => (
          <button
            key={error.id}
            onClick={() => onErrorClick(error.nodeId)}
            className="w-full p-3 rounded-lg bg-[var(--prism-bg-elevated)] hover:bg-[var(--prism-bg-canvas)] border border-transparent hover:border-[var(--prism-error)] transition-colors text-left"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span
                className="text-xs font-medium capitalize"
                style={{
                  color: error.severity === 'error' ? 'var(--prism-error)' : 'var(--prism-warning)',
                }}
              >
                {error.severity}
              </span>
              <span className="text-xs text-[var(--prism-text-secondary)] font-jetbrains">
                #{error.nodeId.slice(0, 8)}
              </span>
            </div>
            <p className="text-sm text-[var(--prism-text-primary)]">{error.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

import { AlertCircle, X } from 'lucide-react';
import { Button } from '../ui/button';
import React from 'react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  showIcon?: boolean;
  className?: string;
}

export function ErrorAlert({
  title = 'Error',
  message,
  onDismiss,
  onRetry,
  showIcon = true,
  className = ''
}: ErrorAlertProps) {
  return (
    <div 
      className={`bg-[var(--prism-error)]/10 border border-[var(--prism-error)] rounded-lg p-4 flex gap-3 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {showIcon && (
        <AlertCircle className="w-5 h-5 text-[var(--prism-error)] flex-shrink-0 mt-0.5" aria-hidden="true" />
      )}
      
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="font-medium text-[var(--prism-error)] mb-1">
            {title}
          </h3>
        )}
        <p className="text-sm text-[var(--prism-text-primary)] break-words">
          {message}
        </p>
      </div>
      
      <div className="flex gap-2 flex-shrink-0">
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="text-[var(--prism-error)] hover:bg-[var(--prism-error)]/10 border-[var(--prism-error)]"
          >
            Retry
          </Button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="h-6 w-6 rounded hover:bg-[var(--prism-bg-elevated)] flex items-center justify-center text-[var(--prism-text-secondary)] hover:text-[var(--prism-text-primary)] transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

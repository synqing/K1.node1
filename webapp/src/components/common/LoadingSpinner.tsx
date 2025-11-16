import { Loader2 } from 'lucide-react';
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  inline?: boolean;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  label,
  inline = false,
  className = ''
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const spinner = (
    <Loader2 
      className={`${sizeMap[size]} animate-spin text-[var(--prism-gold)] ${className}`}
      aria-live="polite"
      aria-label={label || 'Loading'}
    />
  );

  if (inline) {
    return <span className="flex items-center gap-2">{spinner}{label && <span>{label}</span>}</span>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2" role="status">
      {spinner}
      {label && <span className="text-sm text-[var(--prism-text-secondary)]">{label}</span>}
    </div>
  );
}

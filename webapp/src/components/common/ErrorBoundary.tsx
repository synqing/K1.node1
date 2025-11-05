import React from 'react';

type ErrorBoundaryState = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4" style={{ color: 'var(--color-prism-text-primary)' }}>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm" style={{ color: 'var(--color-prism-text-secondary)' }}>
            The Analysis view encountered an error. Try reloading, or check the console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}


// Browser-only bridge to expose Vite env to globalThis without using import.meta in shared code.
// This helps tests/SSR that consume getEnvSafe() while keeping env.ts free of import.meta.

try {
  const meta = (typeof import.meta !== 'undefined' ? (import.meta as any) : undefined);
  const env = meta?.env;
  if (env && typeof globalThis !== 'undefined') {
    // Expose under well-known keys checked by getEnvSafe()
    (globalThis as any).__META_ENV__ = env;
    (globalThis as any).__VITE_ENV__ = env;
    (globalThis as any).import_meta_env = env;
  }
} catch {
  // Ignore in non-browser contexts
}


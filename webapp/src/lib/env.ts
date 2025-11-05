// Safe environment access helpers (no eval, no direct import.meta token)
export type EnvLike = Record<string, any> | undefined;

export function getEnvSafe(): EnvLike {
  try {
    // Avoid referencing the `import.meta` token directly to prevent parser/TS diagnostics
    // Try well-known globals that may be attached by the app or test harness
    const g = globalThis as any;
    const envObj = (
      g?.__VITE_ENV__ ||
      g?.__META_ENV__ ||
      g?.import_meta_env ||
      undefined
    ) as Record<string, any> | undefined;

    // Fallback to Node-style env in SSR/tests when available
    const nodeEnv = (g?.process?.env && typeof g.process.env === 'object') ? (g.process.env as Record<string, any>) : undefined;
    const source = envObj || nodeEnv;
    if (!source) return undefined;

    const out = { ...source };
    // Ensure MODE exists for environments where only DEV/PROD are injected
    if (typeof out.MODE !== 'string') {
      const dev = out.DEV === true || out.DEV === 'true';
      const prod = out.PROD === true || out.PROD === 'true';
      out.MODE = dev ? 'development' : (prod ? 'production' : (typeof out.NODE_ENV === 'string' ? out.NODE_ENV : 'development'));
    }
    return out;
  } catch {
    // Gracefully return undefined when not available (tests/SSR)
    return undefined;
  }
}

function isTrueLike(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isDevEnabled(keys: string[] = [
  'VITE_SHOW_DEV_WIDGET',
  'VITE_ENABLE_DEV_METRICS',
]): boolean {
  const env = getEnvSafe();
  const modeExplicit = (env && (
    typeof env.DEV !== 'undefined' ||
    typeof env.PROD !== 'undefined' ||
    typeof env.NODE_ENV === 'string'
  ));
  const devFlag = !!(
    isTrueLike(env?.DEV) ||
    (modeExplicit && env?.MODE === 'development') ||
    env?.NODE_ENV === 'development'
  );
  const anyKey = keys.some((k) => isTrueLike(env?.[k]));
  return devFlag || anyKey;
}

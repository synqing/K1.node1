import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getEnvSafe, isDevEnabled } from '../lib/env';

describe('env helper', () => {
  const g = globalThis as any;

  const save = {
    META_ENV: g.__META_ENV__,
    VITE_ENV: g.__VITE_ENV__,
    import_meta_env: g.import_meta_env,
    process_env: g.process?.env,
  };

  beforeEach(() => {
    delete g.__META_ENV__;
    delete g.__VITE_ENV__;
    delete g.import_meta_env;
    if (g.process) delete g.process.env;
  });

  afterEach(() => {
    g.__META_ENV__ = save.META_ENV;
    g.__VITE_ENV__ = save.VITE_ENV;
    g.import_meta_env = save.import_meta_env;
    if (g.process) g.process.env = save.process_env;
  });

  it('returns undefined when no env source is present', () => {
    const env = getEnvSafe();
    expect(env).toBeUndefined();
    expect(isDevEnabled()).toBe(false);
  });

  it('reads from browser bridge globals and derives MODE from DEV', () => {
    g.__META_ENV__ = { DEV: true };
    const env = getEnvSafe();
    expect(env?.DEV).toBe(true);
    expect(env?.MODE).toBe('development');
    expect(isDevEnabled()).toBe(true);
  });

  it('falls back to Node process.env and derives MODE from NODE_ENV', () => {
    g.process = g.process || {};
    g.process.env = { NODE_ENV: 'production' };
    const env = getEnvSafe();
    expect(env?.NODE_ENV).toBe('production');
    expect(env?.MODE).toBe('production');
    expect(isDevEnabled()).toBe(false);
  });

  it('isDevEnabled respects provided keys when env flags are set', () => {
    g.__VITE_ENV__ = { VITE_SHOW_DEV_WIDGET: 'true' };
    expect(isDevEnabled(['VITE_SHOW_DEV_WIDGET'])).toBe(true);
    expect(isDevEnabled(['VITE_ENABLE_DEV_METRICS'])).toBe(false);
  });
});


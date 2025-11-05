Environment Helpers and Feature Flags

- Overview: Centralized helpers provide safe, SSR/test-friendly access to environment variables and consistent dev gating across the app.

- Helpers:
  - `getEnvSafe()`: Reads env from globals (`__VITE_ENV__`, `__META_ENV__`, `import_meta_env`) or `process.env` in Node/Jest. Avoids direct `import.meta.env` references in shared code.
  - `isDevEnabled(keys?: string[])`: Returns `true` if explicitly in development mode (`DEV`, `MODE='development'`, `NODE_ENV`), or if any provided flags are truthy. Accepts optional feature flag keys to gate dev-only UI and behaviors.

- Bridge:
  - `env-bridge.ts`: Browser-only shim that attaches Vite `import.meta.env` to `globalThis` under keys consumed by `getEnvSafe()`. Keeps `env.ts` free of `import.meta` usage.

- Flags:
  - Define and import keys from `lib/env-flags.ts` to avoid typos.
    - `FLAG_SHOW_DEV_WIDGET`
    - `FLAG_ENABLE_DEV_METRICS`
    - `FLAG_ENABLE_TIMING_OVERRIDES`
    - `FLAG_SHOW_PREVIEW_LINK`
    - `DEV_WIDGET_AND_METRICS` (common combination)

- Patterns:
  - Gate dev widgets and telemetry:
    - `if (isDevEnabled([...DEV_WIDGET_AND_METRICS])) { /* emit events */ }`
  - Enable timing overrides panel:
    - `if (!isDevEnabled([FLAG_ENABLE_TIMING_OVERRIDES])) return null;`
  - Show Quick Preview link:
    - `const showPreview = isDevEnabled([FLAG_SHOW_PREVIEW_LINK]);`

- Best Practices:
  - Keep shared code free of `import.meta` references; prefer `getEnvSafe()`.
  - Use flag constants from `env-flags.ts` instead of inline strings.
  - Favor explicit flags to enable dev-only UI in production when needed.
  - Write tests that mock `getEnvSafe()` rather than relying on `import.meta.env`.


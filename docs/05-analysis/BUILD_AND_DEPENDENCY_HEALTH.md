# Build and Dependency Health

## Node/TypeScript
- `conductor-api` minimal deps (`zod`, `typescript`); low vulnerability surface.
- No test script; add typecheck and minimal unit tests in CI.

## Firmware
- PlatformIO builds; caches tracked in CI; guard added for tempo sync.
- Unit/hardware tests configured for Phase A where present.

## CI
- `.github/workflows/k1-node1-ci.yml` includes continue-on-error in jobs.
- Added tempo sync guard before firmware build.
- Recommend enabling fail-fast for critical checks.

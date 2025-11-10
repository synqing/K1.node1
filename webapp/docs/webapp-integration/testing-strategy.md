# Integration Testing Strategy

## Scope
- Frontend hooks and services for workflow execution and status polling.
- End-to-end orchestration from pattern code → workflow → firmware build → device deployment (where device is available).

## Test Types
- Unit tests:
  - `src/services/orkes.ts`: input validation, error paths (mock fetch).
  - `src/hooks/useWorkflow.ts`: mutation/query lifecycles using React Query test utils.
- Integration tests (headless):
  - Trigger `k1_pattern_compilation` via REST, poll until terminal state, assert outputs shape.
  - Simulate device deployment via `postDeployBundle` with mock server or local ESP32.
- Performance tests:
  - Workflow polling under load (multiple simultaneous workflows); ensure UI remains responsive.
  - Device params updates at target rates; measure impact on UI thread.

## Test Cases
- Successful compilation: RUNNING → COMPLETED with `binaryPath` present.
- Failed compilation: RUNNING → FAILED; error messages surfaced.
- Pause/resume: transitions reflect immediately and continue execution.
- Retry: failed workflow resumes execution and reaches terminal state.
- Network failures: fetch rejects; UI shows retry and backoff; no crash.
- Device opaque POST fallback: returns `{ ok: true, confirmed: false }` state.

## Rollback Procedures
- If integration fails post-deploy:
  - Feature flag to disable workflow integration UI.
  - Revert to static pattern selection using existing firmware endpoints.
  - Maintain device control via `postParams` and `postSelect` unaffected.


# Recovery Action Plan

## Phase 1: Stabilize
- Add tempo sync contract guard in CI (done).
- Encapsulate firmware snapshot sync into a single function with unit hooks.
- Add minimal schema/unit tests to `conductor-api`.

## Phase 2: Reduce Coupling
- Extract data-plane sync into module; expose tested interface.
- Normalize pattern access via `pattern_audio_interface.h` wrappers.
- Add performance sanity tests from `firmware/measurements` thresholds.

## Phase 3: Hardening
- Expand CI preflight to include guard scripts and static checks.
- Introduce semver tags for `conductor-api` interfaces.
- Increase bus factor via code ownership rotation and documentation.

## Exit Criteria
- All guards green for 2 consecutive weeks.
- No regressions detected by contract tests.
- Risk matrix shows reduced churn on hotspots.

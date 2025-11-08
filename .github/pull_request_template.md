## Summary

Briefly describe what this PR changes and why.

## Phase A Security Fix Checklist (use when applicable)

- [ ] Fix category: Buffer overflow / Race condition / Globals / Initialization / Bounds
- [ ] Before/After snippets included (minimal diffs)
- [ ] Concurrency style: seqlock + atomic sequence counters (no mutex/spinlocks in hot paths)
- [ ] Bounds handling: modulo or Po2 bitmask; inline range checks for bins
- [ ] Snapshot fields default-initialized (no UB from uninitialized reads)
- [ ] Unit tests added/updated (Phase A set) and pass locally (PlatformIO/Unity)
- [ ] Telemetry verified: `/api/health`, `/api/rmt`, `/api/device/performance`

## Evidence

- Unit test log (attach or link CI artifact):
- Concurrency stress CSV (optional in PR; required for gate): `stress.csv`
- Beat phase report (optional in PR; required for gate): `beat_phase_report.csv`

## Commands

```
pio run -e esp32-s3-devkitc-1 && pio test -e esp32-s3-devkitc-1 --without-building --filter test_phase_a_security_fixes*
python tools/poll_beat_phase.py --device http://DEVICE --endpoint /api/device/performance --field beat_phase --interval 0.25 --count 240 --out beat_phase_log.csv
bash tools/run_phase_a_validation.sh
```

## Links

- Playbook: docs/Playbooks/K1NPlaybook_PHASE_A_SECURITY_AND_PHASE0_READINESS_v1.0_20251108.md
- Fixes Reference: docs/06-reference/K1NRef_REFERENCE_PHASE_A_SECURITY_FIXES_v1.0_20251108.md
- Validation Report: docs/09-reports/K1NReport_VALIDATION_SECURITY_FIX_v1.0_20251108.md


# Conductor Documentation Index

Note: As of 2025-11-08, the Conductor documentation directory moved from `docs/Conductor` to the repository root at `Conductor/`. Any file references below refer to documents inside the `Conductor/` directory.

## Quick Start

**For first-time users:** Start with [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) (1-2 minute read)

**For detailed usage:** Read [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) (10-15 minute read)

---

## Documentation Files

### User-Facing Guides

#### 1. K1NCond_REFERENCE_QUICK_v1.0_20251108.md
**Audience:** All developers
**Length:** ~2 KB, 5 minutes
**Content:**
- Setup (automatic)
- Run targets (web:dev, fw:monitor, etc.)
- Archive (automatic)
- Troubleshooting table
- Quick file listing

**When to use:** You need to remember what `RUN_TARGET` options exist, or how to fix a lockfile issue.

---

#### 2. K1NCond_GUIDE_HOOKS_v1.0_20251108.md
**Audience:** All developers (comprehensive reference)
**Length:** ~10 KB, 500+ lines, 15-20 minutes
**Content:**
- Why Conductor hooks?
- Architecture overview
- Detailed hook descriptions (setup/run/archive)
- Usage patterns (3 real-world examples)
- Safety & security analysis
- Integration with Conductor UI
- Troubleshooting guide
- Acceptance tests
- MCP integration (optional)

**When to use:** You want to understand how hooks work, or debug an issue.

---

### Developer & Technical Guides

#### 3. K1NCond_REPORT_HOOKS_v1.0_20251108.md
**Audience:** Developers, maintainers
**Length:** ~8 KB, technical details
**Content:**
- Executive summary
- Files delivered
- Feature breakdown (detailed)
- Validation & testing results
- Acceptance criteria (6/6 pass)
- Integration points
- Safety & security analysis
- Deployment instructions
- Metrics & statistics

**When to use:** You're reviewing the implementation, or need deployment/rollback instructions.

---

### Code Files

#### 4. conductor.json
**Purpose:** Conductor configuration (root-level)
**Size:** 178 bytes, 7 lines
**Content:**
```json
{
  "scripts": {
    "setup": "bash ops/scripts/conductor-setup.sh",
    "run": "bash ops/scripts/conductor-run.sh",
    "archive": "bash ops/scripts/conductor-archive.sh"
  }
}
```

---

#### 5. ops/scripts/conductor-setup.sh
**Purpose:** Workspace bootstrapper (runs on creation)
**Size:** 2.2 KB, 64 lines
**Behavior:**
- Creates `.env` from `.env.example`
- Auto-detects package manager
- Installs web & firmware dependencies
- Detects Node.js and PlatformIO
- Idempotent (safe to re-run)

---

#### 6. ops/scripts/conductor-run.sh
**Purpose:** Multi-target command runner (runs on "Run" button)
**Size:** 2.9 KB, 96 lines
**Behavior:**
- Reads `RUN_TARGET` environment variable
- 6 supported targets (web:dev, web:test, web:e2e, fw:monitor, fw:test, fw:build)
- Respects `$CONDUCTOR_PORT`
- Lockfile guard for nonconcurrent protection
- Auto-cleans lock on exit

---

#### 7. ops/scripts/conductor-archive.sh
**Purpose:** Workspace cleanup (runs on archive)
**Size:** 897 B, 32 lines
**Behavior:**
- Removes workspace-scoped caches
- Preserves global caches and `.env`
- Rotates smoke logs (keeps 20)
- Graceful error handling

---

## Related Documentation

### K1.node1 CI/CD Pipeline

These were created in prior phases and work alongside Conductor hooks:

- **CI_IMPLEMENTATION_SUMMARY.md** — GitHub Actions workflows
- **MERGE_AND_RELEASE_GUIDE.md** — Pre-merge gates & releases
- **STAGING_E2E_GUIDE.md** — Device validation

### Other Guides

- **preflight.sh** — Environment validation script
- **setup-branch-protection.sh** — GitHub branch protection setup
- **README.md** — Project overview

---

## File Organization

```
K1.node1/
├── conductor.json                               ← Root config
├── K1NCond_REFERENCE_QUICK_v1.0_20251108.md     ← User guide (quick)
├── K1NCond_GUIDE_HOOKS_v1.0_20251108.md         ← User guide (comprehensive)
├── rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md  ← Technical report
├── K1N_INDEX_v1.0_20251108.md                   ← Index
├── ops/
│   └── scripts/
│       ├── conductor-setup.sh                   ← Setup hook
│       ├── conductor-run.sh                     ← Run hook
│       ├── conductor-archive.sh                 ← Archive hook
│       ├── preflight.sh                         ← Environment check
│       └── setup-branch-protection.sh           ← GitHub setup
└── ... other project files
```

---

## Quick Navigation

### "I want to..."

| Goal | Document | Section |
|------|----------|---------|
| Remember RUN_TARGET options | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) | Run (Manual) |
| Debug "Another run appears active" | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) | Troubleshooting |
| Understand how setup works | [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) | Hook Scripts → Setup |
| Learn usage patterns | [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) | Usage Patterns |
| Fix a security issue | [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) | Safety & Security |
| Deploy to production | [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) | Deployment Instructions |
| Review acceptance tests | [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) | Acceptance Criteria |
| Check metrics | [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) | Metrics & Statistics |

---

## Learning Path

### For New Developers

1. Read [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) (2 min)
2. Try creating a Conductor workspace (auto-runs setup)
3. Try setting `RUN_TARGET=web:dev` and clicking Run
4. Read [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) if curious (10 min)

### For Contributors

1. Read [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) (5 min)
2. Review the three shell scripts (10 min)
3. Run acceptance tests locally (optional)
4. Propose changes via PR

### For Maintainers

1. Review [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) (10 min)
2. Check **Deployment Instructions** section
3. Run acceptance tests
4. Merge when ready

---

## Troubleshooting Guide Locations

| Issue | Document |
|-------|----------|
| `.conductor-run.lock` exists | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) |
| PlatformIO not found | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) |
| Node version mismatch | [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) |
| Full troubleshooting | [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) |

---

## Version Info

- **Date:** 2025-11-08
- **Status:** Production-Ready
- **Tests:** 6/6 pass
- **Documentation:** Complete

---

## Questions?

1. Check [K1NCond_REFERENCE_QUICK_v1.0_20251108.md](../../../Conductor/K1NCond_REFERENCE_QUICK_v1.0_20251108.md) for quick answers
2. Check [K1NCond_GUIDE_HOOKS_v1.0_20251108.md](../../../Conductor/K1NCond_GUIDE_HOOKS_v1.0_20251108.md) for detailed explanations
3. Check [K1NCond_REPORT_HOOKS_v1.0_20251108.md](../../../Conductor/rules/K1NCond_REPORT_HOOKS_v1.0_20251108.md) for technical details
4. File an issue if nothing above helps

---

**Last updated:** 2025-11-08

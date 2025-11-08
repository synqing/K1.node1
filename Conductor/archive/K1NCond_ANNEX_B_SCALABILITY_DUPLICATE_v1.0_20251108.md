# Conductor Workspace Hooks Documentation

This directory contains comprehensive documentation for Conductor workspace lifecycle hooks that automate setup, runtime, and cleanup for K1.node1 development.

## Quick Navigation

### 🚀 Start Here

- **[CONDUCTOR_QUICK_REFERENCE.md](CONDUCTOR_QUICK_REFERENCE.md)** — 2-minute cheat sheet
  - RUN_TARGET options
  - Troubleshooting quick fixes
  - Common commands

### 📖 Full Documentation

- **[CONDUCTOR_HOOKS_GUIDE.md](CONDUCTOR_HOOKS_GUIDE.md)** — Comprehensive guide
  - Architecture overview
  - Hook descriptions (setup/run/archive)
  - Usage patterns
  - Security & safety
  - Troubleshooting guide

### 🔧 Technical Details

- **[CONDUCTOR_HOOKS_IMPLEMENTATION_REPORT.md](CONDUCTOR_HOOKS_IMPLEMENTATION_REPORT.md)** — For developers & maintainers
  - Implementation details
  - Acceptance test results
  - Deployment instructions
  - Metrics & validation

### 📚 Reference

- **[CONDUCTOR_DOCUMENTATION_INDEX.md](CONDUCTOR_DOCUMENTATION_INDEX.md)** — Complete index
  - File organization
  - Navigation guide
  - Learning paths

---

## What Are Conductor Hooks?

Three bash scripts that automate K1.node1 development workflows:

1. **Setup Hook** — Runs when workspace is created
   - Creates `.env` from `.env.example`
   - Auto-installs dependencies
   - Detects Node.js and PlatformIO

2. **Run Hook** — Runs when user clicks "Run"
   - 6 command targets (web:dev, fw:monitor, etc.)
   - Respects `$CONDUCTOR_PORT`
   - Nonconcurrent guard

3. **Archive Hook** — Runs when workspace closes
   - Cleans workspace-scoped caches
   - Preserves global caches
   - Graceful cleanup

---

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| `conductor.json` | `/K1.node1/` | Hook configuration |
| `conductor-setup.sh` | `ops/scripts/` | Setup bootstrapper |
| `conductor-run.sh` | `ops/scripts/` | Run command router |
| `conductor-archive.sh` | `ops/scripts/` | Cleanup script |

---

## Documentation Hierarchy

**For users:** CONDUCTOR_QUICK_REFERENCE.md → CONDUCTOR_HOOKS_GUIDE.md

**For developers:** CONDUCTOR_HOOKS_IMPLEMENTATION_REPORT.md

**For navigation:** CONDUCTOR_DOCUMENTATION_INDEX.md

---

## Status

✅ Implementation: Complete
✅ Testing: All tests passing (6/6)
✅ Documentation: Comprehensive
✅ Production Ready: Yes

---

**Last updated:** 2025-11-08

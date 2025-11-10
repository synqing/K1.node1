---
status: published
author: Architect-Review
date: 2025-11-05
intent: Prevent documentation bloat through metadata, lifecycle management, and automation
---

# ADR-0004: Documentation Governance System

## Decision

**All documentation must have required metadata and follow automated lifecycle management to prevent bloat.**

## Metadata (Required on EVERY MD file)

```yaml
---
status: [draft|active|superseded|archived|deleted]
author: Name or team
date: YYYY-MM-DD
intent: One-line purpose
references: [ADR-####, other docs]
---
```

## Lifecycle States

- **draft:** Under development (no auto-deadline)
- **active:** Published, maintained (6-month auto-review)
- **superseded:** Replaced by newer doc (archive after 1 month)
- **archived:** Historical reference (delete after 3 months)
- **deleted:** Permanently removed

## Enforcement

- Pre-commit hook rejects docs without metadata
- GitHub Actions weekly audit
- Auto-deprecation of docs >6 months without updates
- Validate cross-references exist
- Document limits: 200 active max, 100KB max file size

## Goals

- Prevent "827 MD file bloat" in K1.reinvented
- Keep active documentation <200 files
- Quick discovery ("Is there a doc on X?")
- Automatic cleanup of stale docs

---
**Decision Date:** November 5, 2025
**References:** K1NGov_GOVERNANCE_v1.0_20251108.md (full spec)

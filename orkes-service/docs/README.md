# Orkes Service Documentation

This directory contains documentation for the K1.node1 Orkes integration service (Express + Orkes JavaScript SDK). It follows the same structure and naming conventions used by the Conductor docs.

## Structure

```
docs/
├── K1NOrkes_INDEX_v1.0_20251108.md            # Master index (start here)
├── K1NOrkes_REPORT_WORK_SUMMARY_v1.0_20251108.md
├── guides/
│   ├── K1NOrkes_GUIDE_INTEGRATION_v1.0_20251108.md
│   ├── K1NOrkes_GUIDE_DEEP_DIVE_v1.0_20251108.md
│   └── K1NOrkes_GUIDE_PATTERN_COMPILATION_v1.0_20251108.md
├── architecture/                               # (optional) system design docs
└── api-reference/                              # (optional) REST API specs
```

## Naming Standard (MANDATORY)

All files must follow the K1N naming standard.

Format: `[ProjectCode]_[Type]_v[Version]_[YYYYMMDD].[ext]`

Examples (Orkes Service docs):
- `K1NOrkes_INDEX_v1.0_20251108.md` (index)
- `K1NOrkes_GUIDE_INTEGRATION_v1.0_20251108.md` (guide)
- `K1NOrkes_GUIDE_DEEP_DIVE_v1.0_20251108.md` (guide)
- `K1NOrkes_GUIDE_PATTERN_COMPILATION_v1.0_20251108.md` (guide)
- `K1NOrkes_REPORT_WORK_SUMMARY_v1.0_20251108.md` (report)

Rules:
- Use semantic versions (v1.0, v1.1, v2.0)
- Use date format `YYYYMMDD`
- Do not overwrite existing versions; add a new versioned file and archive older versions if needed

## Start Here

1. Index: `K1NOrkes_INDEX_v1.0_20251108.md`
2. Integration: `guides/K1NOrkes_GUIDE_INTEGRATION_v1.0_20251108.md`
3. Deep Dive: `guides/K1NOrkes_GUIDE_DEEP_DIVE_v1.0_20251108.md`
4. Pattern Compilation: `guides/K1NOrkes_GUIDE_PATTERN_COMPILATION_v1.0_20251108.md`

## Maintenance

- Keep the index current when adding or archiving docs
- Prefer small, focused guides over long monoliths
- Link from the service README to the relevant guides


# docs: Apply K1N Naming Across Project, Update Links, Add Validator and Summary

## Summary

Realigns project documentation to the K1N naming convention while preserving folder layout and ADR naming. Updates cross-references, adds a non‑blocking docs naming validator (blocking by default now), and records the migration in a summary report.

## Scope

- Root: 00-INDEX.md → K1N_INDEX_v1.0_20251108.md; NAVIGATION.md → K1N_NAVIGATION_v1.0_20251108.md
- Resources (docs/07-resources): K1NRes_*
- Reference (docs/06-reference): K1NRef_*
- Planning (docs/04-planning): K1NPlan_*
- Analysis (docs/05-analysis): K1NAnalysis_* (Conductor subfolder preserved as historical references)
- Architecture (docs/01-architecture): K1NArch_*
- Implementation (docs/09-implementation): K1NImpl_*
- Reports (docs/09-reports): K1NReport_*
- Playbooks (docs/Playbooks): K1NPlaybook_*
- Orkes service docs: already migrated to K1NOrkes_*
- Conductor docs: canonical set in root `Conductor/` already aligned to K1NCond_*

## Not Changed

- Folder names remain as-is (no structure changes)
- ADRs under `docs/02-adr/K1NADR_*.md` use canonical K1NADR naming
- Preserved specialized nested docs:
  - `docs/05-analysis/tab5/**`
  - `docs/03-guides/builderio.starterkit/**` and `docs/03-guides/builderio.guide/**`
  - `docs/05-analysis/Conductor/**` left intact (historical reference set)

## Validator

- Extended `.githooks/pre-commit` to validate K1N naming for docs
- Exemptions: `docs/archive/**`, `docs/02-adr/K1NADR_*.md`, `README.md`, `docs/_README_TEMPLATE.md`, `docs/05-analysis/Conductor/**`, `docs/05-analysis/tab5/**`, and `docs/03-guides/builderio*`
- Blocking ON by default (set `DOCS_NAMING_ENFORCE=0` to temporarily allow commits)

## Migration Report

- Added: `docs/09-reports/K1NReport_SUMMARY_DOCS_MIGRATION_v1.0_20251108.md`
- Snapshot at completion:
  - Total doc files (md/txt/json): 265
  - K1N-prefixed files: 167
  - ADR files (ADR-####): 22
  - Remaining non‑K1N actives: ~35 (exempt/preserved sets listed above)

## Navigation Fix

- `K1N_NAVIGATION_v1.0_20251108.md` — Graph Architecture now links to
  `./04-planning/K1NPlan_STRATEGY_PHASE_2D1_GRAPH_PARALLEL_MASTER_v1.0_20251108.md`.

## Risk & Mitigation

- Risk: Broken links after renames → Mitigated by repo-wide link sweeps and targeted scans
- Risk: Over-enforcement of naming → Mitigated by exemptions and `DOCS_NAMING_ENFORCE` override

## How to Review

- Spot-check a few folders (04-planning, 05-analysis, 06-reference, 07-resources) for K1N* names
- Verify folder READMEs point back to `docs/K1N_INDEX_v1.0_20251108.md`
- Open `docs/K1N_NAVIGATION_v1.0_20251108.md` and click through key links
- Review the migration summary report for coverage details

## Follow-ups (optional)

- Decide if preserved nested docs should be migrated in a future pass
- If stable, keep validator in blocking mode in CI and developer environments

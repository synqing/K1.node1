---
title: Release Notes — v0.1.2
author: Maintainers
date: 2025-11-05 13:50 UTC+8
status: published
intent: Summarize changes for v0.1.2 focusing on documentation optimization and discoverability
---

# v0.1.2 — Documentation Optimization & Discoverability

This release focuses on restructuring and compressing the CLAUDE manual for Claude Code Agent performance, and splitting specialty content into focused guides with clear index links.

## Highlights
- CLAUDE.md reduced from 54,213 → 9,246 chars (−82.9%) while retaining core workflows
- New focused guides for CLI tooling, frontend testing, UI animations, Task Master integration, and governance tools
- Webapp testing quickstart added; documentation index updated for fast discovery

## Added
- docs/06-reference/K1NRef_GUIDE_MODERN_CLI_TOOLKIT_AGENT_v1.0_20251108.md — ripgrep/fd/sed/jq recipes, refactor patterns, governance script usage
- docs/07-resources/K1NRes_PLAYBOOK_FRONTEND_TESTING_v1.0_20251108.md — Jest + RTL patterns, Playwright config, MSW setup, repo excerpts
- .superdesign/CHAT_UI_ANIMATIONS.md — micro‑syntax, CSS mapping examples, framer‑motion integration tips
- docs/07-resources/K1NRes_GUIDE_TASKMASTER_INTEGRATION_v1.0_20251108.md — Task Master rules, tool catalog, workflow and example session
- docs/06-reference/K1NRef_REFERENCE_GOVERNANCE_TOOLS_v1.0_20251108.md — quick reference for governance scripts
- webapp/README.md — Testing Quickstart
- docs/K1N_INDEX_v1.0_20251108.md — Links to CLAUDE manual and new guides; Design & UI section

## Changed
- CLAUDE.md compressed and reorganized; routing normalized to current `docs/` structure
- docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md — added links and commands for governance tools
- README.md — new Testing section with pointers

## Fixed
- Routing inconsistencies and duplicate folder references in CLAUDE.md
- Ensured all cross‑links resolve by creating targets and porting high‑value content

## Removed
- Verbose specialty content from CLAUDE.md (now in focused guides)

## Upgrade Notes
- No code changes required. Review updated documentation locations:
  - CLAUDE manual: `CLAUDE.md`
  - CLI toolkit: `docs/06-reference/K1NRef_GUIDE_MODERN_CLI_TOOLKIT_AGENT_v1.0_20251108.md`
  - Frontend testing: `docs/07-resources/K1NRes_PLAYBOOK_FRONTEND_TESTING_v1.0_20251108.md`
  - UI animations: `.superdesign/CHAT_UI_ANIMATIONS.md`
  - Task Master: `docs/07-resources/K1NRes_GUIDE_TASKMASTER_INTEGRATION_v1.0_20251108.md`
  - Governance tools: `docs/06-reference/K1NRef_REFERENCE_GOVERNANCE_TOOLS_v1.0_20251108.md`

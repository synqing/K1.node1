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
- docs/06-reference/modern-cli-toolkit-agent.md — ripgrep/fd/sed/jq recipes, refactor patterns, governance script usage
- docs/07-resources/frontend-testing-playbook.md — Jest + RTL patterns, Playwright config, MSW setup, repo excerpts
- .superdesign/CHAT_UI_ANIMATIONS.md — micro‑syntax, CSS mapping examples, framer‑motion integration tips
- docs/07-resources/taskmaster_integration.md — Task Master rules, tool catalog, workflow and example session
- docs/06-reference/governance-tools.md — quick reference for governance scripts
- webapp/README.md — Testing Quickstart
- docs/00-INDEX.md — Links to CLAUDE manual and new guides; Design & UI section

## Changed
- CLAUDE.md compressed and reorganized; routing normalized to current `docs/` structure
- docs/08-governance/GOVERNANCE.md — added links and commands for governance tools
- README.md — new Testing section with pointers

## Fixed
- Routing inconsistencies and duplicate folder references in CLAUDE.md
- Ensured all cross‑links resolve by creating targets and porting high‑value content

## Removed
- Verbose specialty content from CLAUDE.md (now in focused guides)

## Upgrade Notes
- No code changes required. Review updated documentation locations:
  - CLAUDE manual: `CLAUDE.md`
  - CLI toolkit: `docs/06-reference/modern-cli-toolkit-agent.md`
  - Frontend testing: `docs/07-resources/frontend-testing-playbook.md`
  - UI animations: `.superdesign/CHAT_UI_ANIMATIONS.md`
  - Task Master: `docs/07-resources/taskmaster_integration.md`
  - Governance tools: `docs/06-reference/governance-tools.md`


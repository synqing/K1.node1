---
title: Governance Tools (K1.node1)
author: Documentation Team
date: 2025-11-05
status: published
---

# Governance Tools — Quick Reference

Centralized usage for repository governance scripts. These enforce metadata hygiene and surface documentation health issues.

## Add YAML Front Matter

Script: `tools/governance/add_frontmatter.sh`

- Check missing front matter across docs:
```
./tools/governance/add_frontmatter.sh --check-missing
```

- Add to all Markdown docs interactively:
```
./tools/governance/add_frontmatter.sh --add-all
```

- Add to a specific file:
```
./tools/governance/add_frontmatter.sh --add-file docs/04-planning/my_doc.md
```

Notes
- Script creates YAML front matter with Title, Owner, Date, Status.
- Follow status values from `docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md`.

## Governance Health Check

Script: `tools/governance/governance_health.sh`

- Run the full check:
```
./tools/governance/governance_health.sh
```

Reports
- Root-level file sprawl
- % of docs with front matter
- Remediation hints (commands to run)

## Best Practices
- Run the health check weekly and before releases.
- Keep root tidy; move long-lived docs under `docs/` and update indices.
- Use front matter consistently to enable indexing and automation.


---
status: published
author: Architect-Review
date: 2025-11-05
intent: Define K1.node1 folder structure (clean, flat, no bloat)
---

# ADR-0005: K1.node1 Repository Structure

## Decision

**Clean, flat structure with clear separation of firmware, webapp, and documentation.**

## Directory Layout

```
K1.node1/
├── firmware/
│   ├── src/          (51 C++ source files)
│   ├── test/         (Test suite)
│   ├── data/         (Web assets)
│   └── platformio.ini
├── webapp/
│   ├── src/          (156 TypeScript/React files)
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/
│   ├── adr/          (Architecture decisions)
│   ├── architecture/ (System design)
│   ├── planning/     (Roadmaps, execution plans)
│   ├── analysis/     (Technical analyses)
│   ├── guides/       (How-tos)
│   └── reference/    (Quick references)
├── tools/            (Build/test scripts)
├── .claude/          (Agent configuration)
├── .cursor/          (IDE configuration)
├── .kiro/            (Deployment specs)
├── .mem0_local/      (Knowledge base)
├── .superdesign/     (Design iterations)
├── .vscode/          (Debugger config)
├── CLAUDE.md         (Agent manual)
├── README.md         (Project overview)
└── package.json      (Root dependencies, if needed)
```

## Key Rules

- **No datasets in repo** (external storage for research)
- **No build artifacts** (generate fresh: .pio, node_modules, dist/)
- **No old/stale docs** (governance system auto-purges >6 months)
- **Tool configs at root** (IDE integration, MCP servers)

---
**Decision Date:** November 5, 2025

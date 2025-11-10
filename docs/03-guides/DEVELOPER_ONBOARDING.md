---
title: Developer Onboarding Guide
status: accepted
version: v1.0
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-11-10
tags: [getting-started, onboarding]
related_docs: [../K1N_INDEX_v1.0_20251108.md, ../02-adr/README.md, ../01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.html]
---

# K1.node1 – Developer Onboarding

Welcome. This guide gets you productive fast on K1.node1 across the webapp, local backend (`orkes-service`), and device firmware.

## Prerequisites

- macOS with Homebrew
- Node.js 20.x (required by `orkes-service`)
- npm 10+
- Git

Recommended:
- `nvm` for Node management
- VS Code or Trae IDE

## Install

```bash
# From repo root
brew install node@20 || echo "use nvm if preferred"

# Webapp dependencies
cd webapp && npm ci

# Orkes service dependencies (Node 20 required)
cd ../orkes-service && npm ci
```

## Environment Configuration

Create `.env` files from examples.

```bash
# Webapp
cd webapp
cp .env.example .env

# Orkes Service
cd ../orkes-service
cp .env.example .env
```

Fill required variables in `orkes-service/.env`:

- `PORT=8800`
- `ORKES_SERVER_URL=https://developer.orkescloud.com/api`
- `ORKES_KEY_ID=<your_key_id>`
- `ORKES_KEY_SECRET=<your_key_secret>`
- `ALLOWED_ORIGINS=http://localhost:3003,http://localhost:3004,http://localhost:5173`

The webapp proxies `/api` to `http://localhost:8800` via Vite.

## Start the Stack

```bash
# Terminal A: webapp (Vite on 3003)
cd webapp
npm run dev

# Terminal B: orkes-service (Express on 8800)
cd orkes-service
npm run dev
```

Verify:

- Webapp: `http://localhost:3003/`
- Orkes Service health: `http://localhost:8800/health`
- Orkes API status: `http://localhost:8800/api/status`

If `/api/status` reports “connected: true”, credentials are valid.

## Ports

- Webapp dev server: `3003`
- Orkes service: `8800`
- Device firmware HTTP: `3000` (on device IP)

See the consolidated diagram: `docs/01-architecture/K1NArch_SYSTEM_OVERVIEW_DIAGRAM.html`.

## Common Workflows

- Run tests (webapp): `npm test` (Jest)
- Build (webapp): `npm run build` (Vite)
- Preview build: `npm run preview`
- Lint (where configured): `npm run lint`

## UI QA Quick Checks

- Load `http://localhost:3003/` with orkes-service running
- Confirm `/api` calls succeed (Network tab shows 200s)
- Verify key routes render without errors
- Check device connection UI if you have a live device (optional)

Full checklist: `webapp/README.md`.

## ADRs and Documentation

- ADR index: `docs/02-adr/README.md` (consolidated)
- Documentation hub: `docs/K1N_INDEX_v1.0_20251108.md`
- Governance: `docs/08-governance/K1NGov_GOVERNANCE_v1.0_20251108.md`

## Troubleshooting

- If `orkes-service` fails to start, ensure Node 20.x
- If `/api/status` fails, verify `ORKES_*` env vars
- If CORS issues, update `ALLOWED_ORIGINS` in `orkes-service/.env`
- If two Vite servers run, stop the 5173 instance; standardize on 3003

## Contributing

- Follow existing code style and conventions
- Reference ADRs in PRs where architecture decisions apply
- Update docs when changing ports or proxies

## Next Steps

- Read the architecture diagram and ADRs for context
- Pick a task from `docs/04-planning/` or the project board
- Pair with a maintainer for your first change


# K1.node1 - Clean Project Home

**Status:** Production Ready
**Created:** November 5, 2025
**Size:** 2.3MB (no bloat)

This is the clean, production project folder for K1.reinvented. All working code, no datasets, no build artifacts, no bloat.

## Project Structure

```
K1.node1/
├── firmware/              (ESP32-S3 firmware)
│   ├── src/               (Core C++ source code, ~50 files)
│   ├── test/              (Hardware tests)
│   ├── data/              (Web assets for device UI)
│   └── platformio.ini     (Build configuration)
│
├── webapp/                (React control dashboard)
│   ├── src/               (TypeScript/React source, ~160 files)
│   ├── package.json       (Dependencies)
│   ├── tsconfig.json      (TypeScript config)
│   └── vite.config.ts     (Bundler config)
│
├── docs/                  (Essential documentation only)
│   ├── adr/               (Architecture Decision Records - 10 decisions)
│   └── CLAUDE.md          (Agent operations manual)
│
└── README.md              (This file)
```

## What's NOT Here (By Design)

- ❌ Beat tracking datasets (6GB+ - abandoned)
- ❌ Build artifacts (.pio, node_modules, dist/)
- ❌ Old/stale documentation (700+ bloated MD files)
- ❌ Archive folders
- ❌ Music/audio datasets

## Quick Start

### Build Firmware
```bash
cd firmware
pio run -e esp32-s3-devkitc-1
```

### Run Webapp
```bash
cd webapp
npm install
npm run dev
```

### Read Documentation
Start with: `CLAUDE.md` (Agent operations guide)
Then: `docs/adr/` (Architecture decisions)

## What Changed from K1.reinvented

| Metric | K1.reinvented | K1.node1 |
|--------|---------------|----------|
| **Total Size** | 32GB | 2.3MB |
| **Documentation Files** | 827 MD files | 12 MD files |
| **Source Code Files** | 207 (scattered) | 207 (organized) |
| **Datasets** | 24GB bloat | None |
| **Build Artifacts** | 3GB cached | Regenerated fresh |

## Key Files

**Firmware:**
- `firmware/src/main.cpp` - Main firmware entry point
- `firmware/src/generated_patterns.h` - 15 hardcoded light show patterns
- `firmware/src/webserver.cpp` - REST API for pattern control
- `firmware/test/` - Comprehensive test suite

**Webapp:**
- `webapp/src/App.tsx` - Main React component
- `webapp/src/components/` - UI component library
- `webapp/src/backend/` - API hooks and device communication

**Documentation:**
- `CLAUDE.md` - How Claude agents should work with this repo
- `docs/adr/ADR-000*.md` - All architectural decisions with reasoning
- `docs/PHASE_2D1_AUDIT_START_HERE.md` - Latest comprehensive audit
- `docs/PHASE_2D1_GRAPH_PARALLEL_MASTER_STRATEGY.md` - Current execution plan

## Development Workflow

1. **Read CLAUDE.md first** - Understand agent and human workflows
2. **Check docs/adr/** - Understand why architecture decisions were made
3. **Firmware**: Edit code in `firmware/src/`, test with `pio run`
4. **Webapp**: Edit code in `webapp/src/`, dev server with `npm run dev`
5. **Documentation**: Keep it minimal; use `docs/` only for essential info

## No Governance System Yet

This is a fresh start. As documentation grows:
- Keep only ESSENTIAL documents
- Delete stale/superseded docs immediately
- Use `docs/` sparingly (not a dumping ground)
- Add new docs only with explicit purpose

## Moving Forward

K1.reinvented is abandoned. **All development happens here in K1.node1.**

If you need something from K1.reinvented:
1. It's archived but accessible for reference
2. Copy what you need manually
3. Don't create symlinks or git submodules - keep K1.node1 self-contained

---

**Status:** Ready for development
**Next:** Check `docs/adr/` for architectural context, then start coding.

## Local Memory (Mem0)

Optional self-hosted memory stack for semantic search over project docs.

- Components:
  - `.mem0_local/` Python tools to ingest Markdown into Qdrant using Ollama embeddings
  - `memory-proxy/` Express service exposing `/memory/search` for the webapp and tools

### Setup

1. Start Qdrant and Ollama locally
   - Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
   - Ollama: install and run; pull `nomic-embed-text:latest`
2. Create and activate Python venv in `.mem0_local/`, install deps
   - `cd .mem0_local && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
3. Ingest docs to Qdrant
   - `./bulk_ingest.sh docs` (or individually via `python ingest_docs.py path/to/file.md`)
4. Run memory proxy
   - `cd memory-proxy && cp .env.example .env && npm install && npm run start`

### Webapp Integration

- Client at `webapp/src/lib/memoryClient.ts`
- Configure base via `VITE_MEMORY_PROXY` (default `http://localhost:4001`)
- Example:
  ```ts
  import { searchMemories } from './lib/memoryClient';
  const results = await searchMemories('What are Phase 2D1 goals?');
  ```

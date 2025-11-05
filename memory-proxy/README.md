# Memory Proxy

A minimal Express service that exposes `/memory/search` by proxying to local Ollama embeddings and Qdrant search.

- Depends on:
  - Ollama at `http://localhost:11434` (model `nomic-embed-text:latest` pulled)
  - Qdrant at `http://localhost:6333` (collection `mem0_k1_memories` created via `.mem0_local/ingest_docs.py`)

## Usage

```bash
cd memory-proxy
cp .env.example .env
npm install
npm run start
# memory-proxy listening on http://localhost:4001
```

### API

- `POST /memory/search`
  - body: `{ "query": "...", "limit": 5 }`
  - returns: `{ results: [{ id, score, payload }] }`

### Health
- `GET /health` returns basic status if Qdrant is reachable.

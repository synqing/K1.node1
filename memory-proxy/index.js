require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 4001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'mem0_k1_memories';

async function embedQuery(query) {
  const url = `${OLLAMA_URL}/api/embeddings`;
  const { data } = await axios.post(url, { model: 'nomic-embed-text:latest', prompt: query });
  if (!data || !data.embedding) throw new Error('No embedding returned from Ollama');
  return data.embedding;
}

async function searchQdrant(vector, limit = 5) {
  const url = `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/search`;
  const body = { vector, limit, with_payload: true };
  const { data } = await axios.post(url, body);
  return (data?.result || []).map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
}

app.post('/memory/search', async (req, res) => {
  try {
    const { query, limit } = req.body || {};
    if (!query || typeof query !== 'string') return res.status(400).json({ error: 'query is required' });
    const embedding = await embedQuery(query);
    const results = await searchQdrant(embedding, typeof limit === 'number' ? limit : 5);
    res.json({ results });
  } catch (err) {
    const msg = err?.response?.data || err?.message || 'unknown error';
    res.status(500).json({ error: msg });
  }
});

app.get('/health', async (req, res) => {
  try {
    await axios.get(`${QDRANT_URL}/collections`);
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

app.listen(PORT, () => {
  console.log(`memory-proxy listening on http://localhost:${PORT}`);
});

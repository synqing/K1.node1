---
title: Mem0 Local Integration Guide
status: draft
version: v0.1
owner: [Docs Maintainers]
reviewers: [Engineering Leads]
last_updated: 2025-10-30
next_review_due: 2026-01-30
tags: [docs]
related_docs: [docs/tags/docs.md]
---

# Mem0 Local Integration Guide

- Prerequisites:
  - Start Ollama at `http://localhost:11434` with `nomic-embed-text:latest` pulled.
  - Start Qdrant at `http://localhost:6333` with network access.
  - Python 3.10+; install dependencies in `.mem0_local/requirements.txt`.

- Install dependencies:
  - `python -m venv .mem0_local/.venv`
  - `. .mem0_local/.venv/bin/activate`
  - `pip install -r .mem0_local/requirements.txt`

- Ingest a Markdown doc into memory:
  - `python .mem0_local/ingest_docs.py Implementation.plans/harmonixset-main/DATA_ACQUISITION_TRAINING_PLAN.md`

- Verify collection exists in Qdrant:
  - `curl http://localhost:6333/collections/mem0_k1_memories`

- Notes:
  - Config is read from `.mem0_local/config.yaml` (collection name, embed model, endpoints).
  - Payload stores frontmatter fields and path for downstream retrieval.


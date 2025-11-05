#!/usr/bin/env bash
set -euo pipefail

# Bulk-ingest Markdown files into Qdrant via .mem0_local/ingest_docs.py
# Usage: ./.mem0_local/bulk_ingest.sh [DOC_ROOT]
# Defaults DOC_ROOT to 'docs' if not provided.

DOC_ROOT="${1:-docs}"
VENV_PATH=".mem0_local/.venv"

if [ -d "$VENV_PATH" ]; then
  # shellcheck source=/dev/null
  source "$VENV_PATH/bin/activate"
fi

echo "Ingesting markdown files under '$DOC_ROOT'..."
find "$DOC_ROOT" -type f -name "*.md" -print0 \
  | xargs -0 -I{} python .mem0_local/ingest_docs.py {}

echo "Done. Verify in Qdrant: curl http://localhost:6333/collections/mem0_k1_memories"

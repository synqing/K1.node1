import sys
import os
import uuid
import hashlib
import json
import requests
import yaml

def load_config(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def parse_frontmatter(text):
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            fm_text = text[4:end]
            body = text[end+5:]
            # Try strict YAML first; if it fails, fall back to a lenient parser
            try:
                fm = yaml.safe_load(fm_text) or {}
            except Exception:
                fm = {}
                for line in fm_text.splitlines():
                    if not line.strip() or line.strip().startswith("#"):
                        continue
                    if ":" in line:
                        key, val = line.split(":", 1)
                        key = key.strip()
                        val = val.strip()
                        # Attempt to parse lists or simple scalars
                        try:
                            parsed = yaml.safe_load(val)
                        except Exception:
                            parsed = val
                        fm[key] = parsed
            return fm, body
    return {}, text

def ensure_collection(qdrant_url, collection, vector_size):
    url = f"{qdrant_url}/collections/{collection}"
    r = requests.get(url)
    if r.status_code == 200:
        return
    payload = {
        "vectors": {"size": vector_size, "distance": "Cosine"}
    }
    requests.put(url, json=payload).raise_for_status()

def embed_text(ollama_base, model, text):
    url = f"{ollama_base}/api/embeddings"
    payload = {"model": model, "prompt": text}
    r = requests.post(url, json=payload)
    r.raise_for_status()
    data = r.json()
    return data.get("embedding")

def stable_id_from_path(doc_path: str) -> str:
    """Generate a deterministic UUID (v5) from the document path.
    This avoids duplicate points on re-ingest and enables idempotent updates.
    """
    # UUIDv5 over URL namespace with path as the name provides a valid UUID format.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, doc_path))


def upsert_point(qdrant_url, collection, vector, payload, point_id: str):
    url = f"{qdrant_url}/collections/{collection}/points"
    # Ensure payload is JSON-serializable
    def to_jsonable(obj):
        if isinstance(obj, (str, int, float, bool)) or obj is None:
            return obj
        if isinstance(obj, (list, tuple)):
            return [to_jsonable(x) for x in obj]
        if isinstance(obj, dict):
            return {str(k): to_jsonable(v) for k, v in obj.items()}
        # Fallback for datetime/date and other types
        return str(obj)

    payload = to_jsonable(payload)
    body = {"points": [{"id": point_id, "vector": vector, "payload": payload}]}
    requests.put(url, json=body).raise_for_status()
    return point_id

def main():
    if len(sys.argv) < 2:
        print("Usage: python .mem0_local/ingest_docs.py <markdown_path>")
        sys.exit(1)
    doc_path = sys.argv[1]
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cfg = load_config(os.path.join(base_dir, "config.yaml"))

    host = cfg["vector_store"]["config"]["host"]
    port = cfg["vector_store"]["config"]["port"]
    collection = cfg["vector_store"]["config"]["collection_name"]
    dims = cfg["vector_store"]["config"].get("embedding_model_dims", 768)
    ollama_base = cfg["embedder"]["config"]["base_url"]
    embed_model = cfg["embedder"]["config"]["model"]

    qdrant_url = f"http://{host}:{port}"

    text = read_file(doc_path)
    frontmatter, body = parse_frontmatter(text)

    ensure_collection(qdrant_url, collection, dims)
    vector = embed_text(ollama_base, embed_model, text)

    payload = {
        "path": doc_path,
        "title": frontmatter.get("title"),
        "tags": frontmatter.get("tags"),
        "status": frontmatter.get("status"),
        "version": frontmatter.get("version"),
        "last_updated": frontmatter.get("last_updated"),
        "next_review_due": frontmatter.get("next_review_due"),
    }

    # Use deterministic path-based ID to avoid duplicate points on re-ingest
    point_id = stable_id_from_path(doc_path)
    point_id = upsert_point(qdrant_url, collection, vector, payload, point_id)
    print(json.dumps({"upserted_id": point_id, "collection": collection, "path": doc_path}))

if __name__ == "__main__":
    main()

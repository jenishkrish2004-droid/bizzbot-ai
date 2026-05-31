from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import TypedDict

import numpy as np

from ai_pipeline.chunking import TextChunk


class SearchResult(TypedDict):
    content: str
    metadata: dict
    score: float


def save_faiss_index(
    *,
    user_id: str,
    document_id: str,
    chunks: list[TextChunk],
    embeddings: np.ndarray,
    base_folder: str,
) -> str:
    import faiss

    if embeddings.ndim != 2 or embeddings.shape[0] != len(chunks):
        raise ValueError("Embedding matrix does not match chunk count")
    if not len(chunks):
        raise ValueError("Cannot create an index without chunks")

    index_root = Path(base_folder).resolve()
    document_dir = (index_root / user_id / document_id).resolve()
    if index_root not in document_dir.parents:
        raise ValueError("Invalid vector index path")

    document_dir.mkdir(parents=True, exist_ok=True)

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    faiss.write_index(index, str(document_dir / "index.faiss"))

    payload = {
        "documentId": document_id,
        "embeddingDimension": int(embeddings.shape[1]),
        "chunkCount": len(chunks),
        "chunks": [
            {
                "id": f"{document_id}:{chunk.metadata['chunk_index']}",
                "content": chunk.content,
                "metadata": chunk.metadata,
            }
            for chunk in chunks
        ],
    }

    (document_dir / "chunks.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(document_dir)


def delete_vector_index(index_path: str | None) -> None:
    if not index_path:
        return

    path = Path(index_path)
    if path.exists() and path.is_dir():
        shutil.rmtree(path)


def search_faiss_index(
    *,
    index_path: str,
    query_embedding: np.ndarray,
    top_k: int,
) -> list[SearchResult]:
    import faiss

    path = Path(index_path)
    faiss_path = path / "index.faiss"
    chunks_path = path / "chunks.json"

    if not faiss_path.exists() or not chunks_path.exists():
        raise FileNotFoundError("Vector index files are missing")

    index = faiss.read_index(str(faiss_path))
    payload = json.loads(chunks_path.read_text(encoding="utf-8"))
    chunks = payload.get("chunks", [])

    query = query_embedding.astype(np.float32)
    if query.ndim == 1:
        query = query.reshape(1, -1)

    scores, indexes = index.search(query, min(top_k, len(chunks)))

    results: list[SearchResult] = []
    for score, chunk_index in zip(scores[0], indexes[0]):
        if chunk_index < 0 or chunk_index >= len(chunks):
            continue
        chunk = chunks[chunk_index]
        results.append(
            {
                "content": chunk["content"],
                "metadata": chunk.get("metadata", {}),
                "score": float(score),
            }
        )

    return results

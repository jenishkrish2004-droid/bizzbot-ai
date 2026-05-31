# Phase 4 - PDF Indexing Pipeline

## Implemented

- PDF text extraction through LangChain `PyPDFLoader`.
- Recursive chunking with configurable chunk size and overlap.
- SentenceTransformers embedding generation.
- FAISS vector index creation using normalized embeddings and inner-product search.
- Per-document vector storage under `backend/vector_indexes/<user_id>/<document_id>/`.
- Chunk metadata persistence in `chunks.json` next to each FAISS index.
- Authenticated document processing API.
- Upload UI action to index uploaded documents and display chunk counts.

## Architecture Notes

The AI pipeline is split into small modules:

- `chunking.py` handles PDF loading and text splitting.
- `embeddings.py` owns model loading and embedding generation.
- `vector_store.py` owns FAISS persistence.
- `rag_pipeline.py` orchestrates extraction, chunking, embedding, and indexing.

The document service updates status through `uploaded`, `processing`, `indexed`, and `failed`, which gives later phases a clean state machine for chat and retrieval.

## Operational Note

The first indexing run may download the configured SentenceTransformers model if it is not already cached in the runtime. In production, bake or pre-warm the model cache during deployment.

## Next Phase

Phase 5 adds semantic retrieval, RAG chat APIs, conversational memory, and the chat UI.

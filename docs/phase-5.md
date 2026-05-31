# Phase 5 - RAG Chat

## Implemented

- Semantic retrieval against FAISS indexes.
- Query embedding generation with the configured SentenceTransformers model.
- Citation metadata for retrieved chunks.
- Conversation and message persistence.
- Chat APIs for listing, creating, loading, and asking questions.
- Optional OpenAI-compatible answer synthesis when `OPENAI_API_KEY` is configured.
- Extractive fallback answer mode when no LLM key is configured.
- Chat UI with indexed-document selection, conversation history, message display, citations, and submit flow.

## Architecture Notes

Phase 5 keeps retrieval and generation separate. `rag_pipeline.py` retrieves document context, `llm_client.py` turns context into an answer, and `chat_service.py` owns persistence and user-scoped business rules.

The assistant refuses to chat with non-indexed documents. This prevents silent empty retrieval and keeps the Upload -> Index -> Chat workflow explicit.

## Next Phase

Phase 6 adds lead extraction using regex plus LLM-assisted extraction, lead storage, CSV export, and a lead dashboard.

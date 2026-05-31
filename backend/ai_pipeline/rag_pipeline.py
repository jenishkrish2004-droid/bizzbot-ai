from __future__ import annotations

from dataclasses import dataclass

from ai_pipeline.chunking import TextChunk, chunk_documents, load_pdf_pages
from ai_pipeline.embeddings import embed_texts
from ai_pipeline.vector_store import SearchResult, save_faiss_index, search_faiss_index


@dataclass(frozen=True)
class IndexingResult:
    vector_index_path: str
    chunk_count: int
    text_char_count: int


def index_pdf_document(
    *,
    file_path: str,
    user_id: str,
    document_id: str,
    vector_index_folder: str,
    embedding_model_name: str,
    chunk_size: int,
    chunk_overlap: int,
) -> IndexingResult:
    pages = load_pdf_pages(file_path)
    chunks: list[TextChunk] = chunk_documents(
        pages,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    if not chunks:
        raise ValueError("No extractable text was found in this PDF")

    embeddings = embed_texts([chunk.content for chunk in chunks], embedding_model_name)
    index_path = save_faiss_index(
        user_id=user_id,
        document_id=document_id,
        chunks=chunks,
        embeddings=embeddings,
        base_folder=vector_index_folder,
    )

    return IndexingResult(
        vector_index_path=index_path,
        chunk_count=len(chunks),
        text_char_count=sum(len(chunk.content) for chunk in chunks),
    )


def retrieve_document_context(
    *,
    question: str,
    vector_index_path: str,
    embedding_model_name: str,
    top_k: int,
) -> list[SearchResult]:
    query_embedding = embed_texts([question], embedding_model_name)
    if query_embedding.size == 0:
        return []

    return search_faiss_index(
        index_path=vector_index_path,
        query_embedding=query_embedding[0],
        top_k=top_k,
    )

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    content: str
    metadata: dict


def load_pdf_pages(file_path: str) -> list:
    from langchain_community.document_loaders import PyPDFLoader

    loader = PyPDFLoader(file_path)
    return loader.load()


def chunk_documents(
    documents: list,
    chunk_size: int,
    chunk_overlap: int,
) -> list[TextChunk]:
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    split_documents = splitter.split_documents(documents)

    chunks: list[TextChunk] = []
    for index, document in enumerate(split_documents):
        content = document.page_content.strip()
        if not content:
            continue

        metadata = {
            **document.metadata,
            "chunk_index": index,
            "content_length": len(content),
        }
        chunks.append(TextChunk(content=content, metadata=metadata))

    return chunks

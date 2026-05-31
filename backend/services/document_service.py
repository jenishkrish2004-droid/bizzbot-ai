from __future__ import annotations

from pathlib import Path

from flask import current_app
from werkzeug.datastructures import FileStorage

from extensions import db
from ai_pipeline.rag_pipeline import index_pdf_document
from ai_pipeline.vector_store import delete_vector_index
from models.document import Document
from utils.file_utils import (
    FileValidationError,
    build_stored_pdf_name,
    delete_file_if_exists,
    ensure_upload_root,
    validate_pdf_upload,
)


class DocumentServiceError(ValueError):
    pass


def list_documents_for_user(user_id: str) -> list[Document]:
    return (
        Document.query.filter_by(user_id=user_id)
        .order_by(Document.created_at.desc())
        .all()
    )


def get_document_for_user(user_id: str, document_id: str) -> Document | None:
    return Document.query.filter_by(id=document_id, user_id=user_id).first()


def upload_documents(user_id: str, files: list[FileStorage]) -> list[Document]:
    if not files:
        raise DocumentServiceError("Attach at least one PDF")

    max_files = current_app.config["MAX_UPLOAD_FILES"]
    if len(files) > max_files:
        raise DocumentServiceError(f"Upload up to {max_files} PDFs at a time")

    max_bytes = current_app.config["MAX_CONTENT_LENGTH"]
    user_dir = ensure_upload_root(current_app.config["UPLOAD_FOLDER"], user_id)
    created_documents: list[Document] = []
    saved_paths: list[Path] = []

    try:
        for file in files:
            size = validate_pdf_upload(file, max_bytes)
            stored_filename = build_stored_pdf_name(file.filename or "document.pdf")
            destination = user_dir / stored_filename
            file.save(destination)
            saved_paths.append(destination)

            document = Document(
                user_id=user_id,
                original_filename=file.filename or "document.pdf",
                stored_filename=stored_filename,
                content_type=file.mimetype or "application/pdf",
                file_size_bytes=size,
                status="uploaded",
            )
            db.session.add(document)
            created_documents.append(document)

        db.session.commit()
        return created_documents
    except FileValidationError:
        db.session.rollback()
        for path in saved_paths:
            delete_file_if_exists(path)
        raise
    except Exception:
        db.session.rollback()
        for path in saved_paths:
            delete_file_if_exists(path)
        current_app.logger.exception("Document upload failed")
        raise DocumentServiceError("Could not upload documents")


def delete_document(user_id: str, document_id: str) -> bool:
    document = get_document_for_user(user_id, document_id)
    if not document:
        return False

    file_path = Path(current_app.config["UPLOAD_FOLDER"]) / user_id / document.stored_filename
    vector_index_path = document.vector_index_path
    db.session.delete(document)
    db.session.commit()
    delete_file_if_exists(file_path)
    delete_vector_index(vector_index_path)
    return True


def process_document_for_user(user_id: str, document_id: str) -> Document:
    document = get_document_for_user(user_id, document_id)
    if not document:
        raise DocumentServiceError("Document not found")

    file_path = Path(current_app.config["UPLOAD_FOLDER"]) / user_id / document.stored_filename
    if not file_path.exists():
        document.status = "failed"
        document.error_message = "Original PDF file is missing"
        db.session.commit()
        raise DocumentServiceError("Original PDF file is missing")

    previous_index_path = document.vector_index_path
    document.status = "processing"
    document.error_message = None
    db.session.commit()

    try:
        result = index_pdf_document(
            file_path=str(file_path),
            user_id=user_id,
            document_id=document.id,
            vector_index_folder=current_app.config["VECTOR_INDEX_FOLDER"],
            embedding_model_name=current_app.config["EMBEDDING_MODEL_NAME"],
            chunk_size=current_app.config["RAG_CHUNK_SIZE"],
            chunk_overlap=current_app.config["RAG_CHUNK_OVERLAP"],
        )
        if previous_index_path and previous_index_path != result.vector_index_path:
            delete_vector_index(previous_index_path)

        document.status = "indexed"
        document.text_char_count = result.text_char_count
        document.chunk_count = result.chunk_count
        document.vector_index_path = result.vector_index_path
        document.error_message = None
        db.session.commit()

        try:
            from services.lead_service import extract_leads_for_document

            extract_leads_for_document(user_id=user_id, document_id=document.id)
        except Exception:
            current_app.logger.exception("Automatic lead extraction failed")

        return document
    except Exception as exc:
        current_app.logger.exception("Document indexing failed")
        document.status = "failed"
        document.error_message = str(exc)
        db.session.commit()
        raise DocumentServiceError(str(exc)) from exc

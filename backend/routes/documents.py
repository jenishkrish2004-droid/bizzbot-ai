from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.document_service import (
    DocumentServiceError,
    delete_document,
    get_document_for_user,
    list_documents_for_user,
    process_document_for_user,
    upload_documents,
)
from utils.file_utils import FileValidationError

documents_bp = Blueprint("documents", __name__)


@documents_bp.get("")
@jwt_required()
def list_documents():
    documents = list_documents_for_user(get_jwt_identity())
    return jsonify({"documents": [document.to_dict() for document in documents]})


@documents_bp.post("/upload")
@jwt_required()
def upload():
    files = request.files.getlist("files")
    if not files and "file" in request.files:
        files = [request.files["file"]]

    try:
        documents = upload_documents(get_jwt_identity(), files)
        return jsonify({"documents": [document.to_dict() for document in documents]}), 201
    except (DocumentServiceError, FileValidationError) as exc:
        return jsonify({"message": str(exc)}), 400


@documents_bp.get("/<document_id>")
@jwt_required()
def get_document(document_id: str):
    document = get_document_for_user(get_jwt_identity(), document_id)
    if not document:
        return jsonify({"message": "Document not found"}), 404
    return jsonify({"document": document.to_dict()})


@documents_bp.post("/<document_id>/process")
@jwt_required()
def process_document(document_id: str):
    try:
        document = process_document_for_user(get_jwt_identity(), document_id)
        return jsonify({"document": document.to_dict()})
    except DocumentServiceError as exc:
        message = str(exc)
        status_code = 404 if message == "Document not found" else 400
        return jsonify({"message": message}), status_code


@documents_bp.delete("/<document_id>")
@jwt_required()
def remove_document(document_id: str):
    deleted = delete_document(get_jwt_identity(), document_id)
    if not deleted:
        return jsonify({"message": "Document not found"}), 404
    return jsonify({"status": "deleted"})

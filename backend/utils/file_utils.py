from __future__ import annotations

import uuid
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


class FileValidationError(ValueError):
    pass


def ensure_upload_root(upload_folder: str, user_id: str) -> Path:
    root = Path(upload_folder).resolve()
    user_dir = (root / user_id).resolve()

    if root not in user_dir.parents and user_dir != root:
        raise FileValidationError("Invalid upload path")

    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def validate_pdf_upload(file: FileStorage, max_bytes: int) -> int:
    if not file or not file.filename:
        raise FileValidationError("Uploaded file is missing a filename")

    filename = secure_filename(file.filename)
    extension = Path(filename).suffix.lower()
    if extension != ".pdf":
        raise FileValidationError(f"{file.filename} is not a PDF")

    position = file.stream.tell()
    file.stream.seek(0, 2)
    size = file.stream.tell()
    file.stream.seek(position)

    if size <= 0:
        raise FileValidationError(f"{file.filename} is empty")
    if size > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise FileValidationError(f"{file.filename} exceeds the {max_mb}MB limit")

    header = file.stream.read(5)
    file.stream.seek(position)
    if header != b"%PDF-":
        raise FileValidationError(f"{file.filename} is not a valid PDF file")

    return size


def build_stored_pdf_name(original_filename: str) -> str:
    stem = Path(secure_filename(original_filename)).stem[:80] or "document"
    return f"{stem}-{uuid.uuid4().hex}.pdf"


def delete_file_if_exists(path: str | Path) -> None:
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        file_path.unlink()

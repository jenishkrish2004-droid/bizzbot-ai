from __future__ import annotations

import uuid
from datetime import datetime, timezone

from extensions import db


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(120), nullable=False, default="application/pdf")
    file_size_bytes = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(40), nullable=False, default="uploaded")
    text_char_count = db.Column(db.Integer, nullable=False, default=0)
    chunk_count = db.Column(db.Integer, nullable=False, default=0)
    vector_index_path = db.Column(db.String(500), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    owner = db.relationship("User", back_populates="documents")
    leads = db.relationship("Lead", back_populates="document")
    conversations = db.relationship("Conversation", back_populates="document")

    def to_dict(self) -> dict[str, str | int | None]:
        return {
            "id": self.id,
            "originalFilename": self.original_filename,
            "storedFilename": self.stored_filename,
            "contentType": self.content_type,
            "fileSizeBytes": self.file_size_bytes,
            "status": self.status,
            "textCharCount": self.text_char_count,
            "chunkCount": self.chunk_count,
            "errorMessage": self.error_message,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

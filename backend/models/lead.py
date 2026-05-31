from __future__ import annotations

import uuid
from datetime import datetime, timezone

from extensions import db


class Lead(db.Model):
    __tablename__ = "leads"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True, index=True)
    name = db.Column(db.String(180), nullable=True)
    email = db.Column(db.String(255), nullable=True, index=True)
    phone = db.Column(db.String(80), nullable=True)
    company = db.Column(db.String(180), nullable=True)
    designation = db.Column(db.String(180), nullable=True)
    location = db.Column(db.String(180), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    linkedin = db.Column(db.String(255), nullable=True)
    intent = db.Column(db.JSON, nullable=False, default=list)
    confidence_score = db.Column(db.Float, nullable=False, default=0.0)
    source_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    owner = db.relationship("User", back_populates="leads")
    document = db.relationship("Document", back_populates="leads")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "userId": self.user_id,
            "documentId": self.document_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "company": self.company,
            "designation": self.designation,
            "location": self.location,
            "website": self.website,
            "linkedin": self.linkedin,
            "intent": self.intent or [],
            "confidenceScore": self.confidence_score,
            "sourceText": self.source_text,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "documentName": self.document.original_filename if self.document else None,
        }

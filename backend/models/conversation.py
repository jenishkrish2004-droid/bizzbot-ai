from __future__ import annotations

import uuid
from datetime import datetime, timezone

from extensions import db


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey("documents.id"), nullable=True, index=True)
    title = db.Column(db.String(180), nullable=False, default="Document chat")
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

    owner = db.relationship("User", back_populates="conversations")
    document = db.relationship("Document", back_populates="conversations")
    messages = db.relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )

    def to_dict(self, include_messages: bool = False) -> dict:
        payload = {
            "id": self.id,
            "documentId": self.document_id,
            "title": self.title,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            payload["messages"] = [message.to_dict() for message in self.messages]
        return payload


class ConversationMessage(db.Model):
    __tablename__ = "conversation_messages"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = db.Column(
        db.String(36),
        db.ForeignKey("conversations.id"),
        nullable=False,
        index=True,
    )
    role = db.Column(db.String(30), nullable=False)
    content = db.Column(db.Text, nullable=False)
    citations = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    conversation = db.relationship("Conversation", back_populates="messages")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "conversationId": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "citations": self.citations,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }

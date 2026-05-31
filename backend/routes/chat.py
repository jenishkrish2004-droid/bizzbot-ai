from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.chat_service import (
    ChatServiceError,
    ask_document_question,
    create_conversation,
    get_conversation_for_user,
    list_conversations_for_user,
)
from utils.validators import ValidationError, require_json_fields

chat_bp = Blueprint("chat", __name__)


@chat_bp.get("/conversations")
@jwt_required()
def list_conversations():
    conversations = list_conversations_for_user(get_jwt_identity())
    return jsonify({"conversations": [conversation.to_dict() for conversation in conversations]})


@chat_bp.post("/conversations")
@jwt_required()
def create_chat_conversation():
    payload = request.get_json(silent=True)
    try:
        require_json_fields(payload, ["documentId"])
        conversation = create_conversation(
            user_id=get_jwt_identity(),
            document_id=payload["documentId"],
            title=payload.get("title"),
        )
        return jsonify({"conversation": conversation.to_dict(include_messages=True)}), 201
    except (ValidationError, ChatServiceError) as exc:
        return jsonify({"message": str(exc)}), 400


@chat_bp.get("/conversations/<conversation_id>")
@jwt_required()
def get_chat_conversation(conversation_id: str):
    conversation = get_conversation_for_user(get_jwt_identity(), conversation_id)
    if not conversation:
        return jsonify({"message": "Conversation not found"}), 404
    return jsonify({"conversation": conversation.to_dict(include_messages=True)})


@chat_bp.post("/ask")
@jwt_required()
def ask():
    payload = request.get_json(silent=True)
    try:
        require_json_fields(payload, ["documentId", "question"])
        conversation, answer = ask_document_question(
            user_id=get_jwt_identity(),
            document_id=payload["documentId"],
            question=payload["question"],
            conversation_id=payload.get("conversationId"),
        )
        return jsonify(
            {
                "conversation": conversation.to_dict(include_messages=True),
                "answer": answer.to_dict(),
            }
        )
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except ChatServiceError as exc:
        message = str(exc)
        status_code = 404 if message in {"Document not found", "Conversation not found"} else 400
        return jsonify({"message": message}), status_code

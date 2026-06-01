from __future__ import annotations

from flask import current_app

from ai_pipeline.llm_client import synthesize_answer
from ai_pipeline.rag_pipeline import retrieve_document_context
from extensions import db
from models.conversation import Conversation, ConversationMessage
from models.document import Document
from services.analytics_service import record_activity_event, record_usage_metric


class ChatServiceError(ValueError):
    pass


def list_conversations_for_user(user_id: str) -> list[Conversation]:
    return (
        Conversation.query.filter_by(user_id=user_id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )


def get_conversation_for_user(user_id: str, conversation_id: str) -> Conversation | None:
    return Conversation.query.filter_by(id=conversation_id, user_id=user_id).first()


def create_conversation(user_id: str, document_id: str, title: str | None = None) -> Conversation:
    document = _get_indexed_document(user_id, document_id)
    conversation = Conversation(
        user_id=user_id,
        document_id=document.id,
        title=(title or document.original_filename or "Document chat")[:180],
    )
    db.session.add(conversation)
    db.session.commit()
    record_activity_event(
        user_id=user_id,
        event_type="conversation.created",
        entity_type="conversation",
        entity_id=conversation.id,
        metadata={"documentId": document.id, "title": conversation.title},
    )
    record_usage_metric(user_id=user_id, metric_name="conversations_created")
    return conversation


def ask_document_question(
    *,
    user_id: str,
    document_id: str,
    question: str,
    conversation_id: str | None = None,
) -> tuple[Conversation, ConversationMessage]:
    cleaned_question = question.strip()
    if not cleaned_question:
        raise ChatServiceError("Question is required")

    document = _get_indexed_document(user_id, document_id)

    if conversation_id:
        conversation = get_conversation_for_user(user_id, conversation_id)
        if not conversation:
            raise ChatServiceError("Conversation not found")
        if conversation.document_id != document.id:
            raise ChatServiceError("Conversation belongs to a different document")
    else:
        conversation = create_conversation(user_id, document.id, title=_title_from_question(cleaned_question))

    contexts = retrieve_document_context(
        question=cleaned_question,
        vector_index_path=document.vector_index_path or "",
        embedding_model_name=current_app.config["EMBEDDING_MODEL_NAME"],
        top_k=current_app.config["RAG_TOP_K"],
    )
    citations = [_citation_from_result(document, result, index) for index, result in enumerate(contexts)]
    answer = synthesize_answer(
        question=cleaned_question,
        contexts=contexts,
        api_key=current_app.config["OPENAI_API_KEY"],
        model=current_app.config["OPENAI_MODEL"],
    )

    user_message = ConversationMessage(
        conversation_id=conversation.id,
        role="user",
        content=cleaned_question,
        citations=[],
    )
    assistant_message = ConversationMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        citations=citations,
    )
    db.session.add(user_message)
    db.session.add(assistant_message)
    db.session.commit()
    record_activity_event(
        user_id=user_id,
        event_type="chat.question_asked",
        entity_type="conversation",
        entity_id=conversation.id,
        metadata={
            "documentId": document.id,
            "questionLength": len(cleaned_question),
            "citationCount": len(citations),
        },
    )
    record_usage_metric(user_id=user_id, metric_name="chat_questions_asked")

    return conversation, assistant_message


def _get_indexed_document(user_id: str, document_id: str) -> Document:
    document = Document.query.filter_by(id=document_id, user_id=user_id).first()
    if not document:
        raise ChatServiceError("Document not found")
    if document.status != "indexed" or not document.vector_index_path:
        raise ChatServiceError("Document must be indexed before chat")
    return document


def _citation_from_result(document: Document, result: dict, index: int) -> dict:
    metadata = result.get("metadata", {})
    page = metadata.get("page")
    return {
        "source": index + 1,
        "documentId": document.id,
        "documentName": document.original_filename,
        "page": page + 1 if isinstance(page, int) else page,
        "chunkIndex": metadata.get("chunk_index"),
        "score": result.get("score"),
        "preview": " ".join(result.get("content", "").split())[:240],
    }


def _title_from_question(question: str) -> str:
    title = " ".join(question.split())[:70]
    return title if title else "Document chat"

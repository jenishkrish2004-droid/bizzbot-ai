from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from flask import current_app
from sqlalchemy import func, or_

from ai_pipeline.lead_extractor import ExtractedLead, extract_leads
from extensions import db
from models.conversation import Conversation
from models.document import Document
from models.lead import Lead


class LeadServiceError(ValueError):
    pass


def extract_leads_for_document(
    *,
    user_id: str,
    document_id: str,
    include_conversation_id: str | None = None,
    replace_existing: bool = False,
) -> list[Lead]:
    document = Document.query.filter_by(id=document_id, user_id=user_id).first()
    if not document:
        raise LeadServiceError("Document not found")
    if document.status != "indexed" or not document.vector_index_path:
        raise LeadServiceError("Document must be indexed before lead extraction")

    source_text = _load_indexed_document_text(document.vector_index_path)
    if include_conversation_id:
        source_text = f"{source_text}\n\n{_load_conversation_text(user_id, include_conversation_id, document_id)}"

    extracted = extract_leads(
        text=source_text,
        openai_api_key=current_app.config["OPENAI_API_KEY"],
        openai_model=current_app.config["OPENAI_MODEL"],
        gemini_api_key=current_app.config["GEMINI_API_KEY"],
        gemini_model=current_app.config["GEMINI_MODEL"],
    )

    if replace_existing:
        Lead.query.filter_by(user_id=user_id, document_id=document_id).delete()
        db.session.flush()

    saved = _persist_extracted_leads(user_id=user_id, document_id=document_id, extracted=extracted)
    db.session.commit()
    return saved


def list_leads(
    *,
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    company: str | None = None,
) -> dict:
    query = Lead.query.filter_by(user_id=user_id)

    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.name.ilike(like),
                Lead.email.ilike(like),
                Lead.phone.ilike(like),
                Lead.company.ilike(like),
                Lead.designation.ilike(like),
                Lead.location.ilike(like),
            )
        )

    if company:
        query = query.filter(Lead.company.ilike(f"%{company.strip()}%"))

    pagination = query.order_by(Lead.created_at.desc()).paginate(
        page=max(page, 1),
        per_page=min(max(per_page, 1), 100),
        error_out=False,
    )

    return {
        "leads": [lead.to_dict() for lead in pagination.items],
        "pagination": {
            "page": pagination.page,
            "perPage": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
        },
        "summary": get_lead_summary(user_id),
        "companies": get_company_filters(user_id),
    }


def get_lead(user_id: str, lead_id: str) -> Lead | None:
    return Lead.query.filter_by(id=lead_id, user_id=user_id).first()


def delete_lead(user_id: str, lead_id: str) -> bool:
    lead = get_lead(user_id, lead_id)
    if not lead:
        return False
    db.session.delete(lead)
    db.session.commit()
    return True


def get_lead_summary(user_id: str) -> dict:
    total = Lead.query.filter_by(user_id=user_id).count()
    high_confidence = Lead.query.filter(
        Lead.user_id == user_id,
        Lead.confidence_score >= 0.75,
    ).count()
    companies = (
        db.session.query(func.count(func.distinct(Lead.company)))
        .filter(Lead.user_id == user_id, Lead.company.isnot(None), Lead.company != "")
        .scalar()
        or 0
    )
    recent = Lead.query.filter_by(user_id=user_id).order_by(Lead.created_at.desc()).limit(5).all()
    return {
        "totalLeads": total,
        "highConfidenceLeads": high_confidence,
        "companiesDetected": companies,
        "recentExtractions": [lead.to_dict() for lead in recent],
    }


def get_company_filters(user_id: str) -> list[str]:
    rows = (
        db.session.query(Lead.company)
        .filter(Lead.user_id == user_id, Lead.company.isnot(None), Lead.company != "")
        .distinct()
        .order_by(Lead.company.asc())
        .all()
    )
    return [row[0] for row in rows]


def export_leads_csv(user_id: str) -> str:
    leads = Lead.query.filter_by(user_id=user_id).order_by(Lead.created_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "name",
            "email",
            "phone",
            "company",
            "designation",
            "location",
            "website",
            "linkedin",
            "intent",
            "confidence_score",
            "document",
            "created_at",
        ]
    )

    for lead in leads:
        writer.writerow(
            [
                lead.name or "",
                lead.email or "",
                lead.phone or "",
                lead.company or "",
                lead.designation or "",
                lead.location or "",
                lead.website or "",
                lead.linkedin or "",
                ", ".join(lead.intent or []),
                lead.confidence_score,
                lead.document.original_filename if lead.document else "",
                lead.created_at.isoformat() if lead.created_at else "",
            ]
        )

    return output.getvalue()


def _persist_extracted_leads(
    *,
    user_id: str,
    document_id: str,
    extracted: list[ExtractedLead],
) -> list[Lead]:
    saved: list[Lead] = []
    for item in extracted:
        existing = _find_existing_lead(user_id, document_id, item)
        if existing:
            _merge_into_model(existing, item)
            saved.append(existing)
            continue

        lead = Lead(
            user_id=user_id,
            document_id=document_id,
            name=item.name,
            email=item.email,
            phone=item.phone,
            company=item.company,
            designation=item.designation,
            location=item.location,
            website=item.website,
            linkedin=item.linkedin,
            intent=item.intent,
            confidence_score=item.confidence_score,
            source_text=item.source_text,
        )
        db.session.add(lead)
        saved.append(lead)
    return saved


def _find_existing_lead(user_id: str, document_id: str, item: ExtractedLead) -> Lead | None:
    query = Lead.query.filter_by(user_id=user_id, document_id=document_id)
    filters = []
    if item.email:
        filters.append(Lead.email == item.email)
    if item.phone:
        filters.append(Lead.phone == item.phone)
    if item.linkedin:
        filters.append(Lead.linkedin == item.linkedin)
    if not filters and item.name and item.company:
        filters.append((Lead.name == item.name) & (Lead.company == item.company))
    if not filters:
        return None
    return query.filter(or_(*filters)).first()


def _merge_into_model(lead: Lead, item: ExtractedLead) -> None:
    for field in ["name", "email", "phone", "company", "designation", "location", "website", "linkedin", "source_text"]:
        if not getattr(lead, field) and getattr(item, field):
            setattr(lead, field, getattr(item, field))
    lead.intent = sorted({*(lead.intent or []), *(item.intent or [])})
    lead.confidence_score = max(lead.confidence_score or 0, item.confidence_score or 0)


def _load_indexed_document_text(vector_index_path: str) -> str:
    chunks_path = Path(vector_index_path) / "chunks.json"
    if not chunks_path.exists():
        raise LeadServiceError("Indexed chunk metadata is missing")

    payload = json.loads(chunks_path.read_text(encoding="utf-8"))
    chunks = payload.get("chunks", [])
    return "\n\n".join(chunk.get("content", "") for chunk in chunks if chunk.get("content"))


def _load_conversation_text(user_id: str, conversation_id: str, document_id: str) -> str:
    conversation = Conversation.query.filter_by(
        id=conversation_id,
        user_id=user_id,
        document_id=document_id,
    ).first()
    if not conversation:
        raise LeadServiceError("Conversation not found")
    return "\n".join(message.content for message in conversation.messages)

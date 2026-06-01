from __future__ import annotations

from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from flask import current_app, has_app_context
from sqlalchemy import func

from extensions import db
from models.analytics import ActivityEvent, UsageMetric
from models.conversation import Conversation, ConversationMessage
from models.document import Document
from models.lead import Lead


DEFAULT_ANALYTICS_DAYS = 30
MAX_ANALYTICS_DAYS = 180

EVENT_LABELS = {
    "user.signup": "Workspace created",
    "user.login": "Signed in",
    "document.uploaded": "Document uploaded",
    "document.indexing_started": "Document indexing started",
    "document.indexed": "Document indexed",
    "document.processing_failed": "Document processing failed",
    "document.deleted": "Document deleted",
    "conversation.created": "Conversation created",
    "chat.question_asked": "Chat question asked",
    "lead.extraction_completed": "Lead extraction completed",
    "lead.deleted": "Lead deleted",
}

METRIC_LABELS = {
    "user_signups": "User signups",
    "user_logins": "User logins",
    "documents_uploaded": "Documents uploaded",
    "documents_indexed": "Documents indexed",
    "documents_failed": "Documents failed",
    "documents_deleted": "Documents deleted",
    "leads_extracted": "Leads extracted",
    "leads_deleted": "Leads deleted",
    "chat_questions_asked": "Chat questions asked",
    "conversations_created": "Conversations created",
}


def record_activity_event(
    *,
    user_id: str,
    event_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> ActivityEvent | None:
    try:
        event = ActivityEvent(
            user_id=user_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata or {},
        )
        db.session.add(event)
        db.session.commit()
        return event
    except Exception:
        db.session.rollback()
        _log_analytics_failure("Could not record analytics activity event")
        return None


def record_usage_metric(
    *,
    user_id: str,
    metric_name: str,
    metric_value: float = 1.0,
    metadata: dict[str, Any] | None = None,
) -> UsageMetric | None:
    try:
        metric = UsageMetric(
            user_id=user_id,
            metric_name=metric_name,
            metric_value=metric_value,
            metadata_json=metadata or {},
        )
        db.session.add(metric)
        db.session.commit()
        return metric
    except Exception:
        db.session.rollback()
        _log_analytics_failure("Could not record analytics usage metric")
        return None


def get_analytics_overview(user_id: str, days: int = DEFAULT_ANALYTICS_DAYS) -> dict:
    days = _normalize_days(days)
    since = _start_of_day(datetime.now(timezone.utc) - timedelta(days=days - 1))

    document_stats = _document_stats(user_id)
    lead_stats = _lead_stats(user_id)
    conversation_stats = _conversation_stats(user_id, since)
    usage_totals = _usage_totals(user_id, since)

    return {
        "range": {
            "days": days,
            "startDate": since.date().isoformat(),
            "endDate": datetime.now(timezone.utc).date().isoformat(),
        },
        "summary": {
            "documentsUploaded": document_stats["totalDocuments"],
            "documentsIndexed": document_stats["indexedDocuments"],
            "leadsExtracted": lead_stats["totalLeads"],
            "chatQuestionsAsked": conversation_stats["questionsAsked"],
            "activeConversations": conversation_stats["activeConversations"],
            "processingSuccessRate": document_stats["processingSuccessRate"],
        },
        "documents": document_stats,
        "leads": lead_stats,
        "conversations": conversation_stats,
        "usageMetrics": usage_totals,
        "charts": {
            "leadGenerationTrend": _daily_lead_trend(user_id, since, days),
            "documentsProcessed": _daily_document_processed_trend(user_id, since, days),
            "chatActivity": _daily_chat_activity(user_id, since, days),
            "userEngagement": _daily_activity_events(user_id, since, days),
            "leadSourceDistribution": _lead_source_distribution(user_id),
            "documentStatusDistribution": document_stats["statusDistribution"],
            "usageMetricTotals": [
                {"name": METRIC_LABELS.get(name, name.replace("_", " ").title()), "value": value}
                for name, value in usage_totals.items()
            ],
        },
        "recentActivity": get_recent_activity(user_id=user_id, limit=12),
    }


def get_recent_activity(user_id: str, limit: int = 20) -> list[dict]:
    limit = min(max(limit, 1), 100)
    events = (
        ActivityEvent.query.filter_by(user_id=user_id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_event(event) for event in events]


def get_usage_metrics(user_id: str, days: int = DEFAULT_ANALYTICS_DAYS) -> dict:
    days = _normalize_days(days)
    since = _start_of_day(datetime.now(timezone.utc) - timedelta(days=days - 1))
    return {
        "range": {
            "days": days,
            "startDate": since.date().isoformat(),
            "endDate": datetime.now(timezone.utc).date().isoformat(),
        },
        "totals": _usage_totals(user_id, since),
        "trend": _daily_usage_metric_trend(user_id, since, days),
    }


def _document_stats(user_id: str) -> dict:
    documents = Document.query.filter_by(user_id=user_id)
    total = documents.count()
    indexed = documents.filter(Document.status == "indexed").count()
    failed = documents.filter(Document.status == "failed").count()
    uploaded = documents.filter(Document.status == "uploaded").count()
    processing = documents.filter(Document.status == "processing").count()
    processed = indexed + failed
    success_rate = round((indexed / processed) * 100, 1) if processed else 0.0

    return {
        "totalDocuments": total,
        "uploadedDocuments": uploaded,
        "processingDocuments": processing,
        "indexedDocuments": indexed,
        "failedDocuments": failed,
        "processedDocuments": processed,
        "processingSuccessRate": success_rate,
        "statusDistribution": [
            {"name": "Uploaded", "value": uploaded},
            {"name": "Processing", "value": processing},
            {"name": "Indexed", "value": indexed},
            {"name": "Failed", "value": failed},
        ],
    }


def _lead_stats(user_id: str) -> dict:
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
    return {
        "totalLeads": total,
        "highConfidenceLeads": high_confidence,
        "companiesDetected": int(companies),
        "highConfidenceRate": round((high_confidence / total) * 100, 1) if total else 0.0,
    }


def _conversation_stats(user_id: str, since: datetime) -> dict:
    total = Conversation.query.filter_by(user_id=user_id).count()
    active = Conversation.query.filter(
        Conversation.user_id == user_id,
        Conversation.updated_at >= since,
    ).count()
    questions = (
        db.session.query(func.count(ConversationMessage.id))
        .join(Conversation)
        .filter(
            Conversation.user_id == user_id,
            ConversationMessage.role == "user",
        )
        .scalar()
        or 0
    )
    questions_in_range = (
        db.session.query(func.count(ConversationMessage.id))
        .join(Conversation)
        .filter(
            Conversation.user_id == user_id,
            ConversationMessage.role == "user",
            ConversationMessage.created_at >= since,
        )
        .scalar()
        or 0
    )
    return {
        "totalConversations": total,
        "activeConversations": active,
        "questionsAsked": int(questions),
        "questionsAskedInRange": int(questions_in_range),
    }


def _usage_totals(user_id: str, since: datetime) -> dict[str, float]:
    rows = (
        db.session.query(UsageMetric.metric_name, func.coalesce(func.sum(UsageMetric.metric_value), 0))
        .filter(UsageMetric.user_id == user_id, UsageMetric.recorded_at >= since)
        .group_by(UsageMetric.metric_name)
        .all()
    )
    totals = {name: float(value or 0) for name, value in rows}
    for name in METRIC_LABELS:
        totals.setdefault(name, 0.0)
    return totals


def _lead_source_distribution(user_id: str) -> list[dict]:
    rows = (
        db.session.query(Document.original_filename, func.count(Lead.id))
        .select_from(Lead)
        .outerjoin(Document, Lead.document_id == Document.id)
        .filter(Lead.user_id == user_id)
        .group_by(Document.original_filename)
        .order_by(func.count(Lead.id).desc())
        .limit(8)
        .all()
    )
    return [{"name": filename or "Unknown source", "value": int(count)} for filename, count in rows]


def _daily_lead_trend(user_id: str, since: datetime, days: int) -> list[dict]:
    rows = (
        db.session.query(func.date(Lead.created_at), func.count(Lead.id))
        .filter(Lead.user_id == user_id, Lead.created_at >= since)
        .group_by(func.date(Lead.created_at))
        .all()
    )
    return _daily_series(rows, days, since, value_key="leads")


def _daily_document_processed_trend(user_id: str, since: datetime, days: int) -> list[dict]:
    rows = (
        db.session.query(func.date(Document.updated_at), func.count(Document.id))
        .filter(
            Document.user_id == user_id,
            Document.updated_at >= since,
            Document.status.in_(["indexed", "failed"]),
        )
        .group_by(func.date(Document.updated_at))
        .all()
    )
    return _daily_series(rows, days, since, value_key="documents")


def _daily_chat_activity(user_id: str, since: datetime, days: int) -> list[dict]:
    rows = (
        db.session.query(func.date(ConversationMessage.created_at), func.count(ConversationMessage.id))
        .join(Conversation)
        .filter(
            Conversation.user_id == user_id,
            ConversationMessage.role == "user",
            ConversationMessage.created_at >= since,
        )
        .group_by(func.date(ConversationMessage.created_at))
        .all()
    )
    return _daily_series(rows, days, since, value_key="questions")


def _daily_activity_events(user_id: str, since: datetime, days: int) -> list[dict]:
    rows = (
        db.session.query(func.date(ActivityEvent.created_at), func.count(ActivityEvent.id))
        .filter(ActivityEvent.user_id == user_id, ActivityEvent.created_at >= since)
        .group_by(func.date(ActivityEvent.created_at))
        .all()
    )
    return _daily_series(rows, days, since, value_key="events")


def _daily_usage_metric_trend(user_id: str, since: datetime, days: int) -> list[dict]:
    rows = (
        db.session.query(
            func.date(UsageMetric.recorded_at),
            UsageMetric.metric_name,
            func.coalesce(func.sum(UsageMetric.metric_value), 0),
        )
        .filter(UsageMetric.user_id == user_id, UsageMetric.recorded_at >= since)
        .group_by(func.date(UsageMetric.recorded_at), UsageMetric.metric_name)
        .all()
    )

    series = _empty_daily_buckets(days, since)
    for day, metric_name, value in rows:
        key = _day_key(day)
        if key in series:
            series[key][metric_name] = float(value or 0)
    return list(series.values())


def _daily_series(rows: list[tuple], days: int, since: datetime, value_key: str) -> list[dict]:
    series = _empty_daily_buckets(days, since)
    for day, value in rows:
        key = _day_key(day)
        if key in series:
            series[key][value_key] = int(value or 0)
    return list(series.values())


def _empty_daily_buckets(days: int, since: datetime) -> OrderedDict[str, dict]:
    buckets: OrderedDict[str, dict] = OrderedDict()
    for offset in range(days):
        current = since + timedelta(days=offset)
        key = current.date().isoformat()
        buckets[key] = {
            "date": key,
            "label": current.strftime("%b %d"),
        }
    return buckets


def _serialize_event(event: ActivityEvent) -> dict:
    return {
        "id": event.id,
        "eventType": event.event_type,
        "label": EVENT_LABELS.get(event.event_type, event.event_type.replace(".", " ").title()),
        "entityType": event.entity_type,
        "entityId": event.entity_id,
        "metadata": event.metadata_json or {},
        "createdAt": event.created_at.isoformat() if event.created_at else None,
    }


def _normalize_days(days: int) -> int:
    try:
        value = int(days)
    except (TypeError, ValueError):
        value = DEFAULT_ANALYTICS_DAYS
    return min(max(value, 7), MAX_ANALYTICS_DAYS)


def _start_of_day(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def _day_key(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _log_analytics_failure(message: str) -> None:
    if has_app_context():
        current_app.logger.exception(message)

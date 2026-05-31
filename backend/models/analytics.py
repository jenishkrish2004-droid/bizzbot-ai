from __future__ import annotations

import uuid
from datetime import datetime, timezone

from extensions import db


class ActivityEvent(db.Model):
    __tablename__ = "activity_events"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    event_type = db.Column(db.String(80), nullable=False, index=True)
    entity_type = db.Column(db.String(80), nullable=True)
    entity_id = db.Column(db.String(36), nullable=True)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class UsageMetric(db.Model):
    __tablename__ = "usage_metrics"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    metric_name = db.Column(db.String(80), nullable=False, index=True)
    metric_value = db.Column(db.Float, nullable=False, default=0.0)
    metadata_json = db.Column(db.JSON, nullable=False, default=dict)
    recorded_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.analytics_service import (
    DEFAULT_ANALYTICS_DAYS,
    get_analytics_overview,
    get_recent_activity,
    get_usage_metrics,
)

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.get("/overview")
@jwt_required()
def overview():
    days = request.args.get("days", default=DEFAULT_ANALYTICS_DAYS, type=int)
    return jsonify(get_analytics_overview(get_jwt_identity(), days=days))


@analytics_bp.get("/activity")
@jwt_required()
def activity():
    limit = request.args.get("limit", default=20, type=int)
    return jsonify({"activity": get_recent_activity(get_jwt_identity(), limit=limit)})


@analytics_bp.get("/usage")
@jwt_required()
def usage():
    days = request.args.get("days", default=DEFAULT_ANALYTICS_DAYS, type=int)
    return jsonify(get_usage_metrics(get_jwt_identity(), days=days))

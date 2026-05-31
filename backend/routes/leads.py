from __future__ import annotations

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.lead_service import (
    LeadServiceError,
    delete_lead,
    export_leads_csv,
    extract_leads_for_document,
    get_lead,
    list_leads,
)
from utils.validators import ValidationError, require_json_fields

leads_bp = Blueprint("leads", __name__)


@leads_bp.post("/extract")
@jwt_required()
def extract():
    payload = request.get_json(silent=True)
    try:
        require_json_fields(payload, ["documentId"])
        leads = extract_leads_for_document(
            user_id=get_jwt_identity(),
            document_id=payload["documentId"],
            include_conversation_id=payload.get("conversationId"),
            replace_existing=bool(payload.get("replaceExisting", False)),
        )
        return jsonify({"leads": [lead.to_dict() for lead in leads], "count": len(leads)})
    except (ValidationError, LeadServiceError) as exc:
        message = str(exc)
        status_code = 404 if message in {"Document not found", "Conversation not found"} else 400
        return jsonify({"message": message}), status_code


@leads_bp.get("")
@jwt_required()
def list_all():
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("perPage", default=20, type=int)
    search = request.args.get("search")
    company = request.args.get("company")
    return jsonify(
        list_leads(
            user_id=get_jwt_identity(),
            page=page,
            per_page=per_page,
            search=search,
            company=company,
        )
    )


@leads_bp.get("/export/csv")
@jwt_required()
def export_csv():
    csv_payload = export_leads_csv(get_jwt_identity())
    return Response(
        csv_payload,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=bizzbot-leads.csv"},
    )


@leads_bp.get("/<lead_id>")
@jwt_required()
def get_one(lead_id: str):
    lead = get_lead(get_jwt_identity(), lead_id)
    if not lead:
        return jsonify({"message": "Lead not found"}), 404
    return jsonify({"lead": lead.to_dict()})


@leads_bp.delete("/<lead_id>")
@jwt_required()
def delete_one(lead_id: str):
    deleted = delete_lead(get_jwt_identity(), lead_id)
    if not deleted:
        return jsonify({"message": "Lead not found"}), 404
    return jsonify({"status": "deleted"})

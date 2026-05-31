from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from services.auth_service import (
    AuthenticationError,
    authenticate_user,
    build_auth_payload,
    get_user_by_id,
    register_user,
)
from utils.validators import ValidationError, require_json_fields

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/signup")
def signup():
    payload = request.get_json(silent=True)
    try:
        require_json_fields(payload, ["fullName", "email", "password"])
        auth_payload = register_user(
            full_name=payload["fullName"],
            email=payload["email"],
            password=payload["password"],
        )
        return jsonify(auth_payload), 201
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True)
    try:
        require_json_fields(payload, ["email", "password"])
        auth_payload = authenticate_user(email=payload["email"], password=payload["password"])
        return jsonify(auth_payload)
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except AuthenticationError as exc:
        return jsonify({"message": str(exc)}), 401


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user = get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify(build_auth_payload(user))


@auth_bp.get("/me")
@jwt_required()
def me():
    user = get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404
    return jsonify({"user": user.to_dict()})


@auth_bp.get("/protected-check")
@jwt_required()
def protected_check():
    return jsonify({"status": "ok", "message": "Authenticated request accepted"})

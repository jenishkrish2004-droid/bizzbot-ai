from __future__ import annotations

from datetime import datetime, timezone

from flask_jwt_extended import create_access_token, create_refresh_token
from sqlalchemy.exc import IntegrityError

from extensions import db
from models.user import User
from utils.security import hash_password, verify_password
from utils.validators import ValidationError, normalize_email, validate_password_strength


class AuthenticationError(ValueError):
    pass


def register_user(full_name: str, email: str, password: str) -> dict:
    normalized_email = normalize_email(email)
    validate_password_strength(password)

    if User.query.filter_by(email=normalized_email).first():
        raise ValidationError("An account with this email already exists")

    user = User(
        full_name=full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(password),
    )
    db.session.add(user)

    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ValidationError("An account with this email already exists") from exc

    return build_auth_payload(user)


def authenticate_user(email: str, password: str) -> dict:
    normalized_email = normalize_email(email)
    user = User.query.filter_by(email=normalized_email).first()

    if not user or not verify_password(user.password_hash, password):
        raise AuthenticationError("Invalid email or password")
    if not user.is_active:
        raise AuthenticationError("This account is disabled")

    user.last_login_at = datetime.now(timezone.utc)
    db.session.commit()

    return build_auth_payload(user)


def build_auth_payload(user: User) -> dict:
    identity = str(user.id)
    return {
        "user": user.to_dict(),
        "accessToken": create_access_token(
            identity=identity,
            additional_claims={"role": user.role, "email": user.email},
        ),
        "refreshToken": create_refresh_token(identity=identity),
    }


def get_user_by_id(user_id: str) -> User | None:
    return User.query.filter_by(id=user_id, is_active=True).first()

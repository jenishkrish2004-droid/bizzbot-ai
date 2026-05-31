from __future__ import annotations

from email_validator import EmailNotValidError, validate_email


class ValidationError(ValueError):
    pass


def require_json_fields(payload: dict | None, fields: list[str]) -> None:
    if not isinstance(payload, dict):
        raise ValidationError("Request body must be a JSON object")

    missing = [field for field in fields if not str(payload.get(field, "")).strip()]
    if missing:
        raise ValidationError(f"Missing required field(s): {', '.join(missing)}")


def normalize_email(value: str) -> str:
    try:
        result = validate_email(value, check_deliverability=False)
        return result.normalized.lower()
    except EmailNotValidError as exc:
        raise ValidationError("Enter a valid email address") from exc


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise ValidationError("Password must be at least 8 characters")
    if password.lower() == password or password.upper() == password:
        raise ValidationError("Password must include both uppercase and lowercase letters")
    if not any(char.isdigit() for char in password):
        raise ValidationError("Password must include at least one number")

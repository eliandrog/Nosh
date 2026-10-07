"""Shared query-parameter parsing for routers (comma-separated lists, enum lists)."""

from app.core.errors import ValidationFailed


def csv(value: str | None) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def enum_list(value: str | None, enum: type, field: str) -> list:
    items = csv(value)
    try:
        return [enum(v) for v in items]
    except ValueError:
        allowed = ", ".join(e.value for e in enum)
        raise ValidationFailed("Some details need fixing.", fields={field: f"Use any of: {allowed}."}) from None

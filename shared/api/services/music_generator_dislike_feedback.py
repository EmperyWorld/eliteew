"""Dislike feedback for music generator — validation + JSON snapshot (без SQL)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Final

from api.schemas.unified_content import Content, ContentType

MUSIC_DISLIKE_REASON_CODES: Final[frozenset[str]] = frozenset(
    {
        "vocal",
        "mix",
        "genre_mismatch",
        "arrangement",
        "lyrics",
        "tempo_rhythm",
        "artifacts",
        "other",
    }
)

MAX_DISLIKE_CUSTOM_LEN = 2000


def content_eligible_for_dislike_feedback(content: Content) -> bool:
    if content.content_type != ContentType.AUDIO:
        return False
    st = (content.sub_type or "").strip().lower()
    if st == "music_generator":
        return True
    tags = content.tags or []
    return "music_generator" in {str(x).lower() for x in tags}


def validate_dislike_reason(*, code: str, custom: str | None) -> str | None:
    """Return normalized custom text for DB, or raise ValueError."""
    c = (code or "").strip().lower()
    if c not in MUSIC_DISLIKE_REASON_CODES:
        raise ValueError("invalid reason_code")
    t = (custom or "").strip() if custom is not None else ""
    if len(t) > MAX_DISLIKE_CUSTOM_LEN:
        raise ValueError("reason_custom too long")
    if c == "other":
        if not t:
            raise ValueError("reason_custom required for other")
        return t
    return t or None


def build_dislike_recipe_snapshot(*, user_id: str, content: Content) -> dict[str, Any]:
    md = content.metadata or {}
    if not isinstance(md, dict):
        md = {}
    return {
        "content_id": str(content.id),
        "user_id": str(user_id),
        "captured_at": datetime.now(UTC).isoformat(),
        "name": content.name,
        "sub_type": content.sub_type,
        "source_service": content.source_service,
        "metadata": md,
    }

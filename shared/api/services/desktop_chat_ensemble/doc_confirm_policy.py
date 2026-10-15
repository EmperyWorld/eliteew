# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# TTL and expiry policy for ensemble semi-auto document confirmation on user messages.
# Invariants:
# - Expired `asked` state is treated as safe decline (legacy freeform), never blueprint.
# Related:
# - api/services/desktop_chat_ensemble/stream_turn.py
# - api/services/desktop_chat/service.py
# ---
"""Semi-auto ensemble document confirm TTL helpers."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from api.models.desktop_ai_chat import DesktopAiChatMessage
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
)
from api.utils.datetime_helpers import utc_now_naive

ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY = "ensemble_doc_confirm_asked_at"
ENSEMBLE_DOC_CONFIRM_EXPIRED_FLAG = "ensemble_doc_confirm_expired"
DEFAULT_ENSEMBLE_DOC_CONFIRM_TTL_SECONDS = 3600


def resolve_ensemble_doc_confirm_ttl_seconds(defaults: dict[str, Any]) -> int:
    raw = defaults.get("desktop_ensemble_doc_confirm_ttl_seconds")
    try:
        sec = int(raw) if raw is not None else DEFAULT_ENSEMBLE_DOC_CONFIRM_TTL_SECONDS
    except (TypeError, ValueError):  # fmt: skip
        sec = DEFAULT_ENSEMBLE_DOC_CONFIRM_TTL_SECONDS
    return max(60, min(86_400, sec))


def _parse_iso_naive(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def doc_confirm_asked_at(msg: DesktopAiChatMessage | None) -> datetime | None:
    if msg is None:
        return None
    meta = getattr(msg, "message_metadata", None)
    if not isinstance(meta, dict):
        return None
    asked = _parse_iso_naive(meta.get(ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY))
    if asked is not None:
        return asked
    return _parse_iso_naive(getattr(msg, "created_at", None))


def doc_confirm_is_expired(msg: DesktopAiChatMessage | None, defaults: dict[str, Any]) -> bool:
    if msg is None:
        return False
    meta = getattr(msg, "message_metadata", None)
    if not isinstance(meta, dict):
        return False
    raw_state = meta.get("ensemble_doc_confirm")
    if not isinstance(raw_state, str) or raw_state.strip() != ENSEMBLE_DOC_CONFIRM_ASKED:
        return False
    asked_at = doc_confirm_asked_at(msg)
    if asked_at is None:
        return False
    ttl = resolve_ensemble_doc_confirm_ttl_seconds(defaults)
    return utc_now_naive() > asked_at + timedelta(seconds=ttl)


def resolve_doc_confirm_state(msg: DesktopAiChatMessage | None, defaults: dict[str, Any]) -> str | None:
    """Return effective confirm state; expired `asked` is reported as `declined`."""
    if msg is None:
        return None
    meta = getattr(msg, "message_metadata", None)
    if not isinstance(meta, dict):
        return None
    raw = meta.get("ensemble_doc_confirm")
    if not isinstance(raw, str) or not raw.strip():
        return None
    state = raw.strip()
    if state == ENSEMBLE_DOC_CONFIRM_ASKED and doc_confirm_is_expired(msg, defaults):
        return ENSEMBLE_DOC_CONFIRM_DECLINED
    return state


def stamp_doc_confirm_asked(meta: dict[str, Any]) -> dict[str, Any]:
    out = dict(meta)
    out["ensemble_doc_confirm"] = ENSEMBLE_DOC_CONFIRM_ASKED
    out.setdefault(ENSEMBLE_DOC_CONFIRM_ASKED_AT_KEY, utc_now_naive().isoformat(timespec="seconds"))
    out.pop(ENSEMBLE_DOC_CONFIRM_EXPIRED_FLAG, None)
    return out


def mark_doc_confirm_expired_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    out = dict(meta)
    out["ensemble_doc_confirm"] = ENSEMBLE_DOC_CONFIRM_DECLINED
    out[ENSEMBLE_DOC_CONFIRM_EXPIRED_FLAG] = True
    out.pop("ensemble_doc_confirm_reason", None)
    return out

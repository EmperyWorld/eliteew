# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Companion evolution**: merge sanitized ``learned_preferences`` deltas with strict caps and audited ``evolution_tick`` writes.
# Invariants:
# - Shallow scalar JSON only inside ``learned_preferences`` deltas (no nested dict/list payloads).
# - Never weakens deny policy elsewhere (preference merge is orthogonal to orchestration intent policy).
# - Companion evolution Celery idempotency keys: explicit capped length or derived SHA-256 fingerprint
#   (stable for the same sanitized delta); never logged raw outside short hash prefixes.
# Related:
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - api/ewa_platform/docs/COMPANION-EVOLUTION-PIPELINE.md
# **Canonical path:** ``api.ewa_platform.companion.persona.evolution_tick``; shim ``companion.evolution_tick``.
# ---
"""Learned-preferences evolution merge (manual / worker entry)."""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.persistence_pg.companion_asyncpg import (
    companion_audit_only,
    companion_profile_patch,
)

logger = logging.getLogger(__name__)

_LEARN_DELTA_MAX_KEYS = 48
_REASON_MAX = 256
_JSON_DETAIL_CAP = 3000

_KEY_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_.]{0,127}$")
_STR_MAX_IN = 512
_IDEMPOTENCY_EXPLICIT_MAX_LEN = 128


def sanitize_learned_preferences_delta(
    raw: Mapping[str, Any] | None,
) -> tuple[dict[str, Any], list[str]]:
    """Return shallow JSON-safe deltas plus human-readable-drop reasons."""

    warns: list[str] = []
    if raw is None:
        return {}, warns
    if not isinstance(raw, Mapping):
        warns.append("learned_preferences_delta_not_object")
        return {}, warns

    out: dict[str, Any] = {}
    keys_seen = 0
    for k_raw, val in raw.items():
        if keys_seen >= _LEARN_DELTA_MAX_KEYS:
            warns.append(f"truncated_after_{_LEARN_DELTA_MAX_KEYS}_keys")
            break
        if not isinstance(k_raw, str):
            warns.append("non_string_key_skipped")
            continue
        k = k_raw.strip()
        if not k:
            warns.append("empty_key_skipped")
            continue
        if not _KEY_RE.match(k):
            warns.append(f"bad_key_skipped:{k}")
            continue
        v = _coerce_learning_value(val, warns)
        if v is _DROP:
            continue
        out[k] = v
        keys_seen += 1
    return out, warns


class _SentinelDrop:
    pass


_DROP = _SentinelDrop()


def _coerce_learning_value(val: Any, warns: list[str]) -> Any | _SentinelDrop:
    if val is None or isinstance(val, bool):
        return val
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    if isinstance(val, float):
        if not math.isfinite(val):
            warns.append("non_finite_float_skipped")
            return _DROP
        return val
    if isinstance(val, str):
        t = val.strip()
        if len(t) > _STR_MAX_IN:
            warns.append(f"string_truncated:{_STR_MAX_IN}")
            t = t[:_STR_MAX_IN]
        return t
    warns.append(f"unsupported_value_type_skipped:{type(val).__name__}")
    return _DROP


def _cut_reason(reason: str) -> str:
    s = reason.strip()
    return s[:_REASON_MAX] if len(s) > _REASON_MAX else s


def _trim_audit_detail(mapping: Mapping[str, Any]) -> dict[str, Any]:
    payload = dict(mapping)
    try:
        js = json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):  # fmt: skip
        return {"truncated": True}
    if len(js) <= _JSON_DETAIL_CAP:
        return payload
    return {"truncated": True, "preview": js[: max(0, _JSON_DETAIL_CAP - 80)]}


def resolve_companion_evolution_idempotency_key(
    *,
    principal_id: str,
    tick_reason: str,
    learned_preferences_delta: Mapping[str, Any] | None,
    explicit_idempotency_key: str | None,
) -> tuple[str, str]:
    """Build the effective Celery idempotency material (explicit or derived).

    Returns ``(effective_key, source)`` where ``source`` is "explicit" or "derived".
    """

    ex = (explicit_idempotency_key or "").strip()
    if ex:
        return ex[:_IDEMPOTENCY_EXPLICIT_MAX_LEN], "explicit"

    pid = principal_id.strip()
    cut_reason = _cut_reason(tick_reason or "scheduled")
    delta_in = learned_preferences_delta if isinstance(learned_preferences_delta, Mapping) else None
    san, _warns = sanitize_learned_preferences_delta(delta_in)
    canonical = json.dumps(san, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    raw = f"{pid}\x1e{cut_reason}\x1e{canonical}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"derived:{digest}", "derived"


def idempotency_key_log_prefix(key: str) -> str:
    """Return a short non-reversible fingerprint for structured logs (no raw key leak)."""

    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:8]


async def companion_evolution_tick_execute(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    learned_preferences_delta: Mapping[str, Any] | None,
    tick_reason: str,
) -> dict[str, Any]:
    """Persist learned preference delta or audit a no-op heartbeat."""

    pid = principal_id.strip()
    if not pid:
        return {"skipped": True, "reason": "empty_principal_id"}
    cut_reason = _cut_reason(tick_reason or "scheduled")

    san, warns = sanitize_learned_preferences_delta(learned_preferences_delta)

    if not san:
        detail = _trim_audit_detail(
            {"tick_reason": cut_reason, "applied": False, "sanitizer_warnings": warns[:32]},
        )
        audited_any = await companion_audit_only(pool, principal_id=pid, action="evolution_tick", detail=detail)
        if not audited_any:
            logger.info("[EWA companion evolution] skipped — no companion row for principal_id present")
            return {
                "applied": False,
                "skipped": True,
                "reason": "no_companion_profile",
                "sanitizer_warnings": warns,
            }
        return {
            "applied": False,
            "skipped": False,
            "reason": "empty_delta_after_sanitize",
            "sanitizer_warnings": warns,
            "audited": True,
        }

    ks = sorted(san.keys())
    detail_extra = {
        "tick_reason": cut_reason,
        "sanitizer_warnings": warns[:32],
        "delta_key_count": len(san),
        "delta_key_preview": ks[:24],
    }
    patched = await companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=san,
        audit_action="evolution_tick",
        audit_detail_override=_trim_audit_detail(detail_extra),
    )
    if patched is None:
        ok = await companion_audit_only(
            pool,
            principal_id=pid,
            action="evolution_tick",
            detail=_trim_audit_detail(
                {"tick_reason": cut_reason, "applied": False, "error": "merge_failed_missing_row"}
            ),
        )
        logger.warning(
            "[EWA companion evolution] merge_failed audit_written=%s",
            ok,
        )
        return {"applied": False, "skipped": True, "reason": "merge_failed", "sanitizer_warnings": warns}

    return {
        "applied": True,
        "companion_revision": int(patched["companion_revision"]),
        "sanitizer_warnings": warns,
        "skipped": False,
    }

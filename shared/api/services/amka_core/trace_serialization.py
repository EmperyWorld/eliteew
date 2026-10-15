# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Serializes AMKA core trace events into a JSON-ready list shared by projections, API payloads,
# and Markdown export (stable stage/event/message/payload shape). Payload values pass through
# `redact_amka_trace_payload` so API/export stay aligned with AMKA-TRACE-EXPORT-GUIDELINES (no PII dumps).
# Invariants:
# - Uses AmkaCoreStage string values when enums are present; no driver or DB imports.
# - Redaction is best-effort key/heuristic based; prefer keeping traces to IDs and counts upstream.
# Related:
# - shared/api/services/amka_core/contracts.py
# - shared/api/services/amka_core/projection.py
# - documentation/product/amka-seed-album/AMKA-TRACE-EXPORT-GUIDELINES.md
# ---
from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from api.services.amka_core.contracts import AmkaCoreStage, AmkaTraceEvent

_MAX_TRACE_PAYLOAD_DEPTH = 5
_MAX_TRACE_PAYLOAD_STR_CHARS = 520
_MAX_TRACE_LIST_ITEMS = 64
_SENSITIVE_KEY_HINTS = frozenset(
    (
        "password",
        "secret",
        "token",
        "authorization",
        "cookie",
        "api_key",
        "credential",
        "refresh",
        "bearer",
        "private_key",
        # PII / direct identifiers (AMKA-TRACE-EXPORT-GUIDELINES §1)
        "email",
        "phone",
        "mobile",
        "ssn",
        "iban",
        "passport",
        # LLM / long user-facing text that must not appear verbatim in export (§1–2)
        "prompt",
        "completion",
        "system_prompt",
        "user_prompt",
    )
)


def _stage_value(stage: AmkaCoreStage | str) -> str:
    return stage.value if isinstance(stage, AmkaCoreStage) else str(stage)


def _key_maybe_sensitive(key: str) -> bool:
    k = key.lower()
    return any(hint in k for hint in _SENSITIVE_KEY_HINTS)


def redact_amka_trace_payload(value: Any, *, depth: int = 0) -> Any:
    """Best-effort redaction for trace `payload` fields (export/API); see AMKA-TRACE-EXPORT-GUIDELINES."""

    if depth > _MAX_TRACE_PAYLOAD_DEPTH:
        return "[amka-trace-redacted-depth]"
    if isinstance(value, Mapping):
        out: dict[str, Any] = {}
        for raw_k, raw_v in value.items():
            k = str(raw_k)
            if _key_maybe_sensitive(k):
                out[k] = "[redacted]"
                continue
            out[k] = redact_amka_trace_payload(raw_v, depth=depth + 1)
        return out
    if isinstance(value, list):
        return [redact_amka_trace_payload(item, depth=depth + 1) for item in value[:_MAX_TRACE_LIST_ITEMS]]
    if isinstance(value, tuple):
        return tuple(redact_amka_trace_payload(item, depth=depth + 1) for item in value[:_MAX_TRACE_LIST_ITEMS])
    if isinstance(value, str) and len(value) > _MAX_TRACE_PAYLOAD_STR_CHARS:
        return f"{value[:_MAX_TRACE_PAYLOAD_STR_CHARS]}…"
    return value


def serialize_amka_trace_events(traces: Sequence[AmkaTraceEvent]) -> list[dict[str, Any]]:
    """Return API/export-friendly trace rows (same shape as projection `trace_events`)."""

    return [
        {
            "stage": _stage_value(trace.stage),
            "event": trace.event,
            "message": trace.message,
            "payload": redact_amka_trace_payload(dict(trace.payload)),
        }
        for trace in traces
    ]

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Tests AMKA trace serialization redaction (export/API safety per AMKA-TRACE-EXPORT-GUIDELINES).
# Invariants:
# - No DB; exercises `redact_amka_trace_payload` and `serialize_amka_trace_events` only.
# Related:
# - shared/api/services/amka_core/trace_serialization.py
# ---
from __future__ import annotations

from api.services.amka_core.contracts import AmkaCoreStage, AmkaTraceEvent
from api.services.amka_core.trace_serialization import (
    redact_amka_trace_payload,
    serialize_amka_trace_events,
)


def test_redact_amka_trace_payload_strips_sensitive_keys() -> None:
    out = redact_amka_trace_payload(
        {
            "run_id": "abc",
            "access_token": "secret-value",
            "nested": {"user_password": "x"},
        }
    )
    assert out["run_id"] == "abc"
    assert out["access_token"] == "[redacted]"
    assert out["nested"]["user_password"] == "[redacted]"


def test_redact_amka_trace_payload_truncates_long_strings() -> None:
    long = "x" * 800
    out = redact_amka_trace_payload({"note": long})
    assert isinstance(out["note"], str)
    assert out["note"].endswith("…")
    assert len(out["note"]) < len(long)


def test_serialize_amka_trace_events_applies_redaction() -> None:
    traces = [
        AmkaTraceEvent(
            stage=AmkaCoreStage.PLAN,
            event="test",
            message="m",
            payload={"refresh_token": "nope", "ok": 1},
        )
    ]
    rows = serialize_amka_trace_events(traces)
    assert rows[0]["payload"]["refresh_token"] == "[redacted]"
    assert rows[0]["payload"]["ok"] == 1


def test_redact_amka_trace_payload_redacts_pii_hint_keys() -> None:
    out = redact_amka_trace_payload(
        {
            "operator_email": "user@example.com",
            "contact_phone": "+1-555-0100",
            "nested": {"iban": "DE89370400440532013000"},
        }
    )
    assert out["operator_email"] == "[redacted]"
    assert out["contact_phone"] == "[redacted]"
    assert out["nested"]["iban"] == "[redacted]"


def test_redact_amka_trace_payload_redacts_llm_hint_keys() -> None:
    out = redact_amka_trace_payload(
        {
            "system_prompt": "You are a helpful assistant…" * 50,
            "completion": "full model output",
            "meta": {"ok": 1},
        }
    )
    assert out["system_prompt"] == "[redacted]"
    assert out["completion"] == "[redacted]"
    assert out["meta"]["ok"] == 1


def test_redact_amka_trace_payload_redacts_tuples() -> None:
    out = redact_amka_trace_payload(("a" * 600, {"token": "x"}))
    assert isinstance(out, tuple)
    assert str(out[0]).endswith("…")
    assert out[1]["token"] == "[redacted]"

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Defines EwaRequestV1, EwaResponseV1, EwaEventV1 and JSON-typed mapping helpers.
# Invariants:
# - api_version "1" is the only supported major envelope revision in this module.
# - Payloads are plain JSON object maps (dict[str, Any]); discriminated variants come later.
# Related:
# - api/ewa_platform/schemas/json/ewa_io_v1.json
# ---
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

EWA_IO_API_VERSION = "1"


class EwaRequestMessageType(StrEnum):
    """Registry of inbound message kinds; extend with new StrEnum members or document strings."""

    START_RUN = "start_run"
    SIGNAL = "signal"
    QUERY_STATE = "query_state"


class EwaResponseMessageType(StrEnum):
    """Outbound synchronous message kinds for EwaResponseV1."""

    RESULT = "result"
    ERROR = "error"


@dataclass(slots=True)
class EwaRequestV1:
    api_version: str
    message_type: EwaRequestMessageType | str
    correlation_id: str
    auth_context_ref: str | None
    payload: dict[str, Any]
    schema_ref: str | None = None


@dataclass(slots=True)
class EwaResponseV1:
    api_version: str
    message_type: EwaResponseMessageType | str
    correlation_id: str
    run_id: str | None
    payload: dict[str, Any]
    schema_ref: str | None = None


@dataclass(slots=True)
class EwaEventV1:
    api_version: str
    run_id: str
    seq: int
    stage: str
    event_type: str
    payload: dict[str, Any]
    trace_ref: str | None = None
    correlation_id: str | None = None


def _ensure_api_version(value: object) -> str:
    if not isinstance(value, str) or not value:
        msg = "api_version must be a non-empty string"
        raise ValueError(msg)
    return value


def _coerce_request_message_type(raw: object) -> EwaRequestMessageType | str:
    if isinstance(raw, EwaRequestMessageType):
        return raw
    if isinstance(raw, str):
        try:
            return EwaRequestMessageType(raw)
        except ValueError:
            return raw
    msg = "message_type must be a string or EwaRequestMessageType"
    raise TypeError(msg)


def _coerce_response_message_type(raw: object) -> EwaResponseMessageType | str:
    if isinstance(raw, EwaResponseMessageType):
        return raw
    if isinstance(raw, str):
        try:
            return EwaResponseMessageType(raw)
        except ValueError:
            return raw
    msg = "message_type must be a string or EwaResponseMessageType"
    raise TypeError(msg)


def _ensure_payload(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        msg = "payload must be a JSON object"
        raise TypeError(msg)
    return dict(value)  # shallow copy


def ewa_request_v1_to_mapping(req: EwaRequestV1) -> dict[str, Any]:
    mt = req.message_type.value if isinstance(req.message_type, EwaRequestMessageType) else req.message_type
    return {
        "api_version": req.api_version,
        "message_type": mt,
        "correlation_id": req.correlation_id,
        "auth_context_ref": req.auth_context_ref,
        "payload": req.payload,
        "schema_ref": req.schema_ref,
    }


def ewa_request_v1_from_mapping(data: Mapping[str, Any]) -> EwaRequestV1:
    if not isinstance(data, Mapping):
        msg = "request envelope must be a mapping"
        raise TypeError(msg)
    payload = _ensure_payload(data.get("payload", {}))
    return EwaRequestV1(
        api_version=_ensure_api_version(data.get("api_version")),
        message_type=_coerce_request_message_type(data.get("message_type")),
        correlation_id=str(data["correlation_id"]),
        auth_context_ref=None if data.get("auth_context_ref") is None else str(data["auth_context_ref"]),
        payload=payload,
        schema_ref=None if data.get("schema_ref") is None else str(data["schema_ref"]),
    )


def ewa_response_v1_to_mapping(res: EwaResponseV1) -> dict[str, Any]:
    mt = res.message_type.value if isinstance(res.message_type, EwaResponseMessageType) else res.message_type
    return {
        "api_version": res.api_version,
        "message_type": mt,
        "correlation_id": res.correlation_id,
        "run_id": res.run_id,
        "payload": res.payload,
        "schema_ref": res.schema_ref,
    }


def ewa_response_v1_from_mapping(data: Mapping[str, Any]) -> EwaResponseV1:
    if not isinstance(data, Mapping):
        msg = "response envelope must be a mapping"
        raise TypeError(msg)
    payload = _ensure_payload(data.get("payload", {}))
    run_raw = data.get("run_id")
    return EwaResponseV1(
        api_version=_ensure_api_version(data.get("api_version")),
        message_type=_coerce_response_message_type(data.get("message_type")),
        correlation_id=str(data["correlation_id"]),
        run_id=None if run_raw is None else str(run_raw),
        payload=payload,
        schema_ref=None if data.get("schema_ref") is None else str(data["schema_ref"]),
    )


def ewa_event_v1_to_mapping(ev: EwaEventV1) -> dict[str, Any]:
    return {
        "api_version": ev.api_version,
        "run_id": ev.run_id,
        "seq": ev.seq,
        "stage": ev.stage,
        "event_type": ev.event_type,
        "payload": ev.payload,
        "trace_ref": ev.trace_ref,
        "correlation_id": ev.correlation_id,
    }


def ewa_event_v1_from_mapping(data: Mapping[str, Any]) -> EwaEventV1:
    if not isinstance(data, Mapping):
        msg = "event envelope must be a mapping"
        raise TypeError(msg)
    seq_raw = data.get("seq")
    if not isinstance(seq_raw, int) or isinstance(seq_raw, bool):
        msg = "seq must be an int"
        raise TypeError(msg)
    payload = _ensure_payload(data.get("payload", {}))
    tr = data.get("trace_ref")
    cid = data.get("correlation_id")
    return EwaEventV1(
        api_version=_ensure_api_version(data.get("api_version")),
        run_id=str(data["run_id"]),
        seq=seq_raw,
        stage=str(data["stage"]),
        event_type=str(data["event_type"]),
        payload=payload,
        trace_ref=None if tr is None else str(tr),
        correlation_id=None if cid is None else str(cid),
    )

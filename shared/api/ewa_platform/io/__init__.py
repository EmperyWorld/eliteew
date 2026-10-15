# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Public surface for standardized **EWA** message envelopes (request / response / event v1).
# Invariants:
# - Serialization mirrors JSON Schema in api/ewa_platform/schemas/json/ewa_io_v1.json.
# Related:
# - api/ewa_platform/schemas/json/ewa_io_v1.json
# - api/ewa_platform/io/desktop_payload.py
# ---
from __future__ import annotations

from api.ewa_platform.io.desktop_payload import (
    desktop_intent_to_wire,
    desktop_observation_to_wire,
    ensure_desktop_intent_wire_or_raise,
    ensure_desktop_observation_wire_or_raise,
    orchestration_stub_payload,
)
from api.ewa_platform.io.envelope import (
    EWA_IO_API_VERSION,
    EwaEventV1,
    EwaRequestMessageType,
    EwaRequestV1,
    EwaResponseMessageType,
    EwaResponseV1,
    ewa_event_v1_from_mapping,
    ewa_event_v1_to_mapping,
    ewa_request_v1_from_mapping,
    ewa_request_v1_to_mapping,
    ewa_response_v1_from_mapping,
    ewa_response_v1_to_mapping,
)

__all__ = [
    "EWA_IO_API_VERSION",
    "EwaEventV1",
    "EwaRequestMessageType",
    "EwaRequestV1",
    "EwaResponseMessageType",
    "EwaResponseV1",
    "ewa_event_v1_from_mapping",
    "ewa_event_v1_to_mapping",
    "ewa_request_v1_from_mapping",
    "ewa_request_v1_to_mapping",
    "ewa_response_v1_from_mapping",
    "ewa_response_v1_to_mapping",
    "desktop_intent_to_wire",
    "desktop_observation_to_wire",
    "ensure_desktop_intent_wire_or_raise",
    "ensure_desktop_observation_wire_or_raise",
    "orchestration_stub_payload",
]

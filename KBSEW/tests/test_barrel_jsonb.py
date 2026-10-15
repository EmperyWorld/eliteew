# ---
# KBSEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# JSONB bind/coerce contract for asyncpg inserts/updates and row reads.
# ---

from __future__ import annotations

import json

import pytest

from api.core.json_codec import coerce_json_object, coerce_record_json_objects
from api.services.barrel_service import _jsonb_value


def test_jsonb_value_empty_dict() -> None:
    assert _jsonb_value(None) == {}
    assert _jsonb_value({}) == {}


def test_jsonb_value_passes_nested_metadata() -> None:
    payload = {"filename": "doc.pdf", "driver_type": "pdf", "pages": 3}
    assert _jsonb_value(payload) == payload


def test_coerce_json_object_from_str() -> None:
    raw = '{"object_key": "kbsew/a/doc.pdf", "filename": "doc.pdf"}'
    assert coerce_json_object(raw) == {
        "object_key": "kbsew/a/doc.pdf",
        "filename": "doc.pdf",
    }


def test_coerce_json_object_none_and_mapping() -> None:
    assert coerce_json_object(None) == {}
    assert coerce_json_object({"a": 1}) == {"a": 1}


def test_coerce_json_object_rejects_array() -> None:
    with pytest.raises(ValueError, match="JSON object expected"):
        coerce_json_object("[1, 2]")


def test_coerce_record_json_objects_payload_and_metadata() -> None:
    row = {
        "id": "job-1",
        "payload": json.dumps({"source_url": "https://example.test/a.pdf"}),
        "metadata": None,
        "status": "queued",
    }
    out = coerce_record_json_objects(row)
    assert out["payload"] == {"source_url": "https://example.test/a.pdf"}
    assert out["metadata"] == {}
    assert out["status"] == "queued"

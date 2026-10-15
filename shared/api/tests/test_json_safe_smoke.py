"""Unit smoke: ``json_safe_api_detail`` (``api.utils.json_safe``) — no heavy imports."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import pytest

from api.utils.json_safe import json_safe_api_detail


@pytest.mark.unit
def test_json_safe_uuid_decimal_mapping() -> None:
    uid = UUID("550e8400-e29b-41d4-a716-446655440000")
    out = json_safe_api_detail({"row": {"id": uid, "amt": Decimal("3.14")}})
    assert out == {"row": {"id": str(uid), "amt": "3.14"}}


@pytest.mark.unit
def test_json_safe_datetime_iso() -> None:
    dt = datetime(2026, 4, 3, 12, 0, tzinfo=UTC)
    assert json_safe_api_detail(dt) == dt.isoformat()


@pytest.mark.unit
def test_json_safe_fallback_non_serializable() -> None:
    class X:
        def __str__(self) -> str:
            return "x"

    assert json_safe_api_detail(X()) == "x"

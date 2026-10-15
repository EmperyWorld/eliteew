#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Unit tests for mobile support bundle sanitization and category normalization.
# Related:
# - api/services/mobile_support_report_service.py
# ---

from __future__ import annotations

import pytest
from fastapi import HTTPException  # type: ignore[import-untyped]

from api.services.mobile_support_report_service import (
    normalize_support_category,
    sanitize_support_bundle_text,
)


def test_sanitize_support_bundle_strips_bearer_tokens() -> None:
    raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def\nok line"
    out = sanitize_support_bundle_text(raw)
    assert "eyJhbGci" not in out
    assert "<redacted>" in out
    assert "ok line" in out


def test_sanitize_support_bundle_redacts_jwt_only_lines() -> None:
    jwt = "aaa.bbb.ccc"
    out = sanitize_support_bundle_text(jwt)
    assert out == "<redacted_jwt>"


def test_sanitize_support_bundle_rejects_empty() -> None:
    with pytest.raises(HTTPException) as exc:
        sanitize_support_bundle_text("   ")
    assert exc.value.status_code == 422


def test_normalize_support_category_unknown_falls_back_to_general() -> None:
    assert normalize_support_category("weird") == "general"
    assert normalize_support_category("ota") == "ota"

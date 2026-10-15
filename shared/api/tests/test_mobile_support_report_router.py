#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for authenticated mobile support report submission endpoint.
# Related:
# - api/routers/mobile_app.py
# ---

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient  # type: ignore[import-untyped]

from api.routers import mobile_app as mobile_app_router
from api.tests.test_mobile_app import _FAKE_USER_ID, _mobile_app_test_app


def test_mobile_support_report_submission_returns_report_id(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    apk = tmp_path / "empery-mobile.apk"
    app = _mobile_app_test_app(monkeypatch, apk_path=apk)

    async def _fake_create(**kwargs: object) -> dict[str, str]:
        assert kwargs["user_id"] == _FAKE_USER_ID
        assert kwargs["category"] == "general"
        return {"report_id": "22222222-2222-2222-2222-222222222222", "category": "general"}

    monkeypatch.setattr(mobile_app_router, "create_mobile_support_report", AsyncMock(side_effect=_fake_create))

    response = TestClient(app).post(
        "/api/v1/mobile-app/support-reports",
        json={
            "bundle_text": "app=0.2.40\nsocket=connected",
            "category": "general",
            "app_version_name": "0.2.40",
            "app_version_code": 50,
            "device_model": "TestDevice",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["report_id"] == "22222222-2222-2222-2222-222222222222"
    assert payload["category"] == "general"
    assert payload["message"]

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Ensure GET ``/api/v1/ugs/billing/stats`` returns 404 when billing service signals missing DB user
#   (no Pydantic construction from ``{"error": "User not found"}``).
# Invariants:
#   - No PostgreSQL; ``TestClient`` + dependency overrides only.
# Related:
#   - api/routers/ugs/ (package), api/services/ugs/billing_service.py
# ---
from __future__ import annotations

import pytest
from fastapi import FastAPI  # type: ignore[import-untyped]
from fastapi.testclient import TestClient

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs import get_billing_service
from api.routers.ugs import router as ugs_router


class _FakeBillingServiceMissingUser:
    async def get_usage_stats(self, user_id: str) -> dict[str, str]:
        assert user_id
        return {"error": "User not found"}


@pytest.fixture
def billing_stats_client() -> TestClient:
    app = FastAPI()
    app.include_router(ugs_router)

    async def fake_user() -> User:
        return User(id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", email="x@y.z", username="t")

    app.dependency_overrides[require_oauth2_user] = fake_user
    app.dependency_overrides[get_billing_service] = lambda: _FakeBillingServiceMissingUser()
    return TestClient(app)


def test_billing_stats_user_not_found_is_404(billing_stats_client: TestClient) -> None:
    r = billing_stats_client.get("/api/v1/ugs/billing/stats")
    assert r.status_code == 404
    assert r.json().get("detail") == "User not found"

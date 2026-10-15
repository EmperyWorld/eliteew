"""
Contract tests: IMC HTTP API (types, rag-hints, run, rerun) with dependency overrides.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id
from api.routers.marketing_cabinet.imc import (
    get_imc_service_readonly,
    get_imc_service_with_ugs,
)
from api.routers.marketing_cabinet.imc import router as imc_router
from api.schemas.imc import (
    ImcRagHintsResponse,
    ImcRunResearchResponse,
)


def _make_imc_app(user_id: UUID, imc_svc: MagicMock | None = None) -> tuple[FastAPI, MagicMock]:
    app = FastAPI()
    app.include_router(imc_router, prefix="/api/v1/marketing-cabinet")
    fake_pool = MagicMock()
    svc = imc_svc or MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    async def override_imc() -> MagicMock:
        return svc

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user
    app.dependency_overrides[get_imc_service_readonly] = override_imc
    app.dependency_overrides[get_imc_service_with_ugs] = override_imc
    return app, svc


@pytest.mark.integration
def test_list_imc_types_returns_200() -> None:
    user_id = uuid4()
    app, mock_svc = _make_imc_app(user_id)
    mock_svc.list_types_for_cabinet = AsyncMock(return_value=[])

    client = TestClient(app)
    r = client.get("/api/v1/marketing-cabinet/imc/types")
    assert r.status_code == 200
    body = r.json()
    assert "types" in body
    mock_svc.list_types_for_cabinet.assert_awaited_once()


@pytest.mark.integration
def test_rag_hints_returns_200() -> None:
    user_id = uuid4()
    project_id = uuid4()
    app, mock_svc = _make_imc_app(user_id)
    mock_svc.get_rag_hints = AsyncMock(
        return_value=ImcRagHintsResponse(
            project_id=str(project_id),
            qdrant_points_count=0,
            vault_documents_with_text=2,
            weak_coverage=True,
        )
    )

    with patch(
        "api.routers.marketing_cabinet.imc.get_accessible_project",
        new=AsyncMock(return_value={"company_id": str(uuid4())}),
    ):
        client = TestClient(app)
        r = client.get(f"/api/v1/marketing-cabinet/imc/project/{project_id}/rag-hints")
        assert r.status_code == 200
        assert r.json()["weak_coverage"] is True
        mock_svc.get_rag_hints.assert_awaited_once()


@pytest.mark.integration
def test_run_imc_research_returns_429_when_rate_limited() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app, _svc = _make_imc_app(user_id)

    with patch(
        "api.routers.marketing_cabinet.imc.get_accessible_project",
        new=AsyncMock(return_value={"company_id": str(company_id)}),
    ):
        with patch(
            "api.routers.marketing_cabinet.imc.get_accessible_company",
            new=AsyncMock(return_value=None),
        ):
            with patch(
                "api.routers.marketing_cabinet.imc.check_marketing_cabinet_ai_rate_limit",
                new=AsyncMock(return_value=(False, 42.0)),
            ):
                client = TestClient(app)
                r = client.post(
                    "/api/v1/marketing-cabinet/imc/research/run",
                    json={
                        "type_key": "imc_rag_swot",
                        "company_id": str(company_id),
                        "project_id": str(project_id),
                        "input_file_ids": [],
                        "language": "russian",
                    },
                )
                assert r.status_code == status.HTTP_429_TOO_MANY_REQUESTS
                assert r.headers.get("Retry-After") == "42"


@pytest.mark.integration
def test_rerun_imc_research_returns_202() -> None:
    user_id = uuid4()
    research_id = uuid4()
    app, mock_svc = _make_imc_app(user_id)
    mock_svc.rerun_research = AsyncMock(
        return_value=ImcRunResearchResponse(
            id=str(uuid4()),
            status="pending",
            ugs_request_id=str(uuid4()),
            message="ok",
        )
    )

    with patch(
        "api.routers.marketing_cabinet.imc.check_marketing_cabinet_ai_rate_limit",
        new=AsyncMock(return_value=(True, 0.0)),
    ):
        client = TestClient(app)
        r = client.post(
            f"/api/v1/marketing-cabinet/imc/research/{research_id}/rerun",
        )
        assert r.status_code == status.HTTP_202_ACCEPTED
        mock_svc.rerun_research.assert_awaited_once()

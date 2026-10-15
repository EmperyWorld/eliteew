from __future__ import annotations

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _stub_minio_module() -> None:
    if "minio" in sys.modules:
        return
    module = types.ModuleType("minio")
    module.__path__ = []  # type: ignore[attr-defined]
    error_module = types.ModuleType("minio.error")
    sseconfig_module = types.ModuleType("minio.sseconfig")

    class _DummyMinio:  # noqa: D401
        """Test stub for optional Minio dependency."""

        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummyS3Error(Exception):
        pass

    class _DummyRule:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    class _DummySSEConfig:
        def __init__(self, *args: object, **kwargs: object) -> None:
            pass

    setattr(module, "Minio", _DummyMinio)
    setattr(error_module, "S3Error", _DummyS3Error)
    setattr(sseconfig_module, "Rule", _DummyRule)
    setattr(sseconfig_module, "SSEConfig", _DummySSEConfig)
    sys.modules["minio"] = module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.sseconfig"] = sseconfig_module


_stub_minio_module()

from api.routers.marketing_cabinet.amka import router as amka_router
from api.routers.marketing_cabinet.common import get_marketing_db_pool, get_marketing_user_id


def _make_app(user_id: UUID) -> FastAPI:
    app = FastAPI()
    app.include_router(amka_router, prefix="/api/v1/marketing-cabinet")

    fake_pool = MagicMock()

    async def override_pool() -> MagicMock:
        return fake_pool

    async def override_user() -> UUID:
        return user_id

    app.dependency_overrides[get_marketing_db_pool] = override_pool
    app.dependency_overrides[get_marketing_user_id] = override_user
    return app


def _run_payload(*, project_id: UUID, company_id: UUID, status: str = "planning") -> dict[str, object]:
    return {
        "id": str(uuid4()),
        "project_id": str(project_id),
        "company_id": str(company_id),
        "created_by_user_id": str(uuid4()),
        "scope_key": "all_visible",
        "status": status,
        "current_stage": "audit",
        "progress": 12,
        "progress_message": "AMKA: planning",
        "master_plan_summary": None,
        "master_plan": [],
        "final_summary_markdown": None,
        "final_assessment": {},
        "metrics_before": {},
        "metrics_after": {},
        "error_payload": {},
        "approved_at": None,
        "started_at": None,
        "completed_at": None,
        "created_at": "2026-04-14T10:00:00+00:00",
        "updated_at": "2026-04-14T10:00:00+00:00",
    }


@pytest.mark.integration
def test_create_amka_run_returns_async_start_payload() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.create_run = AsyncMock(
        return_value={
            "run": _run_payload(project_id=project_id, company_id=company_id),
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            "/api/v1/marketing-cabinet/amka/runs",
            json={
                "project_id": str(project_id),
                "company_id": str(company_id),
                "scope_key": "all_visible",
                "user_instruction": "focus evidence first",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["run"]["project_id"] == str(project_id)
    assert body["run"]["company_id"] == str(company_id)
    assert body["poll_after_ms"] == 2000
    mock_service.create_run.assert_awaited_once_with(
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        scope_key="all_visible",
        user_instruction="focus evidence first",
        section_keys=None,
        imc_type_key=None,
        imc_focus=None,
        imc_max_wait_seconds=None,
        run_mode="semi_auto",
        auto_cycle_total=1,
        per_step_execution=False,
        preset_id=None,
    )


@pytest.mark.integration
def test_create_amka_run_accepts_imc_and_section_options() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.create_run = AsyncMock(
        return_value={
            "run": _run_payload(project_id=project_id, company_id=company_id),
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            "/api/v1/marketing-cabinet/amka/runs",
            json={
                "project_id": str(project_id),
                "company_id": str(company_id),
                "scope_key": "all_visible",
                "section_keys": ["imc", "evidence"],
                "imc_type_key": "imc_rag_jtbd",
                "imc_focus": "global",
                "imc_max_wait_seconds": 120,
            },
        )

    assert response.status_code == 200
    mock_service.create_run.assert_awaited_once_with(
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        scope_key="all_visible",
        user_instruction=None,
        section_keys=["imc", "evidence"],
        imc_type_key="imc_rag_jtbd",
        imc_focus="global",
        imc_max_wait_seconds=120,
        run_mode="semi_auto",
        auto_cycle_total=1,
        per_step_execution=False,
        preset_id=None,
    )


@pytest.mark.integration
def test_create_amka_run_auto_forwards_cycle_total() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.create_run = AsyncMock(
        return_value={
            "run": _run_payload(project_id=project_id, company_id=company_id),
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            "/api/v1/marketing-cabinet/amka/runs",
            json={
                "project_id": str(project_id),
                "company_id": str(company_id),
                "run_mode": "auto",
                "auto_cycle_count": 3,
            },
        )

    assert response.status_code == 200
    mock_service.create_run.assert_awaited_once_with(
        project_id=project_id,
        company_id=company_id,
        user_id=user_id,
        scope_key="all_visible",
        user_instruction=None,
        section_keys=None,
        imc_type_key=None,
        imc_focus=None,
        imc_max_wait_seconds=None,
        run_mode="auto",
        auto_cycle_total=3,
        per_step_execution=False,
        preset_id=None,
    )


@pytest.mark.integration
def test_create_amka_run_rejects_per_step_when_auto() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.create_run = AsyncMock(return_value={"run": {}, "poll_after_ms": 2000})

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            "/api/v1/marketing-cabinet/amka/runs",
            json={
                "project_id": str(project_id),
                "company_id": str(company_id),
                "run_mode": "auto",
                "per_step_execution": True,
            },
        )

    assert response.status_code == 422
    mock_service.create_run.assert_not_called()


@pytest.mark.integration
def test_create_amka_run_rejects_auto_cycle_when_semi() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.create_run = AsyncMock(return_value={"run": {}, "poll_after_ms": 2000})

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            "/api/v1/marketing-cabinet/amka/runs",
            json={
                "project_id": str(project_id),
                "company_id": str(company_id),
                "run_mode": "semi_auto",
                "auto_cycle_count": 2,
            },
        )

    assert response.status_code == 422
    mock_service.create_run.assert_not_called()


@pytest.mark.integration
def test_list_amka_runs_returns_items_for_project() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.list_runs = AsyncMock(
        return_value={
            "items": [_run_payload(project_id=project_id, company_id=company_id)],
            "total": 1,
            "poll_after_ms": 4000,
            "recent_runs_digest": [],
            "recent_runs_digest_markdown": "",
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.get(f"/api/v1/marketing-cabinet/amka/project/{project_id}/runs")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["poll_after_ms"] == 4000
    assert body["items"][0]["project_id"] == str(project_id)
    mock_service.list_runs.assert_awaited_once_with(project_id=project_id, user_id=user_id, limit=20)


@pytest.mark.integration
def test_list_amka_runs_poll_after_defaults_when_omitted_by_service() -> None:
    """Response model fills poll_after_ms=0 when service dict omits it (backward compat)."""
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.list_runs = AsyncMock(
        return_value={
            "items": [_run_payload(project_id=project_id, company_id=company_id, status="completed")],
            "total": 1,
            "recent_runs_digest": [],
            "recent_runs_digest_markdown": "",
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.get(f"/api/v1/marketing-cabinet/amka/project/{project_id}/runs")

    assert response.status_code == 200
    assert response.json()["poll_after_ms"] == 0


@pytest.mark.integration
def test_get_amka_run_detail_returns_steps() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.get_run_detail = AsyncMock(
        return_value={
            "run": _run_payload(project_id=project_id, company_id=company_id),
            "steps": [
                {
                    "id": str(uuid4()),
                    "run_id": str(run_id),
                    "ordinal": 1,
                    "stage_kind": "section_audit",
                    "section_key": "overview",
                    "title": "Audit",
                    "status": "completed",
                    "plan_payload": {},
                    "report_markdown": "done",
                    "report_payload": {},
                    "applied_entities": [],
                    "operation_trail": [],
                    "metrics_before": {},
                    "metrics_after": {},
                    "error_payload": {},
                    "created_at": None,
                    "updated_at": None,
                    "started_at": None,
                    "completed_at": None,
                }
            ],
            "poll_after_ms": 4000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.get(f"/api/v1/marketing-cabinet/amka/runs/{run_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["steps"][0]["stage_kind"] == "section_audit"
    assert body["poll_after_ms"] == 4000
    mock_service.get_run_detail.assert_awaited_once_with(run_id=run_id, user_id=user_id)


@pytest.mark.integration
def test_approve_amka_run_forwards_to_service() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.approve_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(f"/api/v1/marketing-cabinet/amka/runs/{run_id}/approve", json={})

    assert response.status_code == 200
    assert response.json()["run"]["status"] == "queued"
    mock_service.approve_run.assert_awaited_once_with(
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=[],
        skip_operation_keys=[],
        skip_step_ids=[],
    )


@pytest.mark.integration
def test_approve_amka_run_accepts_skip_section_keys() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.approve_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            f"/api/v1/marketing-cabinet/amka/runs/{run_id}/approve",
            json={"skip_section_keys": ["alerts", "tasks"]},
        )

    assert response.status_code == 200
    mock_service.approve_run.assert_awaited_once_with(
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=["alerts", "tasks"],
        skip_operation_keys=[],
        skip_step_ids=[],
    )


@pytest.mark.integration
def test_approve_amka_run_accepts_skip_operation_keys() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.approve_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            f"/api/v1/marketing-cabinet/amka/runs/{run_id}/approve",
            json={"skip_operation_keys": ["op-1", "op-2"]},
        )

    assert response.status_code == 200
    mock_service.approve_run.assert_awaited_once_with(
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=[],
        skip_operation_keys=["op-1", "op-2"],
        skip_step_ids=[],
    )


@pytest.mark.integration
def test_approve_amka_run_accepts_skip_step_ids() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    step_a = str(uuid4())
    step_b = str(uuid4())
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.approve_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            f"/api/v1/marketing-cabinet/amka/runs/{run_id}/approve",
            json={"skip_step_ids": [step_a, step_b]},
        )

    assert response.status_code == 200
    mock_service.approve_run.assert_awaited_once_with(
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=[],
        skip_operation_keys=[],
        skip_step_ids=[step_a, step_b],
    )


@pytest.mark.integration
def test_resume_amka_run_forwards_skip_options() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.resume_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(
            f"/api/v1/marketing-cabinet/amka/runs/{run_id}/resume",
            json={"skip_section_keys": ["tasks"], "skip_operation_keys": ["abc"]},
        )

    assert response.status_code == 200
    mock_service.resume_run.assert_awaited_once_with(
        run_id=run_id,
        user_id=user_id,
        skip_section_keys=["tasks"],
        skip_operation_keys=["abc"],
        skip_step_ids=[],
    )


@pytest.mark.integration
def test_continue_amka_step_forwards_to_service() -> None:
    user_id = uuid4()
    project_id = uuid4()
    company_id = uuid4()
    run_id = uuid4()
    app = _make_app(user_id)
    mock_service = MagicMock()
    mock_service.continue_step_run = AsyncMock(
        return_value={
            "ok": True,
            "run": {
                **_run_payload(project_id=project_id, company_id=company_id),
                "status": "queued",
            },
            "poll_after_ms": 2000,
        }
    )

    with patch("api.routers.marketing_cabinet.amka.AmkaService", return_value=mock_service):
        client = TestClient(app)
        response = client.post(f"/api/v1/marketing-cabinet/amka/runs/{run_id}/continue-step")

    assert response.status_code == 200
    mock_service.continue_step_run.assert_awaited_once_with(run_id=run_id, user_id=user_id)

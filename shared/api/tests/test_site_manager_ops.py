# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Focused tests for Site Manager operator service contracts: reconcile classification, repair routes, template registry and smoke gates.
# Invariants:
# - Tests avoid live Podman, DNS and HTTP; they exercise deterministic service boundaries.
# - Repair route tests verify explicit operator mutation handoff without touching real databases.
# - Public smoke hard-fails when runtime metadata is absent.
# Related:
# - api/services/site_manager_ops.py
# - api/routers/site_manager_ops.py
# ---
from __future__ import annotations

import sys
import types
from collections.abc import Callable
from datetime import timedelta
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import BackgroundTasks, FastAPI, HTTPException, status
from fastapi.testclient import TestClient


def _stub_minio_module() -> None:
    if "minio" in sys.modules:
        return
    module = types.ModuleType("minio")
    module.__path__ = []  # type: ignore[attr-defined]
    error_module = types.ModuleType("minio.error")
    sseconfig_module = types.ModuleType("minio.sseconfig")

    class _DummyMinio:
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

from api.routers import site_manager_ops as site_manager_ops_router
from api.services import site_manager_ops as site_manager_ops_service
from api.services.site_manager_ops import (
    classify_runtime_instance_issue,
    get_template_registry,
    run_publish_quality_smoke,
)
from api.utils.datetime_helpers import utc_now_naive


class _FakeMappings:
    def __init__(self, row):
        self._row = row

    def first(self):
        return self._row


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def mappings(self):
        return _FakeMappings(self._row)


class _FakeSession:
    def __init__(self, row):
        self._row = row

    async def execute(self, *_args, **_kwargs):
        return _FakeResult(self._row)


class _MutationFakeSession:
    def __init__(self) -> None:
        self.executed_params: list[dict[str, object]] = []
        self.commit_count = 0

    async def execute(self, _statement, params=None):
        self.executed_params.append(dict(params or {}))
        return _FakeResult(None)

    async def commit(self) -> None:
        self.commit_count += 1


def test_reconcile_classifies_open_draft_without_runtime_metadata() -> None:
    issues = classify_runtime_instance_issue(
        {
            "status": "draft",
            "publication_state": "open",
            "compose_project_name": None,
            "updated_at": utc_now_naive(),
            "last_error": None,
        }
    )

    assert [issue["code"] for issue in issues] == ["open_without_runtime_metadata"]
    assert issues[0]["severity"] == "critical"
    assert issues[0]["next_action"] == "provision_or_start"


def test_reconcile_classifies_stale_transition_status() -> None:
    issues = classify_runtime_instance_issue(
        {
            "status": "starting",
            "publication_state": "open",
            "compose_project_name": "site-studio-demo",
            "updated_at": utc_now_naive() - timedelta(hours=1),
            "last_error": None,
        }
    )

    assert any(issue["code"] == "stale_transition_status" for issue in issues)


def test_template_registry_exposes_profile_contracts() -> None:
    registry = get_template_registry()

    keys = {row["template_key"] for row in registry["templates"]}
    assert {"olenti", "allenti", "aurelia"}.issubset(keys)
    assert all("profile_id" in row for row in registry["templates"])


@pytest.mark.asyncio
async def test_operator_overview_exposes_truncated_collection_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, int] = {}

    async def _worker(_db):
        return {"worker_ready": True}

    async def _jobs(_db, *, limit, **_kwargs):
        calls["jobs"] = limit
        return [{"id": f"job-{index}"} for index in range(limit)]

    async def _domains(_db, *, limit, **_kwargs):
        calls["domains"] = limit
        return [{"id": f"domain-{index}"} for index in range(limit - 1)]

    async def _outbox(_db, *, limit, **_kwargs):
        calls["dns_outbox"] = limit
        return [{"id": f"outbox-{index}"} for index in range(limit)]

    async def _instances(_db, *, limit, **_kwargs):
        calls["instances"] = limit
        return [{"id": f"instance-{index}"} for index in range(limit)]

    async def _reconcile(_db, *, limit):
        calls["reconcile"] = limit
        return {
            "entries": [{"instance": {"id": f"instance-{index}"}, "issues": []} for index in range(limit)],
            "count": limit,
            "generated_at": utc_now_naive(),
        }

    async def _audit(_db, *, limit, **_kwargs):
        calls["audit_events"] = limit
        return [{"id": f"audit-{index}"} for index in range(limit - 1)]

    monkeypatch.setattr(site_manager_ops_service, "get_worker_readiness", _worker)
    monkeypatch.setattr(site_manager_ops_service, "list_lifecycle_jobs", _jobs)
    monkeypatch.setattr(site_manager_ops_service, "list_domain_bindings_overview", _domains)
    monkeypatch.setattr(site_manager_ops_service, "list_dns_outbox", _outbox)
    monkeypatch.setattr(site_manager_ops_service, "list_runtime_instances", _instances)
    monkeypatch.setattr(site_manager_ops_service, "build_runtime_reconcile_report", _reconcile)
    monkeypatch.setattr(site_manager_ops_service, "list_ops_audit_events", _audit)

    overview = await site_manager_ops_service.get_operator_overview(_MutationFakeSession())

    assert calls == {
        "jobs": 21,
        "domains": 21,
        "dns_outbox": 21,
        "instances": 41,
        "reconcile": 81,
        "audit_events": 21,
    }
    assert len(overview["jobs"]) == 20
    assert len(overview["domains"]) == 20
    assert len(overview["dns_outbox"]) == 20
    assert len(overview["instances"]) == 40
    assert overview["reconcile"]["count"] == 80
    assert len(overview["audit_events"]) == 20
    assert overview["overview_limits"]["jobs"] == {"limit": 20, "returned": 20, "truncated": True}
    assert overview["overview_limits"]["domains"] == {"limit": 20, "returned": 20, "truncated": False}
    assert overview["overview_limits"]["instances"] == {"limit": 40, "returned": 40, "truncated": True}
    assert overview["overview_limits"]["reconcile"] == {"limit": 80, "returned": 80, "truncated": True}


def _ops_client() -> TestClient:
    app = FastAPI()
    app.include_router(site_manager_ops_router.router, prefix="/api/v1")
    return TestClient(app)


def _ops_overrides(client: TestClient) -> dict[Callable[..., Any], Callable[..., Any]]:
    """TestClient.app is ASGI-typed; cast back to FastAPI for dependency_overrides."""
    return cast(FastAPI, client.app).dependency_overrides


def test_ops_router_requires_admin_role() -> None:
    async def _deny_admin():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator privileges required")

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _deny_admin

    response = client.get("/api/v1/desktop/site-manager/ops/templates")

    assert response.status_code == 403


def test_ops_router_instances_search_returns_page_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _allow_admin():
        return SimpleNamespace(id="550e8400-e29b-41d4-a716-446655440000", role="admin")

    class _Db:
        pass

    db = _Db()
    captured: dict[str, object] = {}

    async def _db_session():
        return db

    async def _list_instances(db_arg, *, q, scope, status_filter, limit, offset):
        captured.update(
            {
                "db": db_arg,
                "q": q,
                "scope": scope,
                "status_filter": status_filter,
                "limit": limit,
                "offset": offset,
            }
        )
        return [
            {
                "instance_scope": "user",
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "site_slug": "demo",
                "site_title": "Demo",
                "status": "running",
                "publication_state": "closed",
                "public_hostname": "demo-site.eliteew.ru",
                "public_url": None,
                "api_base_url": None,
                "compose_project_name": "site-demo",
                "runtime_dir": "/runtime/demo",
                "source_dir": None,
                "env_dir": None,
                "compose_file_path": "/runtime/demo/docker-compose.yml",
                "updated_at": utc_now_naive(),
                "last_error": None,
                "marketing_project_id": None,
                "client_access_json": {},
            },
            {
                "instance_scope": "user",
                "id": "550e8400-e29b-41d4-a716-446655440002",
                "site_slug": "demo-2",
                "site_title": "Demo 2",
                "status": "running",
                "publication_state": "closed",
                "public_hostname": "demo-2-site.eliteew.ru",
                "public_url": None,
                "api_base_url": None,
                "compose_project_name": "site-demo-2",
                "runtime_dir": "/runtime/demo-2",
                "source_dir": None,
                "env_dir": None,
                "compose_file_path": "/runtime/demo-2/docker-compose.yml",
                "updated_at": utc_now_naive(),
                "last_error": None,
                "marketing_project_id": None,
                "client_access_json": {},
            },
        ]

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _allow_admin
    _ops_overrides(client)[site_manager_ops_router.get_postgres_session] = _db_session
    monkeypatch.setattr(site_manager_ops_router.site_manager_ops, "list_runtime_instances", _list_instances)

    response = client.get(
        "/api/v1/desktop/site-manager/ops/instances?q=demo&scope=user&status=running&limit=1&offset=10"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["returned"] == 1
    assert payload["has_more"] is True
    assert len(payload["items"]) == 1
    assert captured == {
        "db": db,
        "q": "demo",
        "scope": "user",
        "status_filter": "running",
        "limit": 2,
        "offset": 10,
    }


def test_ops_router_reconcile_mark_failed_passes_operator_reason(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _allow_admin():
        return SimpleNamespace(id="550e8400-e29b-41d4-a716-446655440000", role="admin")

    class _Db:
        committed = False

        async def commit(self) -> None:
            self.committed = True

    db = _Db()
    captured: dict[str, object] = {}
    instance_id = "550e8400-e29b-41d4-a716-446655440001"

    async def _db_session():
        return db

    async def _mark_failed(db_arg, *, instance_scope, instance_id, reason, actor_user_id):
        captured.update(
            {
                "db": db_arg,
                "instance_scope": instance_scope,
                "instance_id": str(instance_id),
                "reason": reason,
                "actor_user_id": str(actor_user_id),
            }
        )
        return {
            "id": instance_id,
            "site_slug": "demo",
            "status": "failed",
            "publication_state": "open",
            "public_hostname": "demo-site.eliteew.ru",
            "last_error": reason,
            "updated_at": utc_now_naive(),
        }

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _allow_admin
    _ops_overrides(client)[site_manager_ops_router.get_postgres_session] = _db_session
    monkeypatch.setattr(site_manager_ops_router.site_manager_ops, "mark_instance_failed_for_repair", _mark_failed)

    response = client.post(
        f"/api/v1/desktop/site-manager/ops/reconcile/user/{instance_id}/mark-failed",
        json={"reason": "operator confirmed stale transition"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "failed"
    assert db.committed is True
    assert captured == {
        "db": db,
        "instance_scope": "user",
        "instance_id": instance_id,
        "reason": "operator confirmed stale transition",
        "actor_user_id": "550e8400-e29b-41d4-a716-446655440000",
    }


def test_ops_router_lifecycle_job_cancel_uses_admin_repair_service(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _allow_admin():
        return SimpleNamespace(id="550e8400-e29b-41d4-a716-446655440000", role="admin")

    job_id = "550e8400-e29b-41d4-a716-446655440010"
    captured: dict[str, object] = {}

    async def _cancel_job(db_arg, *, job_id, actor_user_id, reason="cancelled_by_site_manager_operator"):
        captured.update(
            {
                "db": db_arg,
                "job_id": str(job_id),
                "actor_user_id": str(actor_user_id),
                "reason": reason,
            }
        )
        return {
            "id": job_id,
            "instance_scope": "user",
            "instance_id": "550e8400-e29b-41d4-a716-446655440001",
            "site_slug": "demo",
            "task_type": "site_studio_start",
            "status": "cancelled",
            "stage": reason,
            "queued": True,
            "worker_id": "worker-1",
            "attempts": 1,
            "last_error": None,
            "metadata_json": {},
            "created_at": utc_now_naive(),
            "queued_at": utc_now_naive(),
            "started_at": None,
            "finished_at": utc_now_naive(),
            "updated_at": utc_now_naive(),
            "duration_ms": None,
        }

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _allow_admin
    monkeypatch.setattr(site_manager_ops_router.site_manager_ops, "cancel_lifecycle_job_for_repair", _cancel_job)

    response = client.post(f"/api/v1/desktop/site-manager/ops/jobs/{job_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert captured["job_id"] == job_id
    assert captured["actor_user_id"] == "550e8400-e29b-41d4-a716-446655440000"


def test_ops_router_lifecycle_job_retry_uses_admin_repair_service(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _allow_admin():
        return SimpleNamespace(id="550e8400-e29b-41d4-a716-446655440000", role="admin")

    job_id = "550e8400-e29b-41d4-a716-446655440010"
    captured: dict[str, object] = {}

    async def _retry_job(db_arg, *, job_id, background_tasks, actor_user_id):
        captured.update(
            {
                "db": db_arg,
                "job_id": str(job_id),
                "background_tasks": background_tasks,
                "actor_user_id": str(actor_user_id),
            }
        )
        return {
            "status": "starting",
            "queued": True,
            "detail": "Retry queued",
            "job_id": "550e8400-e29b-41d4-a716-446655440011",
            "worker_ready": True,
        }

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _allow_admin
    monkeypatch.setattr(site_manager_ops_router.site_manager_ops, "retry_lifecycle_job_for_repair", _retry_job)

    response = client.post(f"/api/v1/desktop/site-manager/ops/jobs/{job_id}/retry")

    assert response.status_code == 200
    assert response.json()["detail"] == "Retry queued"
    assert captured["job_id"] == job_id
    assert captured["actor_user_id"] == "550e8400-e29b-41d4-a716-446655440000"
    assert captured["background_tasks"] is not None


@pytest.mark.asyncio
async def test_cancel_lifecycle_job_for_repair_records_audit_event(monkeypatch: pytest.MonkeyPatch) -> None:
    db = _MutationFakeSession()
    job_id = "550e8400-e29b-41d4-a716-446655440010"
    before_job = {
        "id": job_id,
        "instance_scope": "user",
        "instance_id": "550e8400-e29b-41d4-a716-446655440001",
        "site_slug": "demo",
        "task_type": "site_studio_start",
        "status": "running",
        "stage": "worker_started",
    }
    cancelled_job = {
        **before_job,
        "status": "cancelled",
        "stage": "cancelled_by_site_manager_operator",
    }
    audit_events: list[dict[str, object]] = []

    async def _get_job(_db, *, job_id):
        assert str(job_id) == before_job["id"]
        return before_job

    async def _cancel_job(_db, *, job_id, instance_scope, instance_id, reason):
        assert str(job_id) == before_job["id"]
        assert instance_scope == "user"
        assert instance_id == before_job["instance_id"]
        assert reason == "operator cancelled stale job"
        return cancelled_job

    async def _record_audit(_db, **kwargs):
        audit_events.append(kwargs)
        return {"id": "audit-1", **kwargs}

    monkeypatch.setattr(site_manager_ops_service, "_get_lifecycle_job_by_id", _get_job)
    monkeypatch.setattr(site_manager_ops_service, "cancel_lifecycle_job", _cancel_job)
    monkeypatch.setattr(site_manager_ops_service, "record_ops_audit_event", _record_audit)

    result = await site_manager_ops_service.cancel_lifecycle_job_for_repair(
        db,
        job_id=job_id,
        actor_user_id="550e8400-e29b-41d4-a716-446655440000",
        reason="operator cancelled stale job",
    )

    assert result == cancelled_job
    assert db.commit_count == 1
    assert audit_events == [
        {
            "action": "lifecycle_job_cancel",
            "target_type": "site_studio_lifecycle_job",
            "target_id": job_id,
            "actor_user_id": "550e8400-e29b-41d4-a716-446655440000",
            "before": before_job,
            "after": cancelled_job,
            "result": {"reason": "operator cancelled stale job"},
            "metadata": {
                "instance_scope": "user",
                "instance_id": before_job["instance_id"],
                "site_slug": "demo",
            },
        }
    ]


@pytest.mark.asyncio
async def test_retry_lifecycle_job_for_repair_updates_instance_and_records_audit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = _MutationFakeSession()
    job_id = "550e8400-e29b-41d4-a716-446655440010"
    new_job_id = "550e8400-e29b-41d4-a716-446655440011"
    before_job = {
        "id": job_id,
        "instance_scope": "user",
        "instance_id": "550e8400-e29b-41d4-a716-446655440001",
        "site_slug": "demo",
        "task_type": "site_studio_start",
        "status": "failed",
        "stage": "health",
        "last_error": "health failed",
    }
    before_instance = {
        "id": before_job["instance_id"],
        "site_slug": "demo",
        "status": "failed",
        "last_error": "health failed",
        "template_key": "olenti",
        "user_id": "550e8400-e29b-41d4-a716-446655440012",
    }
    cancelled_jobs: list[dict[str, object]] = []
    queued_jobs: list[dict[str, object]] = []
    audit_events: list[dict[str, object]] = []

    async def _get_job(_db, *, job_id):
        assert str(job_id) == before_job["id"]
        return before_job

    async def _get_instance(_db, *, table, row_id):
        assert table == "user_site_instances"
        assert str(row_id) == before_instance["id"]
        return before_instance

    async def _validate(_db, *, instance, task_type):
        assert instance == before_instance
        assert task_type == "site_studio_start"
        return {"worker_ready": True}

    async def _cancel_job(_db, *, job_id, instance_scope, instance_id, reason):
        cancelled_jobs.append(
            {
                "job_id": str(job_id),
                "instance_scope": instance_scope,
                "instance_id": str(instance_id),
                "reason": reason,
            }
        )
        return {**before_job, "status": "cancelled", "stage": reason}

    async def _queue_retry(
        _db,
        *,
        background_tasks,
        instance_scope,
        instance,
        task_type,
        previous_status,
    ):
        assert isinstance(background_tasks, BackgroundTasks)
        queued_jobs.append(
            {
                "instance_scope": instance_scope,
                "instance": instance,
                "task_type": task_type,
                "previous_status": previous_status,
            }
        )
        return True, new_job_id

    async def _record_audit(_db, **kwargs):
        audit_events.append(kwargs)
        return {"id": "audit-1", **kwargs}

    monkeypatch.setattr(site_manager_ops_service, "_get_lifecycle_job_by_id", _get_job)
    monkeypatch.setattr(site_manager_ops_service, "_get_table_row", _get_instance)
    monkeypatch.setattr(site_manager_ops_service, "_validate_retry_or_raise", _validate)
    monkeypatch.setattr(site_manager_ops_service, "cancel_lifecycle_job", _cancel_job)
    monkeypatch.setattr(site_manager_ops_service, "_queue_or_background_retry_task", _queue_retry)
    monkeypatch.setattr(site_manager_ops_service, "record_ops_audit_event", _record_audit)

    result = await site_manager_ops_service.retry_lifecycle_job_for_repair(
        db,
        job_id=job_id,
        background_tasks=BackgroundTasks(),
        actor_user_id="550e8400-e29b-41d4-a716-446655440000",
    )

    assert result == {
        "status": "starting",
        "queued": True,
        "detail": "Retry queued",
        "job_id": new_job_id,
        "worker_ready": True,
    }
    assert db.commit_count == 1
    assert any(
        params.get("status") == "starting" and params.get("instance_id") == before_instance["id"]
        for params in db.executed_params
    )
    assert cancelled_jobs == [
        {
            "job_id": job_id,
            "instance_scope": "user",
            "instance_id": before_instance["id"],
            "reason": "retry_superseded",
        }
    ]
    assert queued_jobs == [
        {
            "instance_scope": "user",
            "instance": {**before_instance, "status": "starting", "last_error": None},
            "task_type": "site_studio_start",
            "previous_status": "failed",
        }
    ]
    assert audit_events == [
        {
            "action": "lifecycle_job_retry",
            "target_type": "site_studio_lifecycle_job",
            "target_id": job_id,
            "actor_user_id": "550e8400-e29b-41d4-a716-446655440000",
            "before": before_job,
            "after": {"new_job_id": new_job_id, "instance_status": "starting"},
            "result": {
                "status": "starting",
                "queued": True,
                "detail": "Retry queued",
                "job_id": new_job_id,
                "worker_ready": True,
            },
            "metadata": {
                "instance_scope": "user",
                "instance_id": before_instance["id"],
                "site_slug": "demo",
                "task_type": "site_studio_start",
            },
        }
    ]


def test_ops_router_openapi_exposes_typed_schemas() -> None:
    async def _allow_admin():
        return SimpleNamespace(id="550e8400-e29b-41d4-a716-446655440000", role="admin")

    client = _ops_client()
    _ops_overrides(client)[site_manager_ops_router.require_admin_user] = _allow_admin

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schemas = response.json()["components"]["schemas"]
    assert "SiteManagerOpsTemplateRegistryResponse" in schemas
    assert "SiteManagerOpsAuditEventResponse" in schemas
    assert "SiteManagerOpsOverviewLimitResponse" in schemas
    assert "overview_limits" in schemas["SiteManagerOpsOverviewResponse"]["properties"]


@pytest.mark.asyncio
async def test_publish_smoke_hard_fails_without_runtime_metadata() -> None:
    result = await run_publish_quality_smoke(
        _FakeSession(
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "site_slug": "demo",
                "status": "draft",
                "publication_state": "open",
                "public_hostname": "demo-site.eliteew.ru",
                "public_url": "https://demo-site.eliteew.ru",
                "api_base_url": "https://demo-site.eliteew.ru/api",
                "compose_project_name": None,
                "last_error": None,
            }
        ),
        instance_scope="user",
        instance_id="550e8400-e29b-41d4-a716-446655440000",
    )

    assert result["status"] == "failed"
    assert any(check["key"] == "runtime_metadata" and not check["ok"] for check in result["checks"])

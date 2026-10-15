# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# S2 queue-auth regression tests: opaque token lifecycle, enqueue sanitization,
# and worker-side auth resolution.
# Invariants:
# - Opaque worker token is one-time consumable.
# - enqueue_companion_run never forwards Bearer headers to Celery payload.
# - Worker helpers resolve token to Authorization header in-memory only.
# - Legacy Bearer in worker payload is hard-rejected at resolution and step execution.
# Related:
# - api/ewa_platform/companion/jobs/worker_auth_token.py
# - api/ewa_platform/companion/jobs/enqueue.py
# - api/ewa_platform/workers/companion_task_runner.py
# - api/ewa_platform/companion/jobs/step_handlers.py
# ---
from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from types import ModuleType

import pytest

from api.ewa_platform.companion.jobs import step_handlers


def _stub_jobs_package(monkeypatch: pytest.MonkeyPatch) -> None:
    package_name = "api.ewa_platform.companion.jobs"
    package_module = ModuleType(package_name)
    package_module.__path__ = [str(Path("ewa_platform/companion/jobs").resolve())]  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, package_name, package_module)


def _load_module_from_path(
    monkeypatch: pytest.MonkeyPatch,
    *,
    module_name: str,
    relative_path: str,
):
    module_path = Path(relative_path).resolve()
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        msg = f"Cannot load module from {module_path}"
        raise RuntimeError(msg)
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, module_name, module)
    spec.loader.exec_module(module)
    return module


def _load_jobs_module(
    monkeypatch: pytest.MonkeyPatch,
    *,
    module_name: str,
    relative_path: str,
):
    _stub_jobs_package(monkeypatch)
    return _load_module_from_path(
        monkeypatch,
        module_name=module_name,
        relative_path=relative_path,
    )


def _stub_celery_for_worker_modules(monkeypatch: pytest.MonkeyPatch) -> None:
    celery_app_mod = ModuleType("api.tasks.celery_app")

    class _FakeCelery:
        def task(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            def decorator(fn):  # type: ignore[no-untyped-def]
                return fn

            return decorator

    setattr(celery_app_mod, "celery_app", _FakeCelery())
    monkeypatch.setitem(sys.modules, "api.tasks.celery_app", celery_app_mod)

    orch_mod = ModuleType("api.ewa_platform.workers.orchestration_tasks")

    class EwaOrchestrationTaskSpec(Enum):
        COMPANION_RUN_TASK = "ewa.companion.run"

    setattr(orch_mod, "EwaOrchestrationTaskSpec", EwaOrchestrationTaskSpec)
    monkeypatch.setitem(sys.modules, "api.ewa_platform.workers.orchestration_tasks", orch_mod)

    exec_mod = ModuleType("api.ewa_platform.companion.jobs.executor")
    exec_mod.execute_companion_run = lambda **kwargs: {}  # type: ignore[attr-defined, no-untyped-def]
    monkeypatch.setitem(sys.modules, "api.ewa_platform.companion.jobs.executor", exec_mod)


def _load_companion_task_runner_module(monkeypatch: pytest.MonkeyPatch):
    _load_jobs_module(
        monkeypatch,
        module_name="api.ewa_platform.companion.jobs.worker_auth_token",
        relative_path="ewa_platform/companion/jobs/worker_auth_token.py",
    )
    _stub_celery_for_worker_modules(monkeypatch)
    return _load_module_from_path(
        monkeypatch,
        module_name="api.ewa_platform.workers.companion_task_runner",
        relative_path="ewa_platform/workers/companion_task_runner.py",
    )


@pytest.mark.unit
def test_worker_auth_token_one_time_consume(monkeypatch: pytest.MonkeyPatch) -> None:
    token_module = _load_jobs_module(
        monkeypatch,
        module_name="api.ewa_platform.companion.jobs.worker_auth_token",
        relative_path="ewa_platform/companion/jobs/worker_auth_token.py",
    )

    store: dict[str, str] = {}

    class _FakePool:
        def disconnect(self) -> None:
            return None

    class _FakeRedis:
        def __init__(self) -> None:
            self.connection_pool = _FakePool()

        def setex(self, key: str, ttl: int, value: str) -> None:  # noqa: ARG002
            store[key] = value

        def execute_command(self, cmd: str, key: str):  # type: ignore[no-untyped-def]
            if cmd == "GETDEL":
                return store.pop(key, None)
            msg = f"Unsupported command {cmd}"
            raise RuntimeError(msg)

        def get(self, key: str):  # type: ignore[no-untyped-def]
            return store.get(key)

        def delete(self, key: str) -> None:
            store.pop(key, None)

    monkeypatch.setattr(token_module, "_redis_client", lambda: _FakeRedis())

    opaque_ref = token_module.issue_worker_auth_token_sync(
        run_id="run-1",
        principal_id="principal-1",
        bearer_token="secret-token",
        audience=token_module.WORKER_AUTH_AUDIENCE,
        ttl_seconds=300,
    )
    assert isinstance(opaque_ref, str) and opaque_ref

    first = token_module.consume_worker_auth_token_sync(
        token_ref=opaque_ref,
        run_id="run-1",
        principal_id="principal-1",
        audience=token_module.WORKER_AUTH_AUDIENCE,
    )
    assert first is not None
    assert first.bearer_token == "secret-token"

    second = token_module.consume_worker_auth_token_sync(
        token_ref=opaque_ref,
        run_id="run-1",
        principal_id="principal-1",
        audience=token_module.WORKER_AUTH_AUDIENCE,
    )
    assert second is None


@pytest.mark.unit
def test_enqueue_replaces_bearer_with_opaque_worker_token(monkeypatch: pytest.MonkeyPatch) -> None:
    _load_jobs_module(
        monkeypatch,
        module_name="api.ewa_platform.companion.jobs.worker_auth_token",
        relative_path="ewa_platform/companion/jobs/worker_auth_token.py",
    )
    enqueue_module = _load_jobs_module(
        monkeypatch,
        module_name="api.ewa_platform.companion.jobs.enqueue",
        relative_path="ewa_platform/companion/jobs/enqueue.py",
    )

    captured: dict[str, object] = {}

    class _FakeAsyncResult:
        id = "celery-task-123"

    class _FakeCompanionRunTask:
        @staticmethod
        def delay(**kwargs):  # type: ignore[no-untyped-def]
            captured["kwargs"] = kwargs
            return _FakeAsyncResult()

        @staticmethod
        def apply_async(**kwargs):  # type: ignore[no-untyped-def]
            captured["kwargs"] = kwargs
            return _FakeAsyncResult()

    fake_worker_module = ModuleType("api.ewa_platform.workers.companion_task_runner")
    fake_worker_module.companion_run_task = _FakeCompanionRunTask  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "api.ewa_platform.workers.companion_task_runner", fake_worker_module)
    monkeypatch.setattr(enqueue_module, "companion_async_jobs_enabled", lambda: True)
    monkeypatch.setattr(enqueue_module, "issue_worker_auth_token_sync", lambda **kwargs: "opaque-ref-1")

    task_id = enqueue_module.enqueue_companion_run(
        run_id="run-55",
        step_index=1,
        job_payload={
            "principal_id": "principal-55",
            "headers": {"Authorization": "Bearer sensitive"},
            "theme": "test",
        },
    )
    assert task_id == "celery-task-123"
    task_kwargs = captured["kwargs"]["kwargs"]  # type: ignore[index]
    payload = task_kwargs["job_payload"]  # type: ignore[index]
    assert payload["worker_auth_token"] == "opaque-ref-1"  # type: ignore[index]
    assert payload["worker_auth_audience"] == enqueue_module.WORKER_AUTH_AUDIENCE  # type: ignore[index]
    assert "headers" not in payload  # type: ignore[operator]
    assert "theme" not in payload  # type: ignore[operator]
    assert captured["kwargs"]["queue"] == "ewa_companion"  # type: ignore[index]


@pytest.mark.unit
def test_resolve_worker_auth_payload_rejects_legacy_bearer(monkeypatch: pytest.MonkeyPatch) -> None:
    runner_module = _load_companion_task_runner_module(monkeypatch)
    payload = {
        "principal_id": "principal-legacy",
        "headers": {"Authorization": "Bearer queue-leaked-token"},
        "theme": "test",
    }

    resolved = runner_module._resolve_worker_auth_payload("run-legacy", payload)

    assert resolved["worker_auth_error"] == "legacy_bearer_rejected"
    assert "headers" not in resolved
    assert "worker_auth_token" not in resolved


@pytest.mark.unit
def test_resolve_worker_auth_payload_resolves_opaque_token(monkeypatch: pytest.MonkeyPatch) -> None:
    token_module = _load_jobs_module(
        monkeypatch,
        module_name="api.ewa_platform.companion.jobs.worker_auth_token",
        relative_path="ewa_platform/companion/jobs/worker_auth_token.py",
    )
    runner_module = _load_companion_task_runner_module(monkeypatch)

    @dataclass(frozen=True)
    class _Snapshot:
        bearer_token: str

    monkeypatch.setattr(
        runner_module,
        "consume_worker_auth_token_sync",
        lambda **kwargs: _Snapshot(bearer_token="runtime-bearer"),
    )

    payload = {
        "principal_id": "principal-1",
        "worker_auth_token": "opaque-ref",
        "worker_auth_audience": token_module.WORKER_AUTH_AUDIENCE,
    }

    resolved = runner_module._resolve_worker_auth_payload("run-1", payload)

    assert resolved.get("worker_auth_error") is None
    assert resolved["headers"] == {"Authorization": "Bearer runtime-bearer"}
    assert "worker_auth_token" not in resolved
    assert "worker_auth_audience" not in resolved


@pytest.mark.unit
def test_resolve_music_headers_accepts_runner_injected_bearer() -> None:
    run = {"id": "run-legacy", "principal_id": "principal-legacy"}
    job_payload = {"headers": {"Authorization": "Bearer step-leaked-token"}}

    headers = step_handlers._resolve_music_headers_for_worker(run=run, job_payload=job_payload)
    assert headers.get("Authorization") == "Bearer step-leaked-token"


@pytest.mark.unit
def test_resolve_music_headers_rejects_worker_auth_error() -> None:
    run = {"id": "run-auth-fail", "principal_id": "principal-1"}
    job_payload = {"worker_auth_error": "legacy_bearer_rejected"}

    with pytest.raises(RuntimeError, match="companion_worker_auth_invalid"):
        step_handlers._resolve_music_headers_for_worker(run=run, job_payload=job_payload)


@pytest.mark.unit
def test_resolve_music_headers_resolves_opaque_token(monkeypatch: pytest.MonkeyPatch) -> None:
    @dataclass(frozen=True)
    class _Snapshot:
        bearer_token: str

    monkeypatch.setattr(
        step_handlers,
        "consume_worker_auth_token_sync",
        lambda **kwargs: _Snapshot(bearer_token="step-runtime-bearer"),
    )

    run = {"id": "run-2", "principal_id": "principal-2"}
    job_payload = {
        "worker_auth_token": "opaque-ref-2",
        "worker_auth_audience": step_handlers.WORKER_AUTH_AUDIENCE,
    }

    headers = step_handlers._resolve_music_headers_for_worker(run=run, job_payload=job_payload)

    assert headers == {"Authorization": "Bearer step-runtime-bearer"}
    assert job_payload["headers"] == {"Authorization": "Bearer step-runtime-bearer"}
    assert "worker_auth_token" not in job_payload

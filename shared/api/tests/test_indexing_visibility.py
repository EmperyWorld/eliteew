# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Regression lock for queue indexing visibility (A-08): ES/Qdrant failures must appear
# in BackgroundTaskManager instead of silent except-pass.
# Invariants:
# - Mocks only; no live Elasticsearch/Qdrant/RabbitMQ.
# Related:
# - api/workers/queue_handlers.py
# - api/core/async_utils.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest

from api.core.async_utils import (
    await_tracked_background_task,
    get_background_task_manager,
)


@pytest.fixture(autouse=True)
def reset_background_task_registry_fixture() -> Iterator[None]:
    get_background_task_manager().clear_for_tests()
    yield
    get_background_task_manager().clear_for_tests()


async def _simulate_legacy_silent_index_failure() -> None:
    """Legacy pattern: except Exception: pass — no registry, no structured log."""

    async def failing_index() -> None:
        msg = "Index Unreachable"
        raise ConnectionError(msg)

    try:
        await failing_index()
    except Exception:
        pass


@pytest.mark.asyncio
async def test_legacy_silent_index_failure_leaves_no_registry_record() -> None:
    """Phase-0 evidence: bare except-pass hides indexing failures from operators."""

    manager = get_background_task_manager()
    await _simulate_legacy_silent_index_failure()
    assert manager.failed_since(datetime.now(UTC) - timedelta(minutes=1)) == []
    assert manager.running_count() == 0


@pytest.mark.asyncio
async def test_tracked_index_failure_is_visible_in_registry(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    correlation_id = "content-event-abc"

    async def failing_index() -> None:
        msg = "Index Unreachable"
        raise ConnectionError(msg)

    task_id = await await_tracked_background_task(
        failing_index(),
        name="unified_content_es_index",
        correlation_id=correlation_id,
        metadata={"content_id": "content-1", "index_target": "elasticsearch"},
        swallow_errors=True,
    )

    manager = get_background_task_manager()
    record = manager.get(task_id)
    assert record is not None
    assert record.status == "failed"
    assert record.correlation_id == correlation_id
    assert "Index Unreachable" in (record.error or "")

    failed_recent = manager.failed_since(datetime.now(UTC) - timedelta(minutes=1))
    assert any(item.task_id == task_id for item in failed_recent)

    bg_logs = [
        json.loads(rec.message.split("[BG_TASK] ", 1)[1])
        for rec in caplog.records
        if rec.levelname == "INFO" and "[BG_TASK]" in rec.message
    ]
    assert any(
        entry.get("event") == "background_task_failed"
        and entry.get("task_name") == "unified_content_es_index"
        and entry.get("correlation_id") == correlation_id
        for entry in bg_logs
    )


@pytest.mark.asyncio
async def test_handle_unified_content_processing_es_failure_tracked(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    import api.workers.queue_handlers as handlers

    content_id = uuid4()
    correlation_id = str(content_id)
    payload: dict[str, Any] = {
        "content_id": str(content_id),
        "correlation_id": correlation_id,
        "use_ocr": False,
    }

    async def fake_load_blob(_content_id: object) -> tuple[str, bytes, str, str]:
        return ("document", b"hello", "doc.txt", "text/plain")

    async def fake_get_pool() -> object:
        return object()

    async def failing_es_index(_content_id: object, _pool: object) -> None:
        msg = "Index Unreachable"
        raise ConnectionError(msg)

    class FakeProcessorFactory:
        def __init__(self, _pool: object) -> None:
            pass

        async def process_content(self, **_kwargs: object) -> dict[str, str]:
            return {"processing_status": "completed"}

    monkeypatch.setattr(handlers, "_load_unified_content_blob", fake_load_blob)
    monkeypatch.setattr(handlers, "get_asyncpg_pool", fake_get_pool)
    monkeypatch.setattr(
        "api.services.unified_content.processors.factory.ProcessorFactory",
        FakeProcessorFactory,
    )
    monkeypatch.setattr(handlers, "_index_unified_content_elasticsearch", failing_es_index)
    monkeypatch.setattr(handlers, "_index_unified_content_marketing_rag", lambda *_a, **_k: None)
    monkeypatch.setattr(handlers, "_index_unified_content_qdrant", lambda *_a, **_k: None)

    caplog.set_level(logging.INFO)
    await handlers.handle_unified_content_processing(payload)

    manager = get_background_task_manager()
    failed = manager.failed_since(datetime.now(UTC) - timedelta(minutes=1))
    es_failures = [row for row in failed if row.name == "unified_content_es_index"]
    assert len(es_failures) == 1
    assert es_failures[0].correlation_id == correlation_id
    assert "Index Unreachable" in (es_failures[0].error or "")


@pytest.mark.asyncio
async def test_tracked_index_success_completes_without_failure_record() -> None:
    manager = get_background_task_manager()

    async def ok_index() -> None:
        return None

    task_id = await await_tracked_background_task(
        ok_index(),
        name="unified_content_qdrant_index",
        correlation_id="content-ok",
        metadata={"index_target": "qdrant"},
        swallow_errors=True,
    )
    record = manager.get(task_id)
    assert record is not None
    assert record.status == "completed"
    assert manager.failed_since(datetime.now(UTC) - timedelta(minutes=1)) == []

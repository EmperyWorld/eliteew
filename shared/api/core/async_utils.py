# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# In-memory registry + structured JSON logs for critical asyncio background tasks (A-05).
# Replaces bare ``asyncio.create_task`` where silent loss would hide operator-visible failures.
# Invariants:
# - No SQL per task lifecycle; JSON log lines are the durable audit trail.
# - Wrapper swallows unhandled exceptions after logging (fire-and-forget safe).
# Related:
# - api/routers/ewrp.py
# - documentation/platform/AGENT-BACKGROUND-TASK-TRACKING.md
# ---

from __future__ import annotations

import asyncio
import json
import logging
import traceback
import uuid
from collections.abc import Awaitable, Coroutine, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

logger = logging.getLogger(__name__)

BackgroundTaskStatus = Literal["started", "running", "completed", "failed"]

DEFAULT_STALE_AFTER_SEC = 3600
DEFAULT_COMPLETED_RETENTION_SEC = 3600
DEFAULT_MAX_RECORDS = 2000


@dataclass(slots=True)
class BackgroundTaskRecord:
    task_id: str
    name: str
    correlation_id: str | None
    status: BackgroundTaskStatus
    started_at: datetime
    finished_at: datetime | None = None
    error: str | None = None
    traceback: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def correlation_id_from_request(request: Any | None) -> str:
    """Resolve HTTP correlation id from common headers or mint a new UUID."""

    if request is None:
        return uuid.uuid4().hex
    headers = getattr(request, "headers", None)
    if headers is None:
        return uuid.uuid4().hex
    for key in (
        "X-Request-Id",
        "X-Request-ID",
        "X-Correlation-Id",
        "X-Correlation-ID",
        "Request-Id",
    ):
        raw = headers.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    return uuid.uuid4().hex


def correlation_id_from_queue_payload(payload: Mapping[str, Any] | None) -> str:
    """Resolve correlation id from queue message payload keys."""

    if not isinstance(payload, Mapping):
        return uuid.uuid4().hex
    for key in ("correlation_id", "request_id", "content_id", "job_id"):
        raw = payload.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    return uuid.uuid4().hex


class BackgroundTaskManager:
    """Track asyncio background tasks in-process with structured lifecycle logs."""

    def __init__(
        self,
        *,
        stale_after_sec: int = DEFAULT_STALE_AFTER_SEC,
        completed_retention_sec: int = DEFAULT_COMPLETED_RETENTION_SEC,
        max_records: int = DEFAULT_MAX_RECORDS,
    ) -> None:
        self._stale_after_sec = max(1, int(stale_after_sec))
        self._completed_retention_sec = max(1, int(completed_retention_sec))
        self._max_records = max(100, int(max_records))
        self._records: dict[str, BackgroundTaskRecord] = {}
        self._asyncio_tasks: dict[str, asyncio.Task[Any]] = {}

    def clear_for_tests(self) -> None:
        self._records.clear()
        self._asyncio_tasks.clear()

    def get(self, task_id: str) -> BackgroundTaskRecord | None:
        return self._records.get(str(task_id or "").strip())

    def running_count(self) -> int:
        return sum(1 for record in self._records.values() if record.status in {"started", "running"})

    def list_running(self) -> list[BackgroundTaskRecord]:
        return [record for record in self._records.values() if record.status in {"started", "running"}]

    def failed_since(self, since: datetime) -> list[BackgroundTaskRecord]:
        cutoff = since.astimezone(UTC) if since.tzinfo else since.replace(tzinfo=UTC)
        out: list[BackgroundTaskRecord] = []
        for record in self._records.values():
            if record.status != "failed":
                continue
            finished = record.finished_at or record.started_at
            if finished.astimezone(UTC) >= cutoff:
                out.append(record)
        out.sort(key=lambda item: item.finished_at or item.started_at, reverse=True)
        return out

    def stale_tasks(self, *, max_age_sec: int | None = None) -> list[BackgroundTaskRecord]:
        age = float(max_age_sec if max_age_sec is not None else self._stale_after_sec)
        now = datetime.now(UTC)
        stale: list[BackgroundTaskRecord] = []
        for record in self._records.values():
            if record.status not in {"started", "running"}:
                continue
            elapsed = (now - record.started_at.astimezone(UTC)).total_seconds()
            if elapsed >= age:
                stale.append(record)
        return stale

    def track(
        self,
        coro: Coroutine[Any, Any, Any] | Awaitable[Any],
        *,
        name: str,
        correlation_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Schedule ``coro`` with lifecycle tracking; returns ``task_id``."""

        task_id = uuid.uuid4().hex
        record = BackgroundTaskRecord(
            task_id=task_id,
            name=str(name or "background_task").strip() or "background_task",
            correlation_id=str(correlation_id).strip() if correlation_id else None,
            status="started",
            started_at=datetime.now(UTC),
            metadata=dict(metadata or {}),
        )
        self._records[task_id] = record
        self._log_lifecycle("background_task_started", record)

        async def _runner() -> None:
            record.status = "running"
            self._log_lifecycle("background_task_running", record)
            try:
                await coro
                if record.status not in {"failed"}:
                    record.status = "completed"
                    record.finished_at = datetime.now(UTC)
                    self._log_lifecycle("background_task_completed", record)
            except asyncio.CancelledError:
                record.status = "failed"
                record.error = "cancelled"
                record.finished_at = datetime.now(UTC)
                self._log_lifecycle("background_task_failed", record, failure_kind="cancelled")
                raise
            except Exception as exc:  # noqa: BLE001 — fire-and-forget: log then stop; caller already detached.
                record.status = "failed"
                record.error = str(exc)[:500]
                record.traceback = traceback.format_exc()
                record.finished_at = datetime.now(UTC)
                self._log_lifecycle(
                    "background_task_failed",
                    record,
                    failure_kind=type(exc).__name__,
                )
            finally:
                self._prune_old_records()

        loop_task = asyncio.create_task(_runner())
        self._asyncio_tasks[task_id] = loop_task

        def _done_callback(done: asyncio.Task[Any]) -> None:
            self._asyncio_tasks.pop(task_id, None)
            if record.status in {"started", "running"}:
                if done.cancelled():
                    record.status = "failed"
                    record.error = record.error or "cancelled"
                elif done.exception() is not None:
                    exc = done.exception()
                    if exc is not None:
                        record.status = "failed"
                        record.error = record.error or str(exc)[:500]
                        record.traceback = record.traceback or "".join(
                            traceback.format_exception(type(exc), exc, exc.__traceback__)
                        )
                else:
                    record.status = "completed"
                record.finished_at = record.finished_at or datetime.now(UTC)
                self._log_lifecycle("background_task_settled", record)

        loop_task.add_done_callback(_done_callback)
        return task_id

    def _prune_old_records(self) -> None:
        if len(self._records) <= self._max_records:
            return
        now = datetime.now(UTC)
        cutoff = now - timedelta(seconds=self._completed_retention_sec)
        terminal_ids = [
            task_id
            for task_id, record in self._records.items()
            if record.status in {"completed", "failed"}
            and (record.finished_at or record.started_at).astimezone(UTC) < cutoff
        ]
        for task_id in terminal_ids:
            self._records.pop(task_id, None)
        if len(self._records) > self._max_records:
            ordered = sorted(
                self._records.items(),
                key=lambda item: item[1].finished_at or item[1].started_at,
            )
            for task_id, _record in ordered[: len(self._records) - self._max_records]:
                self._records.pop(task_id, None)

    def _log_lifecycle(self, event: str, record: BackgroundTaskRecord, **extra: Any) -> None:
        payload: dict[str, Any] = {
            "event": event,
            "task_id": record.task_id,
            "task_name": record.name,
            "correlation_id": record.correlation_id,
            "status": record.status,
            "started_at": record.started_at.isoformat(),
            "metadata": record.metadata,
        }
        if record.finished_at is not None:
            payload["finished_at"] = record.finished_at.isoformat()
        if record.error:
            payload["error"] = record.error
        if extra:
            payload.update(extra)
        logger.info("[BG_TASK] %s", json.dumps(payload, ensure_ascii=False, default=str))

    async def run_tracked(
        self,
        coro: Coroutine[Any, Any, Any] | Awaitable[Any],
        *,
        name: str,
        correlation_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        swallow_errors: bool = False,
    ) -> str:
        """Await ``coro`` inline with the same lifecycle registry as ``track``."""

        task_id = uuid.uuid4().hex
        record = BackgroundTaskRecord(
            task_id=task_id,
            name=str(name or "background_task").strip() or "background_task",
            correlation_id=str(correlation_id).strip() if correlation_id else None,
            status="started",
            started_at=datetime.now(UTC),
            metadata=dict(metadata or {}),
        )
        self._records[task_id] = record
        self._log_lifecycle("background_task_started", record)
        record.status = "running"
        self._log_lifecycle("background_task_running", record)
        try:
            await coro
            record.status = "completed"
            record.finished_at = datetime.now(UTC)
            self._log_lifecycle("background_task_completed", record)
        except asyncio.CancelledError:
            record.status = "failed"
            record.error = "cancelled"
            record.finished_at = datetime.now(UTC)
            self._log_lifecycle("background_task_failed", record, failure_kind="cancelled")
            raise
        except Exception as exc:  # noqa: BLE001 — queue indexing: log failure, preserve best-effort swallow upstream.
            record.status = "failed"
            record.error = str(exc)[:500]
            record.traceback = traceback.format_exc()
            record.finished_at = datetime.now(UTC)
            self._log_lifecycle(
                "background_task_failed",
                record,
                failure_kind=type(exc).__name__,
            )
            if not swallow_errors:
                raise
        finally:
            self._prune_old_records()
        return task_id

    def get_asyncio_task(self, task_id: str) -> asyncio.Task[Any] | None:
        return self._asyncio_tasks.get(str(task_id or "").strip())


_MANAGER = BackgroundTaskManager()


def get_background_task_manager() -> BackgroundTaskManager:
    return _MANAGER


def track_background_task(
    coro: Coroutine[Any, Any, Any] | Awaitable[Any],
    *,
    name: str,
    correlation_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    """Track a critical background coroutine; returns ``task_id``."""

    return _MANAGER.track(
        coro,
        name=name,
        correlation_id=correlation_id,
        metadata=metadata,
    )


async def await_tracked_background_task(
    coro: Coroutine[Any, Any, Any] | Awaitable[Any],
    *,
    name: str,
    correlation_id: str | None = None,
    metadata: dict[str, Any] | None = None,
    swallow_errors: bool = False,
) -> str:
    """Run tracked work inline; optionally swallow errors after registry capture (queue indexing)."""

    return await _MANAGER.run_tracked(
        coro,
        name=name,
        correlation_id=correlation_id,
        metadata=metadata,
        swallow_errors=swallow_errors,
    )


__all__ = (
    "BackgroundTaskManager",
    "BackgroundTaskRecord",
    "await_tracked_background_task",
    "correlation_id_from_queue_payload",
    "correlation_id_from_request",
    "get_background_task_manager",
    "track_background_task",
)

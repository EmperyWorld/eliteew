#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Флаги и нормализация статусов очередей; реэкспорт UTC-«сейчас» для pipeline job'ов.
# Invariants:
#   - Имя utcnow_naive сохранено для совместимости импортов; семантика — UTC naive как в helpers.
# Related:
#   - api/utils/datetime_helpers.py
# ------------------------------------------------------------------------------
"""
Queue runtime helpers.

Centralizes feature flags and public job status normalization for queue-backed flows.
"""

from __future__ import annotations

import os
from typing import Any

from api.utils.datetime_helpers import utc_now_naive as utcnow_naive  # noqa: F401

QUEUE_STATUS_QUEUED = "queued"
QUEUE_STATUS_PENDING = "pending"
QUEUE_STATUS_PROCESSING = "processing"
QUEUE_STATUS_RETRYING = "retrying"
QUEUE_STATUS_COMPLETED = "completed"
QUEUE_STATUS_FAILED = "failed"
QUEUE_STATUS_CANCELLED = "cancelled"

TERMINAL_QUEUE_STATUSES = {
    QUEUE_STATUS_COMPLETED,
    QUEUE_STATUS_FAILED,
    QUEUE_STATUS_CANCELLED,
}

QUEUE_FLAG_UGS = "ENABLE_QUEUE_UGS"
QUEUE_FLAG_DOCS = "ENABLE_QUEUE_DOCS"
QUEUE_FLAG_NOTIFICATIONS = "ENABLE_QUEUE_NOTIFICATIONS"
QUEUE_FLAG_EWRP = "ENABLE_QUEUE_EWRP"
QUEUE_FLAG_BI = "ENABLE_QUEUE_BI"
QUEUE_FLAG_VOICE = "ENABLE_QUEUE_VOICE"
QUEUE_FLAG_SITE_STUDIO = "ENABLE_QUEUE_SITE_STUDIO"

__all__ = (
    "QUEUE_STATUS_QUEUED",
    "QUEUE_STATUS_PENDING",
    "QUEUE_STATUS_PROCESSING",
    "QUEUE_STATUS_RETRYING",
    "QUEUE_STATUS_COMPLETED",
    "QUEUE_STATUS_FAILED",
    "QUEUE_STATUS_CANCELLED",
    "TERMINAL_QUEUE_STATUSES",
    "QUEUE_FLAG_UGS",
    "QUEUE_FLAG_DOCS",
    "QUEUE_FLAG_NOTIFICATIONS",
    "QUEUE_FLAG_EWRP",
    "QUEUE_FLAG_BI",
    "QUEUE_FLAG_VOICE",
    "QUEUE_FLAG_SITE_STUDIO",
    "env_flag",
    "is_queue_enabled",
    "merge_metadata",
    "derive_public_job_status",
    "utcnow_naive",
)


def env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def is_queue_enabled(flag_name: str, *, default: bool = False) -> bool:
    return env_flag(flag_name, default=default)


def merge_metadata(existing: Any, **updates: Any) -> dict[str, Any]:
    metadata = dict(existing) if isinstance(existing, dict) else {}
    for key, value in updates.items():
        if value is None:
            continue
        metadata[key] = value
    return metadata


def derive_public_job_status(
    status: str | None,
    metadata: Any = None,
    *,
    queue_status: str | None = None,
) -> str:
    normalized = (status or "").lower().strip()
    metadata_dict = metadata if isinstance(metadata, dict) else {}
    queue_status_value = (queue_status or metadata_dict.get("queue_status") or "").lower().strip()

    if normalized in {QUEUE_STATUS_COMPLETED, QUEUE_STATUS_FAILED, QUEUE_STATUS_CANCELLED}:
        return normalized
    if queue_status_value == QUEUE_STATUS_RETRYING:
        return QUEUE_STATUS_RETRYING
    if queue_status_value in {QUEUE_STATUS_QUEUED, QUEUE_STATUS_PENDING}:
        return QUEUE_STATUS_QUEUED
    if normalized == QUEUE_STATUS_PENDING:
        return QUEUE_STATUS_QUEUED
    if normalized == QUEUE_STATUS_PROCESSING:
        return QUEUE_STATUS_PROCESSING
    return normalized or QUEUE_STATUS_PENDING

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Celery entry for **EWA companion evolution** — merge sanitized ``learned_preferences`` deltas into the per-user
# profile (or write a no-op audit row) using the EWA Postgres pool from ``EWA_DATABASE_URL``.
# Optional Redis idempotency (best-effort) skips Postgres when a duplicate key completed successfully recently.
# Invariants:
# - Task name equals ``EwaOrchestrationTaskSpec.COMPANION_EVOLUTION_TICK`` (``ewa.platform.*`` namespace).
# - Uses process-level EWA worker pool (E4); no per-task pool close.
# - Never logs raw idempotency material; structured logs carry at most a short SHA-256 prefix.
# Related:
# - api/ewa_platform/companion/persona/evolution_tick.py
# - api/ewa_platform/workers/ewa_pool.py
# - api/ewa_platform/workers/orchestration_tasks.py
# - api/ewa_platform/desktop/pool.py
# ---
"""Celery: companion evolution tick (learned_preferences merge / audit)."""

from __future__ import annotations

import asyncio  # noqa: F401  # pyright: ignore[reportUnusedImport] — contract tests monkeypatch ``evolution_tick_task.asyncio.run``
import contextlib
import hashlib
import logging
import os
from collections.abc import Mapping
from typing import Any

import redis
from redis.exceptions import RedisError

from api.core.celery_async import run_celery_async
from api.ewa_platform.companion.persona.evolution_summary import (
    companion_evolution_llm_summary_execute,
)
from api.ewa_platform.companion.persona.evolution_tick import (
    companion_evolution_tick_execute,
    idempotency_key_log_prefix,
    resolve_companion_evolution_idempotency_key,
)
from api.ewa_platform.companion.plans.config import companion_meta_evolution_enabled
from api.ewa_platform.companion.plans.meta_tick import (
    build_companion_meta_delta,
    companion_meta_evolution_apply,
)
from api.ewa_platform.workers.ewa_pool import open_initialized_ewa_worker_pool
from api.ewa_platform.workers.orchestration_tasks import EwaOrchestrationTaskSpec
from api.tasks.celery_app import celery_app, get_redis_url

_LLM_SUMMARY_TICK_REASONS: frozenset[str] = frozenset({"llm_summary", "llm_evolution_summary"})

logger = logging.getLogger(__name__)

_IDEMPOTENCY_REDIS_KEY_PREFIX_V1 = "ewa:companion_evolution:idemp:v1:"


def _celery_redis_db_index() -> int:
    """Align with Celery broker DB selector (``.env``: ``CELERY_REDIS_DB``)."""

    raw = os.environ.get("CELERY_REDIS_DB", "0")
    try:
        return int(raw)
    except ValueError:
        return 0


def _effective_idempotency_storage_key(effective_key: str) -> str:
    """Fixed-width Redis suffix (digest of logical key; safe for namespaces)."""

    digest = hashlib.sha256(effective_key.encode("utf-8")).hexdigest()
    return f"{_IDEMPOTENCY_REDIS_KEY_PREFIX_V1}{digest}"


def _idempotency_ttl_sec() -> int:
    raw = os.environ.get("EWA_COMPANION_EVOLUTION_IDEMPOTENCY_TTL_SEC", "86400").strip()
    try:
        ttl = int(raw)
    except ValueError:
        ttl = 86_400
    return ttl if ttl > 0 else 86_400


def _redis_duplicate_completed_best_effort(redis_url: str, redis_key: str) -> bool:
    """Return True when Redis confirms a prior successful completion; False on miss or degraded Redis."""

    if not redis_url.strip():
        return False
    try:
        cli = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        try:
            return bool(cli.get(redis_key))
        finally:
            with contextlib.suppress(RedisError, OSError):
                cli.connection_pool.disconnect()
    except (RedisError, OSError):  # fmt: skip
        logger.debug("[EWA companion evolution] idempotency skip — redis GET/client degraded")
        return False


def _redis_mark_completed_best_effort(redis_url: str, redis_key: str, ttl_sec: int) -> None:

    if not redis_url.strip():
        return
    try:
        cli = redis.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
        )
        try:
            cli.setex(redis_key, ttl_sec, "1")
        finally:
            with contextlib.suppress(RedisError, OSError):
                cli.connection_pool.disconnect()
    except (RedisError, OSError):  # fmt: skip
        logger.debug("[EWA companion evolution] idempotency mark skipped — Redis SETEX degraded")


def _result_marks_redis_completed(result: dict[str, Any]) -> bool:
    """Mark Redis only when evolution actually applied (or scalar merge succeeded).

    LLM no-op paths (``transcript_too_short``, ``llm_no_valid_json``, ``merge_conflict``, …) return
    ``skipped=False`` but ``applied=False`` — they must **not** consume the idempotency slot or the next
    chat epoch cannot retry the same Celery key within TTL.
    """

    if result.get("skipped") is True:
        return False
    return result.get("applied") is True


async def _run_companion_evolution_tick(payload: Mapping[str, Any]) -> dict[str, Any]:
    try:
        pool = await open_initialized_ewa_worker_pool(min_size=1, max_size=4)
    except RuntimeError:
        logger.info("[EWA companion evolution] skipped — EWA_DATABASE_URL unset")
        return {"skipped": True, "reason": "EWA_DATABASE_URL_unset"}

    principal_id = str(payload.get("principal_id") or "").strip()
    if not principal_id:
        return {"skipped": True, "reason": "missing_principal_id"}

    tick_reason = str(payload.get("tick_reason") or "scheduled")
    raw_delta = payload.get("learned_preferences_delta")
    effective_delta: Mapping[str, Any] | None = raw_delta if isinstance(raw_delta, Mapping) else None

    meta_delta: dict[str, Any] | None = None
    if (
        effective_delta is None
        and companion_meta_evolution_enabled()
        and tick_reason.strip().lower() in ("scheduled", "companion_meta_from_plan")
    ):
        built = await build_companion_meta_delta(pool, principal_id=principal_id)
        if built:
            meta_delta = dict(built)
    # Two paths share the same Celery entry:
    # 1) LLM evolution summary — when tick_reason is in `_LLM_SUMMARY_TICK_REASONS` (no scalar delta needed).
    # 2) Scalar learned_preferences merge — historical placeholder, still used for explicit caller-supplied deltas.
    normalized_reason = tick_reason.strip().lower()
    if normalized_reason in _LLM_SUMMARY_TICK_REASONS:
        return await companion_evolution_llm_summary_execute(
            pool,
            principal_id=principal_id,
            tick_reason=normalized_reason,
        )
    if meta_delta is not None:
        return await companion_meta_evolution_apply(
            pool,
            principal_id=principal_id,
            meta_delta=meta_delta,
            tick_reason=normalized_reason,
        )
    return await companion_evolution_tick_execute(
        pool,
        principal_id=principal_id,
        learned_preferences_delta=effective_delta,
        tick_reason=tick_reason,
    )


@celery_app.task(name=EwaOrchestrationTaskSpec.COMPANION_EVOLUTION_TICK.value)
def companion_evolution_tick(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge ``learned_preferences_delta`` or record an evolution audit heartbeat."""

    raw: dict[str, Any] = dict(payload) if isinstance(payload, Mapping) else {}
    redis_url = get_redis_url(_celery_redis_db_index())
    ttl = _idempotency_ttl_sec()

    principal_early = str(raw.get("principal_id") or "").strip()
    raw_explicit = raw.get("idempotency_key")
    explicit_kw: str | None = raw_explicit.strip() if isinstance(raw_explicit, str) else None
    tick_reason_early = str(raw.get("tick_reason") or "scheduled")
    delta_early = raw.get("learned_preferences_delta")

    stor_key_for_completed: str = ""
    idem_prefix_for_log: str = ""

    if principal_early:
        eff_key, key_src = resolve_companion_evolution_idempotency_key(
            principal_id=principal_early,
            tick_reason=tick_reason_early,
            learned_preferences_delta=delta_early if isinstance(delta_early, Mapping) else None,
            explicit_idempotency_key=explicit_kw,
        )
        idem_prefix_for_log = idempotency_key_log_prefix(eff_key)
        stor_key_for_completed = _effective_idempotency_storage_key(eff_key)
        if _redis_duplicate_completed_best_effort(redis_url, stor_key_for_completed):
            logger.info(
                "[EWA companion evolution] skipped duplicate idempotency key_prefix=%s source=%s",
                idem_prefix_for_log,
                key_src,
            )
            return {
                "skipped": True,
                "reason": "duplicate_idempotency_key",
                "idempotency_key_prefix": idem_prefix_for_log,
                "idempotency_key_source": key_src,
            }

    try:
        result = run_celery_async(_run_companion_evolution_tick(raw))
    except Exception:
        logger.exception(
            "[EWA companion evolution] task failed principal_id=%s idempotency_key_prefix=%s",
            raw.get("principal_id"),
            idem_prefix_for_log or None,
        )
        raise

    if (
        principal_early
        and stor_key_for_completed
        and isinstance(result, dict)
        and _result_marks_redis_completed(result)
    ):
        _redis_mark_completed_best_effort(redis_url, stor_key_for_completed, ttl)

    return result

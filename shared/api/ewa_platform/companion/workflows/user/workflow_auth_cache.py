# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Short-lived Redis snapshot of OAuth context for declarative workflow multi-step advance (async child hooks).
# Invariants:
# - Never written to ``plan_payload`` (not exposed to SPA); TTL-bound; best-effort delete on terminal runs.
# Related:
# - api/ewa_platform/companion/workflows/user/generic_workflow_starter.py
# - api/ewa_platform/companion/workflows/user/declarative_advance.py
# ---

from __future__ import annotations

import contextlib
import json
import logging
import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

_KEY_PREFIX = "ewa:companion:workflow_auth:"
_DEFAULT_TTL_SECONDS = 6 * 60 * 60


@dataclass(frozen=True)
class WorkflowAuthSnapshot:
    bearer_token: str
    oauth_user_id: str
    profile: dict[str, Any] | None = None


class _WorkflowAuthUser:
    """Minimal auth_user stand-in for background workflow tool dispatch."""

    __slots__ = ("id",)

    def __init__(self, user_id: str) -> None:
        self.id = user_id


def workflow_auth_user(oauth_user_id: str) -> _WorkflowAuthUser:
    return _WorkflowAuthUser(str(oauth_user_id or "").strip())


def _redis_client():
    import redis
    from api.tasks.celery_app import get_redis_url

    raw_db = os.environ.get("CELERY_REDIS_DB", "0")
    try:
        db_index = int(raw_db)
    except ValueError:
        db_index = 0
    redis_url = get_redis_url(db_index)
    if not redis_url.strip():
        return None
    return redis.Redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=1.0,
        socket_timeout=1.0,
    )


def _cache_key(run_id: str) -> str:
    return f"{_KEY_PREFIX}{run_id.strip()}"


def store_workflow_auth_snapshot_sync(
    run_id: str,
    *,
    bearer_token: str | None,
    oauth_user_id: str | None,
    profile: Mapping[str, Any] | None = None,
    ttl_seconds: int = _DEFAULT_TTL_SECONDS,
) -> None:
    """Persist auth for later declarative workflow steps (sync — safe from request handler)."""

    rid = str(run_id or "").strip()
    token = str(bearer_token or "").strip()
    uid = str(oauth_user_id or "").strip()
    if not rid or not token or not uid:
        return
    payload = {
        "bearer_token": token,
        "oauth_user_id": uid,
        "profile": dict(profile) if isinstance(profile, Mapping) else None,
    }
    cli = _redis_client()
    if cli is None:
        logger.warning("[STEP] workflow_auth_cache_skip reason=no_redis run_id=%s", rid)
        return
    try:
        cli.setex(_cache_key(rid), max(60, int(ttl_seconds)), json.dumps(payload, ensure_ascii=False))
        logger.info("[STEP] workflow_auth_cache_stored run_id=%s ttl_s=%d", rid, ttl_seconds)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] workflow_auth_cache_store_failed run_id=%s err=%s", rid, exc)
    finally:
        with contextlib.suppress(Exception):
            cli.connection_pool.disconnect()


def load_workflow_auth_snapshot_sync(run_id: str) -> WorkflowAuthSnapshot | None:
    rid = str(run_id or "").strip()
    if not rid:
        return None
    cli = _redis_client()
    if cli is None:
        return None
    try:
        raw = cli.get(_cache_key(rid))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] workflow_auth_cache_load_failed run_id=%s err=%s", rid, exc)
        return None
    finally:
        with contextlib.suppress(Exception):
            cli.connection_pool.disconnect()
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    token = str(data.get("bearer_token") or "").strip()
    uid = str(data.get("oauth_user_id") or "").strip()
    if not token or not uid:
        return None
    profile_raw = data.get("profile")
    profile = dict(profile_raw) if isinstance(profile_raw, Mapping) else None
    return WorkflowAuthSnapshot(bearer_token=token, oauth_user_id=uid, profile=profile)


def delete_workflow_auth_snapshot_sync(run_id: str) -> None:
    rid = str(run_id or "").strip()
    if not rid:
        return
    cli = _redis_client()
    if cli is None:
        return
    try:
        cli.delete(_cache_key(rid))
    except Exception as exc:  # noqa: BLE001
        from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug

        companion_degrade_debug(
            logger,
            "workflow_auth_cache_delete",
            "redis delete failed",
            exc=exc,
            run_id=rid,
        )
        return
    finally:
        with contextlib.suppress(Exception):
            cli.connection_pool.disconnect()


__all__ = (
    "WorkflowAuthSnapshot",
    "delete_workflow_auth_snapshot_sync",
    "load_workflow_auth_snapshot_sync",
    "store_workflow_auth_snapshot_sync",
    "workflow_auth_user",
)

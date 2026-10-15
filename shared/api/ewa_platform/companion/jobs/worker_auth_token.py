# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Short-lived opaque worker auth token cache for companion Celery payloads, replacing Bearer pass-through.
# Invariants:
# - Tokens are TTL-bound and consumed once via Redis GETDEL semantics.
# - Token payload is audience + run_id + principal_id bound before Bearer is returned to worker code.
# Related:
# - api/ewa_platform/companion/jobs/enqueue.py
# - api/ewa_platform/workers/companion_task_runner.py
# - api/ewa_platform/companion/jobs/step_handlers.py
# ---

from __future__ import annotations

import contextlib
import json
import logging
import os
import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

logger = logging.getLogger(__name__)

_KEY_PREFIX = "ewa:companion:worker_auth:"
_DEFAULT_TTL_SECONDS = 15 * 60
_MAX_TTL_SECONDS = 60 * 60
WORKER_AUTH_AUDIENCE = "ewa.companion.celery.worker"


@dataclass(frozen=True)
class WorkerAuthSnapshot:
    bearer_token: str
    run_id: str
    principal_id: str
    audience: str


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


def _cache_key(token_ref: str) -> str:
    return f"{_KEY_PREFIX}{token_ref.strip()}"


def _normalize_ttl_seconds(ttl_seconds: int | None) -> int:
    if ttl_seconds is not None:
        raw = ttl_seconds
    else:
        raw_env = str(os.getenv("EWA_COMPANION_WORKER_AUTH_TTL_SECONDS", _DEFAULT_TTL_SECONDS)).strip()
        try:
            raw = int(raw_env or _DEFAULT_TTL_SECONDS)
        except ValueError:
            raw = _DEFAULT_TTL_SECONDS
    return max(30, min(int(raw), _MAX_TTL_SECONDS))


def bearer_token_from_headers(headers: Mapping[str, Any] | None) -> str | None:
    if not isinstance(headers, Mapping):
        return None
    for key in ("Authorization", "authorization"):
        raw = str(headers.get(key) or "").strip()
        if raw.lower().startswith("bearer "):
            token = raw[7:].strip()
            if token:
                return token
    return None


def issue_worker_auth_token_sync(
    *,
    run_id: str,
    principal_id: str,
    bearer_token: str,
    audience: str = WORKER_AUTH_AUDIENCE,
    ttl_seconds: int | None = None,
) -> str | None:
    rid = str(run_id or "").strip()
    pid = str(principal_id or "").strip()
    token = str(bearer_token or "").strip()
    aud = str(audience or "").strip()
    if not rid or not pid or not token or not aud:
        return None

    payload = {
        "bearer_token": token,
        "run_id": rid,
        "principal_id": pid,
        "audience": aud,
    }
    opaque_ref = secrets.token_urlsafe(24)
    cli = _redis_client()
    if cli is None:
        logger.warning("[STEP] companion_worker_auth_issue_skip reason=no_redis run_id=%s", rid)
        return None
    try:
        ttl = _normalize_ttl_seconds(ttl_seconds)
        cli.setex(_cache_key(opaque_ref), ttl, json.dumps(payload, ensure_ascii=False))
        logger.info(
            "[STEP] companion_worker_auth_issued run_id=%s principal_id=%s ttl_s=%s audience=%s",
            rid,
            pid,
            ttl,
            aud,
        )
        return opaque_ref
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_worker_auth_issue_failed run_id=%s err=%s", rid, exc)
        return None
    finally:
        with contextlib.suppress(Exception):
            cli.connection_pool.disconnect()


def consume_worker_auth_token_sync(
    *,
    token_ref: str,
    run_id: str,
    principal_id: str,
    audience: str = WORKER_AUTH_AUDIENCE,
) -> WorkerAuthSnapshot | None:
    opaque_ref = str(token_ref or "").strip()
    rid = str(run_id or "").strip()
    pid = str(principal_id or "").strip()
    aud = str(audience or "").strip()
    if not opaque_ref or not rid or not pid or not aud:
        return None
    cli = _redis_client()
    if cli is None:
        return None
    raw: str | None = None
    try:
        try:
            raw = cast(str | None, cli.execute_command("GETDEL", _cache_key(opaque_ref)))
        except Exception:
            raw = cast(str | None, cli.get(_cache_key(opaque_ref)))
            if raw:
                cli.delete(_cache_key(opaque_ref))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_worker_auth_consume_failed run_id=%s err=%s", rid, exc)
        return None
    finally:
        with contextlib.suppress(Exception):
            cli.connection_pool.disconnect()
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, Mapping):
        return None
    payload_run_id = str(payload.get("run_id") or "").strip()
    payload_principal = str(payload.get("principal_id") or "").strip()
    payload_aud = str(payload.get("audience") or "").strip()
    bearer = str(payload.get("bearer_token") or "").strip()
    if not bearer:
        return None
    if payload_run_id != rid or payload_principal != pid or payload_aud != aud:
        logger.warning(
            "[STEP] companion_worker_auth_binding_mismatch run_id=%s principal_id=%s audience=%s",
            rid,
            pid,
            aud,
        )
        return None
    return WorkerAuthSnapshot(
        bearer_token=bearer,
        run_id=payload_run_id,
        principal_id=payload_principal,
        audience=payload_aud,
    )


__all__ = (
    "WORKER_AUTH_AUDIENCE",
    "WorkerAuthSnapshot",
    "bearer_token_from_headers",
    "consume_worker_auth_token_sync",
    "issue_worker_auth_token_sync",
)

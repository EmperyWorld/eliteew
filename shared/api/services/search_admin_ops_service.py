# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin-only search diagnostics: meta, Yandex probe, test searches, audit listing.
# Invariants:
# - Never return plaintext provider secrets in any admin ops payload.
# Related:
# - api/services/search_service.py
# - api/services/web_search_events_service.py
# ---

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.search_runtime_config import SearchRuntimeConfigAudit
from api.services.rate_limiter import RateLimiter
from api.services.search_runtime_config_service import (
    SEARCH_PROVIDER_ID,
    SEARCH_SURFACES,
    get_search_runtime_admin_payload,
    resolve_effective_search_runtime_config,
)
from api.services.search_service import (
    _yandex_credentials_configured,
    fetch_yandex_web_search,
    format_search_results_for_prompt,
    get_web_search_query,
    resolve_web_search_provider,
    web_search,
)
from api.services.web_search_events_service import get_web_search_health
from api.services.web_search_quota_service import (
    WebSearchQuotaExceededError,
    get_web_search_quota_status,
)
from api.utils.llm_wall_clock_context import anchor_web_search_query_to_wall_clock

logger = logging.getLogger(__name__)

SearchTestStatus = Literal["ok", "blocked", "empty", "error"]

_DEFAULT_SMOKE_QUERY = "EliteEW web search smoke test"
_TEST_RATE_LIMIT_PER_HOUR = max(
    1,
    int(os.getenv("SEARCH_ADMIN_TEST_RATE_LIMIT", "30") or "30"),
)
_search_admin_test_limiter = RateLimiter(
    requests_per_minute=_TEST_RATE_LIMIT_PER_HOUR,
    burst_capacity=_TEST_RATE_LIMIT_PER_HOUR,
)


class SearchAdminTestRateLimitError(RuntimeError):
    def __init__(self, retry_after: float) -> None:
        self.retry_after = retry_after
        super().__init__(f"Admin test-search rate limit exceeded; retry after {retry_after:.0f}s")


def assert_search_admin_test_rate_limit(actor_user_id: UUID | str) -> None:
    allowed, retry_after = _search_admin_test_limiter.check_rate_limit(str(actor_user_id))
    if not allowed:
        raise SearchAdminTestRateLimitError(retry_after or 60.0)


def _surface_blockers(
    *,
    runtime,
    resolved_provider: str | None,
) -> list[str]:
    blockers: list[str] = []
    if not runtime.surface_enabled:
        blockers.append("surface_disabled")
    if not resolved_provider:
        if not _yandex_credentials_configured(runtime=runtime):
            blockers.append("yandex_not_configured")
        else:
            blockers.append("no_provider")
    return blockers


async def build_search_admin_meta(db: AsyncSession) -> dict[str, Any]:
    payload = await get_search_runtime_admin_payload(db)
    settings = payload.get("settings") or {}
    secrets = payload.get("secrets") or {}
    yandex_key_status = (secrets.get("yandex_api_key") or {}).get("configured", False)
    yandex_folder_status = (secrets.get("yandex_folder_id") or {}).get("configured", False)

    surfaces_out: list[dict[str, Any]] = []
    for surface in SEARCH_SURFACES:
        runtime = await resolve_effective_search_runtime_config(db, surface=surface)
        provider = resolve_web_search_provider(runtime=runtime)
        surfaces_out.append(
            {
                "id": surface,
                "enabled": bool(runtime.surface_enabled),
                "resolved_provider": provider,
                "source": runtime.source,
                "blockers": _surface_blockers(runtime=runtime, resolved_provider=provider),
            }
        )

    global_runtime = await resolve_effective_search_runtime_config(db, surface=None)
    global_provider = resolve_web_search_provider(runtime=global_runtime)
    health = await get_web_search_health(db)

    return {
        "config_source": payload.get("source") if payload.get("source") in {"db", "env"} else "env",
        "updated_by": payload.get("updated_by"),
        "updated_at": payload.get("updated_at"),
        "provider": SEARCH_PROVIDER_ID,
        "resolved_provider": global_provider,
        "providers": {
            "yandex": {
                "api_key_configured": bool(yandex_key_status),
                "folder_configured": bool(yandex_folder_status),
                "credentials_ready": _yandex_credentials_configured(runtime=global_runtime),
            },
        },
        "cache": {
            "enabled": bool(settings.get("cache_enabled", True)),
            "ttl_sec": int(settings.get("cache_ttl_sec") or 300),
            "empty_ttl_sec": int(settings.get("cache_empty_ttl_sec") or 60),
        },
        "quota": {
            "enforced": bool(settings.get("quota_enforced")),
            "monthly_free_default": int(settings.get("monthly_free_default") or 0),
            "default_limit": int(settings.get("default_limit") or 8),
        },
        "health": health,
        "surfaces": surfaces_out,
        "capabilities": {
            "test_search": True,
            "probe": True,
            "audit": True,
            "stats": True,
        },
    }


@dataclass(frozen=True)
class ProbeResult:
    target: str
    ok: bool
    latency_ms: int
    http_status: int | None
    error_code: str | None
    message: str
    hit_count: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "target": self.target,
            "ok": self.ok,
            "latency_ms": self.latency_ms,
            "http_status": self.http_status,
            "error_code": self.error_code,
            "message": self.message,
            "hit_count": self.hit_count,
        }


async def _probe_yandex(*, runtime, smoke_query: str) -> ProbeResult:
    target = "yandex"
    if not _yandex_credentials_configured(runtime=runtime):
        return ProbeResult(
            target=target,
            ok=False,
            latency_ms=0,
            http_status=None,
            error_code="missing_credentials",
            message="Yandex API key or folder id is not configured",
        )
    outcome = await fetch_yandex_web_search(smoke_query, limit=1, runtime=runtime)
    if outcome.error_code and not outcome.hits:
        return ProbeResult(
            target=target,
            ok=False,
            latency_ms=outcome.latency_ms,
            http_status=outcome.http_status,
            error_code=outcome.error_code,
            message=f"Yandex Search API error: {outcome.error_code}",
        )
    return ProbeResult(
        target=target,
        ok=True,
        latency_ms=outcome.latency_ms,
        http_status=outcome.http_status,
        error_code=None,
        message="Yandex Search API responded successfully",
        hit_count=len(outcome.hits),
    )


async def probe_search_providers(
    db: AsyncSession,
    *,
    smoke_query: str | None = None,
) -> dict[str, Any]:
    query = (smoke_query or _DEFAULT_SMOKE_QUERY).strip() or _DEFAULT_SMOKE_QUERY
    runtime = await resolve_effective_search_runtime_config(db, surface=None)
    result = (await _probe_yandex(runtime=runtime, smoke_query=query)).as_dict()
    return {"smoke_query": query, "results": [result]}


def _settings_diff_summary(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    keys = sorted(set(before.keys()) | set(after.keys()))
    return [key for key in keys if before.get(key) != after.get(key)]


def _secrets_diff_summary(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    keys = sorted(set(before.keys()) | set(after.keys()))
    return [key for key in keys if before.get(key) != after.get(key)]


async def list_search_runtime_audit(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    actor_user_id: UUID | None = None,
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit), 200))
    safe_offset = max(0, int(offset))

    count_stmt = select(func.count()).select_from(SearchRuntimeConfigAudit)
    list_stmt = select(SearchRuntimeConfigAudit).order_by(SearchRuntimeConfigAudit.created_at.desc())
    if actor_user_id is not None:
        count_stmt = count_stmt.where(SearchRuntimeConfigAudit.actor_user_id == actor_user_id)
        list_stmt = list_stmt.where(SearchRuntimeConfigAudit.actor_user_id == actor_user_id)

    total = int((await db.scalar(count_stmt)) or 0)
    rows = (await db.scalars(list_stmt.limit(safe_limit).offset(safe_offset))).all()

    items: list[dict[str, Any]] = []
    for row in rows:
        before_settings = dict(row.before_settings or {})
        after_settings = dict(row.after_settings or {})
        before_secrets = dict(row.before_secrets_status or {})
        after_secrets = dict(row.after_secrets_status or {})
        items.append(
            {
                "id": str(row.id),
                "actor_user_id": str(row.actor_user_id) if row.actor_user_id else None,
                "action": row.action,
                "note": row.note,
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "settings_changed": _settings_diff_summary(before_settings, after_settings),
                "secrets_changed": _secrets_diff_summary(before_secrets, after_secrets),
                "before_settings": before_settings,
                "after_settings": after_settings,
                "before_secrets_status": before_secrets,
                "after_secrets_status": after_secrets,
            }
        )

    return {"total": total, "limit": safe_limit, "offset": safe_offset, "items": items}


@dataclass(frozen=True)
class AdminTestSearchRequest:
    query: str
    surface: str | None
    limit: int
    consume_quota: bool
    simulate_chat_query: bool
    user_id: UUID | None
    preview_only: bool = False


def build_query_preview(query: str, *, simulate_chat_query: bool) -> dict[str, str]:
    original = (query or "").strip()
    effective = anchor_web_search_query_to_wall_clock(original)
    if simulate_chat_query:
        expanded = get_web_search_query(effective, [])
        if expanded:
            effective = expanded
    return {"query_original": original, "query_effective": effective}


async def admin_run_test_search(
    db: AsyncSession,
    *,
    actor_user_id: UUID,
    request: AdminTestSearchRequest,
) -> dict[str, Any]:
    assert_search_admin_test_rate_limit(actor_user_id)

    safe_surface = request.surface if request.surface in SEARCH_SURFACES else None
    runtime = await resolve_effective_search_runtime_config(db, surface=safe_surface)
    provider = resolve_web_search_provider(runtime=runtime)
    blockers = _surface_blockers(runtime=runtime, resolved_provider=provider)

    preview = build_query_preview(request.query, simulate_chat_query=request.simulate_chat_query)
    query_original = preview["query_original"]
    query_effective = preview["query_effective"]

    if request.preview_only:
        return {
            "status": "ok",
            "blockers": blockers,
            "surface": safe_surface,
            "provider": provider,
            "query_original": query_original,
            "query_effective": query_effective,
            "latency_ms": 0,
            "hits": [],
            "prompt_preview": "",
            "quota": None,
            "preview_only": True,
        }

    if blockers:
        return {
            "status": "blocked",
            "blockers": blockers,
            "surface": safe_surface,
            "provider": provider,
            "query_original": query_original,
            "query_effective": query_effective,
            "latency_ms": 0,
            "hits": [],
            "prompt_preview": "",
            "quota": None,
        }

    if request.consume_quota and request.user_id is None:
        msg = "user_id is required when consume_quota is true"
        raise ValueError(msg)

    quota_snapshot: dict[str, Any] | None = None
    if request.consume_quota and request.user_id is not None:
        status = await get_web_search_quota_status(db, request.user_id)
        if status is None:
            msg = f"User {request.user_id} not found"
            raise ValueError(msg)
        quota_snapshot = {
            "user_id": str(request.user_id),
            "monthly_limit": status.monthly_limit,
            "monthly_used": status.monthly_used,
            "monthly_remaining": status.monthly_remaining,
            "coins": status.coins,
            "total_remaining": status.total_remaining,
        }

    started = time.perf_counter()
    try:
        if request.consume_quota and request.user_id is not None:
            hits = await web_search(
                query_effective,
                limit=request.limit,
                user_id=request.user_id,
                db=db,
                surface=safe_surface,
            )
        else:
            hits = await web_search(
                query_effective,
                limit=request.limit,
                user_id=None,
                db=db,
                surface=safe_surface,
            )
    except WebSearchQuotaExceededError as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        st = exc.status
        return {
            "status": "blocked",
            "blockers": ["quota_exceeded"],
            "surface": safe_surface,
            "provider": provider,
            "query_original": query_original,
            "query_effective": query_effective,
            "latency_ms": latency_ms,
            "hits": [],
            "prompt_preview": "",
            "quota": {
                "user_id": str(st.user_id),
                "monthly_limit": st.monthly_limit,
                "monthly_used": st.monthly_used,
                "monthly_remaining": st.monthly_remaining,
                "coins": st.coins,
                "total_remaining": st.total_remaining,
            },
        }

    latency_ms = int((time.perf_counter() - started) * 1000)
    prompt_preview = format_search_results_for_prompt(hits)
    if not hits:
        return {
            "status": "empty",
            "blockers": [],
            "surface": safe_surface,
            "provider": provider,
            "query_original": query_original,
            "query_effective": query_effective,
            "latency_ms": latency_ms,
            "hits": [],
            "prompt_preview": "",
            "quota": quota_snapshot,
        }

    logger.info(
        "[STEP] search.admin_test_search actor=%s surface=%s provider=%s hits=%s quota_skipped=%s",
        actor_user_id,
        safe_surface,
        provider,
        len(hits),
        not request.consume_quota,
    )
    return {
        "status": "ok",
        "blockers": [],
        "surface": safe_surface,
        "provider": provider,
        "query_original": query_original,
        "query_effective": query_effective,
        "latency_ms": latency_ms,
        "hits": hits,
        "prompt_preview": prompt_preview[:4000],
        "quota": quota_snapshot,
    }

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Admin diagnostics for Desktop AI Chat: LLM, Qdrant memory/RAG, embed, rerank, Redis coordination.
# Invariants:
# - Read-only probes; no secrets in responses.
# Related:
# - api/routers/desktop_admin_ai_chat.py
# - api/services/unified_content/content_admin_ops_service.py
# ---
"""Desktop AI Chat admin probe/diagnostics service."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from typing import Any

from api.core.unified_config import unified_settings
from api.services.chat_memory_service import CHAT_HISTORY_COLLECTION, search_memory
from api.services.unified_content.content_admin_ops_service import (
    _probe_http_health,
    asyncio_gather_probes,
    probe_qdrant_collections,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class AiChatProbeCheck:
    id: str
    ok: bool
    latency_ms: int
    message: str
    details: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "id": self.id,
            "ok": self.ok,
            "latency_ms": self.latency_ms,
            "message": self.message,
        }
        if self.details:
            out["details"] = self.details
        return out


async def _probe_redis_coordination() -> AiChatProbeCheck:
    started = time.perf_counter()
    try:
        from api.core.database_manager import get_redis_client

        client = await get_redis_client()
        if client is None:
            raise RuntimeError("redis client unavailable")
        pong = await client.ping()
        ok = bool(pong)
        return AiChatProbeCheck(
            id="redis_stream_coordination",
            ok=ok,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message="Redis PING ok" if ok else "Redis PING failed",
        )
    except Exception as exc:  # noqa: BLE001
        return AiChatProbeCheck(
            id="redis_stream_coordination",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message=str(exc),
        )


async def _probe_memory_search_smoke() -> AiChatProbeCheck:
    started = time.perf_counter()
    try:
        hits = await search_memory(
            "probe smoke query",
            session_id="admin-probe-session",
            limit=1,
            chat_profile="desktop_ai_chat",
        )
        return AiChatProbeCheck(
            id="memory_search_smoke",
            ok=True,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message=f"memory search ok hits={len(hits)}",
        )
    except Exception as exc:  # noqa: BLE001
        return AiChatProbeCheck(
            id="memory_search_smoke",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message=str(exc),
        )


async def _count_legacy_turn_message_id_points() -> AiChatProbeCheck:
    started = time.perf_counter()
    try:
        from api.services.chat_memory_service import MEMORY_KIND_TURN, _get_qdrant_client

        client = await _get_qdrant_client()
        if client is None:
            raise RuntimeError("qdrant unavailable")
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        q_filter = Filter(
            must=[
                FieldCondition(key="memory_kind", match=MatchValue(value=MEMORY_KIND_TURN)),
            ]
        )
        legacy = 0
        offset = None
        while True:
            points, offset = await client.scroll(
                collection_name=CHAT_HISTORY_COLLECTION,
                scroll_filter=q_filter,
                limit=64,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for pt in points or []:
                payload = pt.payload or {}
                if payload.get("message_id") and not payload.get("source_message_id"):
                    legacy += 1
            if offset is None:
                break
        ok = legacy == 0
        details: dict[str, Any] = {"legacy_count": legacy}
        if not ok:
            details["remediation"] = (
                "Run chat_history schema migration: "
                "bash docker/scripts/desktop-ai-chat-chat-history-migrate.sh (dry-run), then "
                "DESKTOP_CHAT_HISTORY_MIGRATE_APPLY=1 bash docker/scripts/desktop-ai-chat-chat-history-migrate.sh. "
                "See documentation/product/DESKTOP-AI-CHAT-CHAT-HISTORY-MIGRATION.md"
            )
        return AiChatProbeCheck(
            id="legacy_schema_points",
            ok=ok,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message="no legacy turn message_id points" if ok else f"legacy turn points with message_id only: {legacy}",
            details=details,
        )
    except Exception as exc:  # noqa: BLE001
        return AiChatProbeCheck(
            id="legacy_schema_points",
            ok=False,
            latency_ms=int((time.perf_counter() - started) * 1000),
            message=str(exc),
        )


async def probe_desktop_ai_chat_health() -> dict[str, Any]:
    """Run all Desktop AI Chat health probes for admin UI."""
    checks: list[AiChatProbeCheck] = []

    llama_url = str(getattr(unified_settings, "llama_url", "") or "").strip().rstrip("/")
    if llama_url:
        sidecar = await _probe_http_health(target="llama_chat", url=llama_url)
        checks.append(
            AiChatProbeCheck(
                id=sidecar.target,
                ok=sidecar.ok,
                latency_ms=sidecar.latency_ms,
                message=sidecar.message,
            )
        )

    # Phase 4: probe deep host only when configured (omit when unset — no greenwash).
    deep_url = (os.getenv("LLAMA_DEEP_URL") or "").strip().rstrip("/")
    if deep_url:
        deep = await _probe_http_health(target="llama_deep", url=deep_url)
        checks.append(
            AiChatProbeCheck(
                id=deep.target,
                ok=deep.ok,
                latency_ms=deep.latency_ms,
                message=deep.message,
                details={"url_host": deep_url.split("://", 1)[-1].split("/", 1)[0]},
            )
        )

    for extra in await asyncio_gather_probes():
        checks.append(
            AiChatProbeCheck(
                id=extra.target,
                ok=extra.ok,
                latency_ms=extra.latency_ms,
                message=extra.message,
                details=extra.details,
            )
        )

    qdrant = await probe_qdrant_collections()
    checks.append(
        AiChatProbeCheck(
            id="qdrant_collections",
            ok=qdrant.ok,
            latency_ms=qdrant.latency_ms,
            message=qdrant.message,
            details=qdrant.details,
        )
    )

    checks.append(await _probe_redis_coordination())
    checks.append(await _probe_memory_search_smoke())
    checks.append(await _count_legacy_turn_message_id_points())

    return {
        "checks": [c.as_dict() for c in checks],
        "all_ok": all(c.ok for c in checks),
    }

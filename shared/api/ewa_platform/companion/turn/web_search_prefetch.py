# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Companion per-turn web-search / KBSEW grounding prefetch: history-aware query,
# chit-chat skip, optional top-URL enrich, and parallel gather under a wall-clock budget.
# Invariants:
# - Web toggle always attaches ``web_search_result.status`` when enabled.
# - Prompt ``web_search_context`` only for ``status=ok`` with usable hits.
# - Top-URL enrich is best-effort (SSRF-safe); SERP-only on fetch failure / short budget.
# - Meta clarifications resolve SERP query from chat history; ambiguous topic → skipped.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-AND-WORKFLOW-EXTENSION-GUIDE.md
# ---

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.turn.phases.main_llm_prepare import CHAT_NS
from api.ewa_platform.companion.turn.phases.turn_bootstrap import normalize_companion_chat_history
from api.ewa_platform.companion.turn.phases.turn_entry import TurnMessageContext
from api.ewa_platform.companion.turn.turn_llm_runtime import env_truthy
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line
from api.services.search_service import (
    WEB_SEARCH_QUERY_MAX_CHARS,
    WebSearchCallResult,
    WebSearchQuotaExceededError,
    format_search_results_for_prompt,
    get_web_search_query,
    is_web_search_query_ambiguous,
    web_search_detailed,
)

logger = logging.getLogger(__name__)

_TOP_FETCH_MIN_REMAINING_SEC = 3.0
_TOP_FETCH_MAX_TIMEOUT_SEC = 6.0
_TOP_FETCH_MAX_BYTES = 48_000
_TOP_FETCH_PROMPT_CHARS = 1200


def companion_web_search_budget_sec() -> float:
    raw = (os.getenv("EWA_COMPANION_WEB_SEARCH_BUDGET_SEC") or "15").strip()
    try:
        v = float(raw)
    except ValueError:
        v = 15.0
    return max(3.0, min(v, 45.0))


def companion_web_search_fetch_top_enabled() -> bool:
    return env_truthy(os.getenv("EWA_COMPANION_WEB_SEARCH_FETCH_TOP", "1"))


def recent_messages_for_search(
    profile: Mapping[str, Any] | None,
    *,
    user_line: str,
) -> list[dict[str, str]]:
    """Chat history from profile LP + current user line (for follow-up query resolve)."""

    history: list[dict[str, str]] = []
    if profile is not None:
        lp_raw = profile.get("learned_preferences")
        lp = dict(lp_raw) if isinstance(lp_raw, Mapping) else {}
        chat_blob = lp.get(CHAT_NS)
        chat_obj = dict(chat_blob) if isinstance(chat_blob, Mapping) else {}
        history = normalize_companion_chat_history(chat_obj.get("messages"))
    line = (user_line or "").strip()
    if line:
        history = [*history, {"role": "user", "content": line}]
    return history


def map_web_search_call_to_companion_status(call: WebSearchCallResult) -> str:
    if call.status == "ok":
        return "ok"
    if call.status == "empty":
        return "empty"
    if call.status == "quota_denied":
        return "quota"
    if call.status == "blocked":
        return "skipped"
    return "error"


def companion_web_search_result_payload(
    query: str,
    hits: list[dict[str, str]],
    *,
    status: str,
    error_code: str | None = None,
) -> dict[str, Any]:
    """Compact user-visible payload for companion right-rail web-search result cards."""

    rows: list[dict[str, str]] = []
    for hit in hits[:5]:
        title = str(hit.get("title") or "").strip()
        url = str(hit.get("url") or "").strip()
        snippet = str(hit.get("content") or hit.get("snippet") or "").strip()
        if not title and not url and not snippet:
            continue
        row: dict[str, str] = {"title": title[:220] or url[:220] or snippet[:80]}
        if url:
            row["url"] = url[:800]
        if snippet:
            row["snippet"] = snippet[:500]
        rows.append(row)
    payload: dict[str, Any] = {
        "schema_version": 1,
        "provider": "yandex",
        "query": query[:240],
        "status": status,
        "results": rows,
        "result_count": len(rows),
    }
    if error_code:
        payload["error_code"] = str(error_code)[:80]
    return payload


def _clone_msg_ctx(
    msg_ctx: TurnMessageContext,
    *,
    shell_norm: dict[str, Any],
) -> TurnMessageContext:
    return TurnMessageContext(
        shell_norm=shell_norm,
        user_line=msg_ctx.user_line,
        vision_data_url=msg_ctx.vision_data_url,
        has_image_attachment=msg_ctx.has_image_attachment,
        image_ocr_context=msg_ctx.image_ocr_context,
    )


async def _enrich_top_hit_if_budget(
    hits: list[dict[str, str]],
    *,
    remaining_sec: float,
) -> list[dict[str, str]]:
    if not companion_web_search_fetch_top_enabled():
        return hits
    if remaining_sec < _TOP_FETCH_MIN_REMAINING_SEC or not hits:
        return hits
    url = str(hits[0].get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return hits
    timeout_sec = max(1.0, min(remaining_sec - 0.4, _TOP_FETCH_MAX_TIMEOUT_SEC))
    try:
        from api.services.desktop_chat.tools.fetch_url import run_fetch_url

        text = await run_fetch_url(
            url,
            max_bytes=_TOP_FETCH_MAX_BYTES,
            timeout_sec=timeout_sec,
            allow_hosts=[],
            deny_hosts=[],
        )
    except Exception as exc:  # noqa: BLE001 — best-effort enrich
        logger.debug("[STEP] companion_web_search_top_fetch_skip err=%s", type(exc).__name__)
        return hits
    if not text or text.startswith("Ошибка") or text.startswith("Не удалось"):
        logger.debug("[STEP] companion_web_search_top_fetch_empty url=%s", url[:120])
        return hits
    enriched = [dict(h) for h in hits]
    base = str(enriched[0].get("content") or enriched[0].get("snippet") or "").strip()
    excerpt = text[:_TOP_FETCH_PROMPT_CHARS].strip()
    if base:
        enriched[0]["content"] = f"{base}\n\n[page excerpt]\n{excerpt}"
    else:
        enriched[0]["content"] = f"[page excerpt]\n{excerpt}"
    logger.info(
        "[STEP] companion_web_search_top_fetch_ok chars=%s timeout_sec=%.1f url=%s",
        len(excerpt),
        timeout_sec,
        url[:120],
    )
    return enriched


async def append_companion_web_search_context(
    msg_ctx: TurnMessageContext,
    *,
    use_web_search: bool,
    web_search_db: Any | None,
    content_catalog_user_id: str | None,
    recent_messages: list[dict[str, str]] | None = None,
) -> TurnMessageContext:
    if not use_web_search:
        return msg_ctx

    shell_norm = dict(msg_ctx.shell_norm or {"schema_version": 1, "windows": []})
    user_line = (msg_ctx.user_line or "").strip()

    def _with_web_result(
        web_result: dict[str, Any],
        *,
        prompt_block: str | None = None,
    ) -> TurnMessageContext:
        next_shell = dict(shell_norm)
        next_shell["web_search_result"] = web_result
        if prompt_block:
            next_shell["web_search_context"] = prompt_block
        return _clone_msg_ctx(msg_ctx, shell_norm=next_shell)

    if is_trivial_chit_chat_user_line(user_line):
        logger.info("[STEP] companion_web_search_skip reason=trivial_chit_chat")
        return _with_web_result(
            companion_web_search_result_payload(
                user_line[:WEB_SEARCH_QUERY_MAX_CHARS],
                [],
                status="skipped",
                error_code="trivial_chit_chat",
            )
        )

    query = get_web_search_query(user_line, list(recent_messages or []))
    query = (query or "").strip()[:WEB_SEARCH_QUERY_MAX_CHARS]

    if not query or web_search_db is None or not content_catalog_user_id:
        logger.info("[STEP] companion_web_search_skip reason=missing_context")
        return _with_web_result(
            companion_web_search_result_payload(
                query or user_line[:WEB_SEARCH_QUERY_MAX_CHARS],
                [],
                status="skipped",
                error_code="missing_context",
            )
        )

    if is_web_search_query_ambiguous(query):
        logger.info(
            "[STEP] companion_web_search_skip reason=ambiguous_query query=%s user_line=%s",
            query[:80],
            user_line[:80],
        )
        return _with_web_result(
            companion_web_search_result_payload(
                query,
                [],
                status="skipped",
                error_code="ambiguous_query",
            )
        )

    status = "error"
    error_code: str | None = None
    hits: list[dict[str, str]] = []
    budget = companion_web_search_budget_sec()
    started = time.monotonic()
    try:
        call = await asyncio.wait_for(
            web_search_detailed(
                query,
                limit=5,
                user_id=content_catalog_user_id,
                db=web_search_db,
                surface="ewa",
            ),
            timeout=budget,
        )
        hits = list(call.hits or [])
        status = map_web_search_call_to_companion_status(call)
        error_code = call.error_code
        logger.info(
            "[STEP] companion_web_search_done status=%s hits=%s error_code=%s latency_ms=%s",
            status,
            len(hits),
            error_code,
            call.latency_ms,
        )
    except WebSearchQuotaExceededError as exc:
        status = "quota"
        error_code = "quota_exceeded"
        logger.info(
            "[STEP] companion_web_search_quota_denied remaining=%s",
            exc.status.total_remaining,
        )
    except TimeoutError:
        status = "error"
        error_code = "budget_exceeded"
        logger.info(
            "[STEP] companion_web_search_budget_exceeded budget_sec=%s query=%s",
            budget,
            query[:80],
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        status = "error"
        error_code = "provider_error"
        logger.info(
            "[STEP] companion_web_search_skip reason=provider_error error=%s",
            type(exc).__name__,
        )

    if hits and status == "ok":
        remaining = budget - (time.monotonic() - started)
        hits = await _enrich_top_hit_if_budget(hits, remaining_sec=remaining)

    web_result = companion_web_search_result_payload(
        query,
        hits,
        status=status,
        error_code=error_code,
    )
    prompt_block: str | None = None
    if hits and status == "ok":
        prompt_block = format_search_results_for_prompt(hits, max_total_chars=2400) or None
        if not prompt_block:
            web_result = companion_web_search_result_payload(
                query,
                [],
                status="empty",
                error_code=error_code,
            )
    return _with_web_result(web_result, prompt_block=prompt_block)


async def append_companion_kbsew_context(
    msg_ctx: TurnMessageContext,
    *,
    kbsew_defaults: Mapping[str, Any] | None,
    recent_messages: list[dict[str, str]] | None = None,
) -> TurnMessageContext:
    if not kbsew_defaults:
        return msg_ctx
    query = get_web_search_query((msg_ctx.user_line or "").strip(), list(recent_messages or []))
    if not query:
        logger.debug("[STEP] companion_kbsew_skip reason=no_query")
        return msg_ctx
    from api.services.kbsew.kbsew_prefetch import prefetch_kbsew_prompt_block

    block = await prefetch_kbsew_prompt_block(
        query=query,
        agent_id="ewa",
        defaults=kbsew_defaults,
    )
    if not block:
        return msg_ctx
    shell_norm = dict(msg_ctx.shell_norm or {"schema_version": 1, "windows": []})
    shell_norm["kbsew_context"] = block
    logger.info("[STEP] companion_kbsew_used chars=%s", len(block))
    return _clone_msg_ctx(msg_ctx, shell_norm=shell_norm)


async def load_kbsew_defaults_for_companion(config_db: Any | None) -> Mapping[str, Any] | None:
    if config_db is None:
        return None
    try:
        from api.services.desktop_chat.service import fetch_config_defaults

        return await fetch_config_defaults(config_db)
    except Exception as exc:
        logger.debug("[STEP] companion_kbsew_defaults_skip reason=%s", exc)
        return None


def _merge_grounding_shells(
    base: Mapping[str, Any] | None,
    web_shell: Mapping[str, Any] | None,
    kbsew_shell: Mapping[str, Any] | None,
) -> dict[str, Any]:
    out = dict(base or {"schema_version": 1, "windows": []})
    if web_shell:
        for key in ("web_search_result", "web_search_context"):
            if key in web_shell:
                out[key] = web_shell[key]
    if kbsew_shell and "kbsew_context" in kbsew_shell:
        out["kbsew_context"] = kbsew_shell["kbsew_context"]
    return out


async def prefetch_companion_grounding(
    msg_ctx: TurnMessageContext,
    *,
    use_web_search: bool,
    web_search_db: Any | None,
    content_catalog_user_id: str | None,
    recent_messages: list[dict[str, str]] | None = None,
) -> TurnMessageContext:
    """Run web-search + KBSEW prefetch in parallel; merge shell keys into one context."""

    recent = list(recent_messages or [])
    kbsew_defaults = await load_kbsew_defaults_for_companion(web_search_db)

    async def _web() -> TurnMessageContext:
        return await append_companion_web_search_context(
            msg_ctx,
            use_web_search=use_web_search,
            web_search_db=web_search_db,
            content_catalog_user_id=content_catalog_user_id,
            recent_messages=recent,
        )

    async def _kbsew() -> TurnMessageContext:
        return await append_companion_kbsew_context(
            msg_ctx,
            kbsew_defaults=kbsew_defaults,
            recent_messages=recent,
        )

    web_out, kbsew_out = await asyncio.gather(_web(), _kbsew())
    merged = _merge_grounding_shells(
        msg_ctx.shell_norm,
        web_out.shell_norm,
        kbsew_out.shell_norm,
    )
    return _clone_msg_ctx(msg_ctx, shell_norm=merged)


__all__ = (
    "append_companion_kbsew_context",
    "append_companion_web_search_context",
    "companion_web_search_budget_sec",
    "companion_web_search_fetch_top_enabled",
    "companion_web_search_result_payload",
    "load_kbsew_defaults_for_companion",
    "map_web_search_call_to_companion_status",
    "prefetch_companion_grounding",
    "recent_messages_for_search",
)

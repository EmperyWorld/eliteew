# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Optional KBSEW semantic prefetch for AI surfaces (desktop chat, companion, marketing/UGS).
# Invariants:
# - Respects kbsew_search_settings.agents + allowed_barrels; read-only KBSEW search.
# - index_stale / errors are counted into summary (not silent empty) and may inject a degrade note.
# Related:
# - api/services/desktop_chat/kbsew_search_settings.py
# - api/services/desktop_chat/tools/knowledge_base_search_tool.py
# - api/services/kbsew/kbsew_client.py
# ---

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from api.services.desktop_chat.kbsew_search_settings import (
    KBSEW_AGENT_SURFACES,
    KbsewSearchSettings,
    kbsew_tool_visible_for_agent,
    resolve_kbsew_search_settings,
)
from api.services.desktop_chat.tools.knowledge_base_search_tool import format_kb_chunks_for_prompt
from api.services.kbsew.kbsew_client import (
    KbsewBarrelDisabledError,
    KbsewClientError,
    KbsewIndexStaleError,
    KbsewServiceUnavailableError,
)
from api.services.kbsew.kbsew_retrieval import kbsew_search_with_settings
from api.services.kbsew.kbsew_trace import get_kbsew_trace_id

logger = logging.getLogger(__name__)

_MAX_BARRELS_PER_PREFETCH = 4
_MAX_TOTAL_CHARS = 4200

_STALE_NOTE_RU = (
    "Индекс базы знаний сейчас обновляется. Факты из базы знаний в этом ответе недоступны; "
    "не утверждай, что искал в базе знаний, пока обновление не завершится."
)
_ERROR_NOTE_RU = "База знаний временно недоступна. Не утверждай, что искал в базе знаний в этом ответе."


@dataclass(frozen=True)
class KbsewPrefetchOutcome:
    """Prefetch block plus metadata for done.context / observability."""

    block: str | None
    status: str  # disabled | empty | ok | stale | error | partial_stale
    barrels_ok: int = 0
    barrels_stale: int = 0
    barrels_failed: int = 0
    barrels_empty: int = 0
    required_pipeline: str = ""
    note: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def as_summary(self, *, agent_id: str) -> dict[str, Any]:
        # applied = anything injected into the user prompt (chunks or honest degrade note)
        return {
            "kbsew_prefetch_applied": bool((self.block or "").strip()),
            "kbsew_prefetch_status": self.status,
            "kbsew_prefetch_barrels_ok": self.barrels_ok,
            "kbsew_prefetch_barrels_stale": self.barrels_stale,
            "kbsew_prefetch_barrels_failed": self.barrels_failed,
            "kbsew_prefetch_barrels_empty": self.barrels_empty,
            "kbsew_prefetch_required_pipeline": self.required_pipeline or None,
            "kbsew_agent_surface": agent_id,
            "kbsew_trace_id": get_kbsew_trace_id(),
        }


async def _search_one_barrel(
    *,
    query: str,
    barrel_id: str,
    settings: KbsewSearchSettings,
) -> tuple[str, list[str], str | None, str]:
    """Return (barrel_id, chunks, error_kind, required_pipeline).

    error_kind: None | stale | disabled | unavailable | error
    """

    try:
        chunks = await kbsew_search_with_settings(query=query, barrel_id=barrel_id, settings=settings)
    except KbsewIndexStaleError as exc:
        logger.info(
            "[STEP] kbsew_prefetch_barrel_stale barrel_id=%s stale_assets=%s pipeline=%s",
            barrel_id,
            exc.stale_assets,
            exc.required_pipeline,
        )
        return barrel_id, [], "stale", exc.required_pipeline
    except KbsewBarrelDisabledError as exc:
        logger.info("[STEP] kbsew_prefetch_barrel_disabled barrel_id=%s reason=%s", barrel_id, exc)
        return barrel_id, [], "disabled", ""
    except KbsewServiceUnavailableError as exc:
        logger.warning("[STEP] kbsew_prefetch_barrel_unavailable barrel_id=%s reason=%s", barrel_id, exc)
        return barrel_id, [], "unavailable", ""
    except KbsewClientError as exc:
        logger.warning("[STEP] kbsew_prefetch_barrel_skip barrel_id=%s reason=%s", barrel_id, exc)
        return barrel_id, [], "error", ""
    return barrel_id, chunks, None, ""


async def prefetch_kbsew_outcome(
    *,
    query: str,
    agent_id: str,
    defaults: Mapping[str, Any] | None,
    chat_settings: Mapping[str, Any] | None = None,
    max_barrels: int = _MAX_BARRELS_PER_PREFETCH,
    max_total_chars: int = _MAX_TOTAL_CHARS,
) -> KbsewPrefetchOutcome:
    """Search allowed barrels; return prompt block + honest status metadata."""

    surface = (agent_id or "").strip().lower()
    if surface not in KBSEW_AGENT_SURFACES:
        return KbsewPrefetchOutcome(block=None, status="disabled")

    q = (query or "").strip()
    if not q:
        return KbsewPrefetchOutcome(block=None, status="empty")

    settings = resolve_kbsew_search_settings(defaults, chat_settings)
    if not kbsew_tool_visible_for_agent(settings, surface):
        return KbsewPrefetchOutcome(block=None, status="disabled")

    barrel_ids = list(settings.allowed_barrels)[: max(1, int(max_barrels))]
    if not barrel_ids:
        return KbsewPrefetchOutcome(block=None, status="disabled")

    results = await asyncio.gather(
        *[_search_one_barrel(query=q[:240], barrel_id=bid, settings=settings) for bid in barrel_ids],
        return_exceptions=False,
    )

    sections: list[str] = []
    total_chars = 0
    ok = 0
    stale = 0
    failed = 0
    empty = 0
    required_pipeline = ""

    for barrel_id, chunks, err_kind, pipeline in results:
        if err_kind == "stale":
            stale += 1
            if pipeline and not required_pipeline:
                required_pipeline = pipeline
            continue
        if err_kind in {"unavailable", "error", "disabled"}:
            failed += 1
            continue
        if not chunks:
            empty += 1
            continue
        ok += 1
        section = format_kb_chunks_for_prompt(query=q, barrel_id=barrel_id, chunks=chunks)
        if total_chars + len(section) > max_total_chars:
            remaining = max_total_chars - total_chars
            if remaining <= 80:
                break
            section = section[:remaining]
        sections.append(section)
        total_chars += len(section)
        if total_chars >= max_total_chars:
            break

    if sections:
        status = "partial_stale" if stale else "ok"
        logger.info(
            "[STEP] kbsew_prefetch_used agent=%s barrels_ok=%s stale=%s failed=%s chars=%s",
            surface,
            ok,
            stale,
            failed,
            total_chars,
        )
        return KbsewPrefetchOutcome(
            block="\n\n".join(sections),
            status=status,
            barrels_ok=ok,
            barrels_stale=stale,
            barrels_failed=failed,
            barrels_empty=empty,
            required_pipeline=required_pipeline,
        )

    if stale and not failed:
        logger.info(
            "[STEP] kbsew_prefetch_stale agent=%s barrels=%s pipeline=%s",
            surface,
            stale,
            required_pipeline,
        )
        return KbsewPrefetchOutcome(
            block=_STALE_NOTE_RU,
            status="stale",
            barrels_stale=stale,
            barrels_empty=empty,
            required_pipeline=required_pipeline,
            note=_STALE_NOTE_RU,
        )

    if failed:
        logger.warning(
            "[STEP] kbsew_prefetch_error agent=%s failed=%s stale=%s empty=%s",
            surface,
            failed,
            stale,
            empty,
        )
        return KbsewPrefetchOutcome(
            block=_ERROR_NOTE_RU,
            status="error",
            barrels_stale=stale,
            barrels_failed=failed,
            barrels_empty=empty,
            required_pipeline=required_pipeline,
            note=_ERROR_NOTE_RU,
        )

    logger.debug("[STEP] kbsew_prefetch_empty agent=%s barrels=%s", surface, len(barrel_ids))
    return KbsewPrefetchOutcome(
        block=None,
        status="empty",
        barrels_empty=empty or len(barrel_ids),
        barrels_stale=stale,
        barrels_failed=failed,
    )


async def prefetch_kbsew_prompt_block(
    *,
    query: str,
    agent_id: str,
    defaults: Mapping[str, Any] | None,
    chat_settings: Mapping[str, Any] | None = None,
    max_barrels: int = _MAX_BARRELS_PER_PREFETCH,
    max_total_chars: int = _MAX_TOTAL_CHARS,
) -> str | None:
    """Backward-compatible: return prompt block or None (degrade notes still returned as str)."""

    outcome = await prefetch_kbsew_outcome(
        query=query,
        agent_id=agent_id,
        defaults=defaults,
        chat_settings=chat_settings,
        max_barrels=max_barrels,
        max_total_chars=max_total_chars,
    )
    block = (outcome.block or "").strip()
    if not block:
        return None
    # Degrade-only notes are returned so callers can inject honesty into the prompt.
    if outcome.status in {"stale", "error"}:
        return block
    if outcome.status in {"ok", "partial_stale"}:
        return block
    return None

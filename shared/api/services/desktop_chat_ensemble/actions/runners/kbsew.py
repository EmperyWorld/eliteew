# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# KBSEW barrel probe for ensemble action packs (reuse knowledge_base_search tool).
# Invariants:
# - Only allowed barrels; findings use project_document citations (FE CPDW allowlist).
# Related:
# - api/services/desktop_chat/tools/knowledge_base_search_tool.py
# ---
"""KBSEW runner for ensemble actions."""

from __future__ import annotations

import logging
import re
from typing import Any

from api.services.desktop_chat.kbsew_search_settings import resolve_kbsew_search_settings
from api.services.desktop_chat.tools import knowledge_base_search_tool
from api.services.desktop_chat_ensemble.actions.budget import MAX_RESULT_DETAIL_CHARS
from api.services.desktop_chat_ensemble.actions.types import ActionResult, PlannedAction

logger = logging.getLogger(__name__)

_EMPTY_MARKERS = (
    "ничего не найдено",
    "не найден",
    "отключён",
    "недоступен",
    "укажите непустой",
    "обновляется",
)


def _next_p(existing: list[dict[str, Any]]) -> int:
    n = 0
    for row in existing:
        cid = str(row.get("citation_id") or "")
        if len(cid) >= 2 and cid[0] == "P" and cid[1:].isdigit():
            n = max(n, int(cid[1:]))
    return n + 1


async def run_kbsew_action(
    action: PlannedAction,
    *,
    defaults: dict[str, Any],
    existing_sources: list[dict[str, Any]] | None = None,
    kbsew_agent: str = "desktop",
    kbsew_registry: list[Any] | None = None,
) -> ActionResult:
    kss = resolve_kbsew_search_settings(defaults)
    barrel = (action.barrel_id or "").strip()
    if not barrel and kss.allowed_barrels:
        barrel = kss.allowed_barrels[0]
    if not barrel:
        return ActionResult(
            action_id=action.action_id,
            kind="kbsew",
            query=action.query,
            status="skipped",
            summary="Нет разрешённых KBSEW barrels",
            error="no_barrel",
        )
    try:
        block = await knowledge_base_search_tool.run_knowledge_base_search(
            query=action.query,
            barrel_id=barrel,
            enabled=True,
            allowed_barrels=kss.allowed_barrels,
            kbsew_settings=kss,
            agent_id=kbsew_agent,
            registry=kbsew_registry,
        )
    except Exception as exc:
        logger.warning(
            "[STEP] ensemble_action kbsew_fail action_id=%s err=%s",
            action.action_id,
            exc,
        )
        return ActionResult(
            action_id=action.action_id,
            kind="kbsew",
            query=action.query,
            status="error",
            summary="Ошибка KBSEW поиска",
            error=str(exc)[:240],
        )

    lowered = (block or "").casefold()
    if any(m in lowered for m in _EMPTY_MARKERS) or not (block or "").strip():
        return ActionResult(
            action_id=action.action_id,
            kind="kbsew",
            query=action.query,
            status="empty",
            summary="KBSEW: нет релевантных фрагментов",
            detail=(block or "")[:MAX_RESULT_DETAIL_CHARS],
        )

    cid = f"P{_next_p(list(existing_sources or []))}"
    title = f"KBSEW · {barrel[:36]}"
    # Soft-cite as project_document so FE ledger accepts CPDW ids.
    source = {
        "citation_id": cid,
        "kind": "project_document",
        "authority": "project_material",
        "title": title,
    }
    # Rewrite first heading-ish line to include citation for heroes.
    detail = (block or "")[:MAX_RESULT_DETAIL_CHARS]
    detail = f"Источник 【{cid}】 ({title})\n{detail}"
    first_line = re.split(r"[\n.]", block or "", maxsplit=1)[0].strip()[:120]
    return ActionResult(
        action_id=action.action_id,
        kind="kbsew",
        query=action.query,
        status="ok",
        summary=first_line or title,
        detail=detail,
        context_sources=[source],
    )

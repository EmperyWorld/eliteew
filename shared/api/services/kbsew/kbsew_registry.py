# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Fetch enabled KBSEW barrels for orchestration and rank barrels for discovery-mode search.
# Invariants:
# - Only barrels in admin allowed_barrels and enabled in KBSEW are returned.
# Related:
# - api/services/kbsew/kbsew_client.py
# - api/services/kbsew/kbsew_orchestration.py
# ---

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from api.services.desktop_chat.kbsew_search_settings import (
    KbsewSearchSettings,
    is_barrel_allowed,
    kbsew_tool_visible_for_agent,
)
from api.services.kbsew.kbsew_client import KbsewClientError, kbsew_list_barrels

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[\w\u0400-\u04ff]+", re.UNICODE)


@dataclass(frozen=True, slots=True)
class KbsewBarrelInfo:
    barrel_id: str
    name: str
    description: str
    enabled: bool


def _tokenize(text: str) -> set[str]:
    return {m.group(0).lower() for m in _TOKEN_RE.finditer(text or "") if m.group(0)}


def rank_barrels_for_query(query: str, barrels: list[KbsewBarrelInfo]) -> list[tuple[str, float]]:
    """Lightweight lexical relevance for discovery mode (no embed round-trip)."""

    q = (query or "").strip()
    q_tokens = _tokenize(q)
    q_lower = q.lower()
    scored: list[tuple[str, float]] = []
    for barrel in barrels:
        haystack = f"{barrel.name} {barrel.description}".strip()
        b_tokens = _tokenize(haystack)
        if not haystack or not q_tokens:
            score = 0.0
        else:
            overlap = len(q_tokens & b_tokens)
            score = overlap / max(len(q_tokens), 1)
        if q_lower and q_lower in (barrel.name or "").lower():
            score += 2.0
        if q_lower and barrel.description and q_lower in barrel.description.lower():
            score += 1.0
        scored.append((barrel.barrel_id, score))
    scored.sort(key=lambda item: item[1], reverse=True)
    return scored


def select_barrel_for_query(
    query: str,
    *,
    barrels: list[KbsewBarrelInfo],
    settings: KbsewSearchSettings,
) -> str | None:
    allowed = [b for b in barrels if is_barrel_allowed(b.barrel_id, settings) and b.enabled]
    if not allowed:
        return None
    if len(allowed) == 1:
        return allowed[0].barrel_id
    ranked = rank_barrels_for_query(query, allowed)
    if not ranked:
        return allowed[0].barrel_id
    best_id, best_score = ranked[0]
    if best_score <= 0.0:
        return allowed[0].barrel_id
    return best_id


async def fetch_kbsew_registry(
    settings: KbsewSearchSettings,
    *,
    agent_id: str,
) -> list[KbsewBarrelInfo]:
    """Return active barrels relevant to the session when KBSEW is enabled for *agent_id*."""

    if not kbsew_tool_visible_for_agent(settings, agent_id):
        return []
    try:
        rows = await kbsew_list_barrels()
    except KbsewClientError as exc:
        logger.warning("[STEP] kbsew_registry_fetch_fail agent=%s reason=%s", agent_id, exc)
        return []

    allowed = set(settings.allowed_barrels)
    out: list[KbsewBarrelInfo] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        bid = str(row.get("id") or "").strip().lower()
        if bid not in allowed:
            continue
        if not bool(row.get("enabled", True)):
            continue
        out.append(
            KbsewBarrelInfo(
                barrel_id=bid,
                name=str(row.get("name") or bid),
                description=str(row.get("description") or "").strip(),
                enabled=True,
            )
        )
    return out


def barrel_display_lines(barrels: list[KbsewBarrelInfo]) -> list[str]:
    lines: list[str] = []
    for barrel in barrels:
        desc = barrel.description.strip()
        if desc:
            lines.append(f"- {barrel.name} (id={barrel.barrel_id}): {desc}")
        else:
            lines.append(f"- {barrel.name} (id={barrel.barrel_id})")
    return lines


def registry_summary_for_meta(barrels: list[KbsewBarrelInfo]) -> list[dict[str, Any]]:
    return [{"id": b.barrel_id, "name": b.name, "description": b.description[:240]} for b in barrels]

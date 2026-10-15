# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave 2 agent-decided research planner: JSON sidecar after hero uncertainty/gaps.
# Invariants:
# - Input is hero draft + capability snapshot — not raw user-text seed alone.
# - When capabilities.web, at least one web probe (user armed the toggle).
# - need_tools=false with web armed still gets a web probe; never invents success.
# - Falls back to heuristic planner only when sidecar returns {}.
# Related:
# - documentation/product/DESKTOP-ENSEMBLE-ACTIONS.md
# ---
"""Agent-decided planner for ensemble research action packs."""

from __future__ import annotations

import logging
import re
from typing import Any

from api.services.desktop_chat.llm.json_sidecar import desktop_llm_json_object
from api.services.desktop_chat_ensemble.actions.budget import (
    MAX_ACTIONS_PER_PACK,
    MAX_KBSEW_ACTIONS,
    MAX_RAG_ACTIONS,
    MAX_WEB_ACTIONS,
)
from api.services.desktop_chat_ensemble.actions.query_planner import plan_actions as plan_actions_heuristic
from api.services.desktop_chat_ensemble.actions.types import (
    ActionKind,
    CapabilitySnapshot,
    PlannedAction,
)

logger = logging.getLogger(__name__)

_SCHEMA_HINT = (
    'Return JSON only: {"need_tools":bool,"actions":[{"kind":"web|chat_rag|project_vault|kbsew",'
    '"query":"string","reason":"string","barrel_id":"optional"}],"abstain_reason":"string"}. '
    "Choose tools only for facts you lack evidence for. Prefer specific queries. "
    "When web=true in capabilities, ALWAYS include at least one web action — the user "
    "armed web search; do not abstain from web. Prefer web over duplicating chat_rag."
)


def _seed_query(user_text: str, draft_body: str) -> str:
    base = re.sub(r"\s+", " ", (user_text or "").strip())[:180]
    if len(base) >= 8:
        return base
    draft = re.sub(r"\s+", " ", (draft_body or "").strip())[:180]
    if len(draft) >= 8:
        return draft
    # Toggle is on — still probe; never leave an empty armed-web pack.
    return "current market facts and sources for this request"


def ensure_web_when_armed(
    planned: list[PlannedAction],
    *,
    capabilities: CapabilitySnapshot,
    user_text: str,
    draft_body: str = "",
) -> list[PlannedAction]:
    """User toggle web=on ⇒ at least one web probe when capability allows."""
    if not capabilities.web:
        return planned
    if any(a.kind == "web" for a in planned):
        return planned
    query = _seed_query(user_text, draft_body)
    web_action = PlannedAction(
        action_id="a_web",
        kind="web",
        query=query,
        rationale="user_armed_web_search",
        barrel_id="",
    )
    out = [web_action, *planned]
    # Re-id sequentially for stable SSE / logs.
    capped = out[:MAX_ACTIONS_PER_PACK]
    return [
        PlannedAction(
            action_id=f"a{i + 1}",
            kind=row.kind,
            query=row.query,
            rationale=row.rationale,
            barrel_id=row.barrel_id,
        )
        for i, row in enumerate(capped)
    ]


_KIND_ALIASES: dict[str, ActionKind] = {
    "web": "web",
    "web_search": "web",
    "chat_rag": "chat_rag",
    "chat_rag_search": "chat_rag",
    "rag": "chat_rag",
    "project_vault": "project_vault",
    "project_vault_search": "project_vault",
    "vault": "project_vault",
    "kbsew": "kbsew",
    "kbsew_search": "kbsew",
}


def _normalize_kind(raw: str) -> ActionKind | None:
    key = str(raw or "").strip().casefold()
    return _KIND_ALIASES.get(key)


def _coerce_planned(
    payload: dict[str, Any],
    *,
    capabilities: CapabilitySnapshot,
) -> list[PlannedAction] | None:
    """Parse agent JSON into PlannedAction list. None → treat as sidecar miss (fallback)."""
    if not payload:
        return None
    if payload.get("need_tools") is False:
        logger.info(
            "[STEP] ensemble_agent_planner abstain reason=%s",
            str(payload.get("abstain_reason") or "")[:160],
        )
        return []
    raw_actions = payload.get("actions")
    if not isinstance(raw_actions, list):
        return None

    planned: list[PlannedAction] = []
    web_n = rag_n = kb_n = 0
    for item in raw_actions:
        if not isinstance(item, dict) or len(planned) >= MAX_ACTIONS_PER_PACK:
            break
        kind = _normalize_kind(str(item.get("kind") or ""))
        query = str(item.get("query") or "").strip()[:200]
        if kind is None or len(query) < 8:
            continue
        if kind == "web":
            if not capabilities.web or web_n >= MAX_WEB_ACTIONS:
                continue
            web_n += 1
        elif kind in {"chat_rag", "project_vault"}:
            if rag_n >= MAX_RAG_ACTIONS:
                continue
            if kind == "chat_rag" and not capabilities.chat_rag:
                continue
            if kind == "project_vault" and not capabilities.project_vault:
                continue
            rag_n += 1
        elif kind == "kbsew":
            if not capabilities.kbsew or kb_n >= MAX_KBSEW_ACTIONS:
                continue
            kb_n += 1
        else:
            continue
        barrel_id = str(item.get("barrel_id") or "").strip()
        if kind == "kbsew" and not barrel_id and capabilities.kbsew_barrels:
            barrel_id = capabilities.kbsew_barrels[0]
        if kind == "kbsew" and not barrel_id:
            continue
        planned.append(
            PlannedAction(
                action_id=f"a{len(planned) + 1}",
                kind=kind,
                query=query,
                rationale=str(item.get("reason") or "agent_decided")[:240],
                barrel_id=barrel_id,
            )
        )
    # Explicit need_tools true with empty usable actions → honest empty, not heuristic fallback.
    if payload.get("need_tools") is True:
        return planned
    if planned:
        return planned
    return None


async def plan_actions_agentic(
    *,
    user_text: str,
    draft_body: str,
    capabilities: CapabilitySnapshot,
    model: str,
    defaults: dict[str, Any] | None = None,
    prefer_agent: bool = True,
) -> list[PlannedAction]:
    """Agent-decided pack when draft/gaps present; else heuristic. Caps applied."""
    if not capabilities.any_enabled:
        return []

    draft = (draft_body or "").strip()
    user = (user_text or "").strip()
    if prefer_agent and (draft or user):
        caps_line = (
            f"web={capabilities.web} chat_rag={capabilities.chat_rag} "
            f"project_vault={capabilities.project_vault} kbsew={capabilities.kbsew} "
            f"kbsew_barrels={list(capabilities.kbsew_barrels)[:4]}"
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "You plan read-only research probes for a Desktop AI Chat ensemble turn. "
                    "Only request tools you are allowed (see capabilities). "
                    "Do not invent facts; choose probes for uncertainty/gaps in the hero draft."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Capabilities: {caps_line}\n\n"
                    f"User request:\n{user[:1200]}\n\n"
                    f"Hero draft / gaps:\n{draft[:3500] or '(empty — use user request gaps)'}"
                ),
            },
        ]
        try:
            payload = await desktop_llm_json_object(
                messages,
                model=model,
                defaults=defaults,
                schema_hint=_SCHEMA_HINT,
                max_tokens=384,
                temperature=0.1,
            )
        except Exception as exc:
            logger.warning("[STEP] ensemble_agent_planner_fail err=%s", exc)
            payload = {}
        coerced = _coerce_planned(payload, capabilities=capabilities)
        if coerced is not None:
            coerced = ensure_web_when_armed(
                coerced,
                capabilities=capabilities,
                user_text=user_text,
                draft_body=draft_body,
            )
            logger.info(
                "[STEP] ensemble_agent_planner ok count=%s kinds=%s",
                len(coerced),
                [a.kind for a in coerced],
            )
            return coerced
        logger.info("[STEP] ensemble_agent_planner miss fallback=heuristic")

    heuristic = plan_actions_heuristic(
        user_text=user_text,
        draft_body=draft_body,
        capabilities=capabilities,
    )
    return ensure_web_when_armed(
        heuristic,
        capabilities=capabilities,
        user_text=user_text,
        draft_body=draft_body,
    )

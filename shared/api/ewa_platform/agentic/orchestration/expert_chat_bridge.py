# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Headless Desktop AI Chat ensemble bridge for agentic call_expert_chat tool.
# Invariants:
# - Ephemeral chats are deleted after the turn; failures must not leave orphan locks.
# - Default heroes are ALLOWED_DESKTOP_HERO_IDS only (never analyst/strategist aliases).
# - Does not import marketing AMKA; shares desktop_chat.stream_chat_turn sink only.
# Related:
# - api/services/desktop_chat/service.py
# - api/services/marketing_cabinet/amka_ensemble_core.py (pattern reference)
# ---

from __future__ import annotations

import json
import logging
from time import perf_counter
from typing import Any
from uuid import UUID

import asyncpg
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_database_manager
from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.service import fetch_config_defaults, stream_chat_turn
from api.services.desktop_chat_ensemble.settings import (
    ALLOWED_DESKTOP_HERO_IDS,
    ENSEMBLE_CHAT_MODE,
    ENSEMBLE_ENGINE_BLUEPRINT,
    ENSEMBLE_MAX_ROSTER_HEROES,
    ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
    sanitize_desktop_chat_settings_payload,
)
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)

DEFAULT_AGENTIC_EXPERT_HEROES: tuple[str, ...] = (
    "likiy_sorrento",
    "arlyqueen",
    "akimbo",
)


def sanitize_agentic_expert_roles(roles: list[str] | None) -> list[str]:
    """Keep only canonical Desktop AI Chat hero ids; fall back to research trio."""

    allowed = set(ALLOWED_DESKTOP_HERO_IDS)
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in roles or []:
        hid = str(raw or "").strip()
        if hid in allowed and hid not in seen:
            seen.add(hid)
            cleaned.append(hid)
        if len(cleaned) >= ENSEMBLE_MAX_ROSTER_HEROES:
            break
    if cleaned:
        return cleaned
    return list(DEFAULT_AGENTIC_EXPERT_HEROES)[:ENSEMBLE_MAX_ROSTER_HEROES]


def build_agentic_ensemble_user_prompt(
    *,
    user_prompt: str,
    goal_text: str | None = None,
    plan_titles: list[str] | None = None,
    use_web_search: bool = False,
) -> str:
    """Local AMKA-style prompt enrichment without importing marketing_cabinet."""

    parts: list[str] = []
    prompt = str(user_prompt or "").strip()
    goal = str(goal_text or "").strip()
    if goal and goal not in prompt:
        parts.append(f"Mission goal:\n{goal}")
    if prompt:
        parts.append(f"Research brief:\n{prompt}")
    titles = [str(t).strip() for t in (plan_titles or []) if str(t).strip()]
    if titles:
        parts.append("Active plan titles:\n" + "\n".join(f"- {t}" for t in titles[:12]))
    brief_locale = prompt or goal
    ru_brief = any("\u0400" <= ch <= "\u04ff" for ch in brief_locale)
    lang_line = (
        "Write the synthesis in Russian when the brief/goal is Russian."
        if ru_brief
        else "Match the language of the research brief."
    )
    parts.append(
        "Produce a structured research synthesis the agent can turn into deliverable documents. "
        f"{lang_line} Mark evidence gaps honestly. Prefer Russian section headings when the brief is Russian."
    )
    parts.append(
        "Anti-hallucination: do not invent media formats (generative video, AI-avatars, YouTube channels) "
        "or third-party products unless the brief/goal explicitly names them. Prefer cited facts; "
        "when evidence is missing, say so instead of fabricating categories."
    )
    if use_web_search:
        parts.append(
            "Web search is enabled for this turn. Use live web facts and URLs when available; "
            "do not claim internet research succeeded from empty local RAG alone."
        )
    return "\n\n".join(parts).strip()


def parse_agentic_ensemble_sse(lines: list[str]) -> tuple[str, dict[str, Any], str | None]:
    tokens: list[str] = []
    metadata: dict[str, Any] = {}
    error: str | None = None
    for line in lines:
        if not line.startswith("data: "):
            continue
        raw = line[6:].strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        event = str(payload.get("event") or "")
        if event == "token":
            tokens.append(str(payload.get("delta") or ""))
        elif event == "ensemble_plan":
            metadata["ensemble_plan"] = payload
        elif event == "error":
            error = str(payload.get("message") or "ensemble_error")
        elif event == "done":
            metadata.update({k: v for k, v in payload.items() if k != "event"})
    return "".join(tokens).strip(), metadata, error


async def _load_last_assistant_markdown(db: AsyncSession, chat_id: UUID) -> tuple[str, dict[str, Any]]:
    result = await db.execute(
        select(DesktopAiChatMessage)
        .where(
            DesktopAiChatMessage.chat_id == chat_id,
            DesktopAiChatMessage.role == "assistant",
        )
        .order_by(desc(DesktopAiChatMessage.created_at))
        .limit(1),
    )
    row = result.scalars().first()
    if row is None:
        return "", {}
    meta = dict(row.message_metadata or {}) if isinstance(row.message_metadata, dict) else {}
    return str(row.content or "").strip(), meta


async def _delete_ephemeral_chat(db: AsyncSession, chat_id: UUID) -> None:
    await db.execute(delete(DesktopAiChat).where(DesktopAiChat.id == chat_id))
    await db.commit()


async def run_agentic_expert_chat(
    db_pool: asyncpg.Pool,
    *,
    user_id: UUID,
    company_id: UUID | None,
    project_id: UUID | None,
    agentic_session_id: str,
    user_prompt: str,
    expert_roles: list[str],
    blueprint_template_id: str | None = None,
    goal_text: str | None = None,
    plan_titles: list[str] | None = None,
    use_web_search: bool = False,
) -> dict[str, Any]:
    """Run one headless expert ensemble turn for agentic orchestrator."""
    hero_ids = sanitize_agentic_expert_roles(expert_roles)
    enriched_prompt = build_agentic_ensemble_user_prompt(
        user_prompt=user_prompt,
        goal_text=goal_text,
        plan_titles=plan_titles,
        use_web_search=use_web_search,
    )
    settings_payload: dict[str, Any] = {
        "desktop_chat_mode": ENSEMBLE_CHAT_MODE,
        "desktop_ensemble_ids": hero_ids,
        "desktop_ensemble_engine": ENSEMBLE_ENGINE_BLUEPRINT,
        "desktop_ensemble_routing_mode": ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
        "agentic_ephemeral": True,
        "agentic_session_id": agentic_session_id,
    }
    # Only force a blueprint when caller supplied one — never default to research_plan_v1.
    # When unset, suppress heuristic score=98 research_plan so agentic briefs do not reopen
    # the market-research scaffold (lady_boss / partner longread path).
    forced_bp = str(blueprint_template_id or "").strip()
    if forced_bp:
        settings_payload["amka_forced_blueprint_template_id"] = forced_bp
    else:
        settings_payload["amka_suppress_research_plan_heuristic"] = True
    settings = sanitize_desktop_chat_settings_payload(settings_payload)
    manager = await get_database_manager()
    chat_id: UUID | None = None
    sse_lines: list[str] = []
    stream_t0 = perf_counter()
    async with manager.get_postgres_session() as db:
        defaults = await fetch_config_defaults(db)
        if use_web_search:
            defaults = {**defaults, "tools_web_search_enabled": True}
        from api.services.llm_runtime.deep_client import deep_llm_enabled

        if deep_llm_enabled():
            defaults = {**defaults, "desktop_llm_job_class": "deep"}
            logger.info(
                "[STEP] agentic_expert_chat_llm_job_class=deep agentic_session_id=%s",
                agentic_session_id,
            )
        chat = DesktopAiChat(
            user_id=user_id,
            company_id=company_id,
            project_id=project_id,
            title=f"Agentic · Эксперты · {agentic_session_id[:8]}"[:500],
            use_project_rag=False,
            settings=settings,
            created_at=utc_now_naive(),
            updated_at=utc_now_naive(),
        )
        db.add(chat)
        await db.commit()
        await db.refresh(chat)
        chat_id = chat.id
        logger.info(
            "[STEP] agentic_expert_chat_start agentic_session_id=%s expert_chat_id=%s heroes=%s "
            "blueprint=%s use_web_search=%s",
            agentic_session_id,
            chat_id,
            ",".join(hero_ids),
            forced_bp or "-",
            int(use_web_search),
        )
        stream_error: str | None = None
        try:
            async for line in stream_chat_turn(
                db_pool,
                chat_id=chat.id,
                user_id=user_id,
                user_text=enriched_prompt,
                defaults=defaults,
                use_tools_flag=bool(use_web_search),
                use_web_search=bool(use_web_search),
                ensemble_forced_path="blueprint",
            ):
                sse_lines.append(line)
        except Exception as exc:
            stream_error = str(exc)[:800] or "ensemble_stream_failed"
            logger.warning(
                "[STEP] agentic_expert_chat_stream_failed agentic_session_id=%s chat_id=%s err=%s",
                agentic_session_id,
                chat_id,
                stream_error[:200],
                exc_info=True,
            )

        token_md, sse_meta, sse_err = parse_agentic_ensemble_sse(sse_lines)
        persisted_md, msg_meta = await _load_last_assistant_markdown(db, chat.id)
        output_text = persisted_md or token_md
        elapsed_ms = int((perf_counter() - stream_t0) * 1000)
        plan_template_id = str(msg_meta.get("plan_template_id") or forced_bp or "")

        try:
            if stream_error or sse_err:
                return {
                    "output_text": output_text,
                    "error": stream_error or sse_err,
                    "expert_chat_id": str(chat_id),
                    "heroes": hero_ids,
                    "elapsed_ms": elapsed_ms,
                }
            return {
                "output_text": output_text,
                "expert_chat_id": str(chat_id),
                "heroes": hero_ids,
                "ensemble_plan": sse_meta.get("ensemble_plan") or {},
                "plan_template_id": plan_template_id,
                "elapsed_ms": elapsed_ms,
            }
        finally:
            try:
                await _delete_ephemeral_chat(db, chat.id)
            except Exception:
                logger.warning(
                    "[STEP] agentic_expert_chat_delete_failed chat_id=%s",
                    chat_id,
                    exc_info=True,
                )


__all__ = (
    "DEFAULT_AGENTIC_EXPERT_HEROES",
    "build_agentic_ensemble_user_prompt",
    "parse_agentic_ensemble_sse",
    "run_agentic_expert_chat",
    "sanitize_agentic_expert_roles",
)

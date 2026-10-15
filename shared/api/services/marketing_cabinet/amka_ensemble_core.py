# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Run Desktop AI Chat ensemble («Команда») headlessly for AMKA execute_section steps.
# Invariants:
# - Ephemeral chats are deleted after the turn; failures must not leave orphan stream locks.
# - Blueprint-only routing by default; semi doc-confirm is not supported in AMKA path.
# Related:
# - api/services/desktop_chat/service.py
# - api/services/marketing_cabinet/amka_ensemble_mapping.py
# ---

from __future__ import annotations

import json
import logging
from time import perf_counter
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from sqlalchemy import delete, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.database_manager import get_database_manager
from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.service import fetch_config_defaults, stream_chat_turn
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_CHAT_MODE,
    ENSEMBLE_ENGINE_BLUEPRINT,
    ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
    sanitize_desktop_chat_settings_payload,
)
from api.services.marketing_cabinet.amka_ensemble_mapping import (
    build_amka_ensemble_user_prompt,
    default_amka_ensemble_settings,
    normalize_amka_ensemble_plan_fields,
    sanitize_amka_ensemble_hero_ids,
)
from api.services.marketing_cabinet.amka_logging import amka_log_line
from api.utils.datetime_helpers import utc_now_naive

logger = logging.getLogger(__name__)


def parse_desktop_chat_sse_lines(lines: list[str]) -> tuple[str, dict[str, Any], str | None]:
    """Collect markdown from SSE token deltas; metadata from done / ensemble_plan events."""
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
    markdown = "".join(tokens).strip()
    return markdown, metadata, error


async def _load_last_assistant_markdown(db: AsyncSession, chat_id: UUID) -> tuple[str, dict[str, Any]]:
    result = await db.execute(
        select(DesktopAiChatMessage)
        .where(
            DesktopAiChatMessage.chat_id == chat_id,
            DesktopAiChatMessage.role == "assistant",
        )
        .order_by(desc(DesktopAiChatMessage.created_at))
        .limit(1)
    )
    row = result.scalars().first()
    if row is None:
        return "", {}
    meta = dict(row.message_metadata or {}) if isinstance(row.message_metadata, dict) else {}
    return str(row.content or "").strip(), meta


async def _delete_ephemeral_chat(db: AsyncSession, chat_id: UUID) -> None:
    await db.execute(delete(DesktopAiChat).where(DesktopAiChat.id == chat_id))
    await db.commit()


async def run_amka_desktop_ensemble_for_project(
    db_pool: asyncpg.Pool,
    *,
    user_id: UUID,
    company_id: UUID | None,
    project_id: UUID,
    run_id: UUID,
    step_id: str,
    section_key: str,
    title: str,
    rationale: str,
    user_instruction: str,
    audit_payload: dict[str, Any],
    plan_payload: dict[str, Any],
) -> dict[str, Any]:
    ensemble_fields = normalize_amka_ensemble_plan_fields(plan_payload, section_key=section_key)
    defaults_map = default_amka_ensemble_settings(section_key)
    hero_ids = sanitize_amka_ensemble_hero_ids(
        ensemble_fields.get("ensemble_hero_ids") or plan_payload.get("ensemble_hero_ids"),
        section_key=section_key,
    )
    routing_mode = str(
        ensemble_fields.get("ensemble_routing_mode")
        or plan_payload.get("ensemble_routing_mode")
        or defaults_map["ensemble_routing_mode"]
    )
    engine = str(
        ensemble_fields.get("ensemble_engine") or plan_payload.get("ensemble_engine") or defaults_map["ensemble_engine"]
    )
    template_hint = str(
        ensemble_fields.get("ensemble_template_hint")
        or plan_payload.get("ensemble_template_hint")
        or defaults_map["ensemble_template_hint"]
    )
    user_prompt = build_amka_ensemble_user_prompt(
        section_key=section_key,
        title=title,
        rationale=rationale,
        user_instruction=user_instruction,
        audit_payload=audit_payload,
        template_hint=template_hint,
    )
    settings = sanitize_desktop_chat_settings_payload(
        {
            "desktop_chat_mode": ENSEMBLE_CHAT_MODE,
            "desktop_ensemble_ids": hero_ids,
            "desktop_ensemble_engine": engine,
            "desktop_ensemble_routing_mode": routing_mode,
            "amka_ephemeral": True,
            "amka_run_id": str(run_id),
            "amka_step_id": step_id,
            "amka_forced_blueprint_template_id": template_hint,
        }
    )
    forced_path = "blueprint" if engine == ENSEMBLE_ENGINE_BLUEPRINT else "legacy"
    if routing_mode == ENSEMBLE_ROUTING_BLUEPRINT_ONLY:
        forced_path = "blueprint"

    manager = await get_database_manager()
    chat_id: UUID | None = None
    sse_lines: list[str] = []
    stream_t0 = perf_counter()
    async with manager.get_postgres_session() as db:
        defaults = await fetch_config_defaults(db)
        chat = DesktopAiChat(
            user_id=user_id,
            company_id=company_id,
            project_id=project_id,
            title=f"AMKA · Команда · {section_key}"[:500],
            use_project_rag=True,
            settings=settings,
            created_at=utc_now_naive(),
            updated_at=utc_now_naive(),
        )
        db.add(chat)
        await db.commit()
        await db.refresh(chat)
        chat_id = chat.id
        logger.info(
            amka_log_line(
                "execute.ensemble.start",
                run_id=run_id,
                step_id=step_id,
                chat_id=chat_id,
                section=section_key,
                heroes=",".join(hero_ids),
                routing=routing_mode,
                engine=engine,
                template=template_hint,
            )
        )
        stream_error: str | None = None
        try:
            async for line in stream_chat_turn(
                db_pool,
                chat_id=chat.id,
                user_id=user_id,
                user_text=user_prompt,
                defaults=defaults,
                use_tools_flag=False,
                ensemble_forced_path=forced_path if forced_path in ("blueprint", "legacy") else None,
            ):
                sse_lines.append(line)
        except Exception as exc:
            stream_error = str(exc)[:800] or "ensemble_stream_failed"
            logger.warning(
                amka_log_line(
                    "execute.ensemble.stream_failed",
                    run_id=run_id,
                    step_id=step_id,
                    chat_id=chat_id,
                    detail=stream_error[:400],
                ),
                exc_info=True,
            )

        token_md, sse_meta, sse_err = parse_desktop_chat_sse_lines(sse_lines)
        persisted_md, msg_meta = await _load_last_assistant_markdown(db, chat.id)
        output_text = persisted_md or token_md
        elapsed_ms = int((perf_counter() - stream_t0) * 1000)
        plan_template_id = str(msg_meta.get("plan_template_id") or template_hint or "")

        try:
            if stream_error:
                return {
                    "output_text": "",
                    "error": stream_error,
                    "chat_id": str(chat_id),
                    "heroes": hero_ids,
                    "template_hint": template_hint,
                    "elapsed_ms": elapsed_ms,
                }
            if sse_err and not output_text:
                return {
                    "output_text": "",
                    "error": sse_err,
                    "chat_id": str(chat_id),
                    "heroes": hero_ids,
                    "template_hint": template_hint,
                    "sse_metadata": sse_meta,
                    "elapsed_ms": elapsed_ms,
                }
            if not output_text.strip():
                logger.warning(
                    amka_log_line(
                        "execute.ensemble.empty_output",
                        run_id=run_id,
                        step_id=step_id,
                        section=section_key,
                        template=plan_template_id,
                        elapsed_ms=elapsed_ms,
                    )
                )
                return {
                    "output_text": "",
                    "error": "ensemble_empty_output",
                    "chat_id": str(chat_id),
                    "heroes": hero_ids,
                    "template_hint": template_hint,
                    "plan_template_id": plan_template_id,
                    "sse_metadata": sse_meta,
                    "elapsed_ms": elapsed_ms,
                }
            logger.info(
                amka_log_line(
                    "execute.ensemble.done",
                    run_id=run_id,
                    step_id=step_id,
                    section=section_key,
                    output_chars=len(output_text),
                    template=plan_template_id,
                    elapsed_ms=elapsed_ms,
                )
            )
            return {
                "output_text": output_text,
                "error": None,
                "chat_id": str(chat_id),
                "heroes": hero_ids,
                "template_hint": template_hint,
                "plan_template_id": plan_template_id,
                "message_metadata": msg_meta,
                "sse_metadata": sse_meta,
                "elapsed_ms": elapsed_ms,
            }
        finally:
            try:
                await _delete_ephemeral_chat(db, chat.id)
            except Exception:
                logger.warning(
                    amka_log_line(
                        "execute.ensemble.cleanup_failed",
                        run_id=run_id,
                        step_id=step_id,
                        chat_id=chat_id,
                    ),
                    exc_info=True,
                )

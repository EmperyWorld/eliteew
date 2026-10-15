# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Route one ensemble turn between blueprint and legacy engines, including semi-auto confirmation flow.
# Invariants:
# - Semi confirmation mutates latest user message metadata via short-lived isolated sessions (no stream-scoped ORM).
# - Route decisions are emitted as structured metrics for observability.
# Related:
# - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
# - api/services/desktop_chat_ensemble/archive/legacy_freeform/stream_turn.py
# ---
"""Ensemble turn: routing modes, blueprint vs legacy freeform, полуавтомат подтверждения."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.service import persist_message_metadata_isolated, resolve_desktop_chat_model
from api.services.desktop_chat_ensemble import ensemble_audit_log
from api.services.desktop_chat_ensemble.archive.legacy_freeform.stream_turn import (
    stream_ensemble_turn as stream_legacy_freeform_turn,
)
from api.services.desktop_chat_ensemble.blueprint.stream_turn import stream_blueprint_turn
from api.services.desktop_chat_ensemble.conversational_route import (
    last_user_message,
    resolve_auto_blueprint_vs_legacy,
)
from api.services.desktop_chat_ensemble.doc_confirm_policy import (
    doc_confirm_is_expired,
    mark_doc_confirm_expired_metadata,
    resolve_doc_confirm_state,
    stamp_doc_confirm_asked,
)
from api.services.desktop_chat_ensemble.settings import (
    ENSEMBLE_DOC_CONFIRM_ACCEPTED,
    ENSEMBLE_DOC_CONFIRM_ASKED,
    ENSEMBLE_DOC_CONFIRM_DECLINED,
    ENSEMBLE_ENGINE_BLUEPRINT,
    ENSEMBLE_ROUTING_BLUEPRINT_ONLY,
    ENSEMBLE_ROUTING_CHAT_ONLY,
    ENSEMBLE_ROUTING_SEMI,
    resolve_ensemble_engine,
    resolve_ensemble_routing_mode,
)

logger = logging.getLogger(__name__)


def _log_route_metric(
    *,
    chat_id: UUID,
    routing_mode: str,
    decision: str,
    note: str = "",
) -> None:
    logger.info(
        "[METRIC] desktop_ai_chat ensemble_route chat_id=%s routing_mode=%s decision=%s note=%s",
        chat_id,
        routing_mode,
        decision,
        note[:160],
    )


async def _yield_document_confirm_and_done(
    *,
    user_message_id: UUID,
    reason_human: str,
    route_note: str,
    rag_ctx: dict[str, Any],
) -> AsyncGenerator[str]:
    payload = {
        "event": "ensemble_document_confirm",
        "user_message_id": str(user_message_id),
        "reason": reason_human,
        "route_note": route_note,
    }
    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    done_payload: dict[str, Any] = {
        "event": "done",
        "context": rag_ctx,
        "duration_ms": 0,
        "ensemble": True,
        "pending_document_confirm": True,
    }
    yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"


def _confirm_reason_text(route_note: str) -> str:
    if route_note.startswith("heuristic_blueprint"):
        return "Запрос похож на структурированный документ (техплан, бриф, ТЗ). Создать документ по шаблону?"
    if route_note.startswith("llm"):
        return "Классификатор предлагает режим документа по шаблону. Продолжить как документ?"
    return "Включить режим создания документа по шаблону?"


async def stream_ensemble_turn(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    enriched_user_content: str | None = None,
    rag_context_summary: dict[str, Any] | None = None,
    forced_ensemble_path: str | None = None,
    kbsew_dpa_block: str = "",
    speaker_context: dict[str, Any] | None = None,
) -> AsyncGenerator[str]:
    """
    ``forced_ensemble_path``: ``blueprint`` | ``legacy`` — после подтверждения в режиме semi (metadata пишет роутер).
    """
    rag_ctx = dict(rag_context_summary or {})
    routing_mode = resolve_ensemble_routing_mode(chat, defaults)
    model = resolve_desktop_chat_model(chat, defaults)
    audit_reset = await ensemble_audit_log.begin_turn(
        chat_id=chat.id,
        user_text=user_text,
        enriched=enriched_user_content or "",
        rag_summary=rag_ctx,
        model=model,
        forced_path=forced_ensemble_path,
        routing_mode=str(routing_mode),
    )
    try:
        async for line in _stream_ensemble_turn_impl(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            forced_ensemble_path=forced_ensemble_path,
            rag_ctx=rag_ctx,
            routing_mode=routing_mode,
            model=model,
            kbsew_dpa_block=kbsew_dpa_block,
            speaker_context=speaker_context,
        ):
            yield line
    finally:
        ensemble_audit_log.end_turn(audit_reset)


async def _stream_ensemble_turn_impl(
    db_pool: asyncpg.Pool,
    *,
    chat: DesktopAiChat,
    user_id: UUID,
    history: list[DesktopAiChatMessage],
    user_text: str,
    defaults: dict[str, Any],
    enriched_user_content: str | None,
    rag_context_summary: dict[str, Any] | None,
    forced_ensemble_path: str | None,
    rag_ctx: dict[str, Any],
    routing_mode: str,
    model: str,
    kbsew_dpa_block: str = "",
    speaker_context: dict[str, Any] | None = None,
) -> AsyncGenerator[str]:
    if forced_ensemble_path == "blueprint":
        _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="forced_blueprint")
        async for line in stream_blueprint_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            kbsew_dpa_block=kbsew_dpa_block,
            speaker_context=speaker_context,
        ):
            yield line
        return
    if forced_ensemble_path == "legacy":
        _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="forced_legacy")
        async for line in stream_legacy_freeform_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            speaker_context=speaker_context,
        ):
            yield line
        return

    if routing_mode == ENSEMBLE_ROUTING_CHAT_ONLY:
        _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="routing_chat_only")
        async for line in stream_legacy_freeform_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            speaker_context=speaker_context,
        ):
            yield line
        return

    if routing_mode == ENSEMBLE_ROUTING_BLUEPRINT_ONLY:
        _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="routing_blueprint_only")
        async for line in stream_blueprint_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            kbsew_dpa_block=kbsew_dpa_block,
            speaker_context=speaker_context,
        ):
            yield line
        return

    if resolve_ensemble_engine(chat, defaults) != ENSEMBLE_ENGINE_BLUEPRINT:
        _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="engine_legacy_freeform")
        async for line in stream_legacy_freeform_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            speaker_context=speaker_context,
        ):
            yield line
        return

    if routing_mode == ENSEMBLE_ROUTING_SEMI:
        last_u = last_user_message(history)
        if last_u is not None and doc_confirm_is_expired(last_u, defaults):
            last_u.message_metadata = mark_doc_confirm_expired_metadata(dict(last_u.message_metadata or {}))
            await persist_message_metadata_isolated(
                message_id=last_u.id,
                chat_id=chat.id,
                message_metadata=dict(last_u.message_metadata or {}),
            )
            logger.info(
                "[STEP] desktop_ai_chat ensemble semi confirm expired chat_id=%s user_msg=%s",
                chat.id,
                last_u.id,
            )
            _log_route_metric(
                chat_id=chat.id,
                routing_mode=routing_mode,
                decision="semi_confirm_expired",
            )
        state = resolve_doc_confirm_state(last_u, defaults)

        if state == ENSEMBLE_DOC_CONFIRM_ACCEPTED:
            _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="semi_confirm_accepted")
            async for line in stream_blueprint_turn(
                db_pool,
                chat=chat,
                user_id=user_id,
                history=history,
                user_text=user_text,
                defaults=defaults,
                enriched_user_content=enriched_user_content,
                rag_context_summary=rag_context_summary,
                kbsew_dpa_block=kbsew_dpa_block,
                speaker_context=speaker_context,
            ):
                yield line
            return
        if state == ENSEMBLE_DOC_CONFIRM_DECLINED:
            _log_route_metric(chat_id=chat.id, routing_mode=routing_mode, decision="semi_confirm_declined")
            async for line in stream_legacy_freeform_turn(
                db_pool,
                chat=chat,
                user_id=user_id,
                history=history,
                user_text=user_text,
                defaults=defaults,
                enriched_user_content=enriched_user_content,
                rag_context_summary=rag_context_summary,
                speaker_context=speaker_context,
            ):
                yield line
            return

        would_bp, route_note = await resolve_auto_blueprint_vs_legacy(
            user_text=user_text,
            history=history,
            defaults=defaults,
            model=model,
            use_web_search=bool((speaker_context or {}).get("use_web_search")),
        )
        if not would_bp:
            _log_route_metric(
                chat_id=chat.id,
                routing_mode=routing_mode,
                decision="semi_auto_legacy",
                note=route_note,
            )
            async for line in stream_legacy_freeform_turn(
                db_pool,
                chat=chat,
                user_id=user_id,
                history=history,
                user_text=user_text,
                defaults=defaults,
                enriched_user_content=enriched_user_content,
                rag_context_summary=rag_context_summary,
                speaker_context=speaker_context,
            ):
                yield line
            return

        if state == ENSEMBLE_DOC_CONFIRM_ASKED and last_u is not None:
            logger.info(
                "[STEP] desktop_ai_chat ensemble semi reconfirm chat_id=%s user_msg=%s",
                chat.id,
                last_u.id,
            )
            rmeta = dict(last_u.message_metadata or {})
            rmeta["ensemble_doc_confirm_reason"] = _confirm_reason_text(route_note)
            last_u.message_metadata = rmeta
            await persist_message_metadata_isolated(
                message_id=last_u.id,
                chat_id=chat.id,
                message_metadata=dict(last_u.message_metadata or {}),
            )
            _log_route_metric(
                chat_id=chat.id,
                routing_mode=routing_mode,
                decision="semi_reconfirm",
                note=route_note,
            )
            async for line in _yield_document_confirm_and_done(
                user_message_id=last_u.id,
                reason_human=_confirm_reason_text(route_note),
                route_note=route_note,
                rag_ctx=rag_ctx,
            ):
                yield line
            return

        if last_u is None:
            _log_route_metric(
                chat_id=chat.id,
                routing_mode=routing_mode,
                decision="semi_no_last_user_fallback_legacy",
            )
            async for line in stream_legacy_freeform_turn(
                db_pool,
                chat=chat,
                user_id=user_id,
                history=history,
                user_text=user_text,
                defaults=defaults,
                enriched_user_content=enriched_user_content,
                rag_context_summary=rag_context_summary,
                speaker_context=speaker_context,
            ):
                yield line
            return

        meta = stamp_doc_confirm_asked(dict(last_u.message_metadata or {}))
        meta["ensemble_doc_confirm_reason"] = _confirm_reason_text(route_note)
        last_u.message_metadata = meta
        await persist_message_metadata_isolated(
            message_id=last_u.id,
            chat_id=chat.id,
            message_metadata=dict(last_u.message_metadata or {}),
        )
        logger.info(
            "[STEP] desktop_ai_chat ensemble semi asked confirm chat_id=%s user_msg=%s",
            chat.id,
            last_u.id,
        )
        _log_route_metric(
            chat_id=chat.id,
            routing_mode=routing_mode,
            decision="semi_asked_confirm",
            note=route_note,
        )
        async for line in _yield_document_confirm_and_done(
            user_message_id=last_u.id,
            reason_human=_confirm_reason_text(route_note),
            route_note=route_note,
            rag_ctx=rag_ctx,
        ):
            yield line
        return

    use_blueprint, route_note = await resolve_auto_blueprint_vs_legacy(
        user_text=user_text,
        history=history,
        defaults=defaults,
        model=model,
        use_web_search=bool((speaker_context or {}).get("use_web_search")),
    )

    if use_blueprint:
        _log_route_metric(
            chat_id=chat.id,
            routing_mode=routing_mode,
            decision="auto_blueprint",
            note=route_note,
        )
        async for line in stream_blueprint_turn(
            db_pool,
            chat=chat,
            user_id=user_id,
            history=history,
            user_text=user_text,
            defaults=defaults,
            enriched_user_content=enriched_user_content,
            rag_context_summary=rag_context_summary,
            kbsew_dpa_block=kbsew_dpa_block,
            speaker_context=speaker_context,
        ):
            yield line
        return

    _log_route_metric(
        chat_id=chat.id,
        routing_mode=routing_mode,
        decision="auto_legacy",
        note=route_note,
    )
    async for line in stream_legacy_freeform_turn(
        db_pool,
        chat=chat,
        user_id=user_id,
        history=history,
        user_text=user_text,
        defaults=defaults,
        enriched_user_content=enriched_user_content,
        rag_context_summary=rag_context_summary,
        speaker_context=speaker_context,
    ):
        yield line

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop AI Chat SSE stream orchestration (prep session + turn body).
# Invariants:
# - Stream Wave A: short prep session then LLM/SSE without request-scoped ORM; writes via isolated sessions.
# - `chat.updated_at` is refreshed with `utc_now_naive()` on successful turn mutations.
# - Project vault usage always passes access checks before retrieval.
# Related:
# - api/routers/desktop_ai_chat.py
# - api/services/desktop_chat/db_session.py
# - api/services/desktop_chat_ensemble/stream_turn.py
# ---
"""Orchestration: history, RAG blocks, Llama stream or tool-loop, persist messages."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import suppress
from typing import Any, Literal
from uuid import UUID

import asyncpg  # type: ignore[import-untyped]
from sqlalchemy import delete, select

from api.models.desktop_ai_chat import DesktopAiChat, DesktopAiChatMessage
from api.services.desktop_chat.collaboration_access import load_chat_for_user
from api.services.desktop_chat.collaboration_authors import (
    SHARED_CHAT_SPEAKER_NUDGE,
    format_user_turn_for_llm,
)
from api.services.desktop_chat.context_evidence import (
    merge_public_context_sources,
    web_context_sources,
)
from api.services.desktop_chat.kbsew_search_settings import merge_kbsew_defaults_for_chat
from api.services.desktop_chat.prompt_compose import compose_desktop_system_prompt_with_meta
from api.services.desktop_chat.sidecar.tool_router import desktop_tool_router_enabled, desktop_tool_router_mode
from api.services.desktop_chat.sidecar.tool_router_dispatch import maybe_run_desktop_tool_router_turn
from api.services.desktop_chat.tools import web_search_tool as desktop_web_search_tool
from api.services.desktop_chat.tools.registry import (
    build_llama_tools,
)
from api.services.desktop_chat.ux.expert_reply_contract import expert_reply_contract_enabled
from api.services.desktop_chat.ux.reply_extract import extract_visible_solo_reply
from api.services.desktop_chat.web_search_sources import (
    WEB_SEARCH_ENRICHED_NUDGE,
    web_search_sources_from_tool_trace,
)
from api.services.kbsew.kbsew_orchestration import (
    build_kbsew_dpa_system_block,
    detect_kbsew_agent_surface,
    load_kbsew_orchestration_context,
)
from api.services.kbsew.kbsew_trace import get_kbsew_trace_id, kbsew_trace_scope, new_kbsew_trace_id
from api.services.llama_service import LlamaService
from api.services.llm_runtime.turn_contract import TurnPhaseTracker

logger = logging.getLogger(__name__)

from api.services.desktop_chat.service_helpers import (
    MAX_HISTORY_MESSAGES,
    _append_image_markdown_from_tool_trace,
    _chat_hero_id,
    _history_tail_for_router,
    _maybe_temporal_short_circuit_reply,
    _post_router_tool_followup_nudge,
    _router_executed_tool_name,
    _router_executed_tool_preview,
    _stream_desktop_chat_llm_tokens,
    _yield_token_chunks,
    load_speaker_context,
    record_desktop_chat_turn_memory,
    resolve_desktop_chat_model,
    verify_project_for_chat,
)
from api.services.desktop_chat.service_persist import (
    messages_for_llama,
    persist_assistant_message_isolated,
    persist_user_message_isolated,
)
from api.services.desktop_chat.service_rag import build_rag_prefix
from api.services.desktop_chat.service_tool_loop import run_tool_loop


async def stream_chat_turn(
    db_pool: asyncpg.Pool,
    *,
    chat_id: UUID,
    user_id: UUID,
    user_text: str,
    defaults: dict[str, Any],
    use_tools_flag: bool,
    use_web_search: bool = False,
    regenerate: bool = False,
    ensemble_skip_user_persist: bool = False,
    ensemble_forced_path: Literal["blueprint", "legacy"] | None = None,
) -> AsyncGenerator[str]:
    """Yields SSE lines (data: {...}\\n\\n or : keep-alive).

    Wave A: short prep session (load/regenerate) then stream without request-scoped ORM.
    """
    from api.services.desktop_chat.db_session import desktop_ai_chat_session

    if not defaults.get("feature_enabled", True):
        yield f"data: {json.dumps({'error': 'desktop_ai_chat_disabled'})}\n\n"
        return

    async with desktop_ai_chat_session() as db:
        chat = await load_chat_for_user(db, chat_id, user_id)
        if chat is None:
            yield f"data: {json.dumps({'event': 'error', 'message': 'chat_not_found'})}\n\n"
            return

        await verify_project_for_chat(
            db_pool,
            project_id=chat.project_id,
            user_id=chat.user_id,
            use_project_rag=bool(chat.use_project_rag),
        )

        chat_settings = chat.settings if isinstance(chat.settings, dict) else {}
        defaults = merge_kbsew_defaults_for_chat(defaults, chat_settings)

        hist_r = await db.execute(
            select(DesktopAiChatMessage)
            .where(DesktopAiChatMessage.chat_id == chat.id)
            .order_by(DesktopAiChatMessage.created_at.asc())
        )
        history = list(hist_r.scalars().all())

        if regenerate:
            if not history or history[-1].role != "assistant":
                yield f"data: {json.dumps({'event': 'error', 'message': 'nothing_to_regenerate'})}\n\n"
                return
            from api.services.desktop_chat_ensemble.settings import is_ensemble_chat as _is_ens

            if _is_ens(chat):
                while history and history[-1].role == "assistant":
                    await db.execute(delete(DesktopAiChatMessage).where(DesktopAiChatMessage.id == history[-1].id))
                    await db.commit()
                    hist_r = await db.execute(
                        select(DesktopAiChatMessage)
                        .where(DesktopAiChatMessage.chat_id == chat.id)
                        .order_by(DesktopAiChatMessage.created_at.asc())
                    )
                    history = list(hist_r.scalars().all())
            else:
                last_asst_id = history[-1].id
                await db.execute(delete(DesktopAiChatMessage).where(DesktopAiChatMessage.id == last_asst_id))
                await db.commit()
                hist_r = await db.execute(
                    select(DesktopAiChatMessage)
                    .where(DesktopAiChatMessage.chat_id == chat.id)
                    .order_by(DesktopAiChatMessage.created_at.asc())
                )
                history = list(hist_r.scalars().all())
            if not history or history[-1].role != "user":
                yield f"data: {json.dumps({'event': 'error', 'message': 'regenerate_history_mismatch'})}\n\n"
                return
            effective_user_text = (history[-1].content or "").strip()
        else:
            effective_user_text = user_text.strip()

        if not effective_user_text:
            yield f"data: {json.dumps({'event': 'error', 'message': 'empty_message'})}\n\n"
            return

        speaker_context = await load_speaker_context(
            db,
            chat=chat,
            history=history,
            actor_user_id=user_id,
        )

        # Detach ORM rows so the prep session can close before LLM/SSE awaits.
        for row in history:
            db.expunge(row)
        db.expunge(chat)

    # Prep session closed — stream phase must not rely on request-scoped Depends(db).
    kbsew_agent_surface = detect_kbsew_agent_surface(chat_settings)
    trace_id = f"{chat.id}:{new_kbsew_trace_id()}"
    with kbsew_trace_scope(trace_id):
        async for line in _stream_chat_turn_body(
            db_pool=db_pool,
            chat=chat,
            user_id=user_id,
            user_uuid=user_id,
            user_text=user_text,
            defaults=defaults,
            chat_settings=chat_settings,
            use_tools_flag=use_tools_flag,
            use_web_search=use_web_search,
            regenerate=regenerate,
            ensemble_skip_user_persist=ensemble_skip_user_persist,
            ensemble_forced_path=ensemble_forced_path,
            history=history,
            effective_user_text=effective_user_text,
            kbsew_agent_surface=kbsew_agent_surface,
            speaker_context=speaker_context,
        ):
            yield line


async def _stream_chat_turn_body(
    *,
    db_pool: asyncpg.Pool,
    chat: DesktopAiChat,
    user_id: UUID,
    user_uuid: UUID,
    user_text: str,
    defaults: dict[str, Any],
    chat_settings: dict[str, Any],
    use_tools_flag: bool,
    use_web_search: bool,
    regenerate: bool,
    ensemble_skip_user_persist: bool,
    ensemble_forced_path: Literal["blueprint", "legacy"] | None,
    history: list[DesktopAiChatMessage],
    effective_user_text: str,
    kbsew_agent_surface: str,
    speaker_context: dict[str, Any] | None = None,
) -> AsyncGenerator[str]:
    speaker_context = speaker_context or {}
    is_shared = bool(speaker_context.get("is_shared"))
    speaker_labels: dict[UUID, str] = speaker_context.get("labels") or {}
    actor_label = speaker_context.get("actor_label")
    actor_display_name = speaker_context.get("actor_display_name")
    actor_is_owner = bool(speaker_context.get("actor_is_owner"))
    # Phase 3: route → retrieve → act* → answer → persist (deep optional / Phase 4).
    turn_phases = TurnPhaseTracker(surface="desktop_ai_chat")
    turn_phases.mark("route")
    prompt_user_text = format_user_turn_for_llm(
        effective_user_text,
        is_shared=is_shared,
        speaker_label=actor_label if isinstance(actor_label, str) else None,
    )
    # Always stamp DB author (GAF-style); shared flag only enriches display meta for LLM.
    persist_author_kwargs: dict[str, Any] = {
        "author_user_id": user_uuid,
        "author_display_name": (actor_display_name if isinstance(actor_display_name, str) else None),
        "author_is_owner": bool(actor_is_owner) or user_uuid == chat.user_id,
    }
    logger.info(
        "[STEP] desktop_ai_chat collab_tool_quota actor=%s owner=%s chat=%s is_shared=%s",
        user_uuid,
        chat.user_id,
        chat.id,
        is_shared,
    )

    kss, kbsew_registry = await load_kbsew_orchestration_context(
        defaults=defaults,
        agent_id=kbsew_agent_surface,
        chat_settings=chat_settings,
    )
    kbsew_dpa_block = build_kbsew_dpa_system_block(
        agent_id=kbsew_agent_surface,
        barrels=kbsew_registry,
        settings=kss,
    )

    from api.services.desktop_chat_ensemble.settings import is_ensemble_chat as _is_ensemble

    if _is_ensemble(chat):
        web_search_allowed = bool(use_web_search) and bool(defaults.get("tools_web_search_enabled", False))
        enriched, rag_context_summary = await build_rag_prefix(
            db_pool=db_pool,
            user_id=user_uuid,
            chat_id=chat.id,
            project_id=chat.project_id,
            use_project_rag=bool(chat.use_project_rag),
            history=history,
            user_text=effective_user_text,
            defaults=defaults,
            chat_settings=chat_settings,
            owner_user_id=chat.user_id,
            user_text_for_prompt=prompt_user_text,
            speaker_context=speaker_context,
            memory_cell_id=getattr(chat, "memory_cell_id", None),
        )
        turn_phases.mark("retrieve")
        ensemble_tool_trace: list[dict[str, Any]] = []
        if web_search_allowed:
            from api.services.desktop_chat.db_session import desktop_ai_chat_session
            from api.services.desktop_chat.tools.web_search_tool import run_web_search_with_sources
            from api.services.desktop_chat.web_search_sources import format_web_search_block_for_user_prompt

            recent_for_search = [{"role": m.role, "content": m.content or ""} for m in history[-MAX_HISTORY_MESSAGES:]]
            async with desktop_ai_chat_session() as search_db:
                block, sources = await run_web_search_with_sources(
                    search_db,
                    user_id=user_uuid,
                    query=effective_user_text,
                    enabled=True,
                    recent_messages=recent_for_search,
                )
            if sources:
                rag_context_summary = dict(rag_context_summary)
                rag_context_summary["web_search_sources"] = sources
                rag_context_summary["web_search_used"] = True
                rag_context_summary = merge_public_context_sources(
                    rag_context_summary,
                    web_context_sources(sources),
                )
            if block.strip() and sources:
                section = format_web_search_block_for_user_prompt(block)
                if section:
                    enriched = (
                        f"{enriched}\n\n{section}\n\n{WEB_SEARCH_ENRICHED_NUDGE}"
                        if enriched
                        else (f"{section}\n\n{WEB_SEARCH_ENRICHED_NUDGE}")
                    )
            ensemble_tool_trace.append(
                {
                    "name": desktop_web_search_tool.TOOL_NAME,
                    "ok": bool(sources),
                    "preview": block[:400],
                    "router": False,
                    "ensemble_prefetch": True,
                }
            )
            yield f"data: {json.dumps({'event': 'tools', 'trace': ensemble_tool_trace}, ensure_ascii=False)}\n\n"
            turn_phases.mark("act")
        if not regenerate and not ensemble_skip_user_persist:
            await persist_user_message_isolated(chat.id, effective_user_text, **persist_author_kwargs)
        from api.services.desktop_chat.db_session import desktop_ai_chat_session
        from api.services.desktop_chat_ensemble.stream_turn import stream_ensemble_turn

        turn_phases.assert_ready_for_answer()
        turn_phases.mark("answer")
        async with desktop_ai_chat_session() as hist_db:
            hist_r2 = await hist_db.execute(
                select(DesktopAiChatMessage)
                .where(DesktopAiChatMessage.chat_id == chat.id)
                .order_by(DesktopAiChatMessage.created_at.asc())
            )
            history_after = list(hist_r2.scalars().all())
            for row in history_after:
                hist_db.expunge(row)

        async for line in stream_ensemble_turn(
            db_pool,
            chat=chat,
            user_id=user_uuid,
            history=history_after,
            user_text=effective_user_text,
            defaults=defaults,
            enriched_user_content=enriched,
            rag_context_summary=rag_context_summary,
            forced_ensemble_path=ensemble_forced_path,
            kbsew_dpa_block=kbsew_dpa_block,
            speaker_context={
                **(speaker_context or {}),
                "use_web_search": web_search_allowed,
            },
        ):
            yield line
        turn_phases.mark("persist")
        return

    enriched, rag_context_summary = await build_rag_prefix(
        db_pool=db_pool,
        user_id=user_uuid,
        chat_id=chat.id,
        project_id=chat.project_id,
        use_project_rag=bool(chat.use_project_rag),
        history=history,
        user_text=effective_user_text,
        defaults=defaults,
        chat_settings=chat_settings,
        owner_user_id=chat.user_id,
        user_text_for_prompt=prompt_user_text,
        speaker_context=speaker_context,
        memory_cell_id=getattr(chat, "memory_cell_id", None),
    )
    turn_phases.mark("retrieve")

    temporal_reply = _maybe_temporal_short_circuit_reply(
        user_text=effective_user_text,
        history=history,
    )
    if temporal_reply:
        stream_t0 = time.monotonic()
        if not regenerate:
            await persist_user_message_isolated(chat.id, effective_user_text, **persist_author_kwargs)

        turn_phases.assert_ready_for_answer()
        turn_phases.mark("answer")
        yield f"data: {json.dumps({'event': 'token', 'delta': temporal_reply}, ensure_ascii=False)}\n\n"

        temporal_metadata: dict[str, Any] = {
            "desktop_prompt_mode": "solo",
            "desktop_prompt_source": "temporal_short_circuit",
            "desktop_temporal_short_circuit": True,
        }
        asst_temporal = await persist_assistant_message_isolated(
            chat.id,
            temporal_reply,
            message_metadata=temporal_metadata,
        )
        await record_desktop_chat_turn_memory(
            chat_id=chat.id,
            user_text=effective_user_text,
            assistant_text=temporal_reply,
            assistant_message_id=asst_temporal.id if asst_temporal is not None else None,
        )
        turn_phases.mark("persist")

        duration_ms = int((time.monotonic() - stream_t0) * 1000)
        logger.info(
            "[STEP] desktop_ai_chat stream_done chat_id=%s user_id=%s duration_ms=%s "
            "use_tools=%s use_project_rag=%s chat_rag_chunks=%s project_vault_chunks=%s",
            chat.id,
            user_uuid,
            duration_ms,
            bool(use_tools_flag),
            bool(chat.use_project_rag),
            rag_context_summary.get("chat_rag_chunks"),
            rag_context_summary.get("project_vault_chunks"),
        )
        from api.monitoring.metrics import observe_desktop_ai_chat_stream

        observe_desktop_ai_chat_stream(outcome="ok", duration_ms=duration_ms)
        temporal_done_payload: dict[str, Any] = {
            "event": "done",
            "context": rag_context_summary,
            "duration_ms": duration_ms,
            "prompt": temporal_metadata,
        }
        yield f"data: {json.dumps(temporal_done_payload, ensure_ascii=False)}\n\n"
        return

    hero_id = _chat_hero_id(chat)
    structured_reply = expert_reply_contract_enabled(defaults)
    post_tool_prompt = False
    system_prompt, prompt_meta = compose_desktop_system_prompt_with_meta(
        hero_id=hero_id,
        mode="solo",
        defaults=defaults,
        use_tools=use_tools_flag,
        chat_override=chat.system_prompt_override,
        structured_reply=structured_reply,
        post_tool=post_tool_prompt,
        kbsew_dpa_block=kbsew_dpa_block,
    )
    if is_shared:
        system_prompt = f"{system_prompt}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
    prompt_meta["kbsew_agent_surface"] = kbsew_agent_surface
    prompt_meta["kbsew_trace_id"] = get_kbsew_trace_id()
    llama_messages = messages_for_llama(
        system_prompt=str(system_prompt),
        history=history,
        user_content=enriched,
        is_shared=is_shared,
        owner_id=chat.user_id,
        speaker_labels=speaker_labels,
    )
    assistant_message_metadata: dict[str, Any] | None = dict(prompt_meta)

    model = resolve_desktop_chat_model(chat, defaults)

    tools = []
    web_search_allowed = bool(use_web_search) and bool(defaults.get("tools_web_search_enabled", False))
    if use_tools_flag:
        tools = build_llama_tools(
            image=bool(defaults.get("tools_image_enabled", True)),
            web_search=web_search_allowed,
            fetch_url=bool(defaults.get("tools_fetch_url_enabled", True)),
            kbsew_search_settings=kss.model_dump(),
            kbsew_agent=kbsew_agent_surface,
            defaults=defaults,
        )

    router_trace: list[dict[str, Any]] = []
    tool_loop_trace: list[dict[str, Any]] = []
    router_executed_tool = False
    extra_msgs: list[dict[str, Any]] = []
    use_router_path = use_tools_flag and desktop_tool_router_enabled(defaults)
    router_mode = desktop_tool_router_mode(defaults) if use_router_path else ""

    if not regenerate:
        await persist_user_message_isolated(chat.id, effective_user_text, **persist_author_kwargs)

    llama = LlamaService()
    full_text: list[str] = []
    last_beat = asyncio.get_event_loop().time()
    last_beat_ref = [last_beat]
    n_chunks_ref = [0]
    stream_t0 = time.monotonic()

    try:
        if use_router_path:
            progress_queue: asyncio.Queue[dict[str, Any]] | None = asyncio.Queue() if router_mode != "shadow" else None
            _plan, router_trace, extra_msgs = await maybe_run_desktop_tool_router_turn(
                db_pool=db_pool,
                defaults=defaults,
                user_excerpt=effective_user_text,
                history_tail=_history_tail_for_router(history),
                user_id=user_uuid,
                company_id=chat.company_id,
                project_id=chat.project_id,
                desktop_chat_id=chat.id,
                web_search_allowed=web_search_allowed,
                tool_progress_queue=progress_queue,
                kbsew_agent=kbsew_agent_surface,
                kbsew_registry=kbsew_registry,
            )
            router_executed_tool = router_mode != "shadow" and bool(extra_msgs)
            if progress_queue is not None:
                while True:
                    try:
                        prog_item = progress_queue.get_nowait()
                        yield f"data: {json.dumps(prog_item, ensure_ascii=False)}\n\n"
                    except asyncio.QueueEmpty:
                        break
            if router_trace:
                yield f"data: {json.dumps({'event': 'tools', 'trace': router_trace}, ensure_ascii=False)}\n\n"
            if router_mode != "shadow" and extra_msgs:
                llama_messages.extend(extra_msgs)
                executed_tool = _router_executed_tool_name(router_trace)
                executed_preview = _router_executed_tool_preview(router_trace)
                if executed_tool:
                    llama_messages.append(
                        {
                            "role": "user",
                            "content": _post_router_tool_followup_nudge(
                                tool_name=executed_tool,
                                tool_preview=executed_preview,
                            ),
                        }
                    )
                post_tool_prompt = True
                system_prompt, prompt_meta = compose_desktop_system_prompt_with_meta(
                    hero_id=hero_id,
                    mode="solo",
                    defaults=defaults,
                    use_tools=use_tools_flag,
                    chat_override=chat.system_prompt_override,
                    structured_reply=structured_reply,
                    post_tool=True,
                    kbsew_dpa_block=kbsew_dpa_block,
                )
                if is_shared:
                    system_prompt = f"{system_prompt}\n\n{SHARED_CHAT_SPEAKER_NUDGE}"
                llama_messages[0] = {"role": "system", "content": str(system_prompt)}
                assistant_message_metadata = dict(prompt_meta)
                turn_phases.mark("act")

        turn_phases.assert_ready_for_answer()
        turn_phases.mark("answer")
        async with llama:
            run_llama_tool_loop = tools and (
                not use_router_path or router_mode == "shadow" or (web_search_allowed and not router_executed_tool)
            )
            if run_llama_tool_loop:
                progress_queue = asyncio.Queue()
                tool_task = asyncio.create_task(
                    run_tool_loop(
                        db_pool=db_pool,
                        llama=llama,
                        messages=llama_messages,
                        model=model,
                        tools=tools,
                        user_id=user_uuid,
                        company_id=chat.company_id,
                        project_id=chat.project_id,
                        defaults=defaults,
                        web_search_allowed=web_search_allowed,
                        desktop_chat_id=chat.id,
                        tool_progress_queue=progress_queue,
                        kbsew_agent=kbsew_agent_surface,
                        kbsew_registry=kbsew_registry,
                    )
                )
                try:
                    while True:
                        try:
                            async with asyncio.timeout(0.28):
                                prog_item = await progress_queue.get()
                            yield f"data: {json.dumps(prog_item, ensure_ascii=False)}\n\n"
                        except TimeoutError:
                            if tool_task.done():
                                break
                    while True:
                        try:
                            prog_item = progress_queue.get_nowait()
                            yield f"data: {json.dumps(prog_item, ensure_ascii=False)}\n\n"
                        except asyncio.QueueEmpty:
                            break
                    final, trace = await tool_task
                    tool_loop_trace = trace
                    if router_trace:
                        trace = [*router_trace, *trace]
                    final = _append_image_markdown_from_tool_trace(final, trace)
                except BaseException:
                    if not tool_task.done():
                        tool_task.cancel()
                        with suppress(BaseException):
                            await tool_task
                    raise
                yield f"data: {json.dumps({'event': 'tools', 'trace': trace}, ensure_ascii=False)}\n\n"
                async for line in _yield_token_chunks(
                    final,
                    full_text=full_text,
                    last_beat_ref=last_beat_ref,
                    n_chunks_ref=n_chunks_ref,
                ):
                    yield line
            else:
                async for line in _stream_desktop_chat_llm_tokens(
                    llama_messages,
                    model=model,
                    defaults=defaults,
                    full_text=full_text,
                    last_beat_ref=last_beat_ref,
                    n_chunks_ref=n_chunks_ref,
                ):
                    yield line
    except asyncio.CancelledError:
        # Partial assistant text on a fresh session — never reuse a cancelled ORM transaction.
        combined_partial = "".join(full_text).strip()
        if combined_partial:
            await persist_assistant_message_isolated(
                chat.id,
                combined_partial,
                message_metadata=assistant_message_metadata,
            )
        raise
    except Exception as e:
        logger.exception("desktop_ai_chat stream failed: %s", e)
        yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    combined = "".join(full_text).strip()
    if combined:
        combined = extract_visible_solo_reply(combined)
    web_search_sources = web_search_sources_from_tool_trace([*router_trace, *tool_loop_trace])
    if web_search_sources:
        rag_context_summary = dict(rag_context_summary)
        rag_context_summary["web_search_sources"] = web_search_sources
        rag_context_summary["web_search_used"] = True
        rag_context_summary = merge_public_context_sources(
            rag_context_summary,
            web_context_sources(web_search_sources),
        )
        meta = dict(assistant_message_metadata or {})
        meta["desktop_web_search_sources"] = web_search_sources
        assistant_message_metadata = meta
    meta = dict(assistant_message_metadata or {})
    meta["context_summary"] = rag_context_summary
    assistant_message_metadata = meta
    if combined:
        asst_msg = await persist_assistant_message_isolated(
            chat.id,
            combined,
            message_metadata=assistant_message_metadata,
        )
        if asst_msg is not None:
            await record_desktop_chat_turn_memory(
                chat_id=chat.id,
                user_text=effective_user_text,
                assistant_text=combined,
                assistant_message_id=asst_msg.id,
            )
    turn_phases.mark("persist")
    duration_ms = int((time.monotonic() - stream_t0) * 1000)
    logger.info(
        "[STEP] desktop_ai_chat stream_done chat_id=%s user_id=%s duration_ms=%s "
        "use_tools=%s use_project_rag=%s chat_rag_chunks=%s project_vault_chunks=%s",
        chat.id,
        user_uuid,
        duration_ms,
        bool(use_tools_flag),
        bool(chat.use_project_rag),
        rag_context_summary.get("chat_rag_chunks"),
        rag_context_summary.get("project_vault_chunks"),
    )
    from api.monitoring.metrics import observe_desktop_ai_chat_stream

    observe_desktop_ai_chat_stream(outcome="ok", duration_ms=duration_ms)
    done_payload: dict[str, Any] = {
        "event": "done",
        "context": rag_context_summary,
        "duration_ms": duration_ms,
    }
    if web_search_sources:
        done_payload["web_search_sources"] = web_search_sources
    if assistant_message_metadata:
        done_payload["prompt"] = assistant_message_metadata
    yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# File catalog tools: ``file_*``, ``doc_insert``, ``catalog_discuss``.
# Invariants:
# - Handler module for EWA companion tool registry; behavior matches pre-split ``tool_registry.py``.
# - Auto-accept create uses ``_resolve_main_pool`` (application ``unified_content`` DB), never EWA companion_pool alone.
# - ``file_rewrite`` persists via server-first → ``replace_file_content`` (previous body snapshotted to ``content_versions``).
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/storage/catalog_pipeline.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---
"""EWA companion tool registry handlers — files."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _resolve_main_pool,
    _tool_router_bypass_line_match,
)
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolHandler,
    ToolResult,
)

logger = logging.getLogger(__name__)


def _resolve_task_folder_label(
    args: Mapping[str, Any],
    *,
    user_line: str,
    name: str,
) -> str:
    """Short folder seed: explicit folder_label / node title / filename — never raw long goal.

    Kept for callers that still need a display seed when an explicit folder target exists.
    """

    from api.utils.ewa_task_folder import derive_ewa_task_folder_short_title

    explicit = str(args.get("folder_label") or args.get("folder_name") or args.get("node_title") or "").strip()
    seed = explicit or str(name or "").strip() or str(user_line or "").strip()
    return derive_ewa_task_folder_short_title(seed, fallback="Task")


async def _resolve_create_folder_fields(
    *,
    args: Mapping[str, Any],
    user_line: str,
    content_catalog_user_id: str,
    name: str,
) -> tuple[str | None, str | None, str | None]:
    """Return ``(task_key, folder_label, folder_item_id)`` — default all None → EwaFile root."""

    from api.ewa_platform.companion.orchestration.companion_folder_intent import (
        resolve_companion_folder_target,
    )

    target = await resolve_companion_folder_target(
        user_line=user_line,
        args=args,
        content_user_id=content_catalog_user_id,
    )
    if target.mode == "root":
        return None, None, None
    label = (target.folder_label or "").strip() or None
    if not label and target.task_key:
        label = _resolve_task_folder_label(args, user_line=user_line, name=name)
    return (
        (target.task_key or None),
        label,
        (target.folder_item_id or None),
    )


async def _handle_file_rewrite(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Full storage rewrite of a named user file — wraps ``server_first.v2.maybe_handle_server_first_v2_turn``.

    Optimistic locking (AIP Phase 1): ``server_first/v2`` reads ``unified_content.version`` before LLM
    and passes ``expected_version`` into ``ContentStorageService.replace_file_content``.

    Returns ``None`` when the user line does not match a full-replace / named-file intent (caller falls through to the
    next branch) or when ``content_catalog_user_id`` is missing.

    Pool acquisition is **gated** on the regex intent pre-check (``companion_user_intent_server_first_v2_full_replace``)
    and the env kill-switch (``server_first_v2_env_enabled``) so the orchestrator does not touch the main asyncpg pool
    on chat-only turns. This was important during Phase D.1 — removing the outer ``server_first_v2_enabled`` gate from
    the orchestrator would otherwise force a pool acquire on every turn.
    """

    from api.ewa_platform.companion.server_first.v2 import (
        companion_user_intent_server_first_v2_full_replace,
        maybe_handle_server_first_v2_turn,
        server_first_v2_env_enabled,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    router_bypass = _tool_router_bypass_line_match(args)
    file_query = str(args.get("file_query") or "").strip()
    rewrite_brief = str(args.get("rewrite_brief") or args.get("instruction") or "").strip()
    open_editor = str(args.get("open_editor") or "").strip().lower() in {"1", "true", "yes", "on"}
    if router_bypass and file_query and rewrite_brief:
        ru = any("\u0400" <= ch <= "\u04ff" for ch in f"{file_query} {rewrite_brief}")
        if ru:
            user_line = f"Полностью перепиши файл {file_query}: {rewrite_brief}"
        else:
            user_line = f"Rewrite entire file {file_query}: {rewrite_brief}"
        if open_editor:
            user_line += " и открой в редакторе" if ru else " and open in the document editor"
    if not user_line:
        return None
    if not server_first_v2_env_enabled():
        return None
    if not companion_user_intent_server_first_v2_full_replace(user_line):
        return None
    write_mode = str(args.get("mode") or "replace").strip().lower()
    main_pool = await _resolve_main_pool(ctx)
    result = await maybe_handle_server_first_v2_turn(
        main_pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
        content_catalog_user_id=uid,
        oauth2_sub_for_content_alternate=ctx.oauth2_sub_for_content_alternate,
        write_mode=write_mode,
    )
    if result is None:
        return None
    return ToolResult(
        tool="file_rewrite",
        status="ok",
        reply=str(result.get("reply") or ""),
        actions=list(result.get("actions") or []),
        data={},
        task_run=result.get("task_run"),
    )


async def _handle_catalog_discuss(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Inject catalogue file body into the main LLM memory section — defers reply to the chat model."""

    from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
    from api.ewa_platform.companion.storage.catalog_file_discuss import (
        augment_memory_section_with_catalog_file_discuss,
        augment_memory_section_with_file_focus_discuss,
        build_catalog_memory_block_for_unified_content,
        catalog_file_discuss_env_enabled,
        user_intent_catalog_file_discuss,
        user_intent_catalog_file_discuss_deictic,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    if not catalog_file_discuss_env_enabled():
        return None

    router_bypass = _tool_router_bypass_line_match(args)
    file_query = str(args.get("file_query") or "").strip()
    unified_content_id = str(args.get("unified_content_id") or "").strip()
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()

    if router_bypass and (file_query or unified_content_id):
        if not user_line:
            user_line = (
                f"прочитать файл {file_query or unified_content_id}" if file_query or unified_content_id else ""
            ).strip()
        if not user_line:
            return None
        main_pool = await _resolve_main_pool(ctx)
        if unified_content_id and not file_query:
            file_label = file_query or unified_content_id
            block = await build_catalog_memory_block_for_unified_content(
                main_pool,
                principal_id=ctx.principal_id,
                content_catalog_user_id=uid,
                unified_content_id=unified_content_id,
                file_label=file_label,
                user_line=user_line,
            )
            if not block or not str(block).strip():
                return None
            discuss_result = (str(block).strip(), unified_content_id, file_label)
        else:
            from api.ewa_platform.companion.orchestration.flows.catalog_resolve import (
                query_service_or_none,
                resolve_file_target,
            )

            query_svc = await query_service_or_none()
            if query_svc is None:
                return None
            resolved = await resolve_file_target(
                query_svc,
                content_user_id=uid,
                oauth2_sub=(ctx.oauth2_sub_for_content_alternate or "").strip() or None,
                phrase=file_query,
                unified_content_id=unified_content_id or None,
                profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
            )
            if resolved is None:
                return None
            uc_str = str(resolved.unified_content_id or "").strip()
            file_label = str(resolved.label or file_query).strip() or file_query
            block = await build_catalog_memory_block_for_unified_content(
                main_pool,
                principal_id=ctx.principal_id,
                content_catalog_user_id=uid,
                unified_content_id=uc_str,
                file_label=file_label,
                user_line=user_line,
            )
            if not block or not str(block).strip():
                return None
            discuss_result = (str(block).strip(), uc_str, file_label)
    else:
        if not user_line:
            return None
        named = user_intent_catalog_file_discuss(user_line)
        deictic = user_intent_catalog_file_discuss_deictic(user_line, ctx.profile)
        if not named and not deictic:
            return None

        main_pool = await _resolve_main_pool(ctx)
        try:
            discuss_result = None
            if named:
                discuss_result = await augment_memory_section_with_catalog_file_discuss(
                    main_pool,
                    principal_id=ctx.principal_id,
                    user_line=user_line,
                    content_catalog_user_id=uid,
                    oauth2_sub_for_content_alternate=ctx.oauth2_sub_for_content_alternate,
                )
            elif deictic:
                discuss_result = await augment_memory_section_with_file_focus_discuss(
                    main_pool,
                    principal_id=ctx.principal_id,
                    user_line=user_line,
                    content_catalog_user_id=uid,
                    profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_catalog_discuss_handler_failed principal=%s err=%s",
                ctx.principal_id,
                exc,
            )
            companion_degrade_debug(
                logger,
                "catalog_discuss_registry",
                "handler_exception",
                principal_id=ctx.principal_id,
                exc=exc,
            )
            return None

    if discuss_result is None:
        companion_degrade_debug(
            logger,
            "catalog_discuss_registry",
            "augment_returned_none",
            principal_id=ctx.principal_id,
        )
        return None
    block, uc_str, file_label = discuss_result
    block = block.strip()
    if not block:
        companion_degrade_debug(
            logger,
            "catalog_discuss_registry",
            "memory_block_empty",
            principal_id=ctx.principal_id,
            unified_content_id=uc_str,
        )
        return None

    companion_pool = ctx.companion_pool
    if companion_pool is not None:
        try:
            from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

            await companion_pg.companion_record_file_focus(
                companion_pool,
                principal_id=ctx.principal_id,
                unified_content_id=uc_str,
                name=file_label,
                source="catalog_discuss",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_file_focus_discuss_persist_failed principal=%s err=%s",
                ctx.principal_id,
                exc,
            )
            companion_degrade_debug(
                logger,
                "catalog_discuss_registry",
                "file_focus_persist_failed",
                principal_id=ctx.principal_id,
                unified_content_id=uc_str,
                exc=exc,
            )

    return ToolResult(
        tool="catalog_discuss",
        status="memory_append",
        reply="",
        actions=[],
        data={
            "memory_section_append": block,
            "orchestration_branch": "catalog_discuss",
            "unified_content_id": uc_str,
            "file_label": file_label,
        },
        task_run=None,
    )


def _flow_inner_to_tool_result(
    *,
    tool: str,
    branch: str,
    inner: Mapping[str, Any],
) -> ToolResult:
    """Map orchestrator-shaped flow dict to ``ToolResult`` (confirm vs informational reply)."""

    if inner.get("needs_open_editor"):
        return ToolResult(
            tool=tool,
            status="needs_open_editor",
            reply=str(inner.get("reply") or ""),
            actions=list(inner.get("actions") or []),
            data={"orchestration_branch": branch},
            task_run=None,
        )
    reply = str(inner.get("reply") or "")
    task_run = inner.get("task_run")
    data: dict[str, Any] = {"orchestration_branch": branch}
    inner_data = inner.get("data")
    if isinstance(inner_data, Mapping):
        for key, val in inner_data.items():
            if key != "orchestration_branch":
                data[key] = val
    output_surface = inner.get("output_surface")
    output_surface_payload = output_surface if isinstance(output_surface, dict) else None
    if task_run is not None:
        return ToolResult(
            tool=tool,
            status="needs_confirm",
            reply=reply,
            actions=list(inner.get("actions") or []),
            **({"output_surface": output_surface_payload} if output_surface_payload else {}),
            data=data,
            task_run=task_run,
        )
    return ToolResult(
        tool=tool,
        status="ok",
        reply=reply,
        actions=list(inner.get("actions") or []),
        **({"output_surface": output_surface_payload} if output_surface_payload else {}),
        data=data,
        task_run=None,
    )


async def _auto_create_document_result(
    *,
    tool: str,
    branch: str,
    args: Mapping[str, Any],
    ctx: ToolContext,
    user_line: str,
    name: str,
    body: str,
    task_key: str | None,
    folder_label: str | None,
    folder_item_id: str | None = None,
) -> ToolResult | None:
    """Create catalog document immediately when agentic auto-accept is on (no HITL gate)."""

    from api.ewa_platform.agentic.auto_accept_hitl import args_request_auto_accept
    from api.ewa_platform.companion.orchestration.task_orchestrator import _friendly_create_done_reply
    from api.ewa_platform.companion.storage.catalog_pipeline import (
        create_unified_companion_document,
        make_content_storage_service,
    )

    if not args_request_auto_accept(args):
        return None

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    # Must use application DATABASE_URL pool (unified_content). Agentic ToolContext
    # often has only companion_pool (EWA PG) — never fall back to that for catalog writes.
    try:
        pool = await _resolve_main_pool(ctx)
    except Exception as exc:  # noqa: BLE001 — surface as tool error, do not open HITL
        logger.warning("[STEP] companion_auto_create_pool_failed tool=%s err=%s", tool, exc)
        return ToolResult(
            tool=tool,
            status="error",
            reply="Не смогла создать файл: хранилище сейчас недоступно.",
            actions=[],
            data={"orchestration_branch": branch, "auto_accept": True},
            task_run=None,
        )
    if pool is None:
        return ToolResult(
            tool=tool,
            status="error",
            reply="Не смогла создать файл: хранилище сейчас недоступно.",
            actions=[],
            data={"orchestration_branch": branch, "auto_accept": True},
            task_run=None,
        )
    try:
        storage = make_content_storage_service(pool)
        row = await create_unified_companion_document(
            storage,
            content_user_id=uid,
            name=name,
            body=body,
            task_key=task_key,
            folder_label=folder_label,
            folder_item_id=folder_item_id,
        )
    except Exception as exc:  # noqa: BLE001 — surface as tool error, do not open HITL
        logger.warning("[STEP] companion_auto_create_failed tool=%s err=%s", tool, exc)
        from api.ewa_platform.companion.storage.catalog_pipeline import reply_unified_content_schema_missing

        msg = str(exc)
        if "unified_content" in msg and "does not exist" in msg:
            reply = reply_unified_content_schema_missing(ru=True)
        else:
            reply = f"Не смогла создать файл: {msg[:180]}"
        return ToolResult(
            tool=tool,
            status="error",
            reply=reply,
            actions=[],
            data={"orchestration_branch": branch, "auto_accept": True},
            task_run=None,
        )
    created_id = str(getattr(row, "id", "") or "").strip()
    logger.info(
        "[STEP] companion_auto_create_ok tool=%s content_id=%s task_key=%s folder_item_id=%s",
        tool,
        created_id[:36],
        (task_key or "")[:36],
        (folder_item_id or "")[:48],
    )
    actions: list[dict[str, Any]] = []
    if created_id:
        actions.append(
            {
                "type": "open_app",
                "app_component": "DocEditor",
                "unified_content_id": created_id,
                "companion_surface_only": True,
            }
        )
    return ToolResult(
        tool=tool,
        status="ok",
        reply=_friendly_create_done_reply(user_line, name),
        actions=actions,
        data={
            "orchestration_branch": branch,
            "auto_accept": True,
            "unified_content_id": created_id,
            "created_unified_content_id": created_id,
            "name": name,
            "document_name": name,
        },
        task_run=None,
    )


async def _handle_file_create(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Propose catalog document creation (confirmation task run) — Phase E registry path."""

    from api.ewa_platform.companion.orchestration.flows.doc_create import (
        begin_doc_create_flow,
        compose_generative_doc_body_markdown,
        friendly_create_compose_failed_reply,
        friendly_create_need_body_reply,
        looks_cyrillic,
        resolve_doc_create_filename,
        resolve_file_create_inputs,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None

    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None

    resolved = resolve_file_create_inputs(user_line, args)
    if resolved is None:
        return None
    resolve_outcome = resolved if isinstance(resolved, str) else "ready"
    logger.info(
        "[STEP] companion_doc_create_input_resolve outcome=%s line_chars=%d",
        resolve_outcome,
        len(user_line),
    )
    if resolved == "need_body":
        from api.ewa_platform.companion.orchestration.flows.doc_create import default_doc_create_filename

        payload_name = str(args.get("name") or "").strip() or default_doc_create_filename(user_line)
        if "." not in payload_name:
            payload_name = f"{payload_name}.md"
        if _tool_router_bypass_line_match(args):
            return ToolResult(
                tool="file_create",
                status="error",
                reply=friendly_create_need_body_reply(user_line, payload_name),
                actions=[],
                data={},
                task_run=None,
            )
        return ToolResult(
            tool="file_create",
            status="ok",
            reply=friendly_create_need_body_reply(user_line, payload_name),
            actions=[],
            data={},
            task_run=None,
        )

    pool = ctx.companion_pool
    if resolved == "generate_body":
        if pool is None:
            ru = looks_cyrillic(user_line)
            return ToolResult(
                tool="file_create",
                status="error",
                reply=(
                    "Не смогла подготовить документ: серверная очередь недоступна."
                    if ru
                    else "I could not prepare the document: companion pool unavailable."
                ),
                actions=[],
                data={},
                task_run=None,
            )
        name = resolve_doc_create_filename(user_line, args)
        agentic_session_id = str(args.get("_agentic_session_id") or "").strip()
        draft_in: Mapping[str, Any] | None = None
        if agentic_session_id and isinstance(args.get("_agentic_doc_create_draft"), Mapping):
            draft_in = args.get("_agentic_doc_create_draft")  # type: ignore[assignment]
        composed = await compose_generative_doc_body_markdown(
            user_line=user_line,
            principal_id=ctx.principal_id,
            profile=ctx.profile if isinstance(ctx.profile, Mapping) else None,
            companion_pool=pool,
            draft=draft_in,
            max_passes_this_slice=1 if agentic_session_id else None,
            filename=name,
        )
        if isinstance(composed, Mapping) and str(composed.get("status") or "") == "continue":
            draft = composed.get("doc_create_draft_v1")
            return ToolResult(
                tool="file_create",
                status="continue",
                reply=(
                    "Продолжаю набор документа — уже есть черновик, следующий проход через scheduler."
                    if looks_cyrillic(user_line)
                    else "Continuing document compose via scheduler with a saved draft."
                ),
                actions=[],
                data={
                    "compose_incomplete": True,
                    "doc_create_draft_v1": dict(draft) if isinstance(draft, Mapping) else {},
                },
                task_run=None,
            )
        body = composed if isinstance(composed, str) else None
        if not body:
            return ToolResult(
                tool="file_create",
                status="error",
                reply=friendly_create_compose_failed_reply(user_line),
                actions=[],
                data={},
                task_run=None,
            )
        task_key, folder_label, folder_item_id = await _resolve_create_folder_fields(
            args=args,
            user_line=user_line,
            content_catalog_user_id=uid,
            name=name,
        )
        auto_out = await _auto_create_document_result(
            tool="file_create",
            branch="doc_create",
            args=args,
            ctx=ctx,
            user_line=user_line,
            name=name,
            body=body,
            task_key=task_key,
            folder_label=folder_label,
            folder_item_id=folder_item_id,
        )
        if auto_out is not None:
            return auto_out
        inner = await begin_doc_create_flow(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            name=name,
            body=body,
            task_key=task_key,
            folder_label=folder_label,
            folder_item_id=folder_item_id,
        )
        return _flow_inner_to_tool_result(tool="file_create", branch="doc_create", inner=inner)

    name, body = resolved
    if pool is None:
        ru = looks_cyrillic(user_line)
        return ToolResult(
            tool="file_create",
            status="error",
            reply=(
                "Не смогла подготовить создание файла: серверная очередь недоступна."
                if ru
                else "I could not prepare file creation: companion pool unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    task_key, folder_label, folder_item_id = await _resolve_create_folder_fields(
        args=args,
        user_line=user_line,
        content_catalog_user_id=uid,
        name=name,
    )
    auto_out = await _auto_create_document_result(
        tool="file_create",
        branch="doc_create",
        args=args,
        ctx=ctx,
        user_line=user_line,
        name=name,
        body=body,
        task_key=task_key,
        folder_label=folder_label,
        folder_item_id=folder_item_id,
    )
    if auto_out is not None:
        return auto_out
    inner = await begin_doc_create_flow(
        pool,
        principal_id=ctx.principal_id,
        user_line=user_line,
        content_catalog_user_id=uid,
        name=name,
        body=body,
        task_key=task_key,
        folder_label=folder_label,
        folder_item_id=folder_item_id,
    )
    if inner.get("task_run") is None:
        return _flow_inner_to_tool_result(tool="file_create", branch="doc_create", inner=inner)

    return _flow_inner_to_tool_result(tool="file_create", branch="doc_create", inner=inner)


async def _handle_file_save_text(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Save explicit text into a new catalog document — workflow-only via router bypass."""

    from api.ewa_platform.companion.orchestration.flows.doc_create import (
        begin_doc_create_flow,
        looks_cyrillic,
    )
    from api.ewa_platform.companion.storage.catalog_pipeline import sanitize_companion_new_filename

    if not _tool_router_bypass_line_match(args):
        return None
    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    name_raw = str(args.get("name") or "").strip()
    body = str(args.get("body") or args.get("text") or "").strip()
    ru = looks_cyrillic(f"{user_line} {name_raw} {body}")
    if not name_raw or not body:
        return ToolResult(
            tool="file_save_text",
            status="error",
            reply=("Укажите имя файла и текст для сохранения." if ru else "Provide a file name and text body to save."),
            actions=[],
            data={},
            task_run=None,
        )
    name_s = sanitize_companion_new_filename(name_raw)
    if "." not in name_s:
        name_s = f"{name_s}.md"
    pool = ctx.companion_pool
    if pool is None:
        return ToolResult(
            tool="file_save_text",
            status="error",
            reply=(
                "Не смогла подготовить сохранение: серверная очередь недоступна."
                if ru
                else "I could not prepare the save: companion pool unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )
    task_key, folder_label, folder_item_id = await _resolve_create_folder_fields(
        args=args,
        user_line=user_line,
        content_catalog_user_id=uid,
        name=name_s,
    )
    line = user_line or f"save text to {name_s}"
    auto_out = await _auto_create_document_result(
        tool="file_save_text",
        branch="doc_create",
        args=args,
        ctx=ctx,
        user_line=line,
        name=name_s,
        body=body[:240_000],
        task_key=task_key,
        folder_label=folder_label,
        folder_item_id=folder_item_id,
    )
    if auto_out is not None:
        return auto_out
    inner = await begin_doc_create_flow(
        pool,
        principal_id=ctx.principal_id,
        user_line=line,
        content_catalog_user_id=uid,
        name=name_s,
        body=body[:240_000],
        task_key=task_key,
        folder_label=folder_label,
        folder_item_id=folder_item_id,
    )
    return _flow_inner_to_tool_result(tool="file_save_text", branch="doc_create", inner=inner)


async def _handle_file_rename(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
    from api.ewa_platform.companion.orchestration.flows.file_rename import (
        propose_file_rename_from_queries,
        propose_file_rename_from_user_line,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None
    pool = ctx.companion_pool
    if pool is None:
        ru = looks_cyrillic(user_line)
        return ToolResult(
            tool="file_rename",
            status="error",
            reply=(
                "Не смогла подготовить переименование: серверная очередь недоступна."
                if ru
                else "I could not prepare rename: companion pool unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    old_query = str(args.get("old_query") or args.get("rename_old_query") or "").strip()
    new_name = str(args.get("new_name") or args.get("rename_new_name") or "").strip()
    if old_query and new_name:
        inner = await propose_file_rename_from_queries(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            old_query=old_query,
            new_name=new_name,
            profile=ctx.profile,
        )
    else:
        inner = await propose_file_rename_from_user_line(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            profile=ctx.profile,
        )
    if inner is None:
        return None
    return _flow_inner_to_tool_result(tool="file_rename", branch="file_rename", inner=inner)


async def _handle_file_delete(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
    from api.ewa_platform.companion.orchestration.flows.file_delete import (
        propose_file_delete_from_query,
        propose_file_delete_from_user_line,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None
    pool = ctx.companion_pool
    if pool is None:
        ru = looks_cyrillic(user_line)
        return ToolResult(
            tool="file_delete",
            status="error",
            reply=(
                "Не смогла подготовить удаление: серверная очередь недоступна."
                if ru
                else "I could not prepare delete: companion pool unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    phrase = str(args.get("phrase") or args.get("delete_file_query") or "").strip()
    if phrase:
        inner = await propose_file_delete_from_query(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            phrase=phrase,
            profile=ctx.profile,
        )
    else:
        inner = await propose_file_delete_from_user_line(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            profile=ctx.profile,
        )
    if inner is None:
        return None
    return _flow_inner_to_tool_result(tool="file_delete", branch="file_delete", inner=inner)


async def _handle_doc_insert(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
    from api.ewa_platform.companion.orchestration.flows.doc_insert import (
        propose_doc_insert_for_phrase,
        propose_doc_insert_from_user_line,
    )

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None
    pool = ctx.companion_pool
    if pool is None:
        ru = looks_cyrillic(user_line)
        return ToolResult(
            tool="doc_insert",
            status="error",
            reply=(
                "Не смогла подготовить вставку: серверная очередь недоступна."
                if ru
                else "I could not prepare insert: companion pool unavailable."
            ),
            actions=[],
            data={},
            task_run=None,
        )

    phrase = str(args.get("phrase") or args.get("insert_source_file_query") or "").strip()
    if phrase:
        inner = await propose_doc_insert_for_phrase(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            shell_norm=ctx.shell_norm,
            phrase=phrase,
        )
    else:
        inner = await propose_doc_insert_from_user_line(
            pool,
            principal_id=ctx.principal_id,
            user_line=user_line,
            content_catalog_user_id=uid,
            oauth2_sub=ctx.oauth2_sub_for_content_alternate,
            shell_norm=ctx.shell_norm,
        )
    if inner is None:
        return None
    return _flow_inner_to_tool_result(tool="doc_insert", branch="doc_insert", inner=inner)


async def _handle_file_open(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Open one EwaFile row in DocEditor via server-resolved ``unified_content_id`` (no shell listing)."""

    from api.ewa_platform.companion.orchestration.flows.file_open import propose_file_open
    from api.ewa_platform.companion.orchestration.tools.handlers_desktop import _handle_catalog_list

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    user_line = str(args.get("user_line") or ctx.user_line or "").strip()
    if not user_line:
        return None

    file_query = str(args.get("file_query") or args.get("file_name") or "").strip()
    unified_content_id = str(args.get("unified_content_id") or args.get("uc") or "").strip()
    if _tool_router_bypass_line_match(args) and not file_query and not unified_content_id:
        list_args = {**dict(args), "mode": "browse", "_tool_router_bypass_line_match": True}
        return await _handle_catalog_list(list_args, ctx)

    inner = await propose_file_open(
        user_line=user_line,
        content_catalog_user_id=uid,
        oauth2_sub=ctx.oauth2_sub_for_content_alternate,
        profile=ctx.profile,
        file_query=file_query or None,
        unified_content_id=unified_content_id or None,
    )
    if inner is None:
        return None

    inner_data = as_mapping_dict(inner.get("data"))
    uc_str = str(inner_data.get("unified_content_id") or "").strip()
    label = str(inner_data.get("label") or "").strip()
    companion_pool = ctx.companion_pool
    if companion_pool is not None and uc_str:
        try:
            from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

            await companion_pg.companion_record_file_focus(
                companion_pool,
                principal_id=ctx.principal_id,
                unified_content_id=uc_str,
                name=label or None,
                source="file_open",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[STEP] companion_file_focus_open_persist_failed principal=%s err=%s",
                ctx.principal_id,
                exc,
            )

    result = _flow_inner_to_tool_result(tool="file_open", branch="file_open", inner=inner)
    if result is not None and uc_str:
        merged_data = dict(result.get("data") or {})
        merged_data.setdefault("unified_content_id", uc_str)
        merged_data.setdefault("label", label)
        output_surface = result.get("output_surface")
        return ToolResult(
            tool=str(result.get("tool") or "file_open"),
            status=str(result.get("status") or "ok"),
            reply=str(result.get("reply") or ""),
            actions=list(result.get("actions") or []),
            **({"output_surface": output_surface} if isinstance(output_surface, dict) else {}),
            data=merged_data,
            task_run=result.get("task_run"),
        )
    return result


async def _handle_doc_append_block(args: Mapping[str, Any], ctx: ToolContext) -> ToolResult | None:
    """Append one attributable block to a catalog document (AIP Phase 2)."""

    from uuid import UUID

    from api.ewa_platform.companion.storage.catalog_pipeline import (
        catalog_pick_owner_row,
        make_content_storage_service,
    )
    from api.services.unified_content.content_blocks import new_content_block
    from api.services.unified_content.content_storage_service import ContentVersionConflictError

    uid = (ctx.content_catalog_user_id or "").strip()
    if not uid:
        return None
    block_content = str(args.get("block_content") or args.get("content") or "").strip()
    if not block_content:
        return ToolResult(
            tool="doc_append_block",
            status="error",
            reply="Missing block_content for doc_append_block.",
        )
    author_role = str(args.get("author_role") or "agent").strip() or "agent"
    block_type = str(args.get("block_type") or "markdown").strip() or "markdown"
    pool = await _resolve_main_pool(ctx)
    if pool is None:
        return ToolResult(tool="doc_append_block", status="unavailable", reply="Database pool unavailable.")

    content_id_raw = str(args.get("unified_content_id") or args.get("content_id") or "").strip()
    if not content_id_raw:
        file_query = str(args.get("file_query") or args.get("file_name") or "").strip()
        if not file_query:
            return ToolResult(
                tool="doc_append_block",
                status="error",
                reply="Provide unified_content_id or file_query for doc_append_block.",
            )
        picked, _, _ = await catalog_pick_owner_row(
            content_catalog_user_id=uid,
            oauth2_sub_for_content_alternate=ctx.oauth2_sub_for_content_alternate,
            user_line=file_query,
        )
        if picked is None:
            return ToolResult(tool="doc_append_block", status="error", reply=f"File not found: {file_query}")
        content_id_raw = str(getattr(picked, "id", "") or "").strip()
    try:
        content_id = UUID(content_id_raw)
    except ValueError:
        return ToolResult(tool="doc_append_block", status="error", reply="Invalid unified_content_id.")

    storage = make_content_storage_service(pool)
    try:
        meta = await storage.get_content(content_id, uid)
    except (PermissionError, ValueError) as exc:
        logger.info("doc_append_block_read_denied content_id=%s err=%s", content_id, exc)
        return ToolResult(tool="doc_append_block", status="error", reply="No access to target document.")
    version = int(meta.version or 0)
    block = new_content_block(content=block_content, block_type=block_type, author_role=author_role)
    try:
        updated = await storage.append_to_content(
            content_id,
            uid,
            [block.model_dump(mode="json")],
            expected_version=version,
        )
    except ContentVersionConflictError as exc:
        logger.info(
            "[STEP] doc_append_block_conflict content_id=%s block_id=%s role=%s expected_version=%s current_version=%s",
            content_id,
            block.id,
            author_role,
            exc.expected_version,
            exc.current_version,
        )
        return ToolResult(
            tool="doc_append_block",
            status="error",
            reply="Document version changed — refresh and retry append.",
            data={
                "error_code": "version_conflict",
                "expected_version": exc.expected_version,
                "current_version": exc.current_version,
            },
        )
    logger.info(
        "[STEP] doc_append_block_success content_id=%s block_id=%s role=%s expected_version=%s new_version=%s",
        content_id,
        block.id,
        author_role,
        version,
        updated.version,
    )
    return ToolResult(
        tool="doc_append_block",
        status="ok",
        reply=f"Appended block from {author_role}.",
        data={
            "unified_content_id": str(content_id),
            "block_id": str(block.id),
            "author_role": author_role,
            "version": int(updated.version or 0),
        },
    )


HANDLERS: Final[dict[str, ToolHandler]] = {
    "file_rewrite": _handle_file_rewrite,
    "doc_append_block": _handle_doc_append_block,
    "catalog_discuss": _handle_catalog_discuss,
    "file_create": _handle_file_create,
    "file_save_text": _handle_file_save_text,
    "file_rename": _handle_file_rename,
    "file_delete": _handle_file_delete,
    "doc_insert": _handle_doc_insert,
    "file_open": _handle_file_open,
}

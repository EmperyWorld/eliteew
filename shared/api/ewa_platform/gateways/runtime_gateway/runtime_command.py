# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Typed command dispatcher for the EWA Runtime Gateway: route allowlisted EWA tool requests to desktop actions, Unified
# Content reads/searches, and controlled DocEditor draft/apply action payloads.
# Invariants:
# - Reject unknown/malformed targets; never execute arbitrary app names, code, or raw LLM instructions.
# - Mutating DocEditor apply requires explicit confirmation and returns SPA actions rather than direct DB writes.
# Related:
# - api/ewa_platform/schemas/pydantic/runtime_command.py
# - api/ewa_platform/gateways/routers/runtime_command.py
# - api/services/ewa_companion/actions.py
# ---
"""EWA Runtime Gateway command dispatcher."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from api.ewa_platform.companion.actions import normalize_actions_list_from_json
from api.ewa_platform.companion.storage.doceditor_translate_body import (
    _sanitize_body_html_for_action,
    build_doc_editor_set_body_action,
)
from api.ewa_platform.gateways.runtime_gateway.catalog_preferences import (
    catalog_preferences_from_profile,
    catalog_preferences_to_mapping,
    merge_catalog_preferences,
    normalize_extension_list,
    patch_catalog_preferences,
)
from api.ewa_platform.gateways.runtime_gateway.runtime_context import (
    build_runtime_content_page,
    normalize_catalog_filters,
    runtime_content_item_from_row,
)
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.runtime_command import (
    EwaRuntimeCommandIn,
    EwaRuntimeCommandOut,
    EwaRuntimeSafetyTier,
)
from api.schemas.unified_content import ContentType, Visibility, build_content_create, build_content_update

if TYPE_CHECKING:
    from api.services.unified_content.content_query_service import ContentQueryService

_DOC_BODY_COMMAND_MAX_CHARS = 250_000


def _command_safety_tier(kind: str) -> EwaRuntimeSafetyTier:
    if kind.startswith("desktop."):
        return "safe_ui"
    if kind in {"content.list", "content.search", "doc.resolve", "doc.read"}:
        return "safe_content_read"
    if kind in {"doc.edit.propose", "doc.delete.propose"}:
        return "draft_mutation"
    if kind == "doc.delete.apply":
        return "destructive_mutation"
    return "confirmed_mutation"


def _reject(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    reason: str,
    target: dict[str, Any] | None = None,
) -> EwaRuntimeCommandOut:
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="rejected",
        safety_tier=_command_safety_tier(cmd.command_kind),
        authorized_user_id=authorized_user_id,
        target=target or {},
        rejection_reason=reason,
        audit_skipped_reason="rejected_before_execution",
    )


def _str_arg(args: dict[str, Any], key: str, *, max_len: int = 500) -> str:
    raw = args.get(key)
    if raw is None:
        return ""
    return str(raw).strip()[:max_len]


def _int_arg(args: dict[str, Any], key: str, default: int, *, lo: int, hi: int) -> int:
    try:
        raw = int(args.get(key, default))
    except (TypeError, ValueError):  # fmt: skip
        raw = default
    return max(lo, min(raw, hi))


async def _desktop_command(cmd: EwaRuntimeCommandIn, *, authorized_user_id: str) -> EwaRuntimeCommandOut:
    action_type = cmd.command_kind.split(".", 1)[1]
    args = dict(cmd.arguments)
    component = _str_arg(args, "app_component", max_len=96) or (cmd.target_app or "").strip()
    raw_action: dict[str, Any] = {"type": action_type, "app_component": component}
    for key in (
        "unified_content_id",
        "content_manager_focus_unified_content_id",
        "content_manager_initial_filter",
        "content_manager_folder_item_id",
        "rationale",
    ):
        if key in args:
            raw_action[key] = args[key]
    actions = normalize_actions_list_from_json([raw_action])
    if not actions:
        return _reject(
            cmd,
            authorized_user_id=authorized_user_id,
            reason="desktop_action_not_allowlisted",
            target={"app_component": component},
        )
    status = "dry_run" if cmd.dry_run else "ok"
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status=status,
        safety_tier="safe_ui",
        authorized_user_id=authorized_user_id,
        target={"app_component": component},
        actions=[] if cmd.dry_run else actions,
        result={"action": actions[0], "dry_run": cmd.dry_run},
        audit_skipped_reason="client_spa_action_only",
    )


async def _content_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    oauth2_sub: str,
    query_svc: ContentQueryService,
    preferences: Any = None,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    search = _str_arg(args, "search_query" if cmd.command_kind == "content.search" else "search", max_len=500)
    raw_scope = _str_arg(args, "search_scope", max_len=32) or _str_arg(args, "scope", max_len=32) or "metadata"
    search_scope = raw_scope if raw_scope in {"metadata", "content", "hybrid"} else "metadata"
    page = await build_runtime_content_page(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=oauth2_sub,
        search_query=search or None,
        search_scope=search_scope,  # type: ignore[arg-type]
        offset=_int_arg(args, "offset", 0, lo=0, hi=1_000_000),
        limit=_int_arg(args, "limit", 50, lo=1, hi=200),
        sort_field=_str_arg(args, "sort_field", max_len=32) or None,
        sort_order=_str_arg(args, "sort_order", max_len=8) or None,
        filters=normalize_catalog_filters(
            content_types=[str(x) for x in args.get("content_types", [])]
            if isinstance(args.get("content_types"), list)
            else [],
            mime_groups=[str(x) for x in args.get("mime_groups", [])]
            if isinstance(args.get("mime_groups"), list)
            else [],
            extension_include=normalize_extension_list(args.get("extension_include")),
            extension_exclude=normalize_extension_list(args.get("extension_exclude")),
            include_audio=args.get("include_audio") if isinstance(args.get("include_audio"), bool) else None,
            exclude_audio=args.get("exclude_audio") if isinstance(args.get("exclude_audio"), bool) else None,
            preferences=preferences,
        ),
        preferences=preferences,
    )
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="dry_run" if cmd.dry_run else "ok",
        safety_tier="safe_content_read",
        authorized_user_id=authorized_user_id,
        target={"content_user_id": content_user_id},
        result=page.model_dump(mode="json"),
        audit_skipped_reason="read_only",
    )


async def _doc_resolve_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    oauth2_sub: str,
    query_svc: ContentQueryService,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    uc = _str_arg(args, "unified_content_id", max_len=128)
    if uc:
        try:
            row = await storage_svc.get_content(UUID(uc), content_user_id)
        except (ValueError, PermissionError) as exc:
            return _reject(
                cmd, authorized_user_id=authorized_user_id, reason=str(exc), target={"unified_content_id": uc}
            )
        return EwaRuntimeCommandOut(
            command_kind=cmd.command_kind,
            status="ok",
            safety_tier="safe_content_read",
            authorized_user_id=authorized_user_id,
            target={"unified_content_id": uc},
            result={"item": runtime_content_item_from_row(row).model_dump(mode="json")},
            audit_skipped_reason="read_only",
        )
    query = _str_arg(args, "search_query", max_len=500) or _str_arg(args, "query", max_len=500)
    if not query:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_unified_content_id_or_query")
    raw_scope = _str_arg(args, "search_scope", max_len=32) or _str_arg(args, "scope", max_len=32) or "metadata"
    search_scope = raw_scope if raw_scope in {"metadata", "content", "hybrid"} else "metadata"
    page = await build_runtime_content_page(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=oauth2_sub,
        search_query=query,
        search_scope=search_scope,  # type: ignore[arg-type]
        offset=0,
        limit=10,
    )
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="safe_content_read",
        authorized_user_id=authorized_user_id,
        target={"query": query},
        result=page.model_dump(mode="json"),
        audit_skipped_reason="read_only",
    )


async def _doc_read_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    uc = _str_arg(args, "unified_content_id", max_len=128)
    if not uc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_unified_content_id")
    try:
        row = await storage_svc.get_content(UUID(uc), content_user_id)
    except (ValueError, PermissionError) as exc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason=str(exc), target={"unified_content_id": uc})
    max_chars = _int_arg(args, "max_chars", 4000, lo=200, hi=30000)
    text = str(getattr(row, "extracted_text", "") or "")
    preview = text[:max_chars].rstrip()
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="safe_content_read",
        authorized_user_id=authorized_user_id,
        target={"unified_content_id": uc},
        result={
            "item": runtime_content_item_from_row(row).model_dump(mode="json"),
            "text_preview": preview,
            "truncated": len(text) > len(preview),
        },
        audit_skipped_reason="read_only",
    )


async def _doc_edit_command(cmd: EwaRuntimeCommandIn, *, authorized_user_id: str) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    uc = _str_arg(args, "unified_content_id", max_len=128)
    raw_body = str(args.get("body_html") or args.get("proposed_body_html") or "").strip()
    safe_body = _sanitize_body_html_for_action(raw_body, _DOC_BODY_COMMAND_MAX_CHARS)
    if not safe_body:
        return _reject(
            cmd, authorized_user_id=authorized_user_id, reason="missing_body_html", target={"unified_content_id": uc}
        )
    rationale = _str_arg(args, "rationale", max_len=200) or "EWA DocEditor command"
    action = build_doc_editor_set_body_action(body_html=safe_body, unified_content_id=uc or None, rationale=rationale)
    if cmd.command_kind == "doc.edit.apply" and not cmd.confirmed:
        return EwaRuntimeCommandOut(
            command_kind=cmd.command_kind,
            status="requires_confirmation",
            safety_tier="confirmed_mutation",
            authorized_user_id=authorized_user_id,
            target={"unified_content_id": uc},
            result={"confirmation_required": True, "proposed_action": action},
            audit_skipped_reason="awaiting_user_confirmation",
        )
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="dry_run" if cmd.dry_run else "ok",
        safety_tier=_command_safety_tier(cmd.command_kind),
        authorized_user_id=authorized_user_id,
        target={"unified_content_id": uc},
        actions=[] if cmd.dry_run else [action],
        result={"action": action, "dry_run": cmd.dry_run},
        audit_skipped_reason="client_spa_doc_editor_action",
    )


def _requires_confirmation(
    cmd: EwaRuntimeCommandIn, *, target: dict[str, Any], result: dict[str, Any]
) -> EwaRuntimeCommandOut | None:
    if cmd.dry_run:
        return EwaRuntimeCommandOut(
            command_kind=cmd.command_kind,
            status="dry_run",
            safety_tier=_command_safety_tier(cmd.command_kind),
            authorized_user_id=result.get("authorized_user_id", ""),
            target=target,
            result={k: v for k, v in result.items() if k != "authorized_user_id"} | {"dry_run": True},
            audit_skipped_reason="dry_run",
        )
    if not cmd.confirmed:
        return EwaRuntimeCommandOut(
            command_kind=cmd.command_kind,
            status="requires_confirmation",
            safety_tier=_command_safety_tier(cmd.command_kind),
            authorized_user_id=result.get("authorized_user_id", ""),
            target=target,
            result={k: v for k, v in result.items() if k != "authorized_user_id"} | {"confirmation_required": True},
            audit_skipped_reason="awaiting_user_confirmation",
        )
    return None


async def _doc_create_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    name = _str_arg(args, "name", max_len=255) or "EWA document.txt"
    body_html = str(args.get("body_html") or "").strip()
    plain_text = str(args.get("plain_text") or args.get("text") or "").strip()
    body = body_html or plain_text
    if not body:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_document_body")
    mime_type = "text/html" if body_html else "text/plain"
    if "." not in name:
        name = f"{name}.html" if body_html else f"{name}.txt"
    target = {"name": name, "content_user_id": content_user_id}
    pending = _requires_confirmation(
        cmd,
        target=target,
        result={
            "authorized_user_id": authorized_user_id,
            "proposed_action": "create_document",
            "name": name,
            "mime_type": mime_type,
            "chars": len(body),
        },
    )
    if pending is not None:
        return pending
    meta_raw = args.get("metadata")
    metadata = (
        {str(k): v for k, v in meta_raw.items()} if isinstance(meta_raw, dict) else {"source": "ewa_runtime_gateway"}
    )
    content_data = build_content_create(
        user_id=content_user_id,
        name=name,
        title=_str_arg(args, "title", max_len=500) or name,
        description=_str_arg(args, "description", max_len=2000) or None,
        tags=[str(x).strip()[:100] for x in args.get("tags", []) if str(x).strip()]
        if isinstance(args.get("tags"), list)
        else [],
        content_type=ContentType.DOCUMENT,
        mime_type=mime_type,
        visibility=Visibility.PRIVATE,
        metadata=metadata,
        original_filename=name,
        source_service="ewa_runtime_gateway",
    )
    try:
        row = await storage_svc.create_content(
            content_data=content_data,
            file_data=body.encode("utf-8"),
            user_id=content_user_id,
        )
    except (ValueError, PermissionError, RuntimeError) as exc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason=str(exc), target=target)
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="confirmed_mutation",
        authorized_user_id=authorized_user_id,
        target={"unified_content_id": str(getattr(row, "id", ""))},
        result={"item": runtime_content_item_from_row(row).model_dump(mode="json")},
        audit_skipped_reason=None,
    )


async def _doc_delete_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    uc = _str_arg(args, "unified_content_id", max_len=128)
    if not uc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_unified_content_id")
    target = {"unified_content_id": uc}
    if cmd.command_kind == "doc.delete.propose":
        return EwaRuntimeCommandOut(
            command_kind=cmd.command_kind,
            status="ok",
            safety_tier="draft_mutation",
            authorized_user_id=authorized_user_id,
            target=target,
            result={"proposed_action": "trash_content", "confirmation_required_for_apply": True},
            audit_skipped_reason="proposal_only",
        )
    pending = _requires_confirmation(
        cmd,
        target=target,
        result={"authorized_user_id": authorized_user_id, "proposed_action": "trash_content"},
    )
    if pending is not None:
        return pending
    try:
        await storage_svc.delete_content(UUID(uc), content_user_id)
    except (ValueError, PermissionError) as exc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason=str(exc), target=target)
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="destructive_mutation",
        authorized_user_id=authorized_user_id,
        target=target,
        result={"deleted": True, "mode": "soft_delete"},
    )


async def _doc_restore_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    uc = _str_arg(dict(cmd.arguments), "unified_content_id", max_len=128)
    if not uc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_unified_content_id")
    target = {"unified_content_id": uc}
    pending = _requires_confirmation(
        cmd,
        target=target,
        result={"authorized_user_id": authorized_user_id, "proposed_action": "restore_content"},
    )
    if pending is not None:
        return pending
    try:
        row = await storage_svc.restore_content(UUID(uc), content_user_id)
    except (ValueError, PermissionError) as exc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason=str(exc), target=target)
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="confirmed_mutation",
        authorized_user_id=authorized_user_id,
        target=target,
        result={"item": runtime_content_item_from_row(row).model_dump(mode="json")},
    )


async def _file_metadata_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    storage_svc: Any,
) -> EwaRuntimeCommandOut:
    args = dict(cmd.arguments)
    uc = _str_arg(args, "unified_content_id", max_len=128)
    if not uc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason="missing_unified_content_id")
    updates_map: dict[str, Any] = {}
    if cmd.command_kind == "file.rename":
        new_name = _str_arg(args, "name", max_len=500) or _str_arg(args, "new_name", max_len=500)
        if not new_name:
            return _reject(
                cmd, authorized_user_id=authorized_user_id, reason="missing_name", target={"unified_content_id": uc}
            )
        updates_map["name"] = new_name
    else:
        for key in ("name", "description", "tags", "metadata", "folder_item_id"):
            if key in args:
                updates_map[key] = args[key]
    if not updates_map:
        return _reject(
            cmd,
            authorized_user_id=authorized_user_id,
            reason="missing_update_fields",
            target={"unified_content_id": uc},
        )
    target = {"unified_content_id": uc, "fields": sorted(updates_map)}
    pending = _requires_confirmation(
        cmd,
        target=target,
        result={"authorized_user_id": authorized_user_id, "proposed_action": "update_metadata", "updates": updates_map},
    )
    if pending is not None:
        return pending
    try:
        row = await storage_svc.update_content(UUID(uc), content_user_id, build_content_update(**updates_map))
    except (ValueError, PermissionError) as exc:
        return _reject(cmd, authorized_user_id=authorized_user_id, reason=str(exc), target=target)
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="ok",
        safety_tier="confirmed_mutation",
        authorized_user_id=authorized_user_id,
        target=target,
        result={"item": runtime_content_item_from_row(row).model_dump(mode="json")},
    )


async def _catalog_preferences_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    companion_pool: Any,
) -> EwaRuntimeCommandOut:
    profile = (
        await companion_pg.companion_profile_fetch(companion_pool, principal_id=authorized_user_id)
        if companion_pool is not None
        else None
    )
    current = catalog_preferences_from_profile(profile)
    args = dict(cmd.arguments)
    next_prefs = merge_catalog_preferences(
        current,
        add_content_types=[str(x).strip().lower() for x in args.get("exclude_content_types", [])]
        if isinstance(args.get("exclude_content_types"), list)
        else None,
        remove_content_types=[str(x).strip().lower() for x in args.get("remove_content_types", [])]
        if isinstance(args.get("remove_content_types"), list)
        else None,
        add_mime_groups=[str(x).strip().lower() for x in args.get("exclude_mime_groups", [])]
        if isinstance(args.get("exclude_mime_groups"), list)
        else None,
        remove_mime_groups=[str(x).strip().lower() for x in args.get("remove_mime_groups", [])]
        if isinstance(args.get("remove_mime_groups"), list)
        else None,
        add_extensions=normalize_extension_list(args.get("extension_exclude")),
        remove_extensions=normalize_extension_list(args.get("remove_extensions")),
        reset=cmd.command_kind == "catalog.preferences.reset" or bool(args.get("reset")),
    )
    if cmd.dry_run:
        persisted = False
    else:
        next_prefs, persisted = await patch_catalog_preferences(
            companion_pool,
            principal_id=authorized_user_id,
            prefs=next_prefs,
            audit_action=cmd.command_kind.replace(".", "_"),
        )
    return EwaRuntimeCommandOut(
        command_kind=cmd.command_kind,
        status="dry_run" if cmd.dry_run else "ok" if persisted else "rejected",
        safety_tier="confirmed_mutation",
        authorized_user_id=authorized_user_id,
        target={"principal_id": authorized_user_id},
        result={"preferences": catalog_preferences_to_mapping(next_prefs), "persisted": persisted},
        audit_skipped_reason=None if persisted else "no_companion_profile_or_dry_run",
        rejection_reason=None if persisted or cmd.dry_run else "companion_profile_not_initialized",
    )


async def execute_runtime_command(
    cmd: EwaRuntimeCommandIn,
    *,
    authorized_user_id: str,
    content_user_id: str,
    oauth2_sub: str,
    query_svc: ContentQueryService,
    storage_svc: Any,
    companion_pool: Any = None,
) -> EwaRuntimeCommandOut:
    """Execute one allowlisted EWA runtime command."""

    if cmd.command_kind.startswith("desktop."):
        return await _desktop_command(cmd, authorized_user_id=authorized_user_id)
    if cmd.command_kind in {"content.list", "content.search"}:
        profile = (
            await companion_pg.companion_profile_fetch(companion_pool, principal_id=authorized_user_id)
            if companion_pool is not None
            else None
        )
        return await _content_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            oauth2_sub=oauth2_sub,
            query_svc=query_svc,
            preferences=catalog_preferences_from_profile(profile),
        )
    if cmd.command_kind in {"catalog.preferences.update", "catalog.preferences.reset"}:
        return await _catalog_preferences_command(
            cmd,
            authorized_user_id=authorized_user_id,
            companion_pool=companion_pool,
        )
    if cmd.command_kind == "doc.create":
        return await _doc_create_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            storage_svc=storage_svc,
        )
    if cmd.command_kind == "doc.resolve":
        return await _doc_resolve_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            oauth2_sub=oauth2_sub,
            query_svc=query_svc,
            storage_svc=storage_svc,
        )
    if cmd.command_kind == "doc.read":
        return await _doc_read_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            storage_svc=storage_svc,
        )
    if cmd.command_kind in {"doc.edit.propose", "doc.edit.apply"}:
        return await _doc_edit_command(cmd, authorized_user_id=authorized_user_id)
    if cmd.command_kind in {"doc.delete.propose", "doc.delete.apply"}:
        return await _doc_delete_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            storage_svc=storage_svc,
        )
    if cmd.command_kind == "doc.restore":
        return await _doc_restore_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            storage_svc=storage_svc,
        )
    if cmd.command_kind in {"file.rename", "file.update_metadata"}:
        return await _file_metadata_command(
            cmd,
            authorized_user_id=authorized_user_id,
            content_user_id=content_user_id,
            storage_svc=storage_svc,
        )
    return _reject(cmd, authorized_user_id=authorized_user_id, reason="unknown_command_kind")

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``file_delete`` proposal flow — resolve catalog row, create confirmation task run.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/flows/catalog_resolve.py
# ---

from __future__ import annotations

import inspect
from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.orchestration.flows.catalog_resolve import (
    parse_delete_phrase,
    query_service_or_none,
    resolve_file_target,
    strip_file_phrase,
)
from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


async def resolve_uc_by_phrase(
    query_svc: Any,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    phrase: str,
    profile: Mapping[str, Any] | None = None,
):
    """Backward-compatible alias used by tests/legacy patches."""

    return await resolve_file_target(
        query_svc,
        content_user_id=content_user_id,
        oauth2_sub=oauth2_sub,
        phrase=phrase,
        profile=profile,
    )


async def propose_file_delete_from_query(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    phrase: str,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    from api.ewa_platform.companion.storage.doceditor_content_resolve import is_deictic_doc_reference

    p = strip_file_phrase(phrase)
    if not p:
        return None
    if len(p) < 2 and not is_deictic_doc_reference(p):
        return None
    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None
    query_svc_obj = query_service_or_none()
    query_svc = await query_svc_obj if inspect.isawaitable(query_svc_obj) else query_svc_obj
    if query_svc is None:
        return None
    resolved = await resolve_uc_by_phrase(
        query_svc,
        content_user_id=uid,
        oauth2_sub=(oauth2_sub or "").strip() or None,
        phrase=p,
        profile=profile,
    )
    if resolved is None:
        return {
            "reply": f"Не нашла файл «{p[:120]}» для удаления."
            if looks_cyrillic(user_line)
            else f'I could not find a file matching "{p[:120]}" to delete.',
            "actions": [],
            "task_run": None,
        }
    if not resolved.can_delete:
        return {
            "reply": (
                f"Нашла «{resolved.label}», но убрать его из твоей библиотеки не могу."
                if looks_cyrillic(user_line)
                else f'I found "{resolved.label}", but I cannot remove it from your library.'
            ),
            "actions": [],
            "task_run": None,
        }
    uc_id = resolved.unified_content_id
    label = resolved.label
    plan = {"kind": "file_delete", "unified_content_id": uc_id, "label": label, "content_user_id": uid}
    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=principal_id,
        intent_kind="file_delete",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={"question": "confirm_delete"},
        status="awaiting_confirmation",
    )
    await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run["id"]),
        step_index=1,
        step_kind="file_delete_proposal",
        title="Soft-delete unified content",
        input_payload={"unified_content_id": uc_id},
        status="awaiting_confirmation",
    )
    rep = (
        f"Нашла «{label}» в EwaFile. Подтверди: это уберёт файл из твоей библиотеки."
        if looks_cyrillic(user_line)
        else f'I found "{label}" in EwaFile. Confirm: this will remove the file from your library.'
    )
    return {"reply": rep, "actions": [], "task_run": run}


async def propose_file_delete_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    phrase = parse_delete_phrase(user_line)
    if phrase is None:
        return None
    return await propose_file_delete_from_query(
        pool,
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub=oauth2_sub,
        phrase=phrase,
        profile=profile,
    )


__all__ = (
    "propose_file_delete_from_query",
    "propose_file_delete_from_user_line",
    "resolve_uc_by_phrase",
)

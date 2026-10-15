# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``file_rename`` proposal flow — resolve catalog row, create confirmation task run.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/flows/catalog_resolve.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import asyncpg

from api.ewa_platform.companion.orchestration.flows.catalog_resolve import (
    parse_rename_pair,
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


async def propose_file_rename_from_queries(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    old_query: str,
    new_name: str,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    old_q = strip_file_phrase(old_query)
    new_nm = strip_file_phrase(new_name)
    if len(old_q) < 1 or len(new_nm) < 1:
        return None
    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None
    query_svc = await query_service_or_none()
    if query_svc is None:
        return None
    resolved = await resolve_uc_by_phrase(
        query_svc,
        content_user_id=uid,
        oauth2_sub=(oauth2_sub or "").strip() or None,
        phrase=old_q,
        profile=profile,
    )
    if resolved is None:
        return {
            "reply": f"Не нашла файл «{old_q[:120]}» для переименования."
            if looks_cyrillic(user_line)
            else f'I could not find a file matching "{old_q[:120]}" to rename.',
            "actions": [],
            "task_run": None,
        }
    if not resolved.can_edit:
        return {
            "reply": (
                f"Нашла «{resolved.label}», но переименовать не могу — это не твой файл."
                if looks_cyrillic(user_line)
                else f'I found "{resolved.label}", but I cannot rename it — you can only rename files you own.'
            ),
            "actions": [],
            "task_run": None,
        }
    uc_id = resolved.unified_content_id
    label = resolved.label
    plan = {
        "kind": "file_rename",
        "unified_content_id": uc_id,
        "old_label": label,
        "new_name": new_nm,
        "content_user_id": uid,
    }
    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=principal_id,
        intent_kind="file_rename",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={"question": "confirm_rename"},
        status="awaiting_confirmation",
    )
    await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run["id"]),
        step_index=1,
        step_kind="file_rename_proposal",
        title="Rename unified content file",
        input_payload={"unified_content_id": uc_id, "new_name": new_nm},
        status="awaiting_confirmation",
    )
    rep = (
        f"Подготовила переименование «{label}» → «{new_nm}». Подтверди: сделать сейчас?"
        if looks_cyrillic(user_line)
        else f'I prepared renaming "{label}" → "{new_nm}". Confirm: apply now?'
    )
    return {"reply": rep, "actions": [], "task_run": run}


async def propose_file_rename_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    pair = parse_rename_pair(user_line)
    if pair is None:
        return None
    old_q, new_name = pair
    return await propose_file_rename_from_queries(
        pool,
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub=oauth2_sub,
        old_query=old_q,
        new_name=new_name,
        profile=profile,
    )


__all__ = (
    "propose_file_rename_from_queries",
    "propose_file_rename_from_user_line",
    "resolve_uc_by_phrase",
)

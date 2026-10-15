# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``doc_insert`` proposal flow — read source file, merge into open DocEditor body, confirmation task run.
# Invariants:
# - Requires open DocEditor in ``shell_norm``; caller maps missing editor to ``needs_open_editor``.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/storage/doceditor_translate_body.py
# ---

from __future__ import annotations

import html
import logging
import re
from collections.abc import Mapping
from typing import Any
from uuid import UUID

import asyncpg

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.flows.catalog_resolve import query_service_or_none
from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    companion_catalog_search_variants,
    pick_content_row_for_doc_open,
)
from api.ewa_platform.companion.storage.doceditor_translate_body import resolve_doc_editor_unified_id_for_shell
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.utils.ewa_companion_folder import companion_list_content_kwargs

logger = logging.getLogger(__name__)

_DOC_INSERT_RE = re.compile(
    r"(?is)(?:встав|добав|помест|insert|append).{0,80}(?:файл|file).{0,120}(?:документ|редактор|editor|document)"
)


def doc_insert_intent_match(user_line: str) -> bool:
    return bool(_DOC_INSERT_RE.search(user_line or ""))


def source_phrase_from_user_line(user_line: str) -> str:
    s = re.sub(r"(?is)^.*?(?:файл|file)\s+", "", user_line).strip()
    s = re.sub(r"(?is)\s+(?:в|into|to)\s+(?:документ|редактор|editor|document).*$", "", s).strip()
    s = s.strip(" «»\"'.,:;!?")
    return s[:240]


def html_from_text(text: str) -> str:
    escaped = html.escape(text.strip())
    blocks = [p.strip() for p in re.split(r"\n{2,}", escaped) if p.strip()]
    if not blocks:
        return ""
    return "".join(f"<p>{p.replace(chr(10), '<br />')}</p>" for p in blocks)


def doc_editor_set_body_action(body_html: str, target_uc: str, rationale: str) -> dict[str, Any]:
    return {
        "type": "doc_editor_set_body",
        "app_component": "DocEditor",
        "body_html": body_html,
        "unified_content_id": target_uc,
        "rationale": rationale,
    }


def friendly_insert_confirm_reply(user_line: str, source_name: str) -> str:
    return (
        f"Нашла файл «{source_name}» и подготовила вставку в открытый документ. Подтверди: вставить сейчас?"
        if looks_cyrillic(user_line)
        else f'I found "{source_name}" and prepared an insert into the open document. Confirm: insert it now?'
    )


async def storage_service_or_none() -> Any | None:
    try:
        from api.core.database_manager import get_asyncpg_pool
        from api.services.unified_content.audit_logger import AuditLogger
        from api.services.unified_content.content_storage_service import ContentStorageService
        from api.services.unified_content.storage_backends.factory import get_storage_factory
    except Exception as exc:
        companion_degrade_debug(
            logger,
            "doc_insert_storage_import",
            "unified content stack import failed",
            exc=exc,
        )
        return None
    pool = await get_asyncpg_pool()
    if pool is None:
        companion_degrade_debug(
            logger,
            "doc_insert_storage_pool",
            "asyncpg pool unavailable for doc_insert",
        )
        return None
    return ContentStorageService(pool, get_storage_factory(pool), AuditLogger(pool))


async def read_text(storage: Any, content_id: str, owner_user_id: str) -> str:
    data, _meta = await storage.read_file_bytes_for_owner(UUID(content_id), owner_user_id)
    if not data or b"\x00" in data[:4096]:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("utf-8", errors="replace")


async def find_source_row(
    query_svc: Any,
    *,
    content_user_id: str,
    oauth2_sub: str | None,
    phrase: str,
    target_uc: str,
) -> Any | None:
    for variant in companion_catalog_search_variants(phrase):
        rows, _total = await query_svc.list_content(
            user_id=content_user_id,
            search_query=variant,
            search_scope="hybrid",
            alternate_user_id=oauth2_sub if oauth2_sub and oauth2_sub != content_user_id else None,
            limit=20,
            offset=0,
            list_profile="compact",
            **companion_list_content_kwargs(),
        )
        candidates = [row for row in rows if str(getattr(row, "id", "")).strip() != target_uc]
        picked = pick_content_row_for_doc_open(candidates, phrase)
        if picked is not None:
            return picked
    return None


async def propose_doc_insert_for_phrase(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    shell_norm: Mapping[str, Any] | None,
    phrase: str,
) -> dict[str, Any] | None:
    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None
    target_uc = resolve_doc_editor_unified_id_for_shell(shell_norm or {})
    if not target_uc:
        return {
            "reply": "Открой документ в редакторе, и я подготовлю вставку."
            if looks_cyrillic(user_line)
            else "Open a document in the editor first, then I can prepare the insert.",
            "actions": [],
            "task_run": None,
            "needs_open_editor": True,
        }
    p = (phrase or "").strip()
    if len(p) < 2:
        return None
    query_svc = await query_service_or_none()
    storage = await storage_service_or_none()
    if query_svc is None or storage is None:
        return None
    source = await find_source_row(
        query_svc,
        content_user_id=uid,
        oauth2_sub=(oauth2_sub or "").strip() or None,
        phrase=p,
        target_uc=target_uc,
    )
    if source is None:
        return {
            "reply": f"Не нашла файл по запросу «{p}»."
            if looks_cyrillic(user_line)
            else f'I could not find a file for "{p}".',
            "actions": [],
            "task_run": None,
        }
    source_uc = str(getattr(source, "id", "")).strip()
    source_name = str(getattr(source, "name", "") or getattr(source, "title", "") or "file").strip()
    source_text = (await read_text(storage, source_uc, uid)).strip()
    target_text = (await read_text(storage, target_uc, uid)).strip()
    if not source_text:
        return {
            "reply": f"Нашла «{source_name}», но не смогла прочитать текст файла."
            if looks_cyrillic(user_line)
            else f'I found "{source_name}", but could not read its text.',
            "actions": [],
            "task_run": None,
        }
    source_html = html_from_text(source_text[:120_000])
    target_html = target_text if "<" in target_text[:500] else html_from_text(target_text[:180_000])
    body_html = (target_html.rstrip() + f"<hr /><h3>{html.escape(source_name)}</h3>" + source_html).strip()
    act = doc_editor_set_body_action(body_html, target_uc, f"Insert file {source_name} into the open document")
    plan = {
        "kind": "doc_insert_file_into_editor",
        "target_unified_content_id": target_uc,
        "source_unified_content_id": source_uc,
        "source_name": source_name,
        "action": act,
    }
    run = await companion_pg.companion_task_run_create(
        pool,
        principal_id=principal_id,
        intent_kind="doc_insert_file_into_editor",
        user_message=user_line,
        plan_payload=plan,
        confirmation_state={"question": "confirm_insert"},
        status="awaiting_confirmation",
    )
    await companion_pg.companion_task_step_create(
        pool,
        run_id=str(run["id"]),
        step_index=1,
        step_kind="doc_editor_set_body_proposal",
        title="Prepare file insertion into DocEditor",
        input_payload=plan,
        status="awaiting_confirmation",
    )
    return {
        "reply": friendly_insert_confirm_reply(user_line, source_name),
        "actions": [],
        "task_run": run,
    }


async def propose_doc_insert_from_user_line(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    shell_norm: Mapping[str, Any] | None,
) -> dict[str, Any] | None:
    uid = (content_catalog_user_id or "").strip()
    if not uid or not doc_insert_intent_match(user_line):
        return None
    phrase = source_phrase_from_user_line(user_line)
    if not phrase:
        return None
    return await propose_doc_insert_for_phrase(
        pool,
        principal_id=principal_id,
        user_line=user_line,
        content_catalog_user_id=uid,
        oauth2_sub=oauth2_sub,
        shell_norm=shell_norm,
        phrase=phrase,
    )


__all__ = (
    "doc_insert_intent_match",
    "propose_doc_insert_for_phrase",
    "propose_doc_insert_from_user_line",
    "source_phrase_from_user_line",
)

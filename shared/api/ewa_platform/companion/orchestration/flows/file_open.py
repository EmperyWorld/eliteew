# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ``file_open`` server tool — resolve EwaFile catalogue row (name, deictic, or explicit ``uc``) and emit
# ``open_app`` → **DocEditor** without shell ``surface_listing``.
# Invariants:
# - Uses ``resolve_file_target`` (file-focus ring + phrase search); scope **EwaFile** only.
# - Does not open empty DocEditor when target cannot be resolved.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/flows/catalog_resolve.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.orchestration.flows.catalog_resolve import (
    query_service_or_none,
    resolve_file_target,
    strip_file_phrase,
)
from api.ewa_platform.companion.orchestration.flows.doc_create import looks_cyrillic
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    extract_doc_search_phrase,
    merge_doceditor_open_with_unified_id,
    normalize_doc_open_phrase_after_extract,
    user_line_implies_deictic_doc_open,
    user_line_may_probe_file_open,
)


async def propose_file_open(
    *,
    user_line: str,
    content_catalog_user_id: str,
    oauth2_sub: str | None,
    profile: Mapping[str, Any] | None = None,
    file_query: str | None = None,
    unified_content_id: str | None = None,
) -> dict[str, Any] | None:
    """Return orchestrator-shaped dict with DocEditor ``open_app`` or ``None`` when tool does not apply."""

    uid = (content_catalog_user_id or "").strip()
    if not uid:
        return None

    explicit_uc = strip_file_phrase(unified_content_id or "")
    slot_query = strip_file_phrase(file_query or "")

    applies = bool(explicit_uc) or bool(slot_query) or user_line_may_probe_file_open(user_line)
    if not applies:
        return None

    phrase: str | None = slot_query or None
    if not phrase and not explicit_uc:
        raw = extract_doc_search_phrase(user_line)
        phrase = normalize_doc_open_phrase_after_extract(raw)
        if user_line_implies_deictic_doc_open(user_line) and not phrase:
            phrase = "его"

    query_svc = await query_service_or_none()
    if query_svc is None:
        return None

    resolved = await resolve_file_target(
        query_svc,
        content_user_id=uid,
        oauth2_sub=(oauth2_sub or "").strip() or None,
        phrase=phrase,
        unified_content_id=explicit_uc or None,
        profile=profile,
    )
    if resolved is None:
        ru = looks_cyrillic(user_line)
        return {
            "reply": (
                "Не понимаю, какой файл открыть в редакторе — назови файл или сначала покажи список в EwaFile."
                if ru
                else "I am not sure which file to open — name the file or list EwaFile contents first."
            ),
            "actions": [],
            "task_run": None,
        }

    label = resolved.label[:80]
    actions = merge_doceditor_open_with_unified_id(
        [],
        unified_id=resolved.unified_content_id,
        rationale=f"Opened in DocEditor: {label}"[:200],
    )
    ru = looks_cyrillic(user_line)
    reply = f"Открываю «{label}» в редакторе документов." if ru else f'Opening "{label}" in DocEditor.'
    return {
        "reply": reply,
        "actions": actions,
        "output_surface": {
            "mode": "document_editor",
            "payload": {
                "unifiedContentId": resolved.unified_content_id,
                "title": label,
                "source": "companion_action",
            },
        },
        "task_run": None,
        "data": {
            "unified_content_id": resolved.unified_content_id,
            "label": label,
        },
    }


__all__ = ("propose_file_open",)

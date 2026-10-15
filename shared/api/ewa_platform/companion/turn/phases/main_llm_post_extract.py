# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared main LLM post-extract processing: action finalize, doc-body augment, catalog appendix merge.
# Invariants:
# - Sync and SSE (stream + non-stream doc-replace) call one helper after LLM raw text is available.
# Related:
# - api/ewa_platform/companion/turn/phases/main_llm_finalize.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import asyncpg
import httpx

from api.ewa_platform.companion.sidecar.file_focus import (
    file_focus_stack_from_profile,
    pick_turn_file_focus_entry,
)
from api.ewa_platform.companion.sidecar.shell_listing_ordinals import (
    augment_actions_shell_listing_ordinals,
)
from api.ewa_platform.companion.storage.catalog_find import (
    CompanionCatalogFindBundle,
    augment_companion_catalog_find_reply,
    catalog_find_bundle_output_surface,
)
from api.ewa_platform.companion.storage.doceditor_content_resolve import (
    augment_actions_doceditor_via_content_search,
    companion_content_query_service_optional,
)
from api.ewa_platform.companion.storage.doceditor_edit_body import (
    augment_companion_doc_editor_edit_actions,
)
from api.ewa_platform.companion.storage.doceditor_translate_body import (
    augment_companion_doc_editor_translate_actions,
    coerce_companion_chat_reply_when_doc_body_action,
)
from api.ewa_platform.companion.turn.phases.action_strip import (
    strip_unjustified_doceditor_open_app_actions,
    strip_unjustified_musicplayer_open_app_actions,
    strip_unjustified_patch_desktop_config_actions,
)
from api.ewa_platform.companion.turn.phases.visible_reply import (
    merge_visible_reply_catalog_appendix_unless_surface,
)
from api.ewa_platform.companion.ux.action_inference import augment_actions_from_user_open_intent
from api.ewa_platform.companion.ux.desktop_theme_inference import (
    augment_patch_desktop_config_from_user_line,
)
from api.ewa_platform.companion.ux.reply_extract import extract_visible_reply_memory_actions
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MainLlmPostExtractResult:
    """Visible reply + actions after LLM extract and server-side augmentation."""

    reply_visible_raw: str
    parsed_memories: list[Any] | None
    parsed_actions: list[dict[str, Any]]
    catalog_appendix: str
    catalog_output_surface: dict[str, Any] | None


def _orchestration_action_dedupe_key(action: Mapping[str, Any]) -> str:
    atype = str(action.get("type") or action.get("action") or "").strip().lower()
    if atype == "open_app":
        return (
            f"open_app:{action.get('app') or action.get('app_id') or ''}:"
            f"{action.get('unified_content_id') or action.get('uc') or ''}"
        )
    return f"{atype}:{sorted((k, str(v)) for k, v in action.items())}"


def merge_orchestration_sidecar_actions(
    parsed_actions: list[dict[str, Any]],
    sidecar_actions: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Prepend server-orchestrator sidecar actions before LLM-emitted rows."""

    sidecar = [dict(a) for a in (sidecar_actions or []) if isinstance(a, Mapping)]
    if not sidecar:
        return parsed_actions
    out = list(sidecar)
    seen = {_orchestration_action_dedupe_key(a) for a in out}
    for row in parsed_actions:
        if not isinstance(row, Mapping):
            continue
        key = _orchestration_action_dedupe_key(row)
        if key not in seen:
            out.append(dict(row))
            seen.add(key)
    return out


async def augment_translate_and_scrub_visible_reply_for_doc_body(
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model_raw: str,
    timeout: httpx.Timeout,
    user_line: str,
    parsed_actions: list[dict[str, Any]],
    content_catalog_user_id: str | None,
    shell_norm: Mapping[str, Any] | None,
    reply_visible_raw: str,
) -> tuple[list[dict[str, Any]], str]:
    """Append optional ``doc_editor_set_body``; scrub chat-visible text when that action fires."""

    try:
        augmented = await augment_companion_doc_editor_translate_actions(
            client,
            base_url=base_url,
            model=model_raw,
            timeout=timeout,
            user_line=user_line,
            actions=list(parsed_actions),
            content_catalog_user_id=content_catalog_user_id,
            shell_norm=shell_norm,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_translate_augment_failed err=%s", exc)
        augmented = parsed_actions
    try:
        if not any(
            isinstance(a, dict) and str(a.get("type") or "").strip() == "doc_editor_set_body" for a in augmented
        ):
            augmented = await augment_companion_doc_editor_edit_actions(
                client,
                base_url=base_url,
                model=model_raw,
                timeout=timeout,
                user_line=user_line,
                actions=list(augmented),
                content_catalog_user_id=content_catalog_user_id,
                shell_norm=shell_norm,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("companion_doc_body_edit_augment_failed err=%s", exc)
    scrubbed = coerce_companion_chat_reply_when_doc_body_action(reply_visible_raw, user_line, augmented)
    return augmented, scrubbed


async def finalize_companion_actions(
    user_line: str,
    parsed_actions: list[dict[str, Any]],
    *,
    principal_id: str,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    shell_norm: Mapping[str, Any] | None = None,
    catalog_prebuilt_bundle: CompanionCatalogFindBundle | None = None,
    profile: Mapping[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """Apply deterministic augmentation; returns ``(actions, catalog_discovery_markdown_suffix)``."""

    merged = augment_patch_desktop_config_from_user_line(user_line, list(parsed_actions), principal_id=principal_id)
    merged = augment_actions_from_user_open_intent(user_line, list(merged), shell_norm=shell_norm)
    merged = augment_actions_shell_listing_ordinals(user_line, merged, shell_norm)

    appendix = ""
    cid = (content_catalog_user_id or "").strip()
    focus_stack = file_focus_stack_from_profile(profile)
    turn_catalog_rows = list(catalog_prebuilt_bundle.collected_rows) if catalog_prebuilt_bundle is not None else None
    if cid:
        query_svc = await companion_content_query_service_optional()
        if query_svc is not None:
            try:
                merged = await augment_actions_doceditor_via_content_search(
                    user_line,
                    merged,
                    content_catalog_user_id=cid,
                    oauth2_sub=((oauth2_sub_for_content_alternate or "").strip() or None),
                    query_svc=query_svc,
                    shell_norm=shell_norm,
                    file_focus_stack=focus_stack,
                    turn_catalog_rows=turn_catalog_rows,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("companion_doc_open_augment_failed err=%s", exc)

            try:
                merged, catalog_apx = await augment_companion_catalog_find_reply(
                    user_line,
                    merged,
                    content_catalog_user_id=cid,
                    oauth2_sub=((oauth2_sub_for_content_alternate or "").strip() or None),
                    query_svc=query_svc,
                    prebuilt_bundle=catalog_prebuilt_bundle,
                )
                appendix = (catalog_apx or "").strip()
            except Exception as exc:  # noqa: BLE001
                logger.warning("companion_catalog_find_augment_failed err=%s", exc)

    merged = strip_unjustified_doceditor_open_app_actions(user_line, merged, shell_norm)
    merged = strip_unjustified_patch_desktop_config_actions(user_line, merged, principal_id=principal_id)
    merged = strip_unjustified_musicplayer_open_app_actions(user_line, merged)
    return merged, appendix


async def maybe_persist_companion_file_focus(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    actions: list[dict[str, Any]],
    catalog_prebuilt_bundle: CompanionCatalogFindBundle | None,
) -> None:
    """Update the file-focus ring after catalogue preview or DocEditor ``open_app`` augmentation."""

    entry = pick_turn_file_focus_entry(
        actions=actions,
        catalog_rows=(catalog_prebuilt_bundle.collected_rows if catalog_prebuilt_bundle else None),
    )
    if entry is None:
        return
    try:
        await companion_pg.companion_record_file_focus(
            pool,
            principal_id=principal_id,
            unified_content_id=entry["unified_content_id"],
            name=entry.get("name"),
            source=str(entry.get("source") or "turn"),
        )
    except Exception as exc:  # noqa: BLE001 — non-fatal observability
        logger.warning("companion_file_focus_persist_failed principal=%s err=%s", principal_id, exc)


async def process_main_llm_raw_reply(
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    *,
    base_url: str,
    model_raw: str,
    timeout: httpx.Timeout,
    reply_raw: str,
    user_line: str,
    principal_id: str,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    shell_norm: Mapping[str, Any] | None,
    catalog_bundle: CompanionCatalogFindBundle | None,
    profile: Mapping[str, Any],
    orchestrated_sidecar_actions: list[dict[str, Any]] | None = None,
    orchestrated_catalog_appendix_prefetch: str = "",
) -> MainLlmPostExtractResult:
    """Extract visible reply/actions from raw LLM text and run shared server augmentations."""

    reply_visible_raw, parsed_memories, parsed_actions = extract_visible_reply_memory_actions(reply_raw)
    parsed_actions, catalog_appendix = await finalize_companion_actions(
        user_line,
        list(parsed_actions or []),
        principal_id=principal_id,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        shell_norm=shell_norm,
        catalog_prebuilt_bundle=catalog_bundle,
        profile=profile,
    )
    if orchestrated_sidecar_actions:
        parsed_actions = merge_orchestration_sidecar_actions(parsed_actions, orchestrated_sidecar_actions)
    if orchestrated_catalog_appendix_prefetch and not catalog_appendix:
        catalog_appendix = orchestrated_catalog_appendix_prefetch

    catalog_output_surface: dict[str, Any] | None = None
    if catalog_bundle is not None and catalog_appendix:
        catalog_output_surface = catalog_find_bundle_output_surface(catalog_bundle)

    await maybe_persist_companion_file_focus(
        pool,
        principal_id=principal_id,
        actions=parsed_actions,
        catalog_prebuilt_bundle=catalog_bundle,
    )
    parsed_actions, reply_visible_raw = await augment_translate_and_scrub_visible_reply_for_doc_body(
        client,
        base_url=base_url,
        model_raw=model_raw,
        timeout=timeout,
        user_line=user_line,
        parsed_actions=parsed_actions,
        content_catalog_user_id=content_catalog_user_id,
        shell_norm=shell_norm,
        reply_visible_raw=reply_visible_raw,
    )
    if catalog_appendix:
        reply_visible_raw = merge_visible_reply_catalog_appendix_unless_surface(
            reply_visible_raw,
            catalog_appendix,
            catalog_output_surface,
        )

    return MainLlmPostExtractResult(
        reply_visible_raw=reply_visible_raw,
        parsed_memories=parsed_memories,
        parsed_actions=parsed_actions,
        catalog_appendix=catalog_appendix,
        catalog_output_surface=catalog_output_surface,
    )


__all__ = (
    "MainLlmPostExtractResult",
    "augment_translate_and_scrub_visible_reply_for_doc_body",
    "finalize_companion_actions",
    "maybe_persist_companion_file_focus",
    "merge_orchestration_sidecar_actions",
    "process_main_llm_raw_reply",
)

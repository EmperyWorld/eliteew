# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared turn entry preamble: message normalize, dedup replay, intake gate, deterministic short-circuit (sync + SSE).
# Invariants:
# - Agentic intake gate runs before deterministic routing when EWA_AGENTIC_INTAKE_GATE is on.
# - agentic_mandatory never falls through to file_rewrite / file-surface deterministic branches.
# - Deterministic routing skipped when vision attachment is present.
# - ``surface=esp_display`` skips agentic intake and deterministic routing (TFT desk gadget).
# - Dedup replay has no side effects.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# - documentation/product/ewa/EWA-ESP-DISPLAY-AI.md
# ---

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Mapping
from dataclasses import dataclass
from typing import Any

import asyncpg

from api.core.auth import User
from api.ewa_platform.agentic.intake.gate import (
    agentic_intake_gate_enabled,
    classify_companion_intake,
    log_companion_intake_verdict,
)
from api.ewa_platform.agentic.intake.turn_resolver import resolve_agentic_intake_turn
from api.ewa_platform.companion.orchestration.deterministic_router import maybe_route_deterministic_turn
from api.ewa_platform.companion.sidecar.shell_context import normalize_shell_context_payload
from api.ewa_platform.companion.surface_blocks import attach_surface_blocks_to_chat_payload
from api.ewa_platform.companion.turn.companion_image_ocr_analyze import (
    companion_ocr_text_from_image_attachment,
    format_companion_image_ocr_context,
)
from api.ewa_platform.companion.turn.phases.visible_reply import truncate_text
from api.ewa_platform.companion.turn.turn_dedup import (
    companion_turn_dedup_store_response,
    companion_turn_dedup_try_fetch_response,
    iter_companion_turn_dedup_sse_replay,
)
from api.ewa_platform.companion.turn.turn_llm_runtime import sse_event
from api.ewa_platform.companion.turn.vision_attachment import (
    companion_vision_enabled,
    companion_vision_multimodal_enabled,
    resolve_companion_vision_data_url,
)

_MAX_MESSAGE_CHARS = 8000

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class TurnMessageContext:
    """Normalized user input for one companion turn (sync + SSE)."""

    shell_norm: dict[str, Any] | None
    user_line: str
    vision_data_url: str | None
    has_image_attachment: bool = False
    image_ocr_context: str | None = None


def normalize_turn_message_context(
    *,
    message: str,
    shell_context: Mapping[str, Any] | None = None,
) -> TurnMessageContext:
    shell_norm: dict[str, Any] | None = None
    if shell_context is not None:
        shell_norm = normalize_shell_context_payload(shell_context)
    user_line = truncate_text(message, _MAX_MESSAGE_CHARS)
    return TurnMessageContext(
        shell_norm=shell_norm,
        user_line=user_line,
        vision_data_url=None,
    )


async def resolve_turn_message_context(
    *,
    message: str,
    shell_context: Mapping[str, Any] | None = None,
    image_attachment: Mapping[str, Any] | None = None,
) -> TurnMessageContext:
    """Normalize message; resolve image attachment to multimodal URL or OCR+LLM fallback."""

    base = normalize_turn_message_context(message=message, shell_context=shell_context)
    if image_attachment is None:
        return base
    if not companion_vision_enabled():
        msg = "companion_vision_disabled"
        raise ValueError(msg)

    if companion_vision_multimodal_enabled():
        vision_data_url = resolve_companion_vision_data_url(image_attachment)
        return TurnMessageContext(
            shell_norm=base.shell_norm,
            user_line=base.user_line,
            vision_data_url=vision_data_url,
            has_image_attachment=True,
        )

    ocr_text = await companion_ocr_text_from_image_attachment(image_attachment)
    image_ocr_context = format_companion_image_ocr_context(ocr_text=ocr_text)
    logger.info(
        "[STEP] companion_vision_ocr_fallback ocr_chars=%s multimodal=0",
        len(ocr_text),
    )
    return TurnMessageContext(
        shell_norm=base.shell_norm,
        user_line=base.user_line,
        vision_data_url=None,
        has_image_attachment=True,
        image_ocr_context=image_ocr_context,
    )


def build_deterministic_final_payload(
    response: Mapping[str, Any],
    *,
    companion_revision: int,
) -> dict[str, Any]:
    """Shape a pre-LLM deterministic response into the chat final payload contract."""

    out: dict[str, Any] = {
        "reply": str(response.get("reply") or "").strip(),
        "companion_revision": companion_revision,
        "actions": [dict(a) for a in (response.get("actions") or []) if isinstance(a, Mapping)],
        "task_run": response.get("task_run"),
        "desktop_config_patch_applied": False,
        "transformed_this_turn": False,
        "transform_event_kind": None,
    }
    for key in (
        "turn_plan_hint",
        "turn_plan_next_tool",
        "turn_plan_source",
        "output_surface",
        "surface_blocks",
        "deterministic_route",
        "intake_verdict",
        "routing_debug",
    ):
        value = response.get(key)
        if value:
            out[key] = value
    return out


async def finalize_companion_sync_response(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    payload: Mapping[str, Any],
) -> dict[str, Any]:
    out = attach_surface_blocks_to_chat_payload(payload)
    await companion_turn_dedup_store_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        response=out,
    )
    return out


async def _pre_llm_turn_route(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    profile: Mapping[str, Any],
    msg_ctx: TurnMessageContext,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    bearer_token: str | None,
    auth_user: User,
    surface: str | None = None,
) -> dict[str, Any] | None:
    """Intake gate + deterministic short-circuit. ``None`` → continue main LLM path."""

    if (surface or "").strip().lower() == "esp_display":
        logger.info(
            "[STEP] companion_pre_llm_route_skipped principal=%s reason=esp_display_surface",
            principal_id,
        )
        return None

    if agentic_intake_gate_enabled():
        from api.ewa_platform.persistence_pg import agentic_asyncpg as agentic_pg

        active_sess = await agentic_pg.agentic_session_fetch_active_for_principal(
            pool,
            principal_id=principal_id,
        )
        verdict = classify_companion_intake(
            msg_ctx.user_line,
            has_active_agentic_session=active_sess is not None,
        )
        log_companion_intake_verdict(msg_ctx.user_line, verdict)

        if verdict.lane in {"agentic_mandatory", "agentic_active_steering"}:
            return await resolve_agentic_intake_turn(
                pool,
                principal_id=principal_id,
                user_line=msg_ctx.user_line,
                verdict=verdict,
                client_turn_id=client_turn_id,
                content_catalog_user_id=content_catalog_user_id,
                oauth2_sub=oauth2_sub_for_content_alternate,
            )

        blocked = verdict.block_deterministic_branches
    else:
        blocked = frozenset()

    return await maybe_route_deterministic_turn(
        pool,
        principal_id=principal_id,
        user_line=msg_ctx.user_line,
        shell_norm=msg_ctx.shell_norm,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        bearer_token=bearer_token,
        auth_user=auth_user,
        profile=profile,
        blocked_branches=blocked,
    )


async def resolve_sync_turn_entry_early(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    profile: Mapping[str, Any],
    msg_ctx: TurnMessageContext,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    bearer_token: str | None,
    auth_user: User,
    surface: str | None = None,
) -> dict[str, Any] | None:
    """Return finalized sync payload on dedup/deterministic short-circuit, else ``None``."""

    dedup_cached = await companion_turn_dedup_try_fetch_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
    )
    if dedup_cached is not None:
        return dedup_cached

    if msg_ctx.has_image_attachment:
        return None

    routed = await _pre_llm_turn_route(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        profile=profile,
        msg_ctx=msg_ctx,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        bearer_token=bearer_token,
        auth_user=auth_user,
        surface=surface,
    )
    if routed is None or routed.get("continue_main_llm"):
        return None

    final_payload = build_deterministic_final_payload(
        routed,
        companion_revision=int(profile["companion_revision"]),
    )
    return await finalize_companion_sync_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        payload=final_payload,
    )


async def iter_sse_turn_entry_early(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    client_turn_id: str | None,
    profile: Mapping[str, Any],
    msg_ctx: TurnMessageContext,
    content_catalog_user_id: str | None,
    oauth2_sub_for_content_alternate: str | None,
    bearer_token: str | None,
    auth_user: User,
) -> AsyncIterator[str]:
    """Yield SSE chunks for dedup replay or deterministic short-circuit; empty if main path continues."""

    dedup_cached = await companion_turn_dedup_try_fetch_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
    )
    if dedup_cached is not None:
        async for piece in iter_companion_turn_dedup_sse_replay(dedup_cached):
            yield piece
        return

    if msg_ctx.has_image_attachment:
        return

    routed = await _pre_llm_turn_route(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        profile=profile,
        msg_ctx=msg_ctx,
        content_catalog_user_id=content_catalog_user_id,
        oauth2_sub_for_content_alternate=oauth2_sub_for_content_alternate,
        bearer_token=bearer_token,
        auth_user=auth_user,
    )
    if routed is None or routed.get("continue_main_llm"):
        return

    final_payload = build_deterministic_final_payload(
        routed,
        companion_revision=int(profile["companion_revision"]),
    )
    reply = str(final_payload.get("reply") or "").strip()
    if reply:
        yield sse_event("delta", {"chunk": reply})
    actions = final_payload.get("actions")
    if actions:
        yield sse_event("actions", {"actions": actions})
    final_payload = attach_surface_blocks_to_chat_payload(final_payload)
    yield sse_event("final", final_payload)
    await companion_turn_dedup_store_response(
        pool,
        principal_id=principal_id,
        client_turn_id=client_turn_id,
        response=final_payload,
    )
    yield sse_event("done", {})


__all__ = (
    "TurnMessageContext",
    "build_deterministic_final_payload",
    "finalize_companion_sync_response",
    "iter_sse_turn_entry_early",
    "normalize_turn_message_context",
    "resolve_sync_turn_entry_early",
    "resolve_turn_message_context",
)

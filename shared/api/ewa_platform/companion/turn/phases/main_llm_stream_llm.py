# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SSE main LLM invoke helpers: non-stream doc-replace gate, token accumulation, doc-replace prefinal delta.
# Invariants:
# - JSON-envelope streams buffer tokens until extract; caller yields ``token_delta_chunks`` only when not buffering.
# - Doc-replace path emits one pre-final ``delta`` before ``finalize_main_llm_turn_after_llm``.
# - Main LLM OpenAI body always includes Gemma 4 template kwargs via ``companion_chat_template_kwargs``.
# Related:
# - api/ewa_platform/companion/turn/phases/main_llm_post_extract.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-TURN-PHASES.md
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx

from api.core.auth import User
from api.ewa_platform.companion.context.noise import apply_companion_visible_reply_guards
from api.ewa_platform.companion.contracts import CompanionIntentPlanV1 as CompanionIntentPlan
from api.ewa_platform.companion.storage.doceditor_edit_body import (
    companion_doc_body_edit_enabled,
    companion_user_intent_edit_replace_editor,
)
from api.ewa_platform.companion.storage.doceditor_translate_body import (
    companion_doc_body_translate_enabled,
    companion_user_intent_translate_replace_editor,
    resolve_doc_editor_unified_id_for_shell,
)
from api.ewa_platform.companion.turn.phases.visible_reply import coerce_visible_reply_for_turn
from api.ewa_platform.companion.turn.turn_llm_runtime import (
    companion_chat_template_kwargs,
    companion_llm_extra_params,
)
from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line
from api.ewa_platform.companion.ux.desktop_config_execute import (
    companion_apply_patch_desktop_config_actions,
)
from api.ewa_platform.companion.ux.reply_extract import reply_stream_should_buffer_json_envelope
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix
from api.utils.llm_openai_compat_http import (
    httpx_compat_chat_completion_json,
    httpx_compat_chat_completion_stream,
)


def _scrub_stream_visible_text(raw: str) -> str:
    """Strip Gemma 4 channel / think markers from streaming or final assistant text."""

    return strip_llm_thinking_prefix(strip_llm_channel_markup(raw or "")).strip()


def should_use_nonstream_doc_replace(user_line: str, shell_norm: Mapping[str, Any] | None) -> bool:
    """Translate-/edit-replace-document intents must not flash token deltas before server scrub."""

    uc_resolved_edit = resolve_doc_editor_unified_id_for_shell(shell_norm or {})
    return (companion_doc_body_translate_enabled() and companion_user_intent_translate_replace_editor(user_line)) or (
        companion_doc_body_edit_enabled()
        and companion_user_intent_edit_replace_editor(user_line)
        and bool((uc_resolved_edit or "").strip())
    )


async def fetch_main_llm_completion_text(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    messages: list[dict[str, Any]],
    options: dict[str, Any],
    timeout: httpx.Timeout,
) -> str:
    """Non-streaming OpenAI-compat chat completion; returns trimmed assistant text."""

    out = await httpx_compat_chat_completion_json(
        client,
        base_url,
        model=model,
        messages=messages,
        options=options,
        timeout=timeout,
        chat_template_kwargs=companion_chat_template_kwargs(),
        extra_params=companion_llm_extra_params() or None,
    )
    return _scrub_stream_visible_text(str(out.get("response", "") or ""))


@dataclass(frozen=True, slots=True)
class MainLlmStreamTokenAccum:
    """Accumulated stream tokens and replay chunks for the SSE path."""

    reply_raw: str
    token_delta_chunks: tuple[str, ...]
    json_envelope_buffered: bool


async def consume_main_llm_stream_tokens(
    client: httpx.AsyncClient,
    base_url: str,
    *,
    model: str,
    messages: list[dict[str, Any]],
    options: dict[str, Any],
    timeout: httpx.Timeout,
) -> MainLlmStreamTokenAccum:
    """Consume HTTP LLM stream; buffer JSON-envelope prefixes without emitting token deltas.

    Channel-markup scrub runs on the **accumulated** text so markers split across SSE chunks
    never reach the UI (Gemma 4 ``enable_thinking=false`` prefill leak).
    """

    full_reply_parts: list[str] = []
    json_envelope_buffered = False
    token_delta_chunks: list[str] = []
    emitted_clean_len = 0
    async for piece in httpx_compat_chat_completion_stream(
        client,
        base_url,
        model=model,
        messages=messages,
        options=options,
        timeout=timeout,
        chat_template_kwargs=companion_chat_template_kwargs(),
        extra_params=companion_llm_extra_params() or None,
    ):
        full_reply_parts.append(piece)
        acc = "".join(full_reply_parts)
        cleaned_acc = strip_llm_thinking_prefix(strip_llm_channel_markup(acc))
        if reply_stream_should_buffer_json_envelope(cleaned_acc) or reply_stream_should_buffer_json_envelope(acc):
            json_envelope_buffered = True
        if not json_envelope_buffered and len(cleaned_acc) > emitted_clean_len:
            token_delta_chunks.append(cleaned_acc[emitted_clean_len:])
            emitted_clean_len = len(cleaned_acc)
    return MainLlmStreamTokenAccum(
        reply_raw=_scrub_stream_visible_text("".join(full_reply_parts)),
        token_delta_chunks=tuple(token_delta_chunks),
        json_envelope_buffered=json_envelope_buffered,
    )


@dataclass(frozen=True, slots=True)
class DocReplacePrefinalResult:
    """Visible reply for doc-replace SSE pre-final ``delta`` event."""

    visible_reply: str
    parsed_actions: list[dict[str, Any]]
    desktop_config_patch_applied: bool


async def build_doc_replace_prefinal_visible_reply(
    *,
    reply_visible_raw: str,
    parsed_actions: list[dict[str, Any]],
    user_line: str,
    shell_norm: Mapping[str, Any] | None,
    intent_plan: CompanionIntentPlan | None,
    catalog_appendix: str,
    bearer_token: str | None,
    auth_user: User | None,
    orchestrated_branch_defer: str | None,
    orchestrated_turn_plan_next_tool: str | None,
) -> DocReplacePrefinalResult:
    """Coerce/guard visible reply for doc-replace turns and apply desktop-config before pre-final SSE delta."""

    actions, cfg_applied = await companion_apply_patch_desktop_config_actions(
        list(parsed_actions),
        bearer_token=bearer_token,
        auth_user=auth_user,
    )
    visible_reply = coerce_visible_reply_for_turn(
        reply_visible_raw,
        user_line=user_line,
        actions=actions,
        shell_norm=shell_norm,
        catalog_appendix=catalog_appendix or "",
        desktop_config_patch_applied=cfg_applied,
    )
    visible_reply = apply_companion_visible_reply_guards(
        visible_reply,
        user_line=user_line,
        intent_plan=intent_plan,
        actions=actions,
        trivial_user_message=is_trivial_chit_chat_user_line(user_line),
        effective_branch=orchestrated_branch_defer,
        deferred_music_generation=orchestrated_turn_plan_next_tool in {"music_generation", "music_generation_xl_base"},
    )
    return DocReplacePrefinalResult(
        visible_reply=visible_reply,
        parsed_actions=actions,
        desktop_config_patch_applied=cfg_applied,
    )


__all__ = (
    "DocReplacePrefinalResult",
    "MainLlmStreamTokenAccum",
    "build_doc_replace_prefinal_visible_reply",
    "consume_main_llm_stream_tokens",
    "fetch_main_llm_completion_text",
    "should_use_nonstream_doc_replace",
)

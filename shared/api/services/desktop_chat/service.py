# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public facade for Desktop AI Chat orchestration — re-exports helpers/RAG/persist/tool-loop/stream.
# Stable import path: api.services.desktop_chat.service.
# Invariants:
# - Export names remain stable for routers, ensemble, and pytest patches of private helpers.
# - Implementation lives in service_*.py siblings; this file is re-export only.
# Related:
# - api/routers/desktop_ai_chat.py
# - documentation/product/DESKTOP-LLAMA-CHAT.md
# ---
"""Orchestration: history, RAG blocks, Llama stream or tool-loop, persist messages."""

from __future__ import annotations

from api.services.desktop_chat.collaboration_access import load_chat_for_user
from api.services.desktop_chat.service_helpers import (
    MAX_HISTORY_MESSAGES,
    _assistant_claims_no_web_data,
    _maybe_temporal_short_circuit_reply,
    _post_router_tool_followup_nudge,
    _router_executed_tool_name,
    _router_executed_tool_preview,
    fetch_config_defaults,
    load_speaker_context,
    record_desktop_chat_turn_memory,
    resolve_desktop_chat_model,
    try_recover_tool_calls_from_assistant_text,
    verify_project_for_chat,
)
from api.services.desktop_chat.service_persist import (
    _assistant_metadata_with_prompt_versions,
    apply_ensemble_document_confirm,
    messages_for_llama,
    persist_assistant_message,
    persist_assistant_message_isolated,
    persist_message_metadata_isolated,
    persist_user_message,
    persist_user_message_isolated,
)
from api.services.desktop_chat.service_rag import build_rag_prefix
from api.services.desktop_chat.service_stream import stream_chat_turn
from api.services.desktop_chat.service_tool_loop import run_tool_loop

__all__ = [
    "MAX_HISTORY_MESSAGES",
    "_assistant_claims_no_web_data",
    "_assistant_metadata_with_prompt_versions",
    "_maybe_temporal_short_circuit_reply",
    "_post_router_tool_followup_nudge",
    "_router_executed_tool_name",
    "_router_executed_tool_preview",
    "apply_ensemble_document_confirm",
    "build_rag_prefix",
    "fetch_config_defaults",
    "load_chat_for_user",
    "load_speaker_context",
    "messages_for_llama",
    "persist_assistant_message",
    "persist_assistant_message_isolated",
    "persist_message_metadata_isolated",
    "persist_user_message",
    "persist_user_message_isolated",
    "record_desktop_chat_turn_memory",
    "resolve_desktop_chat_model",
    "run_tool_loop",
    "stream_chat_turn",
    "try_recover_tool_calls_from_assistant_text",
    "verify_project_for_chat",
]

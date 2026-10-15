# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Core types, REGISTRY assembly, and ``dispatch_tool_by_name`` for EWA companion server-only tools.
# Invariants:
# - Tool handlers return ``ToolResult`` or ``None``; registry is the single discovery surface.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/orchestration/tools/handlers_*.py
# ---
"""EWA companion tool registry core (types, REGISTRY, dispatch)."""

from __future__ import annotations

import logging
import socket
from collections.abc import Mapping
from typing import Any, Final

import httpx  # noqa: F401  # pyright: ignore[reportUnusedImport]

from api.ewa_platform.companion.orchestration.tool_result_utils import as_mapping_dict
from api.ewa_platform.companion.orchestration.tools.registry_types import (
    ToolContext,
    ToolDescriptor,
    ToolHandler,
    ToolResult,
    ToolStatus,
)

logger = logging.getLogger(__name__)


# -- registry -----------------------------------------------------------------

REGISTRY: Final[dict[str, ToolDescriptor]] = {
    "plan_v1": ToolDescriptor(
        name="plan_v1",
        summary=(
            "Create a server-persisted user plan (goals + tasks) from natural language. "
            "Gated by ``EWA_COMPANION_PLAN_ENABLED``; optional LLM structuring via "
            "``EWA_COMPANION_PLAN_LLM_ENABLED``."
        ),
        input_keys=("user_line", "plan_focus", "horizon"),
        result_keys=("reply", "data"),
        requires=("companion_pool",),
    ),
    "plan_task_complete_v1": ToolDescriptor(
        name="plan_task_complete_v1",
        summary="Mark a task in the active companion plan as completed (chat utterance).",
        input_keys=("user_line",),
        result_keys=("reply", "data"),
        requires=("companion_pool",),
    ),
    "calendar_v1": ToolDescriptor(
        name="calendar_v1",
        summary=(
            "List upcoming personal CalendarApp events or create one from chat. "
            "Personal events are ``desktop_calendar_events``; assistant plan steps stay on companion-plans."
        ),
        input_keys=("user_line", "title"),
        result_keys=("reply", "data"),
        requires=("main_pool",),
    ),
    "recall_memory": ToolDescriptor(
        name="recall_memory",
        summary=(
            "Answer what the companion remembers from EWA profile memory. Regex-gated unless "
            "``_intent_planner_bypass_line_match`` is set by intent planner dispatch."
        ),
        input_keys=("user_line",),
        result_keys=("reply",),
        requires=("companion_pool",),
    ),
    "check_task_status": ToolDescriptor(
        name="check_task_status",
        summary=(
            "Ground-truth status for one durable companion background task run by ``task_id`` / ``run_id`` (UUID). "
            "Returns normalized PENDING|RUNNING|COMPLETED|FAILED plus pipeline progress and error summary. "
            "Read-only — no side effects."
        ),
        input_keys=("task_id", "run_id", "user_line"),
        result_keys=("reply", "data", "task_run"),
        requires=("companion_pool",),
    ),
    "operations_status": ToolDescriptor(
        name="operations_status",
        summary=(
            "Ground-truth summary of active companion operations on this desk (music/image/workflow runs). "
            "Used for queries like «что сейчас выполняется?» / «what is running right now». Read-only."
        ),
        input_keys=("user_line",),
        result_keys=("reply", "data", "task_run"),
        requires=("companion_pool",),
    ),
    "operation_cancel": ToolDescriptor(
        name="operation_cancel",
        summary=(
            "Cancel one active companion operation (music/image/user workflow). Chooses explicit ``run_id`` when provided "
            "or the latest cancellable run for the principal."
        ),
        input_keys=("run_id", "task_id", "user_line"),
        result_keys=("reply", "data", "task_run"),
        requires=("companion_pool",),
    ),
    "file_rewrite": ToolDescriptor(
        name="file_rewrite",
        summary=(
            "Full server-side rewrite of a named catalog file (.md / .txt / .html). Resolves the file by name, "
            "reads owner bytes, asks the HTTP LLM for a sanitized replacement, then writes via "
            "ContentStorageService.replace_file_content which **snapshots the previous body** into "
            "content_versions before overwrite (non-destructive). Prefer mode=append or doc_append_block for "
            "fragment edits. Optionally opens DocEditor afterwards."
        ),
        input_keys=("user_line", "file_query", "rewrite_brief", "open_editor", "mode"),
        result_keys=("reply", "actions"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "doc_append_block": ToolDescriptor(
        name="doc_append_block",
        summary=(
            "Append one attributable content block to a catalog document without rewriting unrelated fragments. "
            "Uses ContentStorageService.append_to_content with expected_version optimistic locking (AIP Phase 2)."
        ),
        input_keys=(
            "unified_content_id",
            "content_id",
            "file_query",
            "block_content",
            "author_role",
            "block_type",
        ),
        result_keys=("reply", "data"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "call_expert_chat": ToolDescriptor(
        name="call_expert_chat",
        summary=(
            "Invoke Desktop AI Chat expert ensemble for plan clarification; optionally append output as "
            "an attributable document block (AIP Phase 2). Agentic orchestrator bridge."
        ),
        input_keys=(
            "user_line",
            "prompt",
            "expert_roles",
            "unified_content_id",
            "blueprint_template_id",
            "append_to_document",
            "author_role",
        ),
        result_keys=("reply", "data"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "catalog_list": ToolDescriptor(
        name="catalog_list",
        summary=(
            "Server-side EwaFile catalog listing (browse / keyword search). Optional folder_name / folder_item_id "
            "scopes to one nested ewa-task-* folder. Returns markdown appendix and optional Content Manager preview."
        ),
        input_keys=("user_line", "mode", "folder_name", "folder_item_id"),
        result_keys=("reply", "actions", "data"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "catalog_discuss": ToolDescriptor(
        name="catalog_discuss",
        summary=(
            "Read a named file from the catalog and inject a sanitized body excerpt for chat discussion — "
            "wraps ``storage.catalog_file_discuss``. Phase C handler."
        ),
        input_keys=("user_line", "file_name"),
        result_keys=("reply", "data"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "social_post_compose": ToolDescriptor(
        name="social_post_compose",
        summary=(
            "Compose a ready-to-publish social post (Telegram, VK, etc.) via sidecar LLM. Optional grounding on a "
            "named catalogue document when the user references a file."
        ),
        input_keys=("user_line", "channel", "brief"),
        result_keys=("reply", "data"),
        requires=(),
    ),
    "file_create": ToolDescriptor(
        name="file_create",
        summary=(
            "Create a .md / .txt / .html document in EwaFile (root by default; nested folder only on explicit "
            "create/reuse intent). Generative body via sidecar LLM when body omitted; HITL confirm unless "
            "agentic auto-accept. Handler: handlers_files._handle_file_create."
        ),
        input_keys=(
            "user_line",
            "name",
            "body",
            "create_folder",
            "reuse_folder",
            "folder_name",
            "folder_item_id",
            "task_key",
        ),
        result_keys=("reply", "actions", "task_run"),
        requires=("content_catalog_user_id", "companion_pool", "main_pool"),
    ),
    "file_save_text": ToolDescriptor(
        name="file_save_text",
        summary=(
            "Save explicit text into a new catalog document (.md default). Workflow/router bypass or structured "
            "tool_args with non-empty body; reuses doc_create confirmation flow. Not for LLM-composed content "
            "(use file_create)."
        ),
        input_keys=(
            "user_line",
            "name",
            "body",
            "text",
            "create_folder",
            "reuse_folder",
            "folder_name",
            "folder_item_id",
        ),
        result_keys=("reply", "actions", "task_run"),
        requires=("content_catalog_user_id", "companion_pool"),
    ),
    "file_rename": ToolDescriptor(
        name="file_rename",
        summary=(
            "Rename a catalog file under EwaFile (server-side ContentStorageService.update_content) with HITL "
            "confirm. Resolves via name / deictic file-focus (resolve_file_target)."
        ),
        input_keys=("user_line", "unified_content_id", "new_name", "old_query"),
        result_keys=("reply", "actions", "task_run"),
        requires=("content_catalog_user_id", "companion_pool", "main_pool"),
    ),
    "file_delete": ToolDescriptor(
        name="file_delete",
        summary=("Soft-delete a catalog file under EwaFile with HITL confirm. Resolves via name / deictic file-focus."),
        input_keys=("user_line", "unified_content_id"),
        result_keys=("reply", "task_run"),
        requires=("content_catalog_user_id", "companion_pool", "main_pool"),
    ),
    "file_open": ToolDescriptor(
        name="file_open",
        summary=(
            "Open one EwaFile catalog row in DocEditor. Resolves by explicit ``unified_content_id``, file name, or "
            "deictic reference via the file-focus ring — no shell ``surface_listing`` ordinals."
        ),
        input_keys=("user_line", "file_query", "unified_content_id"),
        result_keys=("reply", "actions"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "doc_insert": ToolDescriptor(
        name="doc_insert",
        summary=(
            "Insert a fragment from one file into the document currently open in DocEditor. Requires an open editor "
            "(``shell_norm.doc_editor_window``)."
        ),
        input_keys=("user_line", "source_file_query"),
        result_keys=("reply", "actions", "task_run"),
        requires=("content_catalog_user_id", "open_doc_editor", "companion_pool", "main_pool"),
    ),
    "paperless_import": ToolDescriptor(
        name="paperless_import",
        summary="Import one document from Paperless-ngx archive into DocEditor V2 / unified_content.",
        input_keys=("paperless_id", "user_line"),
        result_keys=("reply", "actions", "unified_content_id"),
        requires=("content_catalog_user_id", "main_pool"),
    ),
    "telegram_sender": ToolDescriptor(
        name="telegram_sender",
        summary=(
            "Send a Telegram message via Bot API. Feature-flagged. "
            "Direct chat/agent invoke opens HITL needs_confirm unless agentic auto-accept. "
            "DAG outbound requires upstream confirm_gate (sets internal send authorization)."
        ),
        input_keys=("message_text", "text", "reply", "chat_id", "user_line"),
        result_keys=("reply", "delivery_status", "chat_id", "message_id", "task_run"),
        requires=("main_pool", "auth_user"),
    ),
    "email_dispatcher": ToolDescriptor(
        name="email_dispatcher",
        summary=(
            "Send email via operator SMTP. Feature-flagged. "
            "Direct chat/agent invoke opens HITL needs_confirm unless agentic auto-accept. "
            "DAG outbound requires upstream confirm_gate (sets internal send authorization)."
        ),
        input_keys=("to", "subject", "body", "text", "reply", "html", "user_line"),
        result_keys=("reply", "delivery_status", "to", "task_run"),
        requires=(),
    ),
    "vision_analyze": ToolDescriptor(
        name="vision_analyze",
        summary="Analyze an image via companion vision pipeline (multimodal or OCR+LLM fallback).",
        input_keys=(
            "image_url",
            "attachment_id",
            "prompt",
            "question",
            "data_base64",
            "mime_type",
            "user_line",
        ),
        result_keys=("reply", "analysis_text", "text"),
        requires=(),
    ),
    "llm_summarize": ToolDescriptor(
        name="llm_summarize",
        summary="Summarize long workflow text via stack2 chat model (stateless-friendly).",
        input_keys=("text", "body", "reply", "prompt", "instruction", "user_line"),
        result_keys=("reply", "summary_text", "analysis_text", "text"),
        requires=(),
    ),
    "llm_classify": ToolDescriptor(
        name="llm_classify",
        summary="Classify workflow text into a category label with optional rule hint.",
        input_keys=("text", "body", "reply", "categories", "labels", "rules", "contains", "user_line"),
        result_keys=("reply", "category", "matched", "analysis_text", "text"),
        requires=(),
    ),
    "pdf_parser": ToolDescriptor(
        name="pdf_parser",
        summary="Extract plain text from a PDF workflow document (Stack4 Tika + OCR fallback).",
        input_keys=(
            "unified_content_id",
            "document_id",
            "paperless_id",
            "filename",
            "mime_type",
            "file_base64",
            "user_line",
        ),
        result_keys=(
            "reply",
            "text",
            "extracted_text",
            "filename",
            "mime_type",
            "char_count",
            "page_count",
            "error",
        ),
        requires=(),
    ),
    "document_extractor": ToolDescriptor(
        name="document_extractor",
        summary="Extract plain text from DOCX/TXT workflow documents via Stack4 Tika.",
        input_keys=(
            "unified_content_id",
            "document_id",
            "paperless_id",
            "filename",
            "mime_type",
            "file_base64",
            "user_line",
        ),
        result_keys=(
            "reply",
            "text",
            "extracted_text",
            "filename",
            "mime_type",
            "char_count",
            "page_count",
            "error",
        ),
        requires=(),
    ),
    "theme_set": ToolDescriptor(
        name="theme_set",
        summary=(
            "Server-side desktop theme (light/dark/auto) and optional accent_color write via PATCH /desktop/config. "
            "Infers theme/accent from RU/EN phrases when args omitted."
        ),
        input_keys=("theme", "accent", "accent_color", "user_line"),
        result_keys=("reply",),
        requires=("companion_pool",),
    ),
    "music_generation": ToolDescriptor(
        name="music_generation",
        summary=(
            "Server-side Music Generator **Версия 2 / XL Turbo** (``ugs_workflow=v2``): same wizard chain as "
            "«Основной» — ``/music-generator/lyrics`` → ``/suggest-production-params`` → ``/generate-style`` → "
            "``/music-generator/generate`` with Bearer, ``billing_mode=wizard``. Base URL "
            "``…/api/v1/music-generator`` (strip ``/v3`` from env if present). Gated by "
            "``EWA_COMPANION_BACKEND_MUSIC_GENERATION``. On success: ``needs_confirm`` or ``ok`` + ``music_play_track`` "
            "when autoplay phrases / args are set."
        ),
        input_keys=(
            "user_line",
            "theme",
            "creative_brief",
            "mood",
            "extra_context",
            "understood_summary_ru",
            "understood_summary_en",
            "dialog_context",
            "conversation_context",
            "lyrics",
            "genre",
            "style",
            "duration",
            "duration_seconds",
            "bpm",
            "vocal",
            "language",
            "voice_diversity",
            "luna_mode",
            "ugs_workflow",
            "ace_workflow",
            "tags",
            "name",
            "skip_lyrics_validation",
            "autoplay",
            "play_when_ready",
            "immediate_play",
            "play_immediately",
        ),
        result_keys=("reply", "data", "task_run"),
        requires=(),
    ),
    "music_xl_base_interactive": ToolDescriptor(
        name="music_xl_base_interactive",
        summary=(
            "Open an interactive companion XL Base launch surface. The user chooses theme, style, vocal and language; "
            "the final CTA sends a structured command back to companion chat and delegates generation to "
            "``music_generation_xl_base`` / ``ugs_workflow=v2_base``."
        ),
        input_keys=("user_line",),
        result_keys=("reply", "output_surface", "data"),
        requires=(),
    ),
    "music_generation_xl_base": ToolDescriptor(
        name="music_generation_xl_base",
        summary=(
            "EWA companion **XL Base (v2_base) autonomous** music: companion derives lyrics/tags from dialog mood, "
            "persona, and memory; same HTTP wizard chain with ``target_ugs_workflow=v2_base``, "
            "``billing_mode=companion_xl_base``, ``ksampler_use_comfy_template=true``. Triggers: "
            "«напиши сама текст», «по своему настроению песню», EN mood/self lyrics phrases. "
            "Separate UGS ``music_generator_generate_ace_v2_base_companion``."
        ),
        input_keys=(
            "user_line",
            "theme",
            "creative_brief",
            "mood",
            "style",
            "genre",
            "vocal",
            "language",
            "autoplay",
            "understood_summary_ru",
            "understood_summary_en",
            "dialog_context",
            "conversation_context",
        ),
        result_keys=("reply", "data", "task_run"),
        requires=(),
    ),
    "image_generation": ToolDescriptor(
        name="image_generation",
        summary=(
            "Generate or edit an image via UGS (ComfyUI) in the background when the user asks to draw / create / modify a picture. "
            "Extracts the prompt from RU/EN imperatives («нарисуй …», «сгенерируй картинку …», "
            "«generate an image …») and can use ``uc=<id>`` or a turn image attachment as edit source. "
            "Gated by ``EWA_COMPANION_IMAGE_GENERATION_ENABLED``."
        ),
        input_keys=("user_line", "prompt", "aspect_ratio", "image_tool_mode", "source_unified_content_id"),
        result_keys=("reply", "data", "task_run"),
        requires=("content_catalog_user_id", "companion_pool"),
    ),
    "image_tool": ToolDescriptor(
        name="image_tool",
        summary=(
            "Deprecated alias of ``image_generation`` (same handler). Prefer ``image_generation`` in new plans. "
            "Generate/edit via UGS; vision analysis stays on the multimodal chat path."
        ),
        input_keys=("user_line", "prompt", "aspect_ratio", "image_tool_mode", "source_unified_content_id"),
        result_keys=("reply", "data", "task_run"),
        requires=("content_catalog_user_id", "companion_pool"),
    ),
    "presentation_generation": ToolDescriptor(
        name="presentation_generation",
        summary=(
            "Start the shipped EWRP presentation product from companion chat. The tool creates a durable "
            "companion run, calls authenticated ``/api/v1/ewrp`` to start the real EWRP job, and mirrors progress/PDF "
            "metadata into the operations panel."
        ),
        input_keys=(
            "user_line",
            "topic",
            "title",
            "num_slides",
            "extra_context",
            "presentation_theme",
            "default_slide_layout",
            "web_search_quality",
        ),
        result_keys=("reply", "data", "task_run"),
        requires=("companion_pool", "bearer_token"),
    ),
    "music_studio_open": ToolDescriptor(
        name="music_studio_open",
        summary=(
            "Thin launcher: open Music Studio (MusicGenerator) via allowlisted open_app. "
            "Prefer music_generation / music_generation_xl_base when the user wants generation, not just the UI."
        ),
        input_keys=("user_line",),
        result_keys=("reply", "actions"),
        requires=(),
    ),
    "app_open": ToolDescriptor(
        name="app_open",
        summary=(
            "Generic server-side desktop app launcher. Validates ``app_component`` against the EWA companion "
            "allowlist (``actions.allowlist.ALLOWED_APP_COMPONENTS``) and emits an ``open_app`` SPA action; in "
            "inferred mode parses RU/EN imperatives «открой / запусти / open / launch <NAME>» and matches against "
            "``_APP_OPEN_ALIASES``. Returns ``None`` when the line is not an open-app intent."
        ),
        input_keys=("app_component", "payload", "user_line"),
        result_keys=("reply", "actions"),
        requires=(),
    ),
    "mcp_list": ToolDescriptor(
        name="mcp_list",
        summary=(
            "List allowlisted MCP servers for EWA surface, or tools for one server_id. "
            "Gated by ELITEEW_MCP_HOST_ENABLED / mcp_host_enabled. Explicit tool invoke only."
        ),
        input_keys=("server_id", "list_servers", "invoke"),
        result_keys=("reply",),
        requires=(),
    ),
    "mcp_call": ToolDescriptor(
        name="mcp_call",
        summary=(
            "Call a tool on an allowlisted MCP server (e.g. server_id=kbsew, tool=kbsew_search). "
            "Gated by ELITEEW_MCP_HOST_ENABLED. Requires server_id + tool."
        ),
        input_keys=("server_id", "tool", "tool_name", "arguments", "query", "barrel_id"),
        result_keys=("reply",),
        requires=(),
    ),
}


# ruff: noqa: I001 — handler import order avoids circular import with companion_music_xl_base.
from api.ewa_platform.companion.orchestration.tools.handlers_comms import HANDLERS as _HANDLERS_COMMS
from api.ewa_platform.companion.orchestration.tools.handlers_desktop import HANDLERS as _HANDLERS_DESKTOP
from api.ewa_platform.companion.orchestration.tools.handlers_files import HANDLERS as _HANDLERS_FILES
from api.ewa_platform.companion.orchestration.tools.handlers_llm_utils import HANDLERS as _HANDLERS_LLM_UTILS
from api.ewa_platform.companion.orchestration.tools.handlers_media import HANDLERS as _HANDLERS_MEDIA
from api.ewa_platform.companion.orchestration.tools.handlers_ops import HANDLERS as _HANDLERS_OPS
from api.ewa_platform.companion.orchestration.tools.handlers_agentic_orchestrator import (
    HANDLERS as _HANDLERS_AGENTIC_ORCH,
)
from api.ewa_platform.companion.orchestration.tools.handlers_mcp import HANDLERS as _HANDLERS_MCP
from api.ewa_platform.companion.orchestration.companion_music_xl_base import (  # noqa: I001
    handle_music_generation_xl_base,
)
from api.ewa_platform.companion.orchestration.companion_music_xl_base_interactive import (  # noqa: I001
    handle_music_xl_base_interactive,
)


_HANDLERS: Final[dict[str, ToolHandler]] = {
    **_HANDLERS_OPS,
    **_HANDLERS_FILES,
    **_HANDLERS_DESKTOP,
    **_HANDLERS_MEDIA,
    **_HANDLERS_LLM_UTILS,
    **_HANDLERS_COMMS,
    **_HANDLERS_AGENTIC_ORCH,
    **_HANDLERS_MCP,
    "music_xl_base_interactive": handle_music_xl_base_interactive,
    "music_generation_xl_base": handle_music_generation_xl_base,
}


def known_tool_names() -> tuple[str, ...]:
    """Stable, sorted tuple of registered tool names (for logs, planner allowlists, tests)."""

    return tuple(sorted(REGISTRY.keys()))


def tool_descriptor(name: str) -> ToolDescriptor | None:
    """Return the descriptor for ``name`` or ``None`` when the tool is not in the registry."""

    return REGISTRY.get(name)


async def dispatch_tool_by_name(
    name: str,
    args: Mapping[str, Any],
    ctx: ToolContext,
) -> ToolResult | None:
    """Run the registered handler for ``name`` or return ``None`` for unknown / inapplicable cases.

    ``None`` is a meaningful return value: callers (orchestrator branches) treat it as "this tool did not handle the
    current input — try the next branch". The handler itself decides when to return ``None`` (e.g. intent did not
    match) vs a populated ``ToolResult`` with ``status="error"`` (e.g. handler ran but storage was unavailable).
    """

    handler = _HANDLERS.get(name)
    if handler is None:
        logger.info("[STEP] companion_tool_dispatch_unknown name=%s", name)
        return None
    try:
        out = await handler(args, ctx)
    except Exception as exc:  # noqa: BLE001 — registry boundary; never crash the orchestrator
        logger.exception("[STEP] companion_tool_dispatch_error name=%s err=%s", name, exc)
        return ToolResult(
            tool=name,
            status="error",
            reply="",
            actions=[],
            data={"exception": type(exc).__name__, "message": str(exc)[:300]},
            task_run=None,
        )
    if out is not None:
        logger.info("[STEP] companion_tool_dispatch_ok name=%s status=%s", name, out.get("status", "ok"))
    return out


def catalog_discuss_memory_tuple_from_result(result: ToolResult | None) -> tuple[str, str, str] | None:
    """Extract memory inject tuple from a ``catalog_discuss`` registry dispatch (Wave C)."""

    if result is None:
        return None
    if str(result.get("status") or "").strip() != "memory_append":
        return None
    data = as_mapping_dict(result.get("data"))
    block = str(data.get("memory_section_append") or "").strip()
    if not block:
        return None
    return (
        block,
        str(data.get("unified_content_id") or "").strip(),
        str(data.get("file_label") or "").strip(),
    )


async def resolve_catalog_discuss_memory_inject(
    ctx: ToolContext,
    *,
    user_line: str,
) -> tuple[str, str, str] | None:
    """Registry-canonical catalog discuss inject — single path for memory_append (Wave C)."""

    result = await dispatch_tool_by_name("catalog_discuss", {"user_line": user_line}, ctx)
    return catalog_discuss_memory_tuple_from_result(result)


__all__ = (
    "REGISTRY",
    "ToolContext",
    "ToolDescriptor",
    "ToolHandler",
    "ToolResult",
    "ToolStatus",
    "catalog_discuss_memory_tuple_from_result",
    "dispatch_tool_by_name",
    "known_tool_names",
    "resolve_catalog_discuss_memory_inject",
    "socket",
    "tool_descriptor",
    "httpx",
)

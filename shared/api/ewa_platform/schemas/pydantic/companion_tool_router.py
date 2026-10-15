# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Pydantic contract for the **EWA companion Tool Router** sidecar (structured FC / meta-tool output).
# Invariants:
# - Router output is advisory until ``task_orchestrator`` validates slots and runs ``tool_registry`` handlers.
# - ``tool=chat_only`` means no server tool dispatch for this turn.
# Related:
# - api/ewa_platform/companion/sidecar/tool_router.py
# - api/ewa_platform/companion/orchestration/tool_router_dispatch.py
# ---
"""Structured tool-routing plan for EWA companion (FC sidecar)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

CompanionRouterTool = Literal[
    "chat_only",
    "plan_v1",
    "plan_task_complete_v1",
    "calendar_v1",
    "check_task_status",
    "file_rewrite",
    "music_generation",
    "music_xl_base_interactive",
    "music_generation_xl_base",
    "operations_status",
    "operation_cancel",
    "image_generation",
    "presentation_generation",
    "social_post_compose",
    "music_studio_open",
    "theme_set",
    "app_open",
    "catalog_list",
    "catalog_discuss",
    "file_open",
    "file_create",
    "file_rename",
    "file_delete",
    "doc_insert",
    "paperless_import",
]

ROUTER_PARTIAL_TOOLS: frozenset[str] = frozenset(
    {
        "music_generation",
        "music_xl_base_interactive",
        "music_generation_xl_base",
        "theme_set",
        "app_open",
    }
)

ROUTER_FULL_TOOLS: frozenset[str] = frozenset(
    {
        "plan_v1",
        "plan_task_complete_v1",
        "calendar_v1",
        "check_task_status",
        "file_rewrite",
        "music_generation",
        "music_xl_base_interactive",
        "music_generation_xl_base",
        "operations_status",
        "operation_cancel",
        "image_generation",
        "presentation_generation",
        "social_post_compose",
        "music_studio_open",
        "theme_set",
        "app_open",
        "catalog_list",
        "catalog_discuss",
        "file_open",
        "file_create",
        "file_rename",
        "file_delete",
        "doc_insert",
        "paperless_import",
    }
)


class CompanionToolRouterResultV1(BaseModel):
    """One-turn routing decision from the Tool Router sidecar."""

    tool: CompanionRouterTool = "chat_only"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    theme: str | None = None
    style: str | None = None
    autoplay: bool | None = None
    app_component: str | None = None
    prompt: str | None = None
    aspect_ratio: str | None = None
    image_tool_mode: str | None = None
    source_unified_content_id: str | None = None
    doc_file_name: str | None = None
    doc_body_text: str | None = None
    insert_source_file_query: str | None = None
    rename_old_query: str | None = None
    rename_new_name: str | None = None
    delete_file_query: str | None = None
    file_query: str | None = None
    unified_content_id: str | None = None
    topic: str | None = None
    title: str | None = None
    num_slides: int | None = None
    presentation_theme: str | None = None
    default_slide_layout: str | None = None
    run_id: str | None = None
    task_id: str | None = None
    understood_summary_ru: str = ""
    understood_summary_en: str = ""


__all__ = (
    "CompanionRouterTool",
    "CompanionToolRouterResultV1",
    "ROUTER_FULL_TOOLS",
    "ROUTER_PARTIAL_TOOLS",
)

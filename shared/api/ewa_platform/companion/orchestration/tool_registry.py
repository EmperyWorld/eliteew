# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Thin re-export preserving the stable import path ``api.ewa_platform.companion.orchestration.tool_registry``.
# Implementation lives in ``orchestration/tools/*`` (registry core + handler modules).
# Invariants:
# - Public contract unchanged: ``REGISTRY``, ``dispatch_tool_by_name``, ``ToolResult``, ``ToolContext``.
# - Private helpers remain importable from this module for legacy callers and tests.
# Related:
# - api/ewa_platform/companion/orchestration/tools/registry_core.py
# - api/ewa_platform/companion/orchestration/tools/handlers_*.py
# - documentation/platform/EWA-COMPANION-SERVER-ONLY-MIGRATION.md
# ---
"""Stable re-export shim for the EWA companion server-only tool registry."""

# ruff: noqa: I001

from __future__ import annotations

import asyncio

# isort: off — registry_core must initialize before handler re-exports (circular import guard).
from api.ewa_platform.companion.orchestration.tools.registry_core import (
    REGISTRY,
    ToolContext,
    ToolDescriptor,
    ToolHandler,
    ToolResult,
    ToolStatus,
    _HANDLERS,
    catalog_discuss_memory_tuple_from_result,
    dispatch_tool_by_name,
    httpx,
    known_tool_names,
    resolve_catalog_discuss_memory_inject,
    tool_descriptor,
    socket,
)
from api.ewa_platform.companion.orchestration.tools.registry_helpers import (
    _resolve_main_pool,
    _tool_router_bypass_line_match,
    companion_pg,
)
from api.ewa_platform.companion.orchestration.tools.handlers_desktop import (
    _handle_catalog_list,
)
from api.ewa_platform.companion.orchestration.tools.handlers_media import (
    _BACKGROUND_MUSIC_TASKS,
    _clamp_companion_pipeline_lyrics,
    _companion_backend_music_generation_enabled,
    _companion_luna_mode,
    _companion_music_wizard_theme,
    _companion_parse_bpm_duration,
    _companion_resolve_music_generation_inputs,
    _companion_ugs_workflow_v2,
    _companion_voice_diversity,
    _handle_music_generation,
    _music_generation_api_base_url,
    _music_generation_autoplay_requested,
    _normalize_main_vocal,
    _remember_background_music_task,
    _resolve_music_job_base_url,
    _run_background_music_generation_job,
    _user_line_is_music_feedback_or_praise,
    _user_line_requests_music_another_one,
    _user_line_requests_music_creation,
    _user_line_requests_music_retry,
)
from api.ewa_platform.companion.orchestration.tools.handlers_common import (
    _looks_like_non_executing_question,
)
from api.ewa_platform.companion.orchestration.tools.handlers_ops import (
    _record_instant_completed_task_run,
)

# isort: on

__all__ = (
    "REGISTRY",
    "ToolContext",
    "ToolDescriptor",
    "ToolHandler",
    "ToolResult",
    "ToolStatus",
    "_BACKGROUND_MUSIC_TASKS",
    "_clamp_companion_pipeline_lyrics",
    "_companion_backend_music_generation_enabled",
    "_companion_luna_mode",
    "_companion_music_wizard_theme",
    "_companion_parse_bpm_duration",
    "_companion_resolve_music_generation_inputs",
    "_companion_ugs_workflow_v2",
    "_companion_voice_diversity",
    "_handle_catalog_list",
    "_handle_music_generation",
    "_looks_like_non_executing_question",
    "_music_generation_api_base_url",
    "_music_generation_autoplay_requested",
    "_normalize_main_vocal",
    "_record_instant_completed_task_run",
    "_remember_background_music_task",
    "_HANDLERS",
    "_resolve_main_pool",
    "_resolve_music_job_base_url",
    "_run_background_music_generation_job",
    "_tool_router_bypass_line_match",
    "_user_line_is_music_feedback_or_praise",
    "_user_line_requests_music_another_one",
    "_user_line_requests_music_creation",
    "_user_line_requests_music_retry",
    "asyncio",
    "catalog_discuss_memory_tuple_from_result",
    "companion_pg",
    "dispatch_tool_by_name",
    "httpx",
    "known_tool_names",
    "resolve_catalog_discuss_memory_inject",
    "socket",
    "tool_descriptor",
)

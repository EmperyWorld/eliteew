# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# L3 Pydantic arg models for agentic core toolset (Phase 3.2).
# Invariants:
# - Tools outside CORE_TOOL_ARG_MODELS fall back to GenericDict L2 validation.
# Related:
# - api/ewa_platform/agentic/kernel/tool_args_validate.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ValidationError

from api.ewa_platform.agentic.schemas.tool_args.core_models import (
    CatalogListArgs,
    CheckTaskStatusArgs,
    EmailDispatcherArgs,
    FileCreateArgs,
    FileDeleteArgs,
    FileOpenArgs,
    FileSaveTextArgs,
    ImageGenerationArgs,
    LlmSummarizeArgs,
    OperationsStatusArgs,
    PaperlessImportArgs,
    PlanV1Args,
    RecallMemoryArgs,
)

# Operator core toolset mapped to live REGISTRY names (not aspirational aliases).
CORE_TOOL_ARG_MODELS: dict[str, type[BaseModel]] = {
    "catalog_list": CatalogListArgs,  # knowledge_base_search / search_web
    "recall_memory": RecallMemoryArgs,  # knowledge_base_search
    "file_open": FileOpenArgs,  # file_reader
    "file_save_text": FileSaveTextArgs,  # file_writer
    "file_create": FileCreateArgs,  # file_writer
    "check_task_status": CheckTaskStatusArgs,  # database_query / task_list
    "image_generation": ImageGenerationArgs,  # image_generator
    "email_dispatcher": EmailDispatcherArgs,  # email_sender
    "plan_v1": PlanV1Args,  # calendar_manager
    "llm_summarize": LlmSummarizeArgs,  # summarization / lightweight compute
    "operations_status": OperationsStatusArgs,
    "paperless_import": PaperlessImportArgs,
    "file_delete": FileDeleteArgs,
}


def validate_core_tool_args(tool_name: str, raw: Mapping[str, Any] | None) -> dict[str, Any]:
    """Validate args via L3 model when registered; return normalized dict."""

    name = str(tool_name or "").strip()
    model = CORE_TOOL_ARG_MODELS.get(name)
    if model is None:
        return dict(raw or {})
    try:
        return model.model_validate(dict(raw or {})).model_dump()
    except ValidationError as exc:
        first = exc.errors()[0]
        loc = ".".join(str(x) for x in first.get("loc", ()))
        raise ValueError(f"tool_args.{loc or 'root'}: {first.get('msg', 'invalid')}") from exc

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Extended tool catalog metadata (WF-0): ``ToolDescriptorV2``, per-tool capability/router flags, and
# ``export_tool_catalog()`` for admin API and contract tests. Merges static ``REGISTRY`` descriptors with
# ``TOOL_V2_META`` overlay — single source for Tool Router allowlist sync checks.
# Invariants:
# - Every key in ``REGISTRY`` must have a matching entry in ``TOOL_V2_META`` (enforced by contract test).
# - ``router_exposed=True`` tools must appear in ``ROUTER_FULL_TOOLS`` or ``ROUTER_PARTIAL_TOOLS``.
# - ``export_tool_catalog`` never raises; unknown registry keys inherit safe defaults.
# Related:
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/schemas/pydantic/companion_tool_router.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §4.1
# ---
"""Tool catalog v2 metadata and export for EWA companion orchestration."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from typing import Any, Literal, TypedDict

from api.ewa_platform.companion.orchestration.tool_registry import ToolDescriptor
from api.ewa_platform.schemas.pydantic.companion_tool_router import (
    ROUTER_FULL_TOOLS,
    ROUTER_PARTIAL_TOOLS,
)

ToolExecutionMode = Literal["sync", "async", "either"]


def _registry() -> Mapping[str, ToolDescriptor]:
    from api.ewa_platform.companion.orchestration.tool_registry import REGISTRY

    return REGISTRY


def _registered_handlers() -> frozenset[str]:
    from api.ewa_platform.companion.orchestration import tool_registry as tr

    return frozenset(tr._HANDLERS.keys())  # noqa: SLF001 — catalog export


@dataclass(frozen=True)
class ToolDescriptorV2:
    """Static metadata for a registered companion tool (admin export + workflow authoring)."""

    name: str
    summary: str
    input_keys: tuple[str, ...] = field(default_factory=tuple)
    result_keys: tuple[str, ...] = field(default_factory=tuple)
    requires: tuple[str, ...] = field(default_factory=tuple)
    server_only: bool = True
    capability: str = "general"
    execution_mode: ToolExecutionMode = "sync"
    router_exposed: bool = False
    router_partial: bool = False
    confirm_by_default: bool = False
    max_concurrent_per_principal: int = 1
    step_kinds: tuple[str, ...] = field(default_factory=tuple)
    slots_schema: dict[str, Any] = field(default_factory=dict)
    handler_registered: bool = False


class ToolCatalogEntryDict(TypedDict):
    name: str
    summary: str
    input_keys: list[str]
    result_keys: list[str]
    requires: list[str]
    server_only: bool
    capability: str
    execution_mode: str
    router_exposed: bool
    router_partial: bool
    confirm_by_default: bool
    max_concurrent_per_principal: int
    step_kinds: list[str]
    slots_schema: dict[str, Any]
    handler_registered: bool


@dataclass(frozen=True)
class _ToolV2MetaOverlay:
    capability: str = "general"
    execution_mode: ToolExecutionMode = "sync"
    router_exposed: bool = False
    router_partial: bool = False
    confirm_by_default: bool = False
    max_concurrent_per_principal: int = 1
    step_kinds: tuple[str, ...] = field(default_factory=tuple)
    slots_schema: dict[str, Any] = field(default_factory=dict)


# Per-tool v2 overlay — keys must match ``REGISTRY`` exactly (contract test).
TOOL_V2_META: dict[str, _ToolV2MetaOverlay] = {
    "plan_v1": _ToolV2MetaOverlay(
        capability="plans",
        execution_mode="sync",
    ),
    "plan_task_complete_v1": _ToolV2MetaOverlay(
        capability="plans",
        execution_mode="sync",
    ),
    "calendar_v1": _ToolV2MetaOverlay(
        capability="calendar",
        execution_mode="sync",
        router_exposed=True,
        slots_schema={
            "title": {"type": "string"},
        },
    ),
    "check_task_status": _ToolV2MetaOverlay(
        capability="operations",
        execution_mode="sync",
    ),
    "recall_memory": _ToolV2MetaOverlay(
        capability="memory",
        execution_mode="sync",
    ),
    "operations_status": _ToolV2MetaOverlay(
        capability="operations",
        execution_mode="sync",
        router_exposed=True,
        router_partial=False,
        slots_schema={
            "run_id": {"type": "string"},
        },
    ),
    "operation_cancel": _ToolV2MetaOverlay(
        capability="operations",
        execution_mode="sync",
        router_exposed=True,
        router_partial=False,
        slots_schema={
            "run_id": {"type": "string"},
            "task_id": {"type": "string"},
        },
    ),
    "file_rewrite": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
        max_concurrent_per_principal=2,
    ),
    "catalog_list": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
    ),
    "catalog_discuss": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
    ),
    "social_post_compose": _ToolV2MetaOverlay(
        capability="text",
        execution_mode="sync",
        router_exposed=True,
        router_partial=False,
        slots_schema={
            "channel": {"type": "string"},
            "brief": {"type": "string"},
            "file_query": {"type": "string"},
        },
    ),
    "file_create": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="either",
        router_exposed=True,
        router_partial=False,
        confirm_by_default=True,
        slots_schema={
            "doc_file_name": {"type": "string"},
            "doc_body_text": {"type": "string"},
        },
    ),
    "file_rename": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="either",
        router_exposed=True,
        confirm_by_default=True,
        slots_schema={
            "rename_old_query": {"type": "string"},
            "rename_new_name": {"type": "string"},
        },
    ),
    "file_delete": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="either",
        router_exposed=True,
        confirm_by_default=True,
        slots_schema={"delete_file_query": {"type": "string"}},
    ),
    "file_open": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
        router_exposed=True,
        slots_schema={
            "file_query": {"type": "string"},
            "unified_content_id": {"type": "string"},
        },
    ),
    "doc_insert": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="either",
        router_exposed=True,
        confirm_by_default=True,
        slots_schema={"insert_source_file_query": {"type": "string"}},
    ),
    "theme_set": _ToolV2MetaOverlay(
        capability="desktop",
        execution_mode="sync",
        router_exposed=True,
        router_partial=True,
        slots_schema={
            "theme": {"type": "string"},
            "style": {"type": "string"},
        },
    ),
    "music_generation": _ToolV2MetaOverlay(
        capability="music",
        execution_mode="async",
        router_exposed=True,
        router_partial=True,
        max_concurrent_per_principal=1,
        step_kinds=("music_generation_pipeline_v2",),
        slots_schema={
            "theme": {"type": "string"},
            "style": {"type": "string"},
            "autoplay": {"type": "boolean"},
        },
    ),
    "music_xl_base_interactive": _ToolV2MetaOverlay(
        capability="music",
        execution_mode="sync",
        router_exposed=True,
        router_partial=True,
        max_concurrent_per_principal=1,
        slots_schema={
            "user_line": {"type": "string"},
        },
    ),
    "music_generation_xl_base": _ToolV2MetaOverlay(
        capability="music",
        execution_mode="async",
        router_exposed=True,
        router_partial=True,
        max_concurrent_per_principal=1,
        step_kinds=("music_generation_pipeline_xl_base",),
        slots_schema={
            "theme": {"type": "string"},
            "style": {"type": "string"},
            "mood": {"type": "string"},
            "creative_brief": {"type": "string"},
            "autoplay": {"type": "boolean"},
        },
    ),
    "image_generation": _ToolV2MetaOverlay(
        capability="image",
        execution_mode="async",
        router_exposed=True,
        router_partial=False,
        max_concurrent_per_principal=1,
        slots_schema={
            "prompt": {"type": "string"},
            "theme": {"type": "string"},
            "style": {"type": "string"},
            "aspect_ratio": {"type": "string"},
            "image_tool_mode": {"type": "string"},
            "source_unified_content_id": {"type": "string"},
        },
    ),
    "image_tool": _ToolV2MetaOverlay(
        capability="image",
        execution_mode="async",
        max_concurrent_per_principal=1,
        slots_schema={
            "prompt": {"type": "string"},
            "aspect_ratio": {"type": "string"},
            "image_tool_mode": {"type": "string"},
            "source_unified_content_id": {"type": "string"},
        },
    ),
    "presentation_generation": _ToolV2MetaOverlay(
        capability="presentation",
        execution_mode="async",
        router_exposed=True,
        router_partial=False,
        max_concurrent_per_principal=1,
        step_kinds=("presentation_generation_pipeline",),
        slots_schema={
            "topic": {"type": "string"},
            "title": {"type": "string"},
            "num_slides": {"type": "integer"},
            "presentation_theme": {"type": "string"},
            "default_slide_layout": {"type": "string"},
        },
    ),
    "music_studio_open": _ToolV2MetaOverlay(
        capability="desktop",
        execution_mode="sync",
        router_exposed=True,
    ),
    "app_open": _ToolV2MetaOverlay(
        capability="desktop",
        execution_mode="sync",
        router_exposed=True,
        router_partial=True,
        slots_schema={"app_component": {"type": "string"}},
    ),
    "paperless_import": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
        router_exposed=True,
        router_partial=False,
        slots_schema={"paperless_id": {"type": "integer"}},
    ),
    "file_save_text": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="either",
        confirm_by_default=True,
        slots_schema={
            "name": {"type": "string"},
            "body": {"type": "string"},
            "text": {"type": "string"},
        },
    ),
    "telegram_sender": _ToolV2MetaOverlay(
        capability="integrations",
        execution_mode="sync",
        confirm_by_default=True,
        slots_schema={
            "message_text": {"type": "string"},
            "chat_id": {"type": "string"},
        },
    ),
    "email_dispatcher": _ToolV2MetaOverlay(
        capability="integrations",
        execution_mode="sync",
        confirm_by_default=True,
        slots_schema={
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
        },
    ),
    "vision_analyze": _ToolV2MetaOverlay(
        capability="vision",
        execution_mode="sync",
        max_concurrent_per_principal=2,
        slots_schema={
            "image_url": {"type": "string"},
            "attachment_id": {"type": "string"},
            "prompt": {"type": "string"},
        },
    ),
    "llm_summarize": _ToolV2MetaOverlay(
        capability="text",
        execution_mode="sync",
        slots_schema={
            "text": {"type": "string"},
            "instruction": {"type": "string"},
        },
    ),
    "llm_classify": _ToolV2MetaOverlay(
        capability="text",
        execution_mode="sync",
        slots_schema={
            "text": {"type": "string"},
            "categories": {"type": "array"},
        },
    ),
    "pdf_parser": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
        max_concurrent_per_principal=2,
        slots_schema={
            "unified_content_id": {"type": "string"},
            "document_id": {"type": "string"},
            "filename": {"type": "string"},
        },
    ),
    "document_extractor": _ToolV2MetaOverlay(
        capability="storage",
        execution_mode="sync",
        max_concurrent_per_principal=2,
        slots_schema={
            "unified_content_id": {"type": "string"},
            "document_id": {"type": "string"},
            "filename": {"type": "string"},
        },
    ),
}


def tool_descriptor_v2(
    name: str,
    *,
    handler_registered: bool | None = None,
) -> ToolDescriptorV2 | None:
    """Merge ``REGISTRY`` base descriptor with v2 overlay."""

    base = _registry().get(name)
    if base is None:
        return None
    overlay = TOOL_V2_META.get(name)
    if handler_registered is None:
        handler_registered = name in _registered_handlers()
    if overlay is None:
        return _merge_descriptor(base, _ToolV2MetaOverlay(), handler_registered=handler_registered)
    return _merge_descriptor(base, overlay, handler_registered=handler_registered)


def _merge_descriptor(
    base: ToolDescriptor,
    overlay: _ToolV2MetaOverlay,
    *,
    handler_registered: bool,
) -> ToolDescriptorV2:
    return ToolDescriptorV2(
        name=base.name,
        summary=base.summary,
        input_keys=base.input_keys,
        result_keys=base.result_keys,
        requires=base.requires,
        server_only=base.server_only,
        capability=overlay.capability,
        execution_mode=overlay.execution_mode,
        router_exposed=overlay.router_exposed,
        router_partial=overlay.router_partial,
        confirm_by_default=overlay.confirm_by_default,
        max_concurrent_per_principal=overlay.max_concurrent_per_principal,
        step_kinds=overlay.step_kinds,
        slots_schema=dict(overlay.slots_schema),
        handler_registered=handler_registered,
    )


def export_tool_catalog(
    *,
    handler_registered: Mapping[str, bool] | None = None,
) -> list[ToolCatalogEntryDict]:
    """Export sorted tool catalog for admin API and contract tests."""

    default_handlers = _registered_handlers()
    out: list[ToolCatalogEntryDict] = []
    for name in sorted(_registry().keys()):
        flag = handler_registered.get(name) if handler_registered is not None else (name in default_handlers)
        desc = tool_descriptor_v2(name, handler_registered=flag)
        if desc is None:
            continue
        raw = asdict(desc)
        entry: ToolCatalogEntryDict = {
            "name": raw["name"],
            "summary": raw["summary"],
            "input_keys": list(raw["input_keys"]),
            "result_keys": list(raw["result_keys"]),
            "requires": list(raw["requires"]),
            "server_only": raw["server_only"],
            "capability": raw["capability"],
            "execution_mode": raw["execution_mode"],
            "router_exposed": raw["router_exposed"],
            "router_partial": raw["router_partial"],
            "confirm_by_default": raw["confirm_by_default"],
            "max_concurrent_per_principal": raw["max_concurrent_per_principal"],
            "step_kinds": list(raw["step_kinds"]),
            "slots_schema": dict(raw["slots_schema"]),
            "handler_registered": raw["handler_registered"],
        }
        out.append(entry)
    return out


def router_allowlist_contract_errors() -> list[str]:
    """Return human-readable contract violations (empty list = OK)."""

    errors: list[str] = []
    registry_names = set(_registry().keys())
    meta_names = set(TOOL_V2_META.keys())
    if registry_names != meta_names:
        missing_meta = sorted(registry_names - meta_names)
        orphan_meta = sorted(meta_names - registry_names)
        if missing_meta:
            errors.append(f"TOOL_V2_META missing keys: {missing_meta}")
        if orphan_meta:
            errors.append(f"TOOL_V2_META orphan keys (not in REGISTRY): {orphan_meta}")

    router_union = ROUTER_FULL_TOOLS | ROUTER_PARTIAL_TOOLS
    for name, overlay in TOOL_V2_META.items():
        if not overlay.router_exposed:
            continue
        if name not in router_union:
            errors.append(f"router_exposed tool {name!r} missing from ROUTER_FULL/PARTIAL allowlists")
        if overlay.router_partial and name not in ROUTER_PARTIAL_TOOLS:
            errors.append(f"router_partial=True for {name!r} but not in ROUTER_PARTIAL_TOOLS")
        if name in ROUTER_PARTIAL_TOOLS and not overlay.router_partial:
            errors.append(f"{name!r} in ROUTER_PARTIAL_TOOLS but router_partial=False in TOOL_V2_META")

    for router_name in router_union:
        if router_name not in registry_names:
            errors.append(f"Router allowlist tool {router_name!r} not in REGISTRY")

    return errors


__all__ = (
    "ToolCatalogEntryDict",
    "ToolDescriptorV2",
    "TOOL_V2_META",
    "export_tool_catalog",
    "router_allowlist_contract_errors",
    "tool_descriptor_v2",
)

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Builtin declarative action workflows (catalog). Runtime enablement via ENV gates (WF-1).
# Invariants:
# - Builtins ship with ``enabled=False``; ``env_gate`` + ``workflows/config.py`` control activation.
# - PG catalog merge (WF-6) is out of scope here.
# Related:
# - api/ewa_platform/companion/workflows/action/schema.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §7.2
# ---

from __future__ import annotations

from api.ewa_platform.companion.orchestration.tool_registry import known_tool_names
from api.ewa_platform.companion.workflows.action.schema import (
    CompanionWorkflowDefinitionV1,
    validate_workflow_tools_registered,
)
from api.ewa_platform.companion.workflows.config import (
    companion_workflow_catalog_list_file_create_dev_enabled,
    companion_workflow_doc_package_v1_enabled,
    companion_workflow_music_full_v1_enabled,
)

_ENV_GATE_RESOLVERS: dict[str, object] = {
    "EWA_COMPANION_WF_MUSIC_FULL_V1": companion_workflow_music_full_v1_enabled,
    "EWA_COMPANION_WF_DOC_PACKAGE_V1": companion_workflow_doc_package_v1_enabled,
    "EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV": companion_workflow_catalog_list_file_create_dev_enabled,
}


def _music_full_cycle_v1() -> CompanionWorkflowDefinitionV1:
    return CompanionWorkflowDefinitionV1.model_validate(
        {
            "workflow_id": "music_full_cycle_v1",
            "version": 1,
            "title_ru": "Полный цикл музыки",
            "title_en": "Music full cycle",
            "description_ru": "Генерация трека и подтверждение воспроизведения",
            "description_en": "Generate track and confirm playback",
            "enabled": False,
            "execution_mode": "async",
            "env_gate": "EWA_COMPANION_WF_MUSIC_FULL_V1",
            "tags": ["music", "pilot"],
            "triggers": [{"type": "regex", "pattern": "(?i)сгенерируй.*и\\s+включи"}],
            "steps": [
                {
                    "step_key": "generate",
                    "kind": "tool",
                    "tool_name": "music_generation",
                    "step_kind": "music_generation_pipeline_v2",
                    "title_ru": "Генерация",
                    "title_en": "Generation",
                    "retry": {
                        "max_attempts": 2,
                        "backoff_ms": 5000,
                        "retry_on": ["timeout", "503", "broker_down", "generate"],
                    },
                },
                {
                    "step_key": "confirm_play",
                    "kind": "confirm_gate",
                    "title_ru": "Подтверждение воспроизведения",
                    "title_en": "Confirm playback",
                },
            ],
        },
    )


def _doc_package_v1() -> CompanionWorkflowDefinitionV1:
    return CompanionWorkflowDefinitionV1.model_validate(
        {
            "workflow_id": "doc_package_v1",
            "version": 1,
            "title_ru": "Создать документ и открыть редактор",
            "title_en": "Create document and open editor",
            "description_ru": "Создание файла с подтверждением и открытие Doc Editor",
            "description_en": "Create file with confirm gate then open Doc Editor",
            "enabled": False,
            "execution_mode": "sync",
            "env_gate": "EWA_COMPANION_WF_DOC_PACKAGE_V1",
            "tags": ["document", "pilot"],
            "triggers": [{"type": "regex", "pattern": "(?i)создай\\s+документ\\s+и\\s+открой"}],
            "steps": [
                {
                    "step_key": "create",
                    "kind": "tool",
                    "tool_name": "file_create",
                    "step_kind": "file_create",
                    "requires_confirm": True,
                    "title_ru": "Создание файла",
                    "title_en": "Create file",
                    "args_template": {"user_line": "{{turn.user_line}}"},
                },
                {
                    "step_key": "open_editor",
                    "kind": "tool",
                    "tool_name": "app_open",
                    "step_kind": "app_open",
                    "depends_on_step_keys": ["create"],
                    "title_ru": "Открыть Doc Editor",
                    "title_en": "Open Doc Editor",
                    "args_template": {
                        "app_component": "DocEditor",
                        "payload": {"unified_content_id": "{{steps.0.output.unified_content_id}}"},
                    },
                },
            ],
        },
    )


def _catalog_list_file_create_dev_v1() -> CompanionWorkflowDefinitionV1:
    return CompanionWorkflowDefinitionV1.model_validate(
        {
            "workflow_id": "catalog_list_file_create_dev_v1",
            "version": 1,
            "title_ru": "Список файлов и создать документ (dev)",
            "title_en": "List catalog then create file (dev)",
            "description_ru": "Dev-only: показать каталог EwaFile, затем предложить создать файл с подтверждением",
            "description_en": "Dev-only: browse EwaFile catalog, then file_create with confirm gate",
            "enabled": False,
            "execution_mode": "sync",
            "env_gate": "EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV",
            "tags": ["dev", "document", "catalog"],
            "triggers": [
                {
                    "type": "regex",
                    "pattern": "(?i)покажи\\s+файлы\\s+и\\s+создай",
                },
            ],
            "steps": [
                {
                    "step_key": "list_catalog",
                    "kind": "tool",
                    "tool_name": "catalog_list",
                    "step_kind": "tool_dispatch",
                    "title_ru": "Список файлов",
                    "title_en": "Catalog list",
                    "args_template": {"user_line": "{{turn.user_line}}", "mode": "list"},
                },
                {
                    "step_key": "create_file",
                    "kind": "tool",
                    "tool_name": "file_create",
                    "step_kind": "file_create",
                    "requires_confirm": True,
                    "depends_on_step_keys": ["list_catalog"],
                    "title_ru": "Создать файл",
                    "title_en": "Create file",
                    "args_template": {"user_line": "{{turn.user_line}}"},
                },
            ],
        },
    )


_BUILTIN_FACTORIES: dict[str, object] = {
    "music_full_cycle_v1": _music_full_cycle_v1,
    "doc_package_v1": _doc_package_v1,
    "catalog_list_file_create_dev_v1": _catalog_list_file_create_dev_v1,
}

_BUILTIN_CACHE: dict[str, CompanionWorkflowDefinitionV1] | None = None


def _load_builtins() -> dict[str, CompanionWorkflowDefinitionV1]:
    global _BUILTIN_CACHE  # noqa: PLW0603
    if _BUILTIN_CACHE is not None:
        return _BUILTIN_CACHE
    registered = frozenset(known_tool_names())
    loaded: dict[str, CompanionWorkflowDefinitionV1] = {}
    for workflow_id, factory in _BUILTIN_FACTORIES.items():
        definition = factory()  # type: ignore[operator]
        errors = validate_workflow_tools_registered(definition, registered_tools=registered)
        if errors:
            msg = f"builtin workflow {workflow_id!r} invalid: {errors}"
            raise RuntimeError(msg)
        loaded[workflow_id] = definition
    _BUILTIN_CACHE = loaded
    return loaded


def list_builtin_workflows(*, include_disabled: bool = True) -> list[CompanionWorkflowDefinitionV1]:
    """Return builtin workflow definitions (optionally filter by effective enablement)."""

    items = list(_load_builtins().values())
    if include_disabled:
        return items
    return [wf for wf in items if effective_workflow_enabled(wf)]


def get_builtin_workflow(workflow_id: str) -> CompanionWorkflowDefinitionV1 | None:
    wid = str(workflow_id or "").strip()
    if not wid:
        return None
    return _load_builtins().get(wid)


def effective_workflow_enabled(definition: CompanionWorkflowDefinitionV1) -> bool:
    """Resolve ENV gate for a workflow definition."""

    gate = str(definition.env_gate or "").strip()
    if gate:
        resolver = _ENV_GATE_RESOLVERS.get(gate)
        if resolver is not None:
            return bool(resolver())  # type: ignore[operator]
    return bool(definition.enabled)


__all__ = (
    "effective_workflow_enabled",
    "get_builtin_workflow",
    "list_builtin_workflows",
)

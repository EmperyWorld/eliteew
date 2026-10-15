# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unified companion workflow registry: chat LLM workflows (``reflect_week``) plus action catalog builtins.
# Invariants:
# - Chat LLM workflows execute via ``workflows/chat/runner`` (no Celery step loop).
# - Action workflows resolve through ``services/workflow_catalog`` (PG + builtins).
# Related:
# - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §Phase 4.1
# - api/ewa_platform/companion/workflows/chat/registry.py
# ---

from __future__ import annotations

import re
from enum import StrEnum
from typing import TYPE_CHECKING

from api.ewa_platform.companion.plans.config import companion_workflow_enabled
from api.ewa_platform.companion.workflows.chat.registry import WorkflowId, match_workflow_id
from api.ewa_platform.companion.workflows.config import companion_workflow_engine_enabled

if TYPE_CHECKING:
    from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1

CHAT_LLM_TAG = "chat_llm"

_REFLECT_WEEK_TRIGGER_RE = (
    r"(?is)"
    r"(?:\bподвед(?:и|ите)\s+итог(?:и)?\s+недел\w*"
    r"|\bитоги\s+недел\w*"
    r"|\bweekly\s+review\b"
    r"|\breflect\s+on\s+(?:the\s+)?week\b)"
)


class WorkflowRuntimeKind(StrEnum):
    CHAT_LLM = "chat_llm"
    ACTION = "action"


def is_chat_llm_definition(definition: CompanionWorkflowDefinitionV1) -> bool:
    return CHAT_LLM_TAG in frozenset(definition.tags or [])


def reflect_week_catalog_definition() -> CompanionWorkflowDefinitionV1:
    """Catalog metadata for ``reflect_week`` (execution stays in chat runner)."""

    from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1

    return CompanionWorkflowDefinitionV1.model_validate(
        {
            "workflow_id": "reflect_week",
            "version": 1,
            "title_ru": "Итоги недели",
            "title_en": "Weekly reflection",
            "description_ru": "LLM-only chat workflow: подведи итоги недели",
            "description_en": "LLM-only chat workflow triggered by weekly review phrases",
            "enabled": False,
            "execution_mode": "sync",
            "env_gate": "EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED",
            "tags": [CHAT_LLM_TAG, "reflection"],
            "triggers": [{"type": "regex", "pattern": _REFLECT_WEEK_TRIGGER_RE}],
            "steps": [
                {
                    "step_key": "llm_reflect",
                    "kind": "llm_compose",
                    "title_ru": "Сводка недели",
                    "title_en": "Weekly summary",
                },
            ],
        },
    )


_CHAT_CATALOG_FACTORIES: dict[str, object] = {
    WorkflowId.REFLECT_WEEK.value: reflect_week_catalog_definition,
}

_CHAT_CATALOG_CACHE: dict[str, CompanionWorkflowDefinitionV1] | None = None


def _load_chat_catalog() -> dict[str, CompanionWorkflowDefinitionV1]:
    global _CHAT_CATALOG_CACHE  # noqa: PLW0603
    if _CHAT_CATALOG_CACHE is not None:
        return _CHAT_CATALOG_CACHE
    loaded: dict[str, CompanionWorkflowDefinitionV1] = {}
    for workflow_id, factory in _CHAT_CATALOG_FACTORIES.items():
        loaded[workflow_id] = factory()  # type: ignore[operator]
    _CHAT_CATALOG_CACHE = loaded
    return loaded


def list_chat_catalog_workflows() -> list[CompanionWorkflowDefinitionV1]:
    return list(_load_chat_catalog().values())


def get_chat_catalog_workflow(workflow_id: str) -> CompanionWorkflowDefinitionV1 | None:
    wid = str(workflow_id or "").strip()
    if not wid:
        return None
    return _load_chat_catalog().get(wid)


def workflow_runtime_kind(workflow_id: str) -> WorkflowRuntimeKind | None:
    wid = str(workflow_id or "").strip()
    if not wid:
        return None
    if wid in _load_chat_catalog():
        return WorkflowRuntimeKind.CHAT_LLM
    from api.ewa_platform.companion.workflows.action.registry import get_builtin_workflow

    if get_builtin_workflow(wid) is not None:
        return WorkflowRuntimeKind.ACTION
    return None


def effective_workflow_enabled(definition: CompanionWorkflowDefinitionV1) -> bool:
    if is_chat_llm_definition(definition):
        return companion_workflow_enabled(definition.workflow_id)
    from api.ewa_platform.companion.workflows.action.registry import (
        effective_workflow_enabled as action_workflow_effective_enabled,
    )

    return action_workflow_effective_enabled(definition)


def match_chat_workflow_from_line(user_line: str) -> str | None:
    matched = match_workflow_id(user_line)
    if matched is None:
        return None
    return matched.value


def match_action_workflow_from_line(user_line: str) -> CompanionWorkflowDefinitionV1 | None:
    from api.ewa_platform.companion.workflows.action.registry import (
        effective_workflow_enabled as action_workflow_effective_enabled,
    )
    from api.ewa_platform.companion.workflows.action.registry import (
        list_builtin_workflows,
    )

    if not companion_workflow_engine_enabled():
        return None
    line = str(user_line or "")
    if not line.strip():
        return None
    for definition in list_builtin_workflows(include_disabled=False):
        if not action_workflow_effective_enabled(definition):
            continue
        for trigger in definition.triggers:
            if trigger.type != "regex":
                continue
            pattern = str(trigger.pattern or "").strip()
            if pattern and re.search(pattern, line):
                return definition
    return None


def resolve_workflow_definition(
    workflow_id: str,
    *,
    pg_definition: CompanionWorkflowDefinitionV1 | None = None,
) -> CompanionWorkflowDefinitionV1 | None:
    """Resolve a workflow id from PG row, chat catalog, or action builtins (in that order)."""

    from api.ewa_platform.companion.workflows.action.registry import get_builtin_workflow

    wid = str(workflow_id or "").strip()
    if not wid:
        return None
    if pg_definition is not None and pg_definition.workflow_id == wid:
        return pg_definition
    chat = get_chat_catalog_workflow(wid)
    if chat is not None:
        return chat
    return get_builtin_workflow(wid)


__all__ = (
    "CHAT_LLM_TAG",
    "WorkflowRuntimeKind",
    "effective_workflow_enabled",
    "get_chat_catalog_workflow",
    "is_chat_llm_definition",
    "list_chat_catalog_workflows",
    "match_action_workflow_from_line",
    "match_chat_workflow_from_line",
    "reflect_week_catalog_definition",
    "resolve_workflow_definition",
    "workflow_runtime_kind",
)

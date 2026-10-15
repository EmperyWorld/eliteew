# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Validate, merge, and resolve action workflow definitions (builtins + PG catalog, WF-6).
# Invariants:
# - PG enabled row overrides builtin for the same ``workflow_id`` when ``EWA_COMPANION_WF_PG_CATALOG=1``.
# - Builtin env gates still apply unless PG row sets ``enabled`` and engine is on.
# Related:
# - api/ewa_platform/companion/workflows/action/registry.py
# - api/ewa_platform/gateways/routers/companion_admin.py
# ---

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import Any, Literal

import asyncpg
from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.orchestration.tool_registry import known_tool_names
from api.ewa_platform.companion.workflows.action.registry import (
    effective_workflow_enabled,
    get_builtin_workflow,
    list_builtin_workflows,
)
from api.ewa_platform.companion.workflows.action.schema import (
    CompanionWorkflowDefinitionV1,
    extract_workflow_tool_names,
    validate_workflow_tools_registered,
)
from api.ewa_platform.companion.workflows.config import (
    companion_workflow_engine_enabled,
    companion_workflow_pg_catalog_enabled,
)
from api.ewa_platform.persistence_pg import companion_workflow_catalog_asyncpg as catalog_pg
from api.ewa_platform.schemas.pydantic.companion_workflow import CompanionWorkflowValidateResponseV1

logger = logging.getLogger(__name__)

CatalogSource = Literal["builtin", "pg", "merged"]

_BROAD_REGEX_TRIGGER_RE = re.compile(r"(?:(?<!\w)\.(?:\*|\.\+|\*\?)(?!\w)|^\.\*$|^\.\+$|^\.\*\?$)")


def _workflow_trigger_warnings(model: CompanionWorkflowDefinitionV1) -> list[str]:
    warnings: list[str] = []
    for trigger in model.triggers:
        if trigger.type != "regex":
            continue
        pattern = str(trigger.pattern or "").strip()
        if not pattern:
            continue
        if _BROAD_REGEX_TRIGGER_RE.search(pattern) or pattern in {".*", ".+", ".*?", ".+?"}:
            warnings.append(f"trigger regex looks very broad: {pattern!r}")
    return warnings


def validate_workflow_definition_raw(
    definition: Mapping[str, Any],
) -> CompanionWorkflowValidateResponseV1:
    errors: list[str] = []
    try:
        model = CompanionWorkflowDefinitionV1.model_validate(dict(definition))
    except Exception as exc:  # noqa: BLE001 — return errors to admin UI
        errors.append(str(exc)[:500])
        return CompanionWorkflowValidateResponseV1(
            ok=False,
            workflow_id=str(definition.get("workflow_id") or ""),
            version=int(definition.get("version") or 0) or 0,
            step_count=0,
            tool_names=[],
            errors=errors,
            warnings=[],
        )
    tool_errors = validate_workflow_tools_registered(model, registered_tools=frozenset(known_tool_names()))
    errors.extend(tool_errors)
    warnings = _workflow_trigger_warnings(model)
    return CompanionWorkflowValidateResponseV1(
        ok=not errors,
        workflow_id=model.workflow_id,
        version=model.version,
        step_count=len(model.steps),
        tool_names=list(extract_workflow_tool_names(model)),
        errors=errors,
        warnings=warnings,
    )


def _definition_from_pg_row(row: Mapping[str, Any]) -> CompanionWorkflowDefinitionV1 | None:
    raw = row.get("definition")
    if not isinstance(raw, Mapping):
        return None
    try:
        return CompanionWorkflowDefinitionV1.model_validate(dict(raw))
    except Exception as exc:  # noqa: BLE001
        workflow_id = str(row.get("workflow_id") or "").strip() or "unknown"
        companion_degrade_debug(
            logger,
            "workflow_definition_pg_row",
            "invalid workflow definition in PG catalog row",
            exc=exc,
            workflow_id=workflow_id,
        )
        return None


def pg_workflow_effective_enabled(row: Mapping[str, Any]) -> bool:
    if not bool(row.get("enabled")):
        return False
    if not companion_workflow_engine_enabled():
        return False
    definition = _definition_from_pg_row(row)
    if definition is None:
        return False
    gate = str(definition.env_gate or "").strip()
    if gate:
        from api.ewa_platform.companion.orchestration.workflow_registry import (
            effective_workflow_enabled as registry_effective_workflow_enabled,
        )
        from api.ewa_platform.companion.orchestration.workflow_registry import (
            is_chat_llm_definition,
        )

        if is_chat_llm_definition(definition):
            return registry_effective_workflow_enabled(definition)
        return effective_workflow_enabled(definition)
    return True


async def get_runtime_workflow(
    pool: asyncpg.Pool | None,
    workflow_id: str,
) -> CompanionWorkflowDefinitionV1 | None:
    wid = str(workflow_id or "").strip()
    if not wid:
        return None
    if companion_workflow_pg_catalog_enabled() and pool is not None:
        row = await catalog_pg.workflow_catalog_get_enabled(pool, workflow_id=wid)
        if row is not None:
            definition = _definition_from_pg_row(row)
            if definition is not None:
                return definition
    from api.ewa_platform.companion.orchestration.workflow_registry import get_chat_catalog_workflow

    chat = get_chat_catalog_workflow(wid)
    if chat is not None:
        return chat
    return get_builtin_workflow(wid)


async def list_runtime_workflows(
    pool: asyncpg.Pool | None,
    *,
    include_disabled: bool = False,
) -> list[tuple[CompanionWorkflowDefinitionV1, CatalogSource, bool]]:
    """Return (definition, source, effective_enabled) tuples for admin + triggers."""

    out: list[tuple[CompanionWorkflowDefinitionV1, CatalogSource, bool]] = []
    seen: set[str] = set()

    if companion_workflow_pg_catalog_enabled() and pool is not None:
        pg_rows = await catalog_pg.workflow_catalog_list_enabled(pool)
        for row in pg_rows:
            definition = _definition_from_pg_row(row)
            if definition is None:
                continue
            seen.add(definition.workflow_id)
            eff = pg_workflow_effective_enabled(row)
            if include_disabled or eff:
                out.append((definition, "pg", eff))

    for builtin in list_builtin_workflows(include_disabled=True):
        if builtin.workflow_id in seen:
            continue
        eff = effective_workflow_enabled(builtin)
        if include_disabled or eff:
            out.append((builtin, "builtin", eff))

    from api.ewa_platform.companion.orchestration.workflow_registry import (
        effective_workflow_enabled as registry_effective_workflow_enabled,
    )
    from api.ewa_platform.companion.orchestration.workflow_registry import (
        list_chat_catalog_workflows,
    )

    for chat_wf in list_chat_catalog_workflows():
        if chat_wf.workflow_id in seen:
            continue
        eff = registry_effective_workflow_enabled(chat_wf)
        if include_disabled or eff:
            out.append((chat_wf, "builtin", eff))

    out.sort(key=lambda item: item[0].workflow_id)
    return out


async def match_runtime_workflow(
    pool: asyncpg.Pool | None,
    user_line: str,
    *,
    quick_workflow_id: str | None = None,
    quick_intent_id: str | None = None,
) -> CompanionWorkflowDefinitionV1 | None:
    import re

    from api.ewa_platform.companion.workflows.config import companion_workflow_engine_enabled

    if not companion_workflow_engine_enabled():
        return None
    if quick_workflow_id:
        wf = await get_runtime_workflow(pool, quick_workflow_id)
        if wf is not None:
            items = await list_runtime_workflows(pool, include_disabled=False)
            enabled_ids = {d.workflow_id for d, _s, eff in items if eff}
            if wf.workflow_id in enabled_ids:
                return wf
    line = str(user_line or "")
    for definition, _source, eff in await list_runtime_workflows(pool, include_disabled=False):
        if not eff:
            continue
        for trigger in definition.triggers:
            if trigger.type == "regex":
                pattern = str(trigger.pattern or "").strip()
                if pattern and re.search(pattern, line):
                    return definition
            if trigger.type == "quick_intent_id" and quick_intent_id:
                tid = str(trigger.pattern or trigger.tool_name or "").strip()
                if tid and tid == quick_intent_id:
                    return definition
    return None


__all__ = (
    "get_runtime_workflow",
    "list_runtime_workflows",
    "match_runtime_workflow",
    "pg_workflow_effective_enabled",
    "validate_workflow_definition_raw",
)

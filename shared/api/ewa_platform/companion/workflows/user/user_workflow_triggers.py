# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Match enabled personal workflows by phrase trigger (v1 steps or v2 DAG).
# Invariants:
# - v2 definitions require ``companion_workflow_engine_v2_enabled()`` at trigger time.
# Related:
# - api/ewa_platform/companion/workflows/action/starter.py
# ---

from __future__ import annotations

import re
from typing import Any

import asyncpg
from api.ewa_platform.companion.workflows.config import (
    companion_user_workflows_enabled,
    companion_workflow_engine_v2_enabled,
)
from api.ewa_platform.persistence_pg import companion_user_workflows_asyncpg as user_wf_pg
from api.ewa_platform.schemas.pydantic.companion_workflow import CompanionWorkflowDefinitionV1
from api.ewa_platform.schemas.pydantic.companion_workflow_v2 import CompanionWorkflowDefinitionV2

UserWorkflowDefinition = CompanionWorkflowDefinitionV1 | CompanionWorkflowDefinitionV2


def parse_user_workflow_definition(def_raw: dict[str, Any]) -> UserWorkflowDefinition | None:
    if int(def_raw.get("schema_version") or 0) == 2:
        try:
            return CompanionWorkflowDefinitionV2.model_validate(def_raw)
        except ValueError:
            return None
    try:
        return CompanionWorkflowDefinitionV1.model_validate(def_raw)
    except ValueError:
        return None


def is_v2_user_workflow_definition(definition: UserWorkflowDefinition) -> bool:
    return isinstance(definition, CompanionWorkflowDefinitionV2)


async def match_user_workflow_async(
    pool: asyncpg.Pool,
    *,
    principal_id: str,
    user_line: str,
) -> tuple[UserWorkflowDefinition, dict[str, Any]] | None:
    """Return (definition, row) when an enabled user workflow trigger matches."""

    if not companion_user_workflows_enabled():
        return None
    line = str(user_line or "").strip()
    if not line:
        return None
    rows = await user_wf_pg.companion_user_workflows_list_enabled(pool, principal_id=principal_id)
    for row in rows:
        def_raw = row.get("definition_json")
        if not isinstance(def_raw, dict):
            continue
        wf = parse_user_workflow_definition(def_raw)
        if wf is None or not wf.enabled:
            continue
        if is_v2_user_workflow_definition(wf) and not companion_workflow_engine_v2_enabled():
            continue
        for trigger in wf.triggers:
            if trigger.type != "regex":
                continue
            pattern = str(trigger.pattern or "").strip()
            if pattern and re.search(pattern, line):
                return wf, row
    return None


__all__ = (
    "UserWorkflowDefinition",
    "is_v2_user_workflow_definition",
    "match_user_workflow_async",
    "parse_user_workflow_definition",
)

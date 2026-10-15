# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Match user lines (and optional quick intents) to enabled declarative action workflows (WF-2/WF-6).
# Invariants:
# - Tool Router does **not** start workflows; regex/quick triggers only here.
# - PG catalog merge when ``EWA_COMPANION_WF_PG_CATALOG=1`` and pool is available.
# Related:
# - api/ewa_platform/companion/services/workflow_catalog.py
# - documentation/product/ewa/EWA-COMPANION-WORKFLOW-TOOLS-STANDARD-MASTER-PLAN.md §6.3
# ---

from __future__ import annotations

import re
from typing import TYPE_CHECKING

import asyncpg

from api.ewa_platform.companion.services import workflow_catalog
from api.ewa_platform.companion.workflows.action.registry import (
    effective_workflow_enabled,
    get_builtin_workflow,
    list_builtin_workflows,
)
from api.ewa_platform.companion.workflows.action.schema import CompanionWorkflowDefinitionV1
from api.ewa_platform.companion.workflows.config import companion_workflow_engine_enabled

if TYPE_CHECKING:
    from api.ewa_platform.companion.ux.quick_intents import QuickIntentSpec


def match_action_workflow(
    user_line: str,
    *,
    quick_intent: QuickIntentSpec | None = None,
) -> CompanionWorkflowDefinitionV1 | None:
    """Sync builtin-only matcher (tests and fallbacks without PG pool)."""

    if not companion_workflow_engine_enabled():
        return None
    line = str(user_line or "")
    if quick_intent is not None:
        wf_id = str(getattr(quick_intent, "workflow_id", None) or "").strip()
        if wf_id:
            wf = get_builtin_workflow(wf_id)
            if wf is not None and effective_workflow_enabled(wf):
                return wf
    for wf in list_builtin_workflows(include_disabled=False):
        for trigger in wf.triggers:
            if trigger.type == "regex":
                pattern = str(trigger.pattern or "").strip()
                if pattern and re.search(pattern, line):
                    return wf
            if trigger.type == "quick_intent_id" and quick_intent is not None:
                tid = str(trigger.pattern or trigger.tool_name or "").strip()
                if tid and tid == quick_intent.intent_id.value:
                    return wf
    return None


async def match_action_workflow_async(
    pool: asyncpg.Pool | None,
    user_line: str,
    *,
    quick_intent: QuickIntentSpec | None = None,
) -> CompanionWorkflowDefinitionV1 | None:
    """Runtime matcher: PG catalog (when enabled) merged with builtins."""

    quick_id = str(getattr(quick_intent, "workflow_id", None) or "").strip() or None
    intent_id = None
    if quick_intent is not None:
        intent_id = str(getattr(getattr(quick_intent, "intent_id", None), "value", quick_intent.intent_id)).strip()
    return await workflow_catalog.match_runtime_workflow(
        pool,
        user_line,
        quick_workflow_id=quick_id,
        quick_intent_id=intent_id or None,
    )


__all__ = ("match_action_workflow", "match_action_workflow_async")

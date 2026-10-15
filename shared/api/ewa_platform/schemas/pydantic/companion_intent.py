# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for the **EWA companion intent planner**: v1 ``intent`` slots and v2 ``{tool, args}`` unified into
# ``CompanionIntentPlan`` for orchestrator dispatch through ``tool_registry``.
# Invariants:
# - Planner output is **advisory**; execution requires server validation, confirmation gates, and registry handlers.
# - ``tool=chat_only`` means no companion tool dispatch for this turn.
# Related:
# - api/ewa_platform/companion/sidecar/intent_planner.py
# - api/ewa_platform/companion/orchestration/intent_plan_registry_dispatch.py
# ---
"""Structured intent plan for EWA companion tool routing."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

CompanionPlannerIntent = Literal[
    "chat_only",
    "recall_memory",
    "doc_create",
    "doc_insert_into_open_editor",
    "file_rename",
    "file_delete",
    "doc_edit_requires_open_editor",
]

# Registry tool keys the legacy intent planner may emit after v1→tool normalization.
INTENT_PLANNER_DISPATCH_TOOLS: frozenset[str] = frozenset(
    {
        "chat_only",
        "recall_memory",
        "doc_edit_requires_open_editor",
        "file_create",
        "doc_insert",
        "file_rename",
        "file_delete",
    }
)

# Top-level planner slot keys merged into ``args`` when parsing v2 blobs or markdown KV.
INTENT_PLANNER_SLOT_KEYS: frozenset[str] = frozenset(
    {
        "doc_file_name",
        "doc_body_text",
        "insert_source_file_query",
        "rename_old_query",
        "rename_new_name",
        "delete_file_query",
        "name",
        "body",
        "phrase",
        "old_query",
        "new_name",
    }
)

_V1_INTENT_TO_TOOL: dict[str, str] = {
    "chat_only": "chat_only",
    "recall_memory": "recall_memory",
    "doc_create": "file_create",
    "doc_insert_into_open_editor": "doc_insert",
    "file_rename": "file_rename",
    "file_delete": "file_delete",
    "doc_edit_requires_open_editor": "doc_edit_requires_open_editor",
}

_TOOL_TO_V1_INTENT: dict[str, str] = {
    "file_create": "doc_create",
    "doc_insert": "doc_insert_into_open_editor",
    "file_rename": "file_rename",
    "file_delete": "file_delete",
    "recall_memory": "recall_memory",
    "doc_edit_requires_open_editor": "doc_edit_requires_open_editor",
    "chat_only": "chat_only",
}


class CompanionIntentPlanV1(BaseModel):
    """Legacy LLM-emitted plan (``intent`` + flat slots)."""

    intent: CompanionPlannerIntent = "chat_only"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    understood_summary_ru: str = ""
    understood_summary_en: str = ""
    doc_file_name: str | None = None
    doc_body_text: str | None = None
    insert_source_file_query: str | None = None
    rename_old_query: str | None = None
    rename_new_name: str | None = None
    delete_file_query: str | None = None


class CompanionIntentPlanV2(BaseModel):
    """Planner JSON schema v2: registry ``tool`` + structured ``args``."""

    tool: str = "chat_only"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    args: dict[str, Any] = Field(default_factory=dict)
    understood_summary_ru: str = ""
    understood_summary_en: str = ""


class CompanionIntentPlan(BaseModel):
    """Normalized planner output used by orchestrator dispatch (v1 or v2 source)."""

    tool: str = "chat_only"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    args: dict[str, Any] = Field(default_factory=dict)
    understood_summary_ru: str = ""
    understood_summary_en: str = ""

    @property
    def intent(self) -> str:
        """Legacy episodic/logging alias (v1 intent name when mapped)."""

        return _TOOL_TO_V1_INTENT.get(self.tool, self.tool)

    @classmethod
    def from_v1(cls, plan: CompanionIntentPlanV1) -> CompanionIntentPlan:
        tool = _V1_INTENT_TO_TOOL.get(str(plan.intent or "chat_only").strip(), "chat_only")
        args: dict[str, Any] = {}
        if plan.doc_file_name:
            args["doc_file_name"] = plan.doc_file_name.strip()
            args["name"] = args["doc_file_name"]
        if plan.doc_body_text:
            args["doc_body_text"] = plan.doc_body_text
            args["body"] = plan.doc_body_text
        if plan.insert_source_file_query:
            phrase = plan.insert_source_file_query.strip()
            args["insert_source_file_query"] = phrase
            args["phrase"] = phrase
        if plan.rename_old_query:
            args["rename_old_query"] = plan.rename_old_query.strip()
            args["old_query"] = args["rename_old_query"]
        if plan.rename_new_name:
            args["rename_new_name"] = plan.rename_new_name.strip()
            args["new_name"] = args["rename_new_name"]
        if plan.delete_file_query:
            phrase = plan.delete_file_query.strip()
            args["delete_file_query"] = phrase
            args["phrase"] = phrase
        return cls(
            tool=tool,
            confidence=float(plan.confidence),
            args=args,
            understood_summary_ru=plan.understood_summary_ru,
            understood_summary_en=plan.understood_summary_en,
        )

    @classmethod
    def from_v2(cls, plan: CompanionIntentPlanV2) -> CompanionIntentPlan:
        tool = str(plan.tool or "chat_only").strip().lower() or "chat_only"
        raw_args = dict(plan.args) if isinstance(plan.args, dict) else {}
        return cls(
            tool=tool,
            confidence=float(plan.confidence),
            args=raw_args,
            understood_summary_ru=plan.understood_summary_ru,
            understood_summary_en=plan.understood_summary_en,
        )

    @classmethod
    def from_blob(cls, blob: dict[str, Any]) -> CompanionIntentPlan | None:
        """Parse v2 ``{tool, args}`` or legacy v1 ``{intent, …}`` planner JSON/KV dict."""

        if not blob:
            return None
        if str(blob.get("tool") or "").strip():
            merged = dict(blob.get("args") or {}) if isinstance(blob.get("args"), dict) else {}
            for key in INTENT_PLANNER_SLOT_KEYS:
                val = blob.get(key)
                if val is not None and key not in merged:
                    merged[key] = val
            try:
                v2 = CompanionIntentPlanV2.model_validate(
                    {
                        "tool": blob.get("tool"),
                        "confidence": blob.get("confidence", 0.0),
                        "args": merged,
                        "understood_summary_ru": blob.get("understood_summary_ru") or "",
                        "understood_summary_en": blob.get("understood_summary_en") or "",
                    }
                )
            except Exception:
                return None
            plan = cls.from_v2(v2)
            if plan.tool not in INTENT_PLANNER_DISPATCH_TOOLS:
                return None
            return plan
        if str(blob.get("intent") or "").strip():
            try:
                v1 = CompanionIntentPlanV1.model_validate(blob)
            except Exception:
                return None
            return cls.from_v1(v1)
        return None


def intent_planner_tool_requires_catalog(tool: str) -> bool:
    """True when dispatch needs ``content_catalog_user_id`` on ``ToolContext``."""

    return tool in {"file_create", "doc_insert", "file_rename", "file_delete"}


__all__ = (
    "CompanionIntentPlan",
    "CompanionIntentPlanV1",
    "CompanionIntentPlanV2",
    "CompanionPlannerIntent",
    "INTENT_PLANNER_DISPATCH_TOOLS",
    "INTENT_PLANNER_SLOT_KEYS",
    "intent_planner_tool_requires_catalog",
)

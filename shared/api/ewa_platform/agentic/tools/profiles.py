# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Named tool profile bundles for agentic policy_json.tools_profile allowlists.
# Invariants:
# - Profiles reference live companion REGISTRY tool names only.
# Related:
# - api/ewa_platform/agentic/tools/bridge.py
# ---

from __future__ import annotations

from collections.abc import Mapping

TOOL_PROFILES: dict[str, frozenset[str]] = {
    "research": frozenset(
        {
            "call_expert_chat",
            "catalog_list",
            "document_extractor",
            "recall_memory",
            "paperless_import",
            "llm_summarize",
            "check_task_status",
            "operations_status",
            "file_create",
            "file_save_text",
            "file_open",
            "doc_append_block",
        }
    ),
    "files": frozenset(
        {
            "file_open",
            "file_save_text",
            "file_create",
            "file_delete",
            "catalog_list",
        }
    ),
    "ops": frozenset(
        {
            "operations_status",
            "check_task_status",
            "email_dispatcher",
            "plan_v1",
        }
    ),
    "creative": frozenset(
        {
            "image_generation",
            "catalog_list",
            "recall_memory",
        }
    ),
    "orchestrator": frozenset(
        {
            "call_expert_chat",
            "doc_append_block",
            "catalog_list",
            "document_extractor",
            "file_rewrite",
            "file_open",
            "file_create",
            "file_save_text",
            "llm_summarize",
            "check_task_status",
            "operations_status",
        }
    ),
}

DESTRUCTIVE_TOOLS: frozenset[str] = frozenset({"file_delete"})


def resolve_tools_allowlist(policy_json: Mapping[str, object] | None) -> frozenset[str] | None:
    """Return explicit allowlist from policy or profile name; None means session-only / bridge default."""

    if not isinstance(policy_json, Mapping):
        return None

    explicit = policy_json.get("tools_allowlist")
    if isinstance(explicit, list) and explicit:
        return frozenset(str(x).strip() for x in explicit if str(x).strip())

    profile = str(policy_json.get("tools_profile") or "").strip().lower()
    if profile and profile in TOOL_PROFILES:
        return TOOL_PROFILES[profile]
    return None


def require_hitl_for_tool(policy_json: Mapping[str, object] | None, tool_name: str) -> bool:
    """True when policy requires HITL before dispatching this tool."""

    if not isinstance(policy_json, Mapping):
        return tool_name in DESTRUCTIVE_TOOLS

    # User left-rail tumbler: skip pre-dispatch HITL for all tools when auto-accept is on.
    if policy_json.get("auto_accept_hitl") is True:
        return False

    required = policy_json.get("require_hitl_for_tools")
    if isinstance(required, list):
        names = {str(x).strip() for x in required if str(x).strip()}
        return tool_name in names

    if policy_json.get("require_hitl_destructive") is False:
        return False
    return tool_name in DESTRUCTIVE_TOOLS

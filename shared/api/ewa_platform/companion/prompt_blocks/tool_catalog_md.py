# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Computed Server_tool_catalog markdown from REGISTRY / export_tool_catalog (not editable prose).
# Invariants:
# - Never invent tool names; only emit registry entries.
# Related:
# - api/ewa_platform/companion/orchestration/tool_catalog_v2.py
# ---
"""Format companion tool registry for system-prompt grounding."""

from __future__ import annotations

from api.ewa_platform.companion.orchestration.tool_catalog_v2 import export_tool_catalog


def format_server_tool_catalog_markdown(*, max_tools: int = 80) -> str:
    """Return markdown bullet list of live companion tools for prompt injection."""

    tools = export_tool_catalog()
    lines = [
        "Server_tool_catalog (authoritative tool registry for this deployment — do not invent tools outside this list):"
    ]
    for entry in tools[: max(1, max_tools)]:
        name = str(entry.get("name") or "").strip()
        summary = str(entry.get("summary") or "").strip()
        if not name:
            continue
        one = summary.replace("\n", " ").strip()
        if len(one) > 180:
            one = one[:179].rstrip() + "…"
        lines.append(f"- `{name}`: {one}" if one else f"- `{name}`")
    if len(lines) == 1:
        lines.append("- (empty registry — claim no executable tools)")
    return "\n".join(lines) + "\n"


__all__ = ("format_server_tool_catalog_markdown",)

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Merge orchestrator ``memory_section_append`` into the HCM memory block (sync + SSE shared).
# Invariants:
# - Empty append leaves override unchanged; empty base returns append only.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CATALOG-DISCUSS.md
# ---

from __future__ import annotations


def merge_memory_section_append(
    memory_section_override: str | None,
    append: str | None,
) -> str | None:
    """Merge orchestrator ``memory_section_append`` (e.g. catalog_discuss) into the HCM memory block."""

    extra = (append or "").strip()
    if not extra:
        return memory_section_override
    base = (memory_section_override or "").strip()
    return f"{base}\n\n{extra}".strip() if base else extra


__all__ = ("merge_memory_section_append",)

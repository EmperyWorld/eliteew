# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Describes which desktop intents each app supports for future LLM tool-calling catalogs.
# Invariants:
# - Catalog entries are metadata; no live shell queries in this module.
# Related:
# - api/ewa_platform/contracts/desktop_intent.py
# - api/ewa_platform/llm/tools_schema.py
# ---
"""Desktop capability catalog entries.

Holds ``DesktopAppCapability`` (app id, human title, allowed intent kinds) for
static or DB-fed registries. LLM layer will serialize this into tool definitions.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class DesktopAppCapability:
    """One installable or built-in desktop app and the intents it may receive."""

    app_component: str
    title: str
    intent_kinds: frozenset[str] = field(default_factory=frozenset)

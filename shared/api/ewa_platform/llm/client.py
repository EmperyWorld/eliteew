# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Protocol for LLM completions used by orchestrator planning (no vendor SDK in this file).
# Invariants:
# - Implementations perform HTTP in a later change; keep interface JSON-in/JSON-out.
# Related:
# - api/ewa_platform/llm/tools_schema.py
# - api/ewa_platform/core/orchestrator.py
# ---
"""``LlmClient`` Protocol plus ``StubLlmClient``; HTTP implementation in ``http_orch_llm.py``."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class LlmClient(Protocol):
    """Abstract LLM access for orchestration."""

    async def complete(self, prompt: str, *, variables: Mapping[str, Any] | None = None) -> str: ...


class StubLlmClient:
    """Returns a fixed string until real inference is wired."""

    async def complete(self, prompt: str, *, variables: Mapping[str, Any] | None = None) -> str:
        return "stub"

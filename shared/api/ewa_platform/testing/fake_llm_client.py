# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Deterministic ``LlmClient`` stub for orchestrator tests.
# Invariants:
# - Ignores ``prompt`` content unless tests configure responses later.
# Related:
# - api/ewa_platform/llm/client.py
# ---
"""Fake LLM client."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class FakeLlmClient:
    """Returns a canned completion."""

    def __init__(self, response: str = "fake-plan") -> None:
        self._response = response

    async def complete(self, prompt: str, *, variables: Mapping[str, Any] | None = None) -> str:
        return self._response

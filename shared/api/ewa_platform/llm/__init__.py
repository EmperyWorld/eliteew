# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Re-exports LLM client protocol and stub for composition roots.
# Invariants:
# - No side effects on import.
# Related:
# - api/ewa_platform/llm/client.py
# - api/ewa_platform/llm/http_orch_llm.py
# - api/ewa_platform/llm/intent_proposal.py
# - api/ewa_platform/llm/tools_schema.py
# ---
from __future__ import annotations

from api.ewa_platform.llm.client import LlmClient, StubLlmClient
from api.ewa_platform.llm.http_orch_llm import HttpOrchestrationLlmClient
from api.ewa_platform.llm.intent_proposal import (
    ORCHESTRATION_LLM_PROMPT_KEY,
    orchestration_turn_llm_user_content,
    parse_desktop_intent_from_llm_completion,
)
from api.ewa_platform.llm.tools_schema import planned_tool_schemas

__all__ = [
    "HttpOrchestrationLlmClient",
    "LlmClient",
    "ORCHESTRATION_LLM_PROMPT_KEY",
    "StubLlmClient",
    "orchestration_turn_llm_user_content",
    "parse_desktop_intent_from_llm_completion",
    "planned_tool_schemas",
]

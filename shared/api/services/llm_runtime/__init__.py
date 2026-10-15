# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Shared LLM runtime helpers for Phase 3–4 redesign (turn contract + job class + deep client).
# Related:
# - api/services/llm_runtime/turn_contract.py
# - api/services/llm_runtime/job_class.py
# - api/services/llm_runtime/deep_client.py
# ---
"""LLM runtime package (turn contract + interactive/deep job class)."""

from api.services.llm_runtime.deep_client import (
    deep_chat_completion,
    deep_llm_enabled,
    llama_deep_max_inflight,
    resolve_deep_base_url,
)
from api.services.llm_runtime.job_class import (
    DeepLlmUnavailableError,
    LlmJobClass,
    normalize_llm_job_class,
    resolve_llm_base_url,
)
from api.services.llm_runtime.turn_contract import (
    CANONICAL_TURN_PHASES,
    TurnPhaseOrderError,
    TurnPhaseTracker,
    is_canonical_phase_sequence,
)

__all__ = [
    "CANONICAL_TURN_PHASES",
    "DeepLlmUnavailableError",
    "LlmJobClass",
    "TurnPhaseOrderError",
    "TurnPhaseTracker",
    "deep_chat_completion",
    "deep_llm_enabled",
    "is_canonical_phase_sequence",
    "llama_deep_max_inflight",
    "normalize_llm_job_class",
    "resolve_deep_base_url",
    "resolve_llm_base_url",
]

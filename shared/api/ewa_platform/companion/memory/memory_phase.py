# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Single entry for companion HCM memory composition on the chat path — **after** orchestrator short-circuit
# decisions, never inside tool dispatch. Wraps ``compose_memory_window`` with timeout and error boundaries.
# Invariants:
# - Embed/Qdrant/rerank run only when this module is invoked (not from ``task_orchestrator`` tool branches).
# - Failures degrade to legacy identity block; never abort the user-visible turn.
# - Uses the same retrieval budget as ``memory.retrieval`` (env ``EWA_COMPANION_RETRIEVAL_BUDGET_MS``).
# Related:
# - api/ewa_platform/companion/memory/retrieval.py
# - api/ewa_platform/companion/turn/chat_turn.py
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---
"""Phased HCM memory composition for companion chat turns."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.memory.retrieval import MemoryWindow, compose_memory_window

logger = logging.getLogger(__name__)


def _memory_phase_budget_sec() -> float:
    raw = os.getenv("EWA_COMPANION_RETRIEVAL_BUDGET_MS", "4500").strip() or "4500"
    try:
        ms = int(raw)
    except ValueError:
        ms = 4500
    ms = max(50, min(ms, 30000))
    return ms / 1000.0 + 0.25


async def compose_memory_for_chat_turn(
    *,
    profile: Mapping[str, Any],
    principal_id: str,
    current_user_text: str,
    persona: str,
    pool: Any | None = None,
    intent_plan: Any | None = None,
    episodic_top_k: int = 8,
) -> MemoryWindow:
    """Bounded HCM window for main LLM path; safe fallback on timeout or internal errors."""

    try:
        return await asyncio.wait_for(
            compose_memory_window(
                profile=profile,
                principal_id=principal_id,
                current_user_text=current_user_text,
                persona=persona,
                pool=pool,
                episodic_top_k=episodic_top_k,
                intent_plan=intent_plan,
            ),
            timeout=_memory_phase_budget_sec(),
        )
    except TimeoutError:
        logger.warning(
            "[STEP] companion_memory_phase_timeout principal=%s budget_sec=%.2f",
            principal_id,
            _memory_phase_budget_sec(),
        )
        return MemoryWindow(
            prompt_section="",
            used_layers=["identity_legacy"],
            layer_telemetry={"path": "memory_phase_timeout"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[STEP] companion_memory_phase_failed principal=%s err=%s",
            principal_id,
            exc,
        )
        return MemoryWindow(
            prompt_section="",
            used_layers=["identity_legacy"],
            layer_telemetry={"path": "memory_phase_error", "error": str(exc)[:200]},
        )


__all__ = ["compose_memory_for_chat_turn"]

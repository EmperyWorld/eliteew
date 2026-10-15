# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T && TZBrand
# ---
# Purpose:
# Optional Phase 4 companion deep research hop after interactive Answer.
# Invariants:
# - Default off (``EWA_DEEP_LLM_ENABLED``); Answer always uses interactive URL.
# - Never remaps deep→interactive; unavailable deep → honest degrade, chat continues.
# - Successful notes are persisted as episodic ``deep_research`` rows (not user-visible reply).
# Related:
# - documentation/platform/LLM-MEMORY-RUNTIME-REDESIGN-DECISION.md Phase 4
# - api/services/llm_runtime/deep_client.py
# ---
"""Gated companion deep research hop (post-answer, non-user-visible by default)."""

from __future__ import annotations

import logging
from typing import Any

import asyncpg
import httpx

from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.persistence_pg.episodes_asyncpg import episode_insert
from api.services.llm_runtime.deep_client import (
    DeepLlmUnavailableError,
    deep_chat_completion,
    deep_llm_enabled,
)
from api.services.llm_runtime.turn_contract import TurnPhaseTracker

logger = logging.getLogger(__name__)

_MAX_USER = 2_000
_MAX_ANSWER = 4_000
_MAX_NOTE = 2_000


async def maybe_run_companion_deep_research_hop(
    client: httpx.AsyncClient,
    *,
    user_line: str,
    answer_text: str,
    principal_id: str,
    skip_heavy_steps: bool,
    pool: asyncpg.Pool | None = None,
    persona: str = "parent",
    turn_phases: TurnPhaseTracker | None = None,
) -> str | None:
    """When enabled, run one deep completion for research enrichment; return note or None.

    Does **not** replace the interactive answer. Failures degrade without raising into chat.
    When ``pool`` is set and a note is produced, best-effort episodic persist (``kind=deep_research``).
    """

    if skip_heavy_steps:
        return None
    if not deep_llm_enabled():
        return None

    tracker = turn_phases or TurnPhaseTracker(
        surface="ewa_companion_deep",
        require_retrieve_before_answer=False,
    )
    # Canonical order: answer already happened on interactive path; mark deep next.
    if "answer" not in tracker.seen:
        tracker.mark("answer")
    tracker.mark("deep")

    user_snip = (user_line or "").strip()[:_MAX_USER]
    answer_snip = (answer_text or "").strip()[:_MAX_ANSWER]
    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are a private research sidecar for EliteEW companion. "
                "Given the user question and the interactive assistant reply, "
                "write a short internal research note (facts to verify, gaps, next probes). "
                "Do not rewrite the user-facing reply. Plain text, max ~400 words."
            ),
        },
        {
            "role": "user",
            "content": f"User:\n{user_snip}\n\nInteractive answer:\n{answer_snip}",
        },
    ]
    try:
        data = await deep_chat_completion(
            client,
            messages=messages,
            options={
                "temperature": 0.3,
                "num_predict": 512,
                "openai_visible_assistant_content_only": True,
            },
            reason="companion_deep_research_hop",
        )
    except DeepLlmUnavailableError as exc:
        companion_degrade_debug(
            logger,
            "llm_deep_hop_unavailable",
            str(exc),
            principal_id=principal_id,
        )
        return None
    except Exception as exc:  # noqa: BLE001 — honest degrade; Answer already produced
        companion_degrade_debug(
            logger,
            "llm_deep_hop_failed",
            str(exc),
            principal_id=principal_id,
        )
        return None

    note = str(data.get("response") or "").strip()[:_MAX_NOTE]
    if not note:
        logger.info("[STEP] llm_deep_hop_empty principal_id=%s", principal_id)
        return None

    logger.info(
        "[STEP] llm_deep_hop_note principal_id=%s chars=%s",
        principal_id,
        len(note),
    )
    if pool is not None:
        try:
            await episode_insert(
                pool,
                principal_id=principal_id,
                body=note,
                kind="deep_research",
                source="llm_deep_hop",
                persona=(persona or "parent")[:64],
                importance=0.4,
                extra={"phase": "deep", "user_chars": len(user_snip)},
            )
            logger.info("[STEP] llm_deep_hop_persisted principal_id=%s", principal_id)
        except Exception as exc:  # noqa: BLE001 — note still returned; persist is best-effort
            companion_degrade_debug(
                logger,
                "llm_deep_hop_persist_failed",
                str(exc),
                principal_id=principal_id,
            )
    return note


__all__ = ["maybe_run_companion_deep_research_hop"]

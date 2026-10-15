# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Optional **operator ground-truth** paragraph loaded from ``unified_content`` (``extracted_text`` / ``description``)
# and injected near the top of the companion system prompt when ``EWA_COMPANION_GROUND_TRUTH_UNIFIED_CONTENT_ID``
# is set — canonical facts the model must not contradict in this deployment.
# Invariants:
# - Only returns text when the UC row exists, is not deleted, and ``user_id`` matches ``principal_id`` (UUID text).
# - Bounded by ``EWA_COMPANION_GROUND_TRUTH_MAX_CHARS`` to protect prompt size.
# Related:
# - api/ewa_platform/companion/turn/chat_turn.py
# - documentation/product/ewa/EWA-COMPANION-CHAT-PIPELINE-2026-05.md
# ---
"""Load optional unified-content ground truth for the EWA companion system prompt."""

from __future__ import annotations

import logging
import os
import uuid

import asyncpg

logger = logging.getLogger(__name__)


def _max_chars() -> int:
    raw = os.getenv("EWA_COMPANION_GROUND_TRUTH_MAX_CHARS", "6000").strip() or "6000"
    try:
        v = int(raw)
    except ValueError:
        v = 6000
    return max(400, min(v, 24_000))


async def fetch_companion_ground_truth_markdown(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str,
) -> str:
    """Return trimmed plain text for injection into the companion system prompt, or empty string."""

    raw_id = os.getenv("EWA_COMPANION_GROUND_TRUTH_UNIFIED_CONTENT_ID", "").strip()
    if not raw_id or pool is None:
        return ""
    try:
        uc_id = uuid.UUID(raw_id)
    except ValueError:
        logger.warning("[STEP] companion_ground_truth_bad_uuid uc=%r", raw_id)
        return ""
    try:
        uid = uuid.UUID(str(principal_id).strip())
    except ValueError:
        return ""
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT COALESCE(NULLIF(TRIM(extracted_text), ''), NULLIF(TRIM(description), '')) AS txt
                FROM unified_content
                WHERE id = $1::uuid
                  AND deleted_at IS NULL
                  AND user_id = $2::uuid
                """,
                uc_id,
                uid,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[STEP] companion_ground_truth_query_failed err=%s", exc)
        return ""
    if row is None:
        return ""
    txt = str(row["txt"] or "").strip()
    if not txt:
        return ""
    cap = _max_chars()
    if len(txt) > cap:
        return txt[: cap - 1].rstrip() + "…"
    return txt


__all__ = ("fetch_companion_ground_truth_markdown",)

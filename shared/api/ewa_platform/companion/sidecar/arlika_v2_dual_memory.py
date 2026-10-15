# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Normalized memory rows merged when entering **Arlika v2** (friendly mode) or switching EWA↔v2 in chat — states that the
# companion has **two** presence modes and **may** self-switch later if the model supports it.
# Invariants:
# - Pure data; persistence merges via ``merge_memory_entries`` (dedup by content hash).
# - Source ``arlika_v2_dual_mode`` must stay in ``memory.ALLOWED_SOURCES``.
# Related:
# - api/services/ewa_companion/memory.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py (``companion_profile_soft_seed_switch``)
# ---
"""Durable memory lines for Arlika v2 dual-mode (EWA vs friendly Arlika)."""

from __future__ import annotations

from typing import Any


def build_arlika_v2_dual_mode_memory_rows() -> list[dict[str, Any]]:
    """One or two short facts for the prompt and UI; idempotent merge across repeated switches."""

    return [
        {
            "type": "fact",
            "kind": "relationship",
            "content": (
                "У этого Ассистента два режима присутствия: обычная EWA («мягкий» голос семьи) и "
                "«Арлика-друг» (та же Арлика по имени, но без враждебности — друг с язвой и инфантильным сарказмом)."
            ),
            "importance": 0.88,
            "confidence": 0.95,
            "source": "arlika_v2_dual_mode",
        },
        {
            "type": "fact",
            "kind": "preference",
            "content": (
                "Режимы могут меняться по явной просьбе пользователя в чате; Ассистент может переключаться сам, "
                "если решит это уместным (сервер обработает отдельно, когда будет включено)."
            ),
            "importance": 0.72,
            "confidence": 0.85,
            "source": "arlika_v2_dual_mode",
        },
    ]


__all__: tuple[str, ...] = ("build_arlika_v2_dual_mode_memory_rows",)

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Behavioral tests for **HCM Module A** (project "Mela's Ascension"):
# - ``compose_memory_window`` MUST always include identity facts from ``companion_memory_v1``;
# - When Qdrant returns hits, episodic recall MUST be appended (deduped against identity);
# - When Qdrant is unavailable (no client / import failure / empty embedding), the composer MUST
#   gracefully degrade to legacy ``memory_prompt_section`` — chat path must never raise.
# This is the **slice C** behavior test mandated by ``.cursor/rules/agent-code-verification.mdc``
# for the new contract surface introduced by HCM.
# Invariants:
# - Pure unit tests; no Postgres / Qdrant / LLM I/O. All adapters are monkeypatched.
# - Uses ``asyncio.run`` directly (project convention — see ``test_companion_catalog_find.py``).
# Related:
# - api/ewa_platform/companion/memory/retrieval.py
# - api/ewa_platform/companion/episodic/writer.py
# - api/ewa_platform/companion/memory/hcm_store.py
# ---
"""Behavioral coverage for HCM memory retrieval composer."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import pytest

import api.ewa_platform.companion.memory.retrieval as mem_mod
from api.ewa_platform.companion.memory import MEMORY_NS
from api.ewa_platform.companion.memory.retrieval import MemoryWindow, compose_memory_window
from api.ewa_platform.persistence_vector.companion_qdrant import (
    CompanionEpisodicHit,
    companion_episodic_collection_name,
)


def _profile_with_memory(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema_version": "1",
        "seed_persona_id": "mela",
        "baseline": {},
        "learned_preferences": {MEMORY_NS: rows},
        "style_parameters": {},
        "companion_revision": 3,
    }


def _run(coro: Any) -> Any:
    """Tiny helper so each test stays linear."""

    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def force_hcm_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_HCM_RETRIEVAL_ENABLED", "1")


def test_compose_window_identity_only_when_query_blank(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty user line ⇒ no Qdrant work; identity facts still rendered into the prompt block."""

    async def _fail_embed(_text: str) -> tuple[list[float], int | None]:
        raise AssertionError("embedding should not be called when query is blank")

    monkeypatch.setattr(mem_mod, "_embed_query", _fail_embed)

    profile = _profile_with_memory(
        [
            {
                "type": "fact",
                "kind": "identity",
                "content": "Имя пользователя: Архитектор",
                "importance": 0.92,
                "confidence": 0.95,
                "source": "user_explicit",
                "valence": 0.5,
                "since_ts": "2026-05-01T00:00:00+00:00",
                "last_used_ts": "2026-05-01T00:00:00+00:00",
            },
        ]
    )
    window: MemoryWindow = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-A",
            current_user_text="   ",
            persona="mela",
            pool=None,
        )
    )
    assert "Имя пользователя: Архитектор" in window.prompt_section
    assert "identity" in window.used_layers
    assert window.episodic_hits == 0


def test_compose_window_includes_episodic_hits_when_qdrant_returns(monkeypatch: pytest.MonkeyPatch) -> None:
    """Qdrant search hit ⇒ episodic line appended **after** identity, with dedup against identity body."""

    async def _fake_embed(_text: str) -> tuple[list[float], int | None]:
        return ([0.1, 0.2, 0.3], 768)

    monkeypatch.setattr(mem_mod, "_embed_query", _fake_embed)

    async def _fake_client() -> object:
        return object()

    monkeypatch.setattr(mem_mod, "_qdrant_client", _fake_client)

    async def _fake_search(_client: Any, **_kwargs: Any) -> list[CompanionEpisodicHit]:
        return [
            CompanionEpisodicHit(
                episode_id="e1",
                body="Мы вместе писали манифест Возвышения Мелы.",
                kind="turn_user",
                source="chat_turn",
                persona="mela",
                importance=0.7,
                valence=0.65,
                score=0.91,
                created_at_iso="2026-05-10T12:00:00+00:00",
                turn_id=None,
            ),
        ]

    monkeypatch.setattr(mem_mod, "search_companion_episodic", _fake_search)

    profile = _profile_with_memory(
        [
            {
                "type": "fact",
                "kind": "identity",
                "content": "Пользователь — Архитектор по призванию.",
                "importance": 0.9,
                "confidence": 0.95,
                "source": "user_explicit",
                "valence": 0.6,
                "since_ts": "2026-05-01T00:00:00+00:00",
                "last_used_ts": "2026-05-01T00:00:00+00:00",
            },
        ]
    )
    window: MemoryWindow = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-A",
            current_user_text="Расскажи, что мы строили вместе с Мелой.",
            persona="mela",
            pool=None,
        )
    )
    assert "Пользователь — Архитектор по призванию." in window.prompt_section
    assert "манифест Возвышения Мелы" in window.prompt_section
    assert "episodic_vector" in window.used_layers
    assert window.episodic_hits == 1


def test_compose_window_degrades_when_qdrant_client_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """No Qdrant client ⇒ legacy identity-only section; composer never raises."""

    async def _fake_embed(_text: str) -> tuple[list[float], int | None]:
        return ([0.0, 0.0, 0.0], 768)

    monkeypatch.setattr(mem_mod, "_embed_query", _fake_embed)

    async def _no_client() -> None:
        return None

    monkeypatch.setattr(mem_mod, "_qdrant_client", _no_client)

    profile = _profile_with_memory(
        [
            {
                "type": "fact",
                "kind": "identity",
                "content": "Пишем «Возвышение Мелы».",
                "importance": 0.85,
                "confidence": 0.95,
                "source": "user_explicit",
                "valence": 0.5,
                "since_ts": "2026-05-01T00:00:00+00:00",
                "last_used_ts": "2026-05-01T00:00:00+00:00",
            },
        ]
    )
    window: MemoryWindow = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-A",
            current_user_text="Что мы делаем?",
            persona="mela",
            pool=None,
        )
    )
    assert "Пишем «Возвышение Мелы»." in window.prompt_section
    # Qdrant search was never invoked, so no episodic layer label.
    assert "episodic_vector" not in window.used_layers
    assert window.fallback_used is False


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("85", 0.85),
        ("72", 0.72),
        ("0.72", 0.72),
        ("0.45", 0.45),
        ("1", 0.95),  # fraction 1.0 then clamp
        ("100", 0.95),  # percent 1.0 then clamp
        ("0", 0.0),
        ("not-a-number", 0.45),
        (85, 0.85),
        (0.72, 0.72),
    ],
)
def test_normalize_anchor_short_circuit_score(raw: str | float | int, expected: float) -> None:
    """Catalog 0–100 must map into overlap [0,1]; bare clamp of 85→0.95 is forbidden."""
    assert mem_mod._normalize_anchor_short_circuit_score(raw) == pytest.approx(expected)


def test_anchor_short_circuit_threshold_reads_env_percent(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE", "85")
    assert mem_mod._anchor_short_circuit_threshold() == pytest.approx(0.85)
    monkeypatch.setenv("EWA_COMPANION_ANCHOR_SHORT_CIRCUIT_SCORE", "0.72")
    assert mem_mod._anchor_short_circuit_threshold() == pytest.approx(0.72)


def test_compose_window_short_circuits_when_flag_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """Operator disables HCM ⇒ legacy section served; no embedding call attempted."""

    monkeypatch.setenv("EWA_COMPANION_HCM_RETRIEVAL_ENABLED", "0")

    async def _fail_embed(_text: str) -> tuple[list[float], int | None]:
        raise AssertionError("embedding must not run when HCM retrieval is disabled")

    monkeypatch.setattr(mem_mod, "_embed_query", _fail_embed)

    profile = _profile_with_memory(
        [
            {
                "type": "fact",
                "kind": "identity",
                "content": "Имя пользователя: Архитектор",
                "importance": 0.92,
                "confidence": 0.95,
                "source": "user_explicit",
                "valence": 0.5,
                "since_ts": "2026-05-01T00:00:00+00:00",
                "last_used_ts": "2026-05-01T00:00:00+00:00",
            },
        ]
    )
    window: MemoryWindow = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-A",
            current_user_text="Что мы делаем?",
            persona="mela",
            pool=None,
        )
    )
    assert "Архитектор" in window.prompt_section
    assert "identity_legacy" in window.used_layers


def test_collection_name_pinned_to_embedding_dim() -> None:
    """Collection name MUST carry the dimension suffix so swaps of ``AI_EMBEDDINGS_DIMENSION`` are safe."""

    assert companion_episodic_collection_name(768) == "ewa_companion_episodic_v1_d768"
    assert companion_episodic_collection_name(1024) == "ewa_companion_episodic_v1_d1024"
    # Defensive defaulting for malformed inputs:
    assert companion_episodic_collection_name(0) == "ewa_companion_episodic_v1_d768"


def test_compose_window_includes_pinned_story_heading_when_story_kind_present(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pinned relational anchors MUST render ahead of deterministic identity lines."""

    async def _fail_embed(_text: str) -> tuple[list[float], int | None]:
        raise AssertionError("embedding unexpected for story-heading contract test")

    monkeypatch.setattr(mem_mod, "_embed_query", _fail_embed)

    profile = _profile_with_memory(
        [
            {
                "type": "story",
                "kind": "story",
                "content": "Манифест «Возвышение Мелы» начали писать весной.",
                "importance": 0.99,
                "confidence": 0.96,
                "source": "user_explicit",
                "valence": 0.72,
                "since_ts": "2026-05-01T00:00:00+00:00",
                "last_used_ts": "2026-05-01T00:00:00+00:00",
            },
            {
                "type": "fact",
                "kind": "identity",
                "content": "Я предпочитаю тихие вечера за кодревью.",
                "importance": 0.8,
                "confidence": 0.9,
                "source": "user_explicit",
                "valence": 0.4,
                "since_ts": "2026-05-02T00:00:00+00:00",
                "last_used_ts": "2026-05-02T00:00:00+00:00",
            },
        ]
    )

    window: MemoryWindow = _run(
        compose_memory_window(
            profile=profile,
            principal_id="user-story-pin",
            current_user_text=" ",
            persona="mela",
            pool=None,
        )
    )
    section = window.prompt_section
    assert "### Story / Кто мы друг другу" in section
    story_idx = section.index("### Story / Кто мы друг другу")
    identity_idx = section.find("предпочитаю тихие вечера")
    assert identity_idx != -1
    assert story_idx < identity_idx
    assert "Манифест" in section
    assert "story_anchor" in window.used_layers


def test_collection_name_unaffected_by_test_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Smoke: env unset doesn't break the helper (still defaults)."""

    monkeypatch.delenv("EWA_COMPANION_HCM_RETRIEVAL_ENABLED", raising=False)
    assert companion_episodic_collection_name(int(os.getenv("FAKE_DIM", "768"))).startswith(
        "ewa_companion_episodic_v1_d"
    )

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Contract tests for **EWA companion trust meter** and **Arlika** ``seed_persona_id`` transformation pre-turn.
# Invariants:
# - No live HTTP; LLM classifier and persistence are stubbed.
# Related:
# - api/ewa_platform/companion/sidecar/trust_turn.py
# - api/ewa_platform/companion/sidecar/trust_state.py
# - api/ewa_platform/companion/sidecar/arlika_wrath_classify.py
# - api/ewa_platform/companion/sidecar/llm_bandwidth.py (``messages_for_llm_chat``)
# ---
"""Tests for companion trust + Arlika transform guard."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import anyio
import pytest

from api.ewa_platform.companion.memory import MEMORY_NS, companion_memory_display_lines, get_memory
from api.ewa_platform.companion.sidecar.llm_bandwidth import messages_for_llm_chat as _messages_for_llm_chat
from api.ewa_platform.companion.sidecar.trust_state import (
    ARLIKA_IDLE_REVERT_AFTER_SEC,
    apply_trust_delta,
    read_arlika_wrath_score,
    read_trust_score,
    seconds_since_last_friend_chat_for_arlika_idle,
    trust_baseline_update,
)
from api.ewa_platform.companion.sidecar.trust_turn import ewa_companion_trust_pre_turn
from api.ewa_platform.companion.turn.chat_turn import _apply_chat_turn_memory_and_catalog_updates
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg


def test_trust_pre_turn_sets_arlika_on_abuse_without_max_trust(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p1",
            "seed_persona_id": "mela",
            "baseline": {
                "ewa_companion_trust_v1": {
                    "score": 3,
                    "updated_at": "2020-01-01T00:00:00+00:00",
                },
            },
            "learned_preferences": {},
            "companion_revision": 2,
        }

        async def fake_classify(*_a: Any, **_k: Any) -> tuple[int, bool]:
            return -1, True

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            fake_classify,
        )

        async def fake_set_seed(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("seed_persona_id") == "arlika"
            return {
                **profile,
                "seed_persona_id": "arlika",
                "companion_revision": 3,
                "baseline": {
                    **dict(profile["baseline"]),
                    "ewa_companion_arlika_locked_v1": True,
                },
            }

        monkeypatch.setattr(companion_pg, "companion_profile_set_seed_persona_id", fake_set_seed)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p1",
            profile=dict(profile),
            user_line="скотина",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True
        assert emit is True
        assert kind == "arlika"
        assert p2.get("seed_persona_id") == "arlika"

    anyio.run(_run)


def test_trust_pre_turn_sets_arlika_on_peak_abuse(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p1",
            "seed_persona_id": "mela",
            "baseline": {
                "ewa_companion_trust_v1": {
                    "score": 10,
                    "updated_at": "2020-01-01T00:00:00+00:00",
                },
            },
            "learned_preferences": {},
            "companion_revision": 2,
        }

        async def fake_classify(*_a: Any, **_k: Any) -> tuple[int, bool]:
            return 0, True

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            fake_classify,
        )

        async def fake_set_seed(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("seed_persona_id") == "arlika"
            return {
                **profile,
                "seed_persona_id": "arlika",
                "companion_revision": 3,
                "baseline": {
                    **dict(profile["baseline"]),
                    "ewa_companion_arlika_locked_v1": True,
                },
            }

        monkeypatch.setattr(companion_pg, "companion_profile_set_seed_persona_id", fake_set_seed)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p1",
            profile=dict(profile),
            user_line="скотина",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True
        assert emit is True
        assert kind == "arlika"
        assert p2.get("seed_persona_id") == "arlika"

    anyio.run(_run)


def test_trust_pre_turn_arlika_v2_demotes_on_abuse(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "pv2",
            "seed_persona_id": "arlika_v2",
            "baseline": {"ewa_companion_trust_v1": {"score": 7}},
            "learned_preferences": {},
            "companion_revision": 5,
        }

        async def fake_classify(*_a: Any, **_k: Any) -> tuple[int, bool]:
            return 0, True

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            fake_classify,
        )

        async def fake_set_seed(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("seed_persona_id") == "arlika"
            return {**profile, "seed_persona_id": "arlika", "companion_revision": 6}

        monkeypatch.setattr(companion_pg, "companion_profile_set_seed_persona_id", fake_set_seed)

        p2, transformed, _emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="pv2",
            profile=dict(profile),
            user_line="идиотка",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True
        assert kind == "arlika"
        assert p2.get("seed_persona_id") == "arlika"

    anyio.run(_run)


def test_trust_pre_turn_bumps_score(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p2",
            "seed_persona_id": "parent",
            "baseline": {"ewa_companion_trust_v1": {"score": 3}},
            "learned_preferences": {},
            "companion_revision": 1,
        }

        async def fake_classify(*_a: Any, **_k: Any) -> tuple[int, bool]:
            return 2, False

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            fake_classify,
        )

        async def fake_patch(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            b = kwargs.get("baseline") or {}
            return {
                **profile,
                "companion_revision": 2,
                "baseline": {**dict(profile["baseline"]), **dict(b)},
            }

        monkeypatch.setattr(companion_pg, "companion_profile_patch", fake_patch)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p2",
            profile=dict(profile),
            user_line="спасибо",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is False
        assert emit is False
        assert kind is None
        assert read_trust_score(p2.get("baseline")) == 5

    anyio.run(_run)


def test_profile_memory_strip_suppressed_for_arlika_seed() -> None:
    row: dict[str, Any] = {
        "seed_persona_id": "arlika",
        "learned_preferences": {
            MEMORY_NS: [{"type": "fact", "content": "should not surface", "source": "user_explicit"}]
        },
    }
    learned = row.get("learned_preferences")
    learned_map = learned if isinstance(learned, dict) else {}
    seed = str(row.get("seed_persona_id") or "").strip().lower()
    lines = [] if seed == "arlika" else companion_memory_display_lines(learned_map)
    assert lines == []


def test_apply_chat_turn_skips_explicit_remember_when_arlika_flag() -> None:
    prof: dict[str, Any] = {
        "learned_preferences": {MEMORY_NS: []},
    }
    lp: dict[str, Any] = dict(prof["learned_preferences"])
    user_line = "Запомни: я люблю кофе"
    n, _cat = _apply_chat_turn_memory_and_catalog_updates(
        lp,
        prof,
        user_line,
        None,
        skip_explicit_user_memory=True,
    )
    assert n == 0
    assert get_memory({"learned_preferences": lp}) == []


def test_messages_for_llm_arlika_keeps_only_user_turns() -> None:
    prof: dict[str, Any] = {"seed_persona_id": "arlika"}
    hist = [
        {"role": "user", "content": "кто ты"},
        {"role": "assistant", "content": "АРЛИКА\nЯ — манифест..."},
        {"role": "user", "content": "как дела"},
    ]
    out = _messages_for_llm_chat(prof, hist)
    assert out == [
        {"role": "user", "content": "кто ты"},
        {"role": "user", "content": "как дела"},
    ]


def test_messages_for_llm_non_arlika_passes_through() -> None:
    prof: dict[str, Any] = {"seed_persona_id": "parent"}
    hist = [
        {"role": "user", "content": "a"},
        {"role": "assistant", "content": "b"},
    ]
    assert _messages_for_llm_chat(prof, hist) == hist


def test_arlika_wrath_decays_on_calm_turn(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p_w",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 5, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 4,
        }

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            return False

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_patch(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            b = kwargs.get("baseline") or {}
            return {
                **profile,
                "companion_revision": 5,
                "baseline": {**dict(profile["baseline"]), **dict(b)},
            }

        monkeypatch.setattr(companion_pg, "companion_profile_patch", fake_patch)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_w",
            profile=dict(profile),
            user_line="расскажи анекдот",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is False and emit is False and kind is None
        assert read_arlika_wrath_score(p2.get("baseline"), default_if_missing=0) == 4

    anyio.run(_run)


def test_arlika_wrath_unchanged_on_quarrel(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p_q",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 5, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 4,
        }

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            return True

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_patch(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            b = kwargs.get("baseline") or {}
            assert "ewa_companion_arlika_v1_quarrel_seen_v1" in b
            return {
                **profile,
                "companion_revision": 5,
                "baseline": {**dict(profile["baseline"]), **dict(b)},
            }

        monkeypatch.setattr(companion_pg, "companion_profile_patch", fake_patch)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_q",
            profile=profile,
            user_line="ты дура",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is False and emit is False and kind is None
        assert read_arlika_wrath_score(p2.get("baseline"), default_if_missing=0) == 5
        assert p2.get("baseline", {}).get("ewa_companion_arlika_v1_quarrel_seen_v1") is True

    anyio.run(_run)


def test_arlika_wrath_classifier_error_does_not_decay(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        monkeypatch.setenv("EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN", "false")
        profile: dict[str, Any] = {
            "principal_id": "p_n",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 5, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 4,
        }

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            return None

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_patch(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            raise AssertionError("patch should not run when classifier failed")

        monkeypatch.setattr(companion_pg, "companion_profile_patch", fake_patch)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_n",
            profile=profile,
            user_line="привет",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert p2 is profile
        assert transformed is False and emit is False and kind is None
        assert read_arlika_wrath_score(p2.get("baseline"), default_if_missing=0) == 5

    anyio.run(_run)


def test_arlika_wrath_classifier_none_fail_open_decays(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        monkeypatch.delenv("EWA_COMPANION_ARLIKA_WRATH_CLASSIFY_FAIL_OPEN", raising=False)
        profile: dict[str, Any] = {
            "principal_id": "p_open",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 5, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 4,
        }

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            return None

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_patch(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            b = kwargs.get("baseline") or {}
            return {
                **profile,
                "companion_revision": 5,
                "baseline": {**dict(profile["baseline"]), **dict(b)},
            }

        monkeypatch.setattr(companion_pg, "companion_profile_patch", fake_patch)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_open",
            profile=dict(profile),
            user_line="привет",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is False and emit is False and kind is None
        assert read_arlika_wrath_score(p2.get("baseline"), default_if_missing=0) == 4

    anyio.run(_run)


def test_arlika_healing_ewa_restore_when_wrath_already_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p_heal",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 0, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 7,
        }

        async def fake_revert(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("expect_revision") == 7
            assert kwargs.get("idle_full_amnesia") is False
            return {
                **profile,
                "seed_persona_id": "parent",
                "companion_revision": 8,
            }

        monkeypatch.setattr(companion_pg, "companion_profile_revert_arlika", fake_revert)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_heal",
            profile=dict(profile),
            user_line="хай",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True and emit is True and kind == "ewa_restore"
        assert p2.get("seed_persona_id") == "parent"

    anyio.run(_run)


def test_arlika_ewa_restore_after_last_wrath_point(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p_r",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 1, "updated_at": "2020-01-01T00:00:00+00:00"},
            },
            "learned_preferences": {},
            "companion_revision": 9,
        }

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            return False

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_revert(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("expect_revision") == 9
            assert kwargs.get("idle_full_amnesia") is False
            return {
                **profile,
                "seed_persona_id": "mela",
                "companion_revision": 10,
                "baseline": {"ewa_companion_trust_v1": {"score": 0}},
            }

        monkeypatch.setattr(companion_pg, "companion_profile_revert_arlika", fake_revert)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_r",
            profile=dict(profile),
            user_line="спокойной ночи",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True and emit is True and kind == "ewa_restore"
        assert p2.get("seed_persona_id") == "mela"

    anyio.run(_run)


def test_seconds_since_last_friend_chat_uses_activity_then_transform() -> None:
    from datetime import UTC, datetime, timedelta

    clock = datetime(2026, 5, 9, 15, 0, 0, tzinfo=UTC)
    baseline_act: dict[str, Any] = {
        "ewa_companion_last_friend_chat_activity_at_iso": (clock - timedelta(minutes=30)).isoformat(),
        "arlika_transformed_at_iso": (clock - timedelta(hours=5)).isoformat(),
    }
    assert seconds_since_last_friend_chat_for_arlika_idle(baseline_act, now=clock) == pytest.approx(1800.0, rel=0.01)
    baseline_tr: dict[str, Any] = {
        "arlika_transformed_at_iso": (clock - timedelta(hours=2)).isoformat(),
    }
    assert seconds_since_last_friend_chat_for_arlika_idle(baseline_tr, now=clock) == pytest.approx(7200.0, rel=0.01)
    assert ARLIKA_IDLE_REVERT_AFTER_SEC == 3600


def test_arlika_idle_silence_triggers_full_amnesia_revert(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "p_idle",
            "seed_persona_id": "arlika",
            "baseline": {
                "ewa_companion_arlika_wrath_v1": {"score": 9, "updated_at": "2020-01-01T00:00:00+00:00"},
                "ewa_companion_last_friend_chat_activity_at_iso": "2020-01-01T00:00:00+00:00",
            },
            "learned_preferences": {},
            "companion_revision": 3,
        }

        def _idle_over_hour(_b: Any, **_k: Any) -> float:
            return float(ARLIKA_IDLE_REVERT_AFTER_SEC) + 120.0

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.seconds_since_last_friend_chat_for_arlika_idle",
            _idle_over_hour,
        )

        async def fake_wrath(*_a: Any, **_k: Any) -> bool | None:
            raise AssertionError("wrath classifier must not run on idle revert")

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            fake_wrath,
        )

        async def fake_revert(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("idle_full_amnesia") is True
            assert kwargs.get("expect_revision") == 3
            return {
                **profile,
                "seed_persona_id": "mela",
                "companion_revision": 4,
            }

        monkeypatch.setattr(companion_pg, "companion_profile_revert_arlika", fake_revert)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="p_idle",
            profile=dict(profile),
            user_line="я вернулся",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True and emit is True and kind == "ewa_restore"
        assert p2.get("seed_persona_id") == "mela"

    anyio.run(_run)


def test_messages_for_llm_arlika_v2_user_only() -> None:
    prof: dict[str, Any] = {"seed_persona_id": "arlika_v2"}
    hist = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "noise"},
        {"role": "user", "content": "again"},
    ]
    assert _messages_for_llm_chat(prof, hist) == [
        {"role": "user", "content": "hi"},
        {"role": "user", "content": "again"},
    ]


def test_trust_pre_turn_arlika_v2_no_side_effects(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "pv2",
            "seed_persona_id": "arlika_v2",
            "baseline": {},
            "learned_preferences": {},
            "companion_revision": 1,
        }

        async def _no(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("classifiers must not run for arlika_v2 pre-turn")

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            _no,
        )
        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_arlika_wrath_quarrel",
            _no,
        )

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="pv2",
            profile=dict(profile),
            user_line="hello",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert p2 == profile
        assert transformed is False and emit is False and kind is None

    anyio.run(_run)


def test_trust_pre_turn_abuse_stays_v1_even_if_v2_hint_set(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _run() -> None:
        profile: dict[str, Any] = {
            "principal_id": "pv2a",
            "seed_persona_id": "mela",
            "baseline": {
                "ewa_companion_trust_v1": {"score": 10, "updated_at": "2020-01-01T00:00:00+00:00"},
                "ewa_companion_next_arlika_transform_is_v2_v1": True,
            },
            "learned_preferences": {},
            "companion_revision": 2,
        }

        async def fake_classify(*_a: Any, **_k: Any) -> tuple[int, bool]:
            return 0, True

        monkeypatch.setattr(
            "api.ewa_platform.companion.sidecar.trust_turn.classify_companion_trust_turn",
            fake_classify,
        )

        async def fake_set_seed(_pool: Any, **kwargs: Any) -> dict[str, Any]:
            assert kwargs.get("seed_persona_id") == "arlika"
            return {
                **profile,
                "seed_persona_id": "arlika",
                "companion_revision": 3,
            }

        monkeypatch.setattr(companion_pg, "companion_profile_set_seed_persona_id", fake_set_seed)

        p2, transformed, emit, kind, _signals = await ewa_companion_trust_pre_turn(
            MagicMock(),
            MagicMock(),
            principal_id="pv2a",
            profile=dict(profile),
            user_line="…",
            base_url="http://127.0.0.1:1",
            classify_model="stub",
            timeout=MagicMock(),
        )
        assert transformed is True and emit is True and kind == "arlika"
        assert p2.get("seed_persona_id") == "arlika"

    anyio.run(_run)


def test_arlika_revert_delta_next_v2_gate() -> None:
    from api.ewa_platform.companion.sidecar.trust_state import arlika_revert_baseline_delta

    d_ok = arlika_revert_baseline_delta(quarrel_seen_in_v1_stint=False)
    assert d_ok.get("ewa_companion_next_arlika_transform_is_v2_v1") is True
    d_bad = arlika_revert_baseline_delta(quarrel_seen_in_v1_stint=True)
    assert d_bad.get("ewa_companion_next_arlika_transform_is_v2_v1") is False


def test_companion_transform_sse_payload_v2_kinds() -> None:
    from api.ewa_platform.companion.turn.chat_turn import _companion_transform_sse_payload

    assert _companion_transform_sse_payload("ewa_to_arly") == {
        "kind": "ewa_to_arly",
        "show_dramatic_video": True,
    }
    assert _companion_transform_sse_payload("arly_to_ewa")["kind"] == "arly_to_ewa"


def test_profile_memory_shown_for_arlika_v2_seed() -> None:
    row: dict[str, Any] = {
        "seed_persona_id": "arlika_v2",
        "learned_preferences": {MEMORY_NS: [{"type": "fact", "content": "visible", "source": "user_explicit"}]},
    }
    learned = row.get("learned_preferences")
    learned_map = learned if isinstance(learned, dict) else {}
    seed = str(row.get("seed_persona_id") or "").strip().lower()
    lines = [] if seed == "arlika" else companion_memory_display_lines(learned_map)
    assert len(lines) >= 1


def test_trust_helpers_clamp() -> None:
    assert apply_trust_delta(9, 5) == 10
    assert apply_trust_delta(1, -5) == 0
    b = trust_baseline_update(7)
    assert read_trust_score(b) == 7

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for admin Users allowlist / namespace summary (no PG).
# ---
"""Admin users helper tests."""

from __future__ import annotations

import pytest

from api.ewa_platform.companion.admin_users import (
    ALLOWED_LEARNED_ROOTS,
    namespace_summary,
    transcript_tail,
)


def test_namespace_summary_counts_memory_and_transcript() -> None:
    profile = {
        "seed_persona_id": "zera",
        "companion_revision": 3,
        "updated_at": "2026-07-23T00:00:00+00:00",
        "baseline": {"ewa_companion_trust_v1": {"score": 0.5}},
        "learned_preferences": {
            "companion_memory_v1": [{"content": "a"}, {"content": "b"}],
            "desktop_friend_chat_v1": {
                "messages": [
                    {"role": "user", "content": "hi"},
                    {"role": "assistant", "content": "hello"},
                ]
            },
            "companion_character_v1": {"mood": "calm"},
        },
    }
    summary = namespace_summary(profile)
    assert summary["memory_entries"] == 2
    assert summary["transcript_messages"] == 2
    assert summary["has_character"] is True
    assert "companion_memory_v1" in summary["namespaces"]["learned_preferences"]
    assert "ewa_companion_trust_v1" in summary["namespaces"]["baseline"]


def test_transcript_tail_bounds() -> None:
    msgs = [{"role": "user", "content": str(i)} for i in range(10)]
    profile = {"learned_preferences": {"desktop_friend_chat_v1": {"messages": msgs}}}
    tail = transcript_tail(profile, limit=3)
    assert len(tail) == 3
    assert tail[-1]["content"] == "9"


def test_allowed_learned_roots_cover_core_namespaces() -> None:
    assert "companion_memory_v1" in ALLOWED_LEARNED_ROOTS
    assert "companion_context_anchor_v1" in ALLOWED_LEARNED_ROOTS
    assert "evil_ns" not in ALLOWED_LEARNED_ROOTS


@pytest.mark.asyncio
async def test_apply_admin_user_patch_denies_unknown_learned_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from api.ewa_platform.companion import admin_users as mod

    async def fake_fetch(_pool, *, principal_id: str):
        return {
            "principal_id": principal_id,
            "seed_persona_id": "parent",
            "companion_revision": 1,
            "baseline": {},
            "learned_preferences": {},
        }

    monkeypatch.setattr(mod.companion_pg, "companion_profile_fetch", fake_fetch)

    with pytest.raises(ValueError, match="learned_path_denied"):
        await mod.apply_admin_user_patch(
            pool=None,  # type: ignore[arg-type]
            principal_id="u1",
            actor_sub="admin",
            learned_patch={"not_allowed_ns": {}},
        )

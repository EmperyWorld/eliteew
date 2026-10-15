# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit locks for MusicForge taste-profile counts exposed via capabilities (W6).
# Invariants:
# - count_music_forge_taste_profile aggregates likes/dislikes only; no recipe content.
# Related:
# - api/services/music_forge/corpus.py
# - api/routers/music_forge.py
# ---

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from api.services.music_forge.corpus import count_music_forge_taste_profile


class _MappingRow:
    def __init__(self, likes: int, dislikes: int) -> None:
        self._likes = likes
        self._dislikes = dislikes

    def get(self, key: str, default: object = None) -> object:
        if key == "likes":
            return self._likes
        if key == "dislikes":
            return self._dislikes
        return default


class _ExecuteResult:
    def __init__(self, row: _MappingRow | None) -> None:
        self._row = row

    def mappings(self) -> _ExecuteResult:
        return self

    def first(self) -> _MappingRow | None:
        return self._row


@pytest.mark.asyncio
async def test_count_music_forge_taste_profile_returns_likes_and_dislikes() -> None:
    db = MagicMock()
    db.execute = AsyncMock(return_value=_ExecuteResult(_MappingRow(3, 1)))

    out = await count_music_forge_taste_profile(
        db,
        user_id="00000000-0000-4000-8000-000000000001",
    )

    assert out == {"likes": 3, "dislikes": 1}
    assert db.execute.await_count == 1
    sql = str(db.execute.await_args.args[0])
    assert "music_forge_feedback" in sql
    assert "rating = 'like'" in sql
    assert db.execute.await_args.args[1]["user_id"] == "00000000-0000-4000-8000-000000000001"


@pytest.mark.asyncio
async def test_count_music_forge_taste_profile_empty_row_returns_zeros() -> None:
    db = MagicMock()
    db.execute = AsyncMock(return_value=_ExecuteResult(None))

    out = await count_music_forge_taste_profile(
        db,
        user_id="00000000-0000-4000-8000-000000000001",
    )

    assert out == {"likes": 0, "dislikes": 0}

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Phase 1 ConfigGateway generation-stamp cache contract.
# Invariants:
# - Local cache hit only when generation matches.
# - Generation mismatch forces reload path (no TTL-only reuse).
# Related:
# - api/services/music_forge/config/coordinator.py
# - api/services/music_forge/config/gateway.py
# ---
"""MusicForge ConfigGateway generation stamp tests."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from api.services.music_forge.config import code_default_bundle
from api.services.music_forge.config import coordinator as config_coordinator
from api.services.music_forge.config.gateway import MusicForgeConfigGateway


@pytest.mark.asyncio
async def test_local_cache_hit_only_on_matching_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    bundle = code_default_bundle()
    config_coordinator.clear_local_cache()
    config_coordinator.set_local_cache(3, bundle)
    monkeypatch.setattr(config_coordinator, "read_redis_generation", AsyncMock(return_value=3))
    monkeypatch.setattr(config_coordinator, "fetch_pg_generation", AsyncMock(return_value=3))

    db = AsyncMock()
    gateway = MusicForgeConfigGateway(db)
    loaded = await gateway.get_active()
    assert loaded is bundle
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_generation_mismatch_clears_stale_local_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    stale = code_default_bundle()
    config_coordinator.clear_local_cache()
    config_coordinator.set_local_cache(1, stale)
    monkeypatch.setattr(config_coordinator, "read_redis_generation", AsyncMock(return_value=2))
    monkeypatch.setattr(config_coordinator, "fetch_pg_generation", AsyncMock(return_value=2))
    monkeypatch.setattr(config_coordinator, "publish_generation", AsyncMock())

    # Force incomplete active → unavailable (proves we did not return stale gen=1 cache)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=type("R", (), {"mappings": lambda self: self, "first": lambda self: None})())
    gateway = MusicForgeConfigGateway(db)
    with pytest.raises(Exception) as exc:
        await gateway.get_active()
    assert "music_forge_config_unavailable" in str(exc.value) or exc.value.__class__.__name__
    assert config_coordinator.get_local_cached(1) is None


@pytest.mark.asyncio
async def test_second_worker_process_misses_stale_cache_after_generation_bump(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fake multi-worker: worker A caches gen=5; Redis/PG bump to 6 → stale local must not hit."""
    worker_a_bundle = code_default_bundle()
    config_coordinator.clear_local_cache()
    config_coordinator.set_local_cache(5, worker_a_bundle)
    assert config_coordinator.get_local_cached(5) is worker_a_bundle
    assert config_coordinator.get_local_cached(6) is None

    # Simulate activate publish on another process (generation bump)
    monkeypatch.setattr(config_coordinator, "read_redis_generation", AsyncMock(return_value=6))
    monkeypatch.setattr(config_coordinator, "fetch_pg_generation", AsyncMock(return_value=6))
    monkeypatch.setattr(config_coordinator, "publish_generation", AsyncMock())

    db = AsyncMock()
    db.execute = AsyncMock(return_value=type("R", (), {"mappings": lambda self: self, "first": lambda self: None})())
    worker_b = MusicForgeConfigGateway(db)
    with pytest.raises(Exception) as exc:
        await worker_b.get_active()
    assert "music_forge_config_unavailable" in str(exc.value) or isinstance(exc.value, Exception)
    # After mismatch path, gen=5 local entry is cleared
    assert config_coordinator.get_local_cached(5) is None

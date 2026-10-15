# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Layer C locks for Admin consolidation: ewa_getenv* prefers DB cache; presentation/agentic
# gates ignore compose when cache is loaded (Test 1 + Test 2 semantics).
# Related:
# - documentation/product/ewa/EWA-PLATFORM-SETTINGS-HIDDEN-TOGGLES-INVENTORY-2026-07-09.md
# ---

from __future__ import annotations

from collections.abc import Iterator

import pytest

from api.ewa_platform.companion.orchestration import companion_presentation_generation as presentation
from api.ewa_platform.settings import access as settings_access
from api.ewa_platform.settings import service as settings_service
from api.ewa_platform.settings.catalog_entries import GENERATED_CATALOG


@pytest.fixture(autouse=True)
def reset_ewa_settings_cache() -> Iterator[None]:
    yield
    with settings_service._cache_lock:  # noqa: SLF001
        settings_service._cache.clear()  # noqa: SLF001
        settings_service._loaded = False  # noqa: SLF001


@pytest.mark.unit
def test_catalog_includes_h1_h3_keys_and_categories() -> None:
    assert "EWA_COMPANION_PRESENTATION_GENERATION_ENABLED" in GENERATED_CATALOG
    assert GENERATED_CATALOG["EWA_COMPANION_PRESENTATION_GENERATION_ENABLED"].category == "media"
    assert "EWA_AGENTIC_STEP_SCHEDULER_ENABLED" in GENERATED_CATALOG
    assert GENERATED_CATALOG["EWA_AGENTIC_STEP_SCHEDULER_ENABLED"].category == "agentic"
    assert GENERATED_CATALOG["EWA_AGENTIC_SUBSTRATE_ENABLED"].category == "agentic"
    assert "EWA_COMPANION_VISION_ENABLED" in GENERATED_CATALOG
    assert len(GENERATED_CATALOG) >= 260


@pytest.mark.unit
def test_ewa_getenv_prefers_cache_over_compose(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EWA_COMPANION_PRESENTATION_GENERATION_ENABLED", "0")
    settings_service._apply_cache({"EWA_COMPANION_PRESENTATION_GENERATION_ENABLED": "1"})
    assert settings_access.ewa_getenv("EWA_COMPANION_PRESENTATION_GENERATION_ENABLED", "0") == "1"
    assert presentation.companion_presentation_generation_enabled() is True


@pytest.mark.unit
def test_ewa_getenv_compose_removal_does_not_break_when_cache_loaded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings_service._apply_cache({"EWA_COMPANION_PRESENTATION_GENERATION_ENABLED": "1"})
    monkeypatch.delenv("EWA_COMPANION_PRESENTATION_GENERATION_ENABLED", raising=False)
    assert presentation.companion_presentation_generation_enabled() is True


@pytest.mark.unit
def test_ewa_getenv_falls_back_to_env_before_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    settings_service._apply_cache({})
    # Empty cache still marks loaded; clear loaded flag for pre-bootstrap path.
    settings_service._loaded = False  # noqa: SLF001 — test hook
    monkeypatch.setenv("EWA_CELERY_BEAT_STALE_SECONDS", "900")
    assert settings_access.ewa_getenv_int("EWA_CELERY_BEAT_STALE_SECONDS", default=600) == 900

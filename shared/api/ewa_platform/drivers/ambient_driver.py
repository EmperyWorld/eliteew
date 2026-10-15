# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# **Ambient driver Protocol** for EWA companion (project «Mela's Ascension», Module B3). Lets the
# companion express «atmosphere» actions (theme / wallpaper / music preset) through the same driver
# registry as desktop / content drivers — concrete adapters can re-use ``patch_desktop_config`` plus
# the SPA ``MusicPlayer`` open intent without each turn needing custom plumbing.
# Invariants:
# - **Protocol only here.** Implementations live in adapters/ (HTTP wire), services/ (in-process), or
#   tests/ (fakes). The core depends on the Protocol so the registry can swap them.
# - Driver returns ``AmbientApplyResult`` even on partial failure; **never raises**.
# - The driver is **suggestion executor**: deciding whether to call it is the responsibility of the
#   chat orchestrator (gated by ``EWA_COMPANION_AMBIENT_ACTIONS_ENABLED``).
# Related:
# - api/ewa_platform/drivers/registry.py (``AMBIENT_DRIVER_ID``)
# - api/ewa_platform/companion/affective/mood_palette.py
# - api/ewa_platform/companion/actions/ambient.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

AMBIENT_DRIVER_ID: str = "ewa_companion_ambient"


@dataclass(frozen=True)
class AmbientApplyResult:
    """Outcome of one ``apply_ambient`` call."""

    ok: bool
    applied_theme: str | None = None
    applied_wallpaper: str | None = None
    applied_music_preset: str | None = None
    diagnostics: dict[str, str] = field(default_factory=dict)


@runtime_checkable
class AmbientDriver(Protocol):
    """Apply one resolved ambient preset (theme / wallpaper / music)."""

    @property
    def driver_id(self) -> str:
        """Registry key, e.g. ``ewa_companion_ambient``."""

        ...

    async def ping(self) -> Mapping[str, Any]:
        """Cheap health probe."""

        ...

    async def apply_ambient(
        self,
        *,
        principal_id: str,
        mood: str,
        theme_id: str | None,
        wallpaper_id: str | None,
        music_preset: str | None,
        rationale: str,
    ) -> AmbientApplyResult:
        """Best-effort ambient application; concrete adapter decides what to call (HTTP / SPA event)."""

        ...


class FakeAmbientDriver:
    """In-process driver for tests and dev runtime — only records what would have been applied."""

    def __init__(self, *, driver_id: str = AMBIENT_DRIVER_ID) -> None:
        self._driver_id = driver_id
        self.calls: list[Mapping[str, Any]] = []

    @property
    def driver_id(self) -> str:
        return self._driver_id

    async def ping(self) -> Mapping[str, Any]:
        return {"ok": True, "driver_id": self._driver_id, "kind": "fake"}

    async def apply_ambient(
        self,
        *,
        principal_id: str,
        mood: str,
        theme_id: str | None,
        wallpaper_id: str | None,
        music_preset: str | None,
        rationale: str,
    ) -> AmbientApplyResult:
        self.calls.append(
            {
                "principal_id": principal_id,
                "mood": mood,
                "theme_id": theme_id,
                "wallpaper_id": wallpaper_id,
                "music_preset": music_preset,
                "rationale": rationale,
            }
        )
        return AmbientApplyResult(
            ok=True,
            applied_theme=theme_id,
            applied_wallpaper=wallpaper_id,
            applied_music_preset=music_preset,
            diagnostics={"driver": self._driver_id, "kind": "fake"},
        )

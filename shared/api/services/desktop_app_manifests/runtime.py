# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve the active install profile from env (UnifiedConfig) for Desktop enablement.
# Invariants:
# - Empty ELITEEW_INSTALL_PROFILE → default profile for ELITEEW_PRODUCT_EDITION.
# - Dual-flag: explicit profile.edition must match ELITEEW_PRODUCT_EDITION (fail closed).
# Related:
# - api/core/unified_config.py (ELITEEW_PRODUCT_EDITION / ELITEEW_INSTALL_PROFILE)
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §6
# ---

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from api.services.desktop_app_manifests.profiles import (
    EditionName,
    InstallProfile,
    load_profile,
    resolve_enabled_app_components,
)

DEFAULT_PROFILE_BY_EDITION: dict[EditionName, str] = {
    "cloud": "cloud-full",
    "onprem": "onprem-team-core",
    "client": "client-offline-ai",
}


class InstallProfileConfigError(ValueError):
    """Misconfigured edition/profile pair — fail closed at API boundary."""


@dataclass(frozen=True, slots=True)
class ActiveInstallSnapshot:
    edition: EditionName
    profile_id: str
    mode: str
    access_mode: str
    seat_activation_required: bool
    include_legacy: bool
    enabled_app_components: frozenset[str]


def _settings_edition_and_profile() -> tuple[EditionName, str]:
    from api.core.unified_config import unified_settings

    edition_raw = str(getattr(unified_settings, "eliteew_product_edition", "cloud") or "cloud")
    edition = edition_raw.strip().lower()
    if edition not in ("cloud", "onprem", "client"):
        raise InstallProfileConfigError(
            f"ELITEEW_PRODUCT_EDITION invalid: {edition_raw!r} (expected cloud|onprem|client)"
        )
    profile_raw = str(getattr(unified_settings, "eliteew_install_profile", "") or "").strip()
    return edition, profile_raw  # type: ignore[return-value]


def resolve_active_profile_id() -> str:
    """Profile id from env; empty profile → edition default pack."""
    edition, profile_raw = _settings_edition_and_profile()
    if profile_raw:
        return profile_raw
    return DEFAULT_PROFILE_BY_EDITION[edition]


def load_active_profile() -> InstallProfile:
    edition, profile_raw = _settings_edition_and_profile()
    profile_id = profile_raw or DEFAULT_PROFILE_BY_EDITION[edition]
    try:
        profile = load_profile(profile_id)
    except ValueError as exc:
        raise InstallProfileConfigError(str(exc)) from exc
    if profile.edition != edition:
        raise InstallProfileConfigError(
            f"ELITEEW_PRODUCT_EDITION={edition} conflicts with profile "
            f"{profile.id!r} (edition={profile.edition}); "
            f"set ELITEEW_INSTALL_PROFILE={DEFAULT_PROFILE_BY_EDITION[edition]!r} "
            f"or align edition"
        )
    return profile


@lru_cache(maxsize=16)
def _cached_enabled(profile_id: str) -> frozenset[str]:
    return resolve_enabled_app_components(profile_id)


def clear_active_install_cache() -> None:
    """Test helper — drop lru cache after env/settings monkeypatch."""
    _cached_enabled.cache_clear()


def resolve_active_enabled_app_components() -> frozenset[str]:
    profile = load_active_profile()
    try:
        return _cached_enabled(profile.id)
    except ValueError as exc:
        raise InstallProfileConfigError(str(exc)) from exc


def is_active_app_component_enabled(app_component: str) -> bool:
    return app_component in resolve_active_enabled_app_components()


def get_active_install_snapshot() -> ActiveInstallSnapshot:
    profile = load_active_profile()
    enabled = resolve_active_enabled_app_components()
    return ActiveInstallSnapshot(
        edition=profile.edition,
        profile_id=profile.id,
        mode=profile.mode,
        access_mode=profile.access_mode,
        seat_activation_required=profile.seat_activation_required,
        include_legacy=profile.include_legacy,
        enabled_app_components=enabled,
    )


FOFLINE_CONNECTED_PROFILE_ID = "fofline-connected"


def get_install_snapshot_for_oauth_client(
    oauth_client_id: str | None,
) -> ActiveInstallSnapshot:
    """
    Env-resolved snapshot, overridden to ``fofline-connected`` for FoFline OAuth clients.

    Same stack0 cloud edition host may serve browser (cloud-full) and FoFline seats;
    surface gate must follow the token, not only ELITEEW_INSTALL_PROFILE.
    """
    from api.services.fofline_remote_tools import is_fofline_oauth_client

    if is_fofline_oauth_client(oauth_client_id):
        profile = load_profile(FOFLINE_CONNECTED_PROFILE_ID)
        try:
            enabled = _cached_enabled(profile.id)
        except ValueError as exc:
            raise InstallProfileConfigError(str(exc)) from exc
        return ActiveInstallSnapshot(
            edition=profile.edition,
            profile_id=profile.id,
            mode=profile.mode,
            access_mode=profile.access_mode,
            seat_activation_required=profile.seat_activation_required,
            include_legacy=profile.include_legacy,
            enabled_app_components=enabled,
        )
    return get_active_install_snapshot()

# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Public exports for desktop product app manifests / KNOWN components.
# Invariants:
# - KNOWN_DESKTOP_APP_COMPONENTS is loaded once via loader.known_desktop_app_components().
# Related:
# - shared/apps/README.md
# ---

from api.services.desktop_app_manifests.loader import (
    AppManifest,
    build_known_desktop_app_components,
    known_desktop_app_components,
    load_manifests,
    validate_all,
)
from api.services.desktop_app_manifests.profiles import (
    InstallProfile,
    is_app_component_enabled,
    load_profile,
    load_profiles,
    resolve_enabled_app_components,
)
from api.services.desktop_app_manifests.runtime import (
    ActiveInstallSnapshot,
    InstallProfileConfigError,
    get_active_install_snapshot,
    is_active_app_component_enabled,
    resolve_active_enabled_app_components,
    resolve_active_profile_id,
)

KNOWN_DESKTOP_APP_COMPONENTS: frozenset[str] = known_desktop_app_components()

__all__ = [
    "ActiveInstallSnapshot",
    "AppManifest",
    "InstallProfile",
    "InstallProfileConfigError",
    "KNOWN_DESKTOP_APP_COMPONENTS",
    "build_known_desktop_app_components",
    "get_active_install_snapshot",
    "is_active_app_component_enabled",
    "is_app_component_enabled",
    "known_desktop_app_components",
    "load_manifests",
    "load_profile",
    "load_profiles",
    "resolve_active_enabled_app_components",
    "resolve_active_profile_id",
    "resolve_enabled_app_components",
    "validate_all",
]

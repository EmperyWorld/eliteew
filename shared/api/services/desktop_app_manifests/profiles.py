# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Install profiles over product app manifests — resolve enabled app_components
# for edition + named profile (Phase 2 foundation).
# Invariants:
# - Profile cannot enable an app whose edition_default[edition] is false.
# - allowlist apps must be known manifest ids; unknown ids fail closed.
# - Community profiles never require a paid/native seat activation.
# - Dual-flag: explicit profile selection wins shape; edition_default is hard floor.
# Related:
# - shared/apps/_profiles/
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §6
# ---

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from api.services.desktop_app_manifests.loader import (
    AppManifest,
    apps_root,
    load_legacy_components,
    load_manifests,
)

EditionName = Literal["cloud", "onprem", "client"]
ProfileMode = Literal["edition_default", "allowlist"]
AccessMode = Literal["community", "managed"]


class InstallProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    edition: EditionName
    mode: ProfileMode
    access_mode: AccessMode
    seat_activation_required: bool
    include_legacy: bool = False
    apps: list[str] = Field(default_factory=list)
    # Selective legacy / non-manifest components (e.g. fofline-connected). Not full include_legacy.
    extra_app_components: list[str] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def _id_ok(cls, v: str) -> str:
        if not v or not v[0].islower():
            raise ValueError(f"profile id invalid: {v!r}")
        for c in v:
            if c not in "abcdefghijklmnopqrstuvwxyz0123456789_-":
                raise ValueError(f"profile id invalid: {v!r}")
        return v

    @field_validator("extra_app_components")
    @classmethod
    def _extra_ok(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for raw in v:
            name = str(raw or "").strip()
            if not name:
                raise ValueError("extra_app_components entry must be non-empty")
            if name in seen:
                continue
            seen.add(name)
            out.append(name)
        return out

    @model_validator(mode="after")
    def _allowlist_needs_apps(self) -> InstallProfile:
        if self.mode == "allowlist" and not self.apps:
            raise ValueError(f"profile {self.id!r}: mode=allowlist requires non-empty apps")
        if self.mode == "edition_default" and self.apps:
            raise ValueError(f"profile {self.id!r}: mode=edition_default must use empty apps[]")
        if self.include_legacy and self.extra_app_components:
            raise ValueError(f"profile {self.id!r}: include_legacy and extra_app_components are mutually exclusive")
        if self.access_mode == "community" and self.seat_activation_required:
            raise ValueError(f"profile {self.id!r}: access_mode=community cannot require seat activation")
        return self


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path}: root must be a mapping")
    return data


def iter_profile_paths(root: Path | None = None) -> list[Path]:
    base = (root or apps_root()) / "_profiles"
    if not base.is_dir():
        return []
    return sorted(p for p in base.glob("*.yaml") if p.is_file())


def load_profiles(root: Path | None = None) -> list[InstallProfile]:
    profiles: list[InstallProfile] = []
    for path in iter_profile_paths(root):
        try:
            profiles.append(InstallProfile.model_validate(_load_yaml(path)))
        except Exception as exc:
            raise ValueError(f"{path}: {exc}") from exc
    return profiles


def load_profile(profile_id: str, root: Path | None = None) -> InstallProfile:
    for p in load_profiles(root):
        if p.id == profile_id:
            return p
    raise ValueError(f"unknown install profile: {profile_id!r}")


def _edition_flag(m: AppManifest, edition: EditionName) -> bool:
    return bool(getattr(m.edition_default, edition))


def resolve_enabled_manifests(
    profile: InstallProfile,
    *,
    root: Path | None = None,
) -> list[AppManifest]:
    """Manifests enabled by profile. edition_default[edition] is a hard floor."""
    manifests = load_manifests(root)
    by_id = {m.id: m for m in manifests}

    if profile.mode == "allowlist":
        unknown = [aid for aid in profile.apps if aid not in by_id]
        if unknown:
            raise ValueError(f"profile {profile.id!r}: unknown manifest ids {unknown}")
        selected = [by_id[aid] for aid in profile.apps]
    else:
        selected = [m for m in manifests if _edition_flag(m, profile.edition)]

    # Hard floor: never enable if edition_default says false for profile.edition
    enabled = [m for m in selected if _edition_flag(m, profile.edition)]
    if profile.mode == "allowlist" and not enabled:
        raise ValueError(
            f"profile {profile.id!r}: resolved zero components "
            f"(allowlist empty after edition_default floor for {profile.edition})"
        )
    return enabled


def resolve_enabled_app_components(
    profile_id: str,
    *,
    root: Path | None = None,
) -> frozenset[str]:
    """Enabled desktop app_component set for a named install profile."""
    profile = load_profile(profile_id, root)
    enabled = resolve_enabled_manifests(profile, root=root)
    components = {m.surfaces.desktop.app_component for m in enabled}
    if profile.include_legacy:
        if profile.edition != "cloud":
            raise ValueError(f"profile {profile.id!r}: include_legacy only allowed for edition=cloud")
        components |= set(load_legacy_components(root))
    if profile.extra_app_components:
        known = set(load_legacy_components(root)) | {m.surfaces.desktop.app_component for m in load_manifests(root)}
        unknown_extra = [c for c in profile.extra_app_components if c not in known]
        if unknown_extra:
            raise ValueError(f"profile {profile.id!r}: unknown extra_app_components {unknown_extra}")
        components |= set(profile.extra_app_components)
    return frozenset(components)


def is_app_component_enabled(
    app_component: str,
    profile_id: str,
    *,
    root: Path | None = None,
) -> bool:
    return app_component in resolve_enabled_app_components(profile_id, root=root)


def validate_profiles(root: Path | None = None) -> list[str]:
    """Validate all profiles resolve; raise ValueError on failure."""
    base = root or apps_root()
    profiles = load_profiles(base)
    if not profiles:
        raise ValueError(f"{base / '_profiles'}: no install profiles found")
    lines: list[str] = [f"profiles={len(profiles)}"]
    seen: set[str] = set()
    for p in profiles:
        if p.id in seen:
            raise ValueError(f"duplicate profile id {p.id!r}")
        seen.add(p.id)
        comps = resolve_enabled_app_components(p.id, root=base)
        lines.append(
            f"ok profile id={p.id} edition={p.edition} mode={p.mode} "
            f"access_mode={p.access_mode} seat_activation_required={p.seat_activation_required} "
            f"enabled_components={len(comps)}"
        )
        if not comps and p.mode == "allowlist":
            raise ValueError(f"profile {p.id!r}: resolved zero components")
    return lines

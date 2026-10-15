# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Load product app manifests (shared/apps/*/app.manifest.yaml) and build
# KNOWN_DESKTOP_APP_COMPONENTS = manifests ∪ legacy JSON; write FE generated JSON.
# Invariants:
# - Manifest app_component must not also appear in legacy (fail closed).
# - Duplicate app_component across manifests fail closed.
# - validate_all refreshes shell/knownDesktopAppComponents.generated.json (Wave F1).
# Related:
# - shared/apps/README.md
# - documentation/platform/ELITEEW-PRODUCT-EDITIONS-AND-APP-PLATFORM.md §5
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

_CAPABILITY_ENUM = frozenset(
    {
        "auth",
        "postgres",
        "redis",
        "llm",
        "qdrant",
        "gpu",
        "comfy",
        "socketio",
        "object_store",
    }
)


class EditionDefault(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cloud: bool
    onprem: bool
    client: bool


class DesktopSurface(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_component: str
    icon: str | None = None

    @field_validator("app_component")
    @classmethod
    def _pascal_component(cls, v: str) -> str:
        if not v or not v[0].isupper() or not v.isalnum():
            raise ValueError(f"app_component must be PascalCase alphanumeric, got {v!r}")
        return v


class ApiSurface(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prefixes: list[str] = Field(default_factory=list)


class JobsSurface(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queues: list[str] = Field(default_factory=list)


class Surfaces(BaseModel):
    model_config = ConfigDict(extra="forbid")

    desktop: DesktopSurface
    api: ApiSurface | None = None
    jobs: JobsSurface | None = None


class OptionalRuntime(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str = "in_process"

    @field_validator("kind")
    @classmethod
    def _kind_ok(cls, v: str) -> str:
        if v not in {"in_process", "process", "container"}:
            raise ValueError(f"optional_runtime.kind invalid: {v!r}")
        return v


class ClientSurface(BaseModel):
    model_config = ConfigDict(extra="forbid")

    offline_capable: str = "none"
    remote_tools_allowlist: list[str] = Field(default_factory=list)

    @field_validator("offline_capable")
    @classmethod
    def _offline_ok(cls, v: str) -> str:
        if v not in {"none", "partial", "full"}:
            raise ValueError(f"client.offline_capable invalid: {v!r}")
        return v


class AppManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    edition_default: EditionDefault
    requires: list[str] = Field(default_factory=list)
    optional_runtime: OptionalRuntime | None = None
    surfaces: Surfaces
    client: ClientSurface | None = None

    @field_validator("id")
    @classmethod
    def _id_snake(cls, v: str) -> str:
        if not v or not v[0].islower() or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789_" for c in v):
            raise ValueError(f"id must be snake_case starting with letter, got {v!r}")
        return v

    @field_validator("requires")
    @classmethod
    def _requires_ok(cls, v: list[str]) -> list[str]:
        bad = [x for x in v if x not in _CAPABILITY_ENUM]
        if bad:
            raise ValueError(f"unknown requires: {bad}")
        if len(v) != len(set(v)):
            raise ValueError("requires must be unique")
        return v


def apps_root() -> Path:
    """shared/apps — resolve from this file (api/services/desktop_app_manifests/)."""
    # …/shared/api/services/desktop_app_manifests/loader.py → shared/
    shared_root = Path(__file__).resolve().parents[3]
    return shared_root / "apps"


def _load_yaml(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: root must be a mapping")
    return data


def iter_manifest_paths(root: Path | None = None) -> list[Path]:
    base = root or apps_root()
    if not base.is_dir():
        return []
    return sorted(p for p in base.glob("*/app.manifest.yaml") if p.is_file() and not p.parent.name.startswith("_"))


def load_manifests(root: Path | None = None) -> list[AppManifest]:
    manifests: list[AppManifest] = []
    for path in iter_manifest_paths(root):
        data = _load_yaml(path)
        try:
            manifests.append(AppManifest.model_validate(data))
        except Exception as exc:
            raise ValueError(f"{path}: {exc}") from exc
    return manifests


def load_legacy_components(root: Path | None = None) -> frozenset[str]:
    base = root or apps_root()
    legacy_path = base / "_legacy" / "known_desktop_app_components.legacy.json"
    if not legacy_path.is_file():
        return frozenset()
    payload = json.loads(legacy_path.read_text(encoding="utf-8"))
    items = payload.get("app_components")
    if not isinstance(items, list):
        raise ValueError(f"{legacy_path}: app_components must be a list")
    out: set[str] = set()
    for item in items:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"{legacy_path}: invalid app_component entry {item!r}")
        out.add(item.strip())
    return frozenset(out)


def build_known_desktop_app_components(root: Path | None = None) -> frozenset[str]:
    """Union of manifest app_components and legacy; fail on overlap or duplicate manifests."""
    manifests = load_manifests(root)
    from_manifests: dict[str, str] = {}
    for m in manifests:
        comp = m.surfaces.desktop.app_component
        if comp in from_manifests:
            raise ValueError(f"duplicate app_component {comp!r} in manifests {from_manifests[comp]!r} and {m.id!r}")
        from_manifests[comp] = m.id

    legacy = load_legacy_components(root)
    overlap = set(from_manifests) & set(legacy)
    if overlap:
        raise ValueError(f"app_component present in both manifests and legacy (remove from legacy): {sorted(overlap)}")

    known = frozenset(from_manifests) | legacy
    if not known:
        raise ValueError("KNOWN_DESKTOP_APP_COMPONENTS would be empty")
    return known


@lru_cache(maxsize=1)
def known_desktop_app_components() -> frozenset[str]:
    return build_known_desktop_app_components()


def known_fe_generated_path() -> Path:
    """FE import path for API KNOWN (Wave F1 Gen/Forge harvest)."""
    eliteew_root = Path(__file__).resolve().parents[3]
    return (
        eliteew_root
        / "web"
        / "frontend"
        / "src"
        / "pages"
        / "Desktop"
        / "shell"
        / "knownDesktopAppComponents.generated.json"
    )


def write_known_fe_generated(known: frozenset[str], path: Path | None = None) -> Path:
    """Write sorted API KNOWN for FE union with shell-only components."""
    out = path or known_fe_generated_path()
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "app_components": sorted(known),
        "count": len(known),
        "source": "shared/apps manifests ∪ _legacy",
    }
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    out.write_text(text, encoding="utf-8")
    return out


def validate_all(root: Path | None = None) -> list[str]:
    """Return human-readable OK lines; raise ValueError on failure."""
    base = root or apps_root()
    manifests = load_manifests(base)
    known = build_known_desktop_app_components(base)
    fe_path = write_known_fe_generated(known)
    lines = [
        f"apps_root={base}",
        f"manifests={len(manifests)}",
        f"legacy={len(load_legacy_components(base))}",
        f"known={len(known)}",
        f"fe_known_generated={fe_path}",
    ]
    for m in manifests:
        lines.append(f"ok manifest id={m.id} app_component={m.surfaces.desktop.app_component}")
    from api.services.desktop_app_manifests.profiles import validate_profiles

    lines.extend(validate_profiles(base))
    return lines

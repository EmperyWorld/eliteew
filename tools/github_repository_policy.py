# ---
# EliteEW · Empery World · https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Path placement and repository ids for the EliteEW GitHub canon.
# Invariants:
# - Development-only and excluded paths must not be classified as shared source.
# - Constants match documentation/platform/ELITEEW-GITHUB-REPOSITORY.md.
# Related:
# - documentation/platform/ELITEEW-GITHUB-REPOSITORY.md
# - documentation/platform/engineering-bar/adr/ADR-004-github-development-canon.md
# ---
"""Classify monorepo paths for the development canon and the public export."""

from __future__ import annotations

from enum import StrEnum

PUBLIC_REPOSITORY = "EmperyWorld/eliteew"
PUBLIC_SOURCE_URL = "https://github.com/EmperyWorld/eliteew"
DEVELOPMENT_REPOSITORY = "EmperyWorld/eliteew-dev"

COMMUNITY_INSTALL_SCRIPT = "scripts/eliteew/install-community.sh"
COMMUNITY_EDITION = "onprem"
COMMUNITY_PROFILE = "onprem-team-core"
PROD_RUNTIME_HOST = "192.168.1.111"
COMMAND_CENTER_HOST = "192.168.1.136"

PRODUCT_MEDIA_PREFIXES: tuple[str, ...] = (
    "shared/web/frontend/public/audio/",
    "shared/web/frontend/public/ewa/",
    "shared/web/landing/kuku2.mp4",
)

DEVELOPMENT_ONLY_PREFIXES: tuple[str, ...] = (
    "docker/env_file/bundles/prod-core.env.tar.sops",
    "docker/env_file/bundles/.sops.yaml",
    ".cursor/",
)

EXCLUDED_PREFIXES: tuple[str, ...] = (
    "pack-cloud/mobile/adb_exports/",
    "tg_bot_ip_verif/",
)


class Placement(StrEnum):
    """Where a path lives after the GitHub cutover."""

    BOTH = "both"
    DEVELOPMENT_ONLY = "development_only"
    NEITHER = "neither"


def _normalize(path: str) -> str:
    cleaned = path.replace("\\", "/").strip()
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    return cleaned.lstrip("/")


def _matches(path: str, prefix: str) -> bool:
    if prefix.endswith("/"):
        return path == prefix[:-1] or path.startswith(prefix)
    return path == prefix or path.startswith(prefix + "/")


def classify_repo_path(path: str) -> Placement:
    """Return target placement for a repo-relative path.

    ``development_only`` and ``neither`` win over product media. Unknown
    source paths are ``both``.
    """
    normalized = _normalize(path)
    if not normalized:
        raise ValueError("path is empty")
    for prefix in EXCLUDED_PREFIXES:
        if _matches(normalized, prefix):
            return Placement.NEITHER
    for prefix in DEVELOPMENT_ONLY_PREFIXES:
        if _matches(normalized, prefix):
            return Placement.DEVELOPMENT_ONLY
    return Placement.BOTH


def is_product_media(path: str) -> bool:
    """True when the path is shell media that both repositories must keep."""
    normalized = _normalize(path)
    if classify_repo_path(normalized) is not Placement.BOTH:
        return False
    return any(_matches(normalized, prefix) for prefix in PRODUCT_MEDIA_PREFIXES)


def history_drop_paths(*placements: Placement) -> tuple[str, ...]:
    """Repo paths that ``git filter-repo --invert-paths`` must drop.

    ``NEITHER`` is the development-canon history rewrite. The public export
    drops ``NEITHER`` and ``DEVELOPMENT_ONLY``.
    """
    if not placements:
        raise ValueError("placements required")
    selected: list[str] = []
    for placement in placements:
        if placement is Placement.NEITHER:
            prefixes = EXCLUDED_PREFIXES
        elif placement is Placement.DEVELOPMENT_ONLY:
            prefixes = DEVELOPMENT_ONLY_PREFIXES
        else:
            raise ValueError(f"placement cannot be dropped: {placement}")
        selected.extend(prefix.rstrip("/") for prefix in prefixes)
    return tuple(selected)


def index_violations(paths: list[str], *, allowed: frozenset[Placement]) -> list[str]:
    """Return tracked paths whose placement is outside ``allowed``."""
    if not allowed:
        raise ValueError("allowed placements required")
    violations: list[str] = []
    for path in paths:
        if classify_repo_path(path) not in allowed:
            violations.append(path)
    return violations

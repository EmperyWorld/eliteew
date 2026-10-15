# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Path allowlist + monorepo root discovery for Курсорина read/search tools.
# Invariants:
# - Deny secrets, env, trash, keys; documentation + selected shared code trees only.
# Related:
# - documentation/product/desktop/KURSORINA.md
# ---

from __future__ import annotations

from pathlib import Path

_ALLOWED_PREFIXES = (
    "documentation/",
    "shared/apps/",
    "shared/api/services/",
    "shared/api/routers/",
    "shared/api/domains/",
    "shared/api/tests/test_kursorina_worker.py",
)

_DENIED_SUBSTR = (
    "/.env",
    "keys/",
    "trash/",
    "node_modules/",
    "host/runtime/",
    "docker/env_file/",
    ".sops",
    "password",
    "secret",
    "credential",
    "__pycache__",
)


def monorepo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "shared" / "api").is_dir() and (parent / "documentation").is_dir():
            return parent
    return here.parents[4]


def _normalize_rel(rel_or_abs: str, *, root: Path) -> str | None:
    raw = str(rel_or_abs or "").strip()
    if not raw or ".." in Path(raw).parts:
        return None
    path = Path(raw)
    if path.is_absolute():
        try:
            return path.resolve().relative_to(root.resolve()).as_posix()
        except ValueError:
            return None
    return path.as_posix().lstrip("./")


def is_path_allowed(rel_or_abs: str, *, root: Path | None = None) -> bool:
    base = root or monorepo_root()
    rel = _normalize_rel(rel_or_abs, root=base)
    if not rel:
        return False
    low = rel.lower()
    if any(part in low for part in _DENIED_SUBSTR):
        return False
    return any(rel == p.rstrip("/") or rel.startswith(p) for p in _ALLOWED_PREFIXES)


def resolve_allowed_path(rel: str, *, root: Path | None = None) -> Path | None:
    base = root or monorepo_root()
    if not is_path_allowed(rel, root=base):
        return None
    norm = _normalize_rel(rel, root=base)
    if not norm:
        return None
    path = (base / norm).resolve()
    try:
        path.relative_to(base.resolve())
    except ValueError:
        return None
    if not path.exists():
        return None
    return path


__all__ = ("is_path_allowed", "monorepo_root", "resolve_allowed_path")

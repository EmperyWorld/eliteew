# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# P18 pack golden law (Wave F4): product packs are assembly-active only when
# a registry-listed report under .cursor/orchestration/reports/ shows PASSED.
# Invariants:
# - always_active / law packs never require product goldens.
# - Missing registry entry or missing PASSED report ⇒ not assembly-active.
# Related:
# - .cursor/orchestration/recipes/pack_golden_registry.yaml
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md
# ---

from __future__ import annotations

import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_log = logging.getLogger("eliteew.pack_golden_law")

_PASSED_RE = re.compile(
    r"(?is)(?:#{1,3}\s*verdict\b.{0,160}\bPASSED\b)"
    r"|(?:verdict|status)\s*[:\*]*\s*\**\s*PASSED\b"
)

# Law / platform packs (INDEX) — always assembly-active even if omitted from YAML.
_LAW_PACKS = frozenset(
    {
        "module_anatomy",
        "desktop_mount_catalog",
        "verify_gates",
        "service_factory",
        "desktop_shell_kernel",
    }
)


def monorepo_root(start: Path | None = None) -> Path:
    """Resolve monorepo root (directory containing shared/ + .cursor/)."""
    cur = (start or Path.cwd()).resolve()
    for candidate in (cur, *cur.parents):
        if (candidate / "shared" / "api").is_dir() and (candidate / ".cursor").is_dir():
            return candidate
    # Fallback: shared/api → … → monorepo (cwd often shared/api in pytest)
    if cur.name == "api" and cur.parent.name == "shared":
        return cur.parent.parent
    return cur


def orchestration_root(repo: Path | None = None) -> Path:
    return (repo or monorepo_root()) / ".cursor" / "orchestration"


def pack_golden_registry_path(repo: Path | None = None) -> Path:
    return orchestration_root(repo) / "recipes" / "pack_golden_registry.yaml"


def reports_dir(repo: Path | None = None) -> Path:
    return orchestration_root(repo) / "reports"


def _parse_simple_registry(text: str) -> dict[str, Any]:
    """Minimal fallback when PyYAML missing."""
    always: list[str] = []
    product: dict[str, list[str]] = {}
    section: str | None = None
    current_pack: str | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("always_active:"):
            section = "always"
            current_pack = None
            continue
        if line.startswith("product_goldens:"):
            section = "product"
            current_pack = None
            continue
        if section == "always" and line.strip().startswith("- "):
            always.append(line.strip()[2:].strip())
            continue
        if section == "product":
            if line.startswith("  ") and line.strip().endswith(":") and not line.strip().startswith("-"):
                current_pack = line.strip().rstrip(":")
                product[current_pack] = []
                continue
            if current_pack and line.strip().startswith("- "):
                product[current_pack].append(line.strip()[2:].strip())
    return {"always_active": always, "product_goldens": product}


@lru_cache(maxsize=8)
def _load_registry_raw(registry_file: str) -> dict[str, Any]:
    path = Path(registry_file)
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text)
        return data if isinstance(data, dict) else {}
    except Exception:
        return _parse_simple_registry(text)


def load_pack_golden_registry(repo: Path | None = None) -> dict[str, Any]:
    path = pack_golden_registry_path(repo)
    return _load_registry_raw(str(path.resolve()))


def _report_passed(report: Path) -> bool:
    if not report.is_file():
        return False
    text = report.read_text(encoding="utf-8", errors="replace")
    head = "\n".join(text.splitlines()[:40])
    if _PASSED_RE.search(head):
        return True
    return bool(re.search(r"(?m)^\|\s*[^|]+\s*\|\s*PASSED\s*\|", text))


def pack_has_passed_golden(stem: str, *, repo: Path | None = None) -> bool:
    data = load_pack_golden_registry(repo)
    goldens = data.get("product_goldens") or {}
    if not isinstance(goldens, dict):
        return False
    reports = goldens.get(stem) or []
    if not isinstance(reports, list) or not reports:
        return False
    base = reports_dir(repo)
    for name in reports:
        if not isinstance(name, str) or not name.strip():
            continue
        if _report_passed(base / name.strip()):
            return True
    return False


def is_law_pack(stem: str) -> bool:
    return stem in _LAW_PACKS


@lru_cache(maxsize=8)
def _atom_catalog_pack_stems(catalog_file: str) -> frozenset[str]:
    path = Path(catalog_file)
    if not path.is_file():
        return frozenset()
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text)
    except Exception:
        data = None
    stems: set[str] = set()
    if isinstance(data, dict):
        packs = data.get("packs") or []
        if isinstance(packs, list):
            for row in packs:
                if isinstance(row, dict):
                    pack = row.get("pack")
                    if isinstance(pack, str) and pack.strip():
                        stems.add(pack.strip())
    if not stems:
        # Fallback: lines like `- pack: name`
        for raw in text.splitlines():
            m = re.match(r"^\s*-\s+pack:\s+(\S+)\s*$", raw)
            if m:
                stems.add(m.group(1))
    return frozenset(stems)


def atom_catalog_packs(*, repo: Path | None = None) -> frozenset[str]:
    path = orchestration_root(repo) / "recipes" / "atom_catalog.yaml"
    return _atom_catalog_pack_stems(str(path.resolve()))


def clear_registry_cache() -> None:
    _load_registry_raw.cache_clear()
    _atom_catalog_pack_stems.cache_clear()


def is_pack_assembly_active(stem: str, *, repo: Path | None = None) -> bool:
    """True when pack may be selected for factory compose (P18 INDEX law)."""
    s = stem[:-3] if stem.endswith(".md") else stem
    if is_law_pack(s):
        return True
    data = load_pack_golden_registry(repo)
    always = data.get("always_active") or []
    if isinstance(always, list) and s in always:
        return True
    product = data.get("product_goldens") or {}
    if isinstance(product, dict) and s in product:
        ok = pack_has_passed_golden(s, repo=repo)
        if not ok:
            _log.info(
                "pack %s not assembly-active: no PASSED golden in registry",
                s,
            )
        return ok
    # Catalogued product packs without a golden entry are draft (not assembly-active).
    if s in atom_catalog_packs(repo=repo):
        _log.info("pack %s draft: in atom_catalog but no product_goldens entry", s)
        return False
    # Unknown stems (ad-hoc attach) stay allowed.
    return True


def filter_active_pack_stems(
    stems: list[str] | tuple[str, ...],
    *,
    repo: Path | None = None,
) -> list[str]:
    out: list[str] = []
    for stem in stems:
        s = stem[:-3] if stem.endswith(".md") else stem
        if is_pack_assembly_active(s, repo=repo):
            out.append(s)
    return out


def inactive_product_packs(*, repo: Path | None = None) -> list[str]:
    """Product packs in registry or atom_catalog that are not assembly-active."""
    data = load_pack_golden_registry(repo)
    always = set(data.get("always_active") or [])
    goldens = data.get("product_goldens") or {}
    if not isinstance(goldens, dict):
        goldens = {}
    candidates = set(goldens) | set(atom_catalog_packs(repo=repo))
    bad: list[str] = []
    for stem in sorted(candidates):
        if stem in always or is_law_pack(stem):
            continue
        if not is_pack_assembly_active(stem, repo=repo):
            bad.append(stem)
    return bad

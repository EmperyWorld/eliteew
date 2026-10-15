#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F6 extract-adapt: harvest report JSON + atom_catalog → file copy proposals.
# Invariants:
# - Default --dry-run (no filesystem writes).
# - Never restore whole product trees to monorepo root; dest must stay under EliteEW/.
# - --apply copies individual files only; refuse dest outside EliteEW/.
# - --apply also requires ELITEEW_FACTORY_EXTRACT_APPLY=1 (Wave G3 Approval gate).
# Related:
# - documentation/platform/ELITEEW-GENEW-FACTORY-HARVEST.md §8.5 / §8.9
# - .cursor/skills/eliteew-capability-harvest/SKILL.md
# ---
"""Propose (and optionally apply) file-level harvest copies into EliteEW/."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore[assignment]


FORBIDDEN_ROOT_NAMES = frozenset(
    {
        "DEWA",
        "EWGen",
        "EWPower",
        "EWC",
        "EWCoderOrchestrator",
        "EWCO",
        "SSFEW",
        "genEW",
        "nexus-root",
    }
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_yaml(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise SystemExit("PyYAML required: install via EliteEW api deps / uv")
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"invalid yaml (expected mapping): {path}")
    return raw


def _load_json(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise SystemExit(f"invalid harvest JSON (expected object): {path}")
    return raw


def _pack_entry(catalog: dict[str, Any], pack: str) -> dict[str, Any] | None:
    for item in catalog.get("packs") or []:
        if isinstance(item, dict) and str(item.get("pack") or "") == pack:
            return item
    return None


def _eliteew_root(repo: Path, catalog: dict[str, Any]) -> Path:
    import os

    env_key = str(catalog.get("eliteew_root_env") or "ELITEEW_ROOT")
    override = os.environ.get(env_key, "").strip()
    if override:
        return Path(override).resolve()
    rel = str(catalog.get("eliteew_root_default") or "EliteEW")
    return (repo / rel).resolve()


def _expand_globs(repo: Path, patterns: list[str]) -> list[Path]:
    out: list[Path] = []
    for pat in patterns:
        p = str(pat or "").strip()
        if not p:
            continue
        # pathlib Path.glob does not support ** at start without relative — use rglob-ish via glob
        matches = sorted(repo.glob(p))
        for m in matches:
            if m.is_file():
                out.append(m.resolve())
    return out


def _sources_from_report(repo: Path, report: dict[str, Any]) -> list[Path]:
    out: list[Path] = []
    for item in report.get("sources") or []:
        if not isinstance(item, dict):
            continue
        raw = str(item.get("path") or "").strip()
        if not raw:
            continue
        path = Path(raw)
        path = (repo / path).resolve() if not path.is_absolute() else path.resolve()
        if path.is_file():
            out.append(path)
    return out


def _guess_dest(eliteew: Path, src: Path, upstream_globs: list[str]) -> Path:
    """Map a trash file into the first upstream directory hint + basename."""

    name = src.name
    for ug in upstream_globs:
        # Take directory prefix before first ** or *
        stem = ug.split("**", 1)[0].rstrip("/*")
        if not stem:
            continue
        base = eliteew / stem
        # Prefer existing parent; still propose even if missing (dry-run)
        return (base / name).resolve()
    return (eliteew / "runtime" / "factory" / "extract-staging" / name).resolve()


def _is_under(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def _refuse_tree_restore(dest: Path, eliteew: Path, repo: Path) -> str | None:
    if not _is_under(dest, eliteew):
        return f"dest outside EliteEW/: {dest}"
    # Never propose recreating retired product roots at monorepo root
    try:
        rel = dest.resolve().relative_to(repo.resolve())
    except ValueError:
        return f"dest outside repo: {dest}"
    parts = rel.parts
    if parts and parts[0] in FORBIDDEN_ROOT_NAMES:
        return f"refuses restore of retired root {parts[0]!r}"
    return None


def build_proposals(
    *,
    repo: Path,
    report: dict[str, Any],
    catalog: dict[str, Any],
) -> list[dict[str, Any]]:
    pack = str(report.get("pack") or report.get("capability_id") or "").strip()
    if not pack:
        raise SystemExit("harvest report missing pack / capability_id")

    entry = _pack_entry(catalog, pack)
    if entry is None:
        raise SystemExit(f"pack not in atom_catalog: {pack}")

    eliteew = _eliteew_root(repo, catalog)
    upstream = [str(x) for x in (entry.get("upstream_eliteew_globs") or [])]
    trash_globs = [str(x) for x in (entry.get("trash_harvest_globs") or [])]

    sources = _sources_from_report(repo, report)
    if not sources and trash_globs:
        sources = _expand_globs(repo, trash_globs)

    # Explicit proposed_copies win when present
    explicit = report.get("proposed_copies") or []
    proposals: list[dict[str, Any]] = []
    if isinstance(explicit, list) and explicit:
        for item in explicit:
            if not isinstance(item, dict):
                continue
            src_raw = str(item.get("src") or "").strip()
            dest_raw = str(item.get("dest_rel") or item.get("dest") or "").strip()
            if not src_raw or not dest_raw:
                continue
            src = Path(src_raw)
            if not src.is_absolute():
                src = (repo / src).resolve()
            dest = Path(dest_raw)
            if not dest.is_absolute():
                dest = (repo / dest).resolve()
            refuse = _refuse_tree_restore(dest, eliteew, repo)
            proposals.append(
                {
                    "src": str(src),
                    "dest": str(dest),
                    "pack": pack,
                    "ok": refuse is None and src.is_file(),
                    "refuse": refuse,
                    "src_exists": src.is_file(),
                }
            )
        return proposals

    seen: set[str] = set()
    for src in sources:
        key = str(src)
        if key in seen:
            continue
        seen.add(key)
        dest = _guess_dest(eliteew, src, upstream)
        refuse = _refuse_tree_restore(dest, eliteew, repo)
        proposals.append(
            {
                "src": str(src),
                "dest": str(dest),
                "pack": pack,
                "ok": refuse is None and src.is_file(),
                "refuse": refuse,
                "src_exists": src.is_file(),
            }
        )
    return proposals


def apply_proposals(proposals: list[dict[str, Any]], *, force: bool) -> int:
    copied = 0
    for p in proposals:
        if not p.get("ok"):
            continue
        src = Path(str(p["src"]))
        dest = Path(str(p["dest"]))
        if dest.exists() and not force:
            print(f"skip exists (use --force): {dest}", file=sys.stderr)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        print(f"copied {src} → {dest}")
        copied += 1
    return copied


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Harvest extract-adapt map (dry-run default; never restores trees).",
    )
    parser.add_argument(
        "--report",
        type=Path,
        required=True,
        help="Harvest report JSON (capability_id/pack + sources)",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=None,
        help="atom_catalog.yaml (default: .cursor/orchestration/recipes/atom_catalog.yaml)",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=None,
        help="Monorepo root (default: derived from script path)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Copy proposed files (requires ELITEEW_FACTORY_EXTRACT_APPLY=1 and operator Approval; default is dry-run)"
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing dest files when --apply",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=None,
        help="Write proposals JSON to this path (dry-run friendly)",
    )
    args = parser.parse_args(argv)

    if args.apply:
        apply_flag = str(os.environ.get("ELITEEW_FACTORY_EXTRACT_APPLY") or "").strip().lower()
        if apply_flag not in {"1", "true", "yes", "on"}:
            print(
                "[STEP] extract_adapt_apply_blocked set ELITEEW_FACTORY_EXTRACT_APPLY=1 after Approval",
                file=sys.stderr,
            )
            return 2

    repo = (args.repo_root or _repo_root()).resolve()
    catalog_path = (
        args.catalog
        if args.catalog is not None
        else repo / ".cursor" / "orchestration" / "recipes" / "atom_catalog.yaml"
    )
    report = _load_json(args.report.resolve())
    catalog = _load_yaml(catalog_path.resolve())
    proposals = build_proposals(repo=repo, report=report, catalog=catalog)

    payload = {
        "mode": "apply" if args.apply else "dry-run",
        "pack": report.get("pack") or report.get("capability_id"),
        "proposals": proposals,
        "count": len(proposals),
        "ok_count": sum(1 for p in proposals if p.get("ok")),
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    print(text)
    if args.json_out is not None:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text + "\n", encoding="utf-8")

    if args.apply:
        n = apply_proposals(proposals, force=args.force)
        print(f"[STEP] extract_adapt_apply copied={n}", file=sys.stderr)
        return 0 if n or not proposals else 1

    print("[STEP] extract_adapt_dry_run (no writes)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

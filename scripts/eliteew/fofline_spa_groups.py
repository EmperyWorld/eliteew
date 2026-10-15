#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# FoFline SPA asset-group catalog + files.json helpers for core/group pack bake (A1).
# Invariants:
# - Catalog matches documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.2
# - core-spa excludes every optional group path; hashed assets/ stay in core
# Related:
# - scripts/eliteew/fofline-spa-pack-build.sh
# - scripts/eliteew/fofline-spa-assets-build.sh
# ---

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

# Optional static groups (v1 — all). Order is bake/publish order.
# Each entry: id, include path prefixes relative to dist root, optional exclude prefixes.
GROUPS: list[dict[str, Any]] = [
	{
		"id": "audio-guides",
		"paths": ["audio"],
		"exclude_prefixes": ["audio/tts-style-samples/"],
	},
	{
		"id": "audio-tts-samples",
		"paths": ["audio/tts-style-samples"],
		"exclude_prefixes": [],
	},
	{
		"id": "ewa-media",
		"paths": ["ewa"],
		"exclude_prefixes": [],
	},
	{
		"id": "site-studio-templates",
		"paths": ["site-studio-template-assets"],
		"exclude_prefixes": [],
	},
	{
		"id": "desktop-wallpapers",
		"paths": ["desktop-wallpapers"],
		"exclude_prefixes": [],
	},
	{
		"id": "o-proekte",
		"paths": ["o-proekte", "fonts"],
		"exclude_prefixes": [],
	},
	{
		"id": "avatars",
		"paths": ["avatars"],
		"exclude_prefixes": [],
	},
	{
		"id": "music-evolution-static",
		"paths": ["music-evolution"],
		"exclude_prefixes": [],
	},
]


def core_exclude_top_dirs() -> list[str]:
	"""Top-level dist dirs that must not enter core-spa (rsync --exclude 'name/')."""
	names: set[str] = set()
	for g in GROUPS:
		for p in g["paths"]:
			names.add(str(p).split("/", 1)[0])
	return sorted(names)


def _norm_rel(path: Path, root: Path) -> str:
	rel = path.relative_to(root).as_posix()
	return rel


def _excluded(rel: str, exclude_prefixes: list[str]) -> bool:
	for pref in exclude_prefixes:
		if rel == pref.rstrip("/") or rel.startswith(pref):
			return True
	return False


def iter_group_files(dist: Path, group: dict[str, Any]) -> list[Path]:
	files: list[Path] = []
	excludes = list(group.get("exclude_prefixes") or [])
	for prefix in group["paths"]:
		base = dist / prefix
		if not base.exists():
			continue
		if base.is_file():
			rel = _norm_rel(base, dist)
			if not _excluded(rel, excludes):
				files.append(base)
			continue
		for p in sorted(base.rglob("*")):
			if not p.is_file():
				continue
			rel = _norm_rel(p, dist)
			if _excluded(rel, excludes):
				continue
			files.append(p)
	return files


def sha256_file(path: Path) -> str:
	h = hashlib.sha256()
	with path.open("rb") as f:
		for chunk in iter(lambda: f.read(1024 * 1024), b""):
			h.update(chunk)
	return h.hexdigest()


def build_files_manifest(
	*,
	root: Path,
	files: list[Path],
	group_id: str,
	app_build_id: str,
) -> dict[str, Any]:
	entries: list[dict[str, Any]] = []
	for path in files:
		rel = _norm_rel(path, root)
		entries.append(
			{
				"path": rel,
				"sha256": sha256_file(path),
				"size": path.stat().st_size,
			}
		)
	entries.sort(key=lambda e: e["path"])
	return {
		"schema_version": 1,
		"kind": "fofline-spa-files",
		"group_id": group_id,
		"app_build_id": app_build_id,
		"file_count": len(entries),
		"files": entries,
	}


def write_files_json(
	out: Path,
	*,
	root: Path,
	files: list[Path],
	group_id: str,
	app_build_id: str,
) -> dict[str, Any]:
	doc = build_files_manifest(
		root=root,
		files=files,
		group_id=group_id,
		app_build_id=app_build_id,
	)
	out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
	return doc


def cmd_print_core_excludes() -> int:
	for name in core_exclude_top_dirs():
		print(f"{name}/")
	return 0


def cmd_print_groups_json() -> int:
	print(json.dumps(GROUPS, indent=2))
	return 0


def cmd_write_core_files_json(args: argparse.Namespace) -> int:
	pack_root = Path(args.pack_root)
	app_build_id = args.app_build_id.strip()
	files = [p for p in sorted(pack_root.rglob("*")) if p.is_file()]
	# Exclude manifests we are about to write / already wrote
	files = [
		p
		for p in files
		if p.name not in {"files.json", "pack-manifest.json", "group-manifest.json"}
	]
	out = pack_root / "files.json"
	write_files_json(
		out,
		root=pack_root,
		files=files,
		group_id="core-spa",
		app_build_id=app_build_id,
	)
	print(f"OK: wrote {out} files={len(files)}", file=sys.stderr)
	return 0


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description="FoFline SPA asset group helpers")
	sub = parser.add_subparsers(dest="cmd", required=True)

	sub.add_parser("print-core-excludes", help="Print rsync exclude dir/ lines for core")
	sub.add_parser("print-groups-json", help="Print group catalog JSON")

	p_files = sub.add_parser("write-core-files-json", help="Write files.json for pack root")
	p_files.add_argument("--pack-root", required=True)
	p_files.add_argument("--app-build-id", required=True)

	args = parser.parse_args(argv)
	if args.cmd == "print-core-excludes":
		return cmd_print_core_excludes()
	if args.cmd == "print-groups-json":
		return cmd_print_groups_json()
	if args.cmd == "write-core-files-json":
		return cmd_write_core_files_json(args)
	return 2


if __name__ == "__main__":
	raise SystemExit(main())

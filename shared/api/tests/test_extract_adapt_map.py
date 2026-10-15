# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Wave F6 — dry-run extract-adapt-map against a synthetic trash file + catalog.
# Invariants:
# - Default dry-run never copies; dest stays under EliteEW/.
# Related:
# - scripts/eliteew/extract-adapt-map.py
# ---

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest
import yaml


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_extract_adapt_dry_run_music_forge(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    trash_file = repo / "trash" / "20260718-015129" / "EWGen" / "music_demo.py"
    trash_file.parent.mkdir(parents=True)
    trash_file.write_text("# harvest fixture\n", encoding="utf-8")
    (repo / "EliteEW").mkdir()
    catalog_dir = repo / ".cursor" / "orchestration" / "recipes"
    catalog_dir.mkdir(parents=True)
    catalog = {
        "eliteew_root_default": "EliteEW",
        "packs": [
            {
                "pack": "music_forge",
                "upstream_eliteew_globs": ["web/frontend/src/pages/MusicForge/**"],
                "trash_harvest_globs": ["trash/*/EWGen/**/music*"],
            }
        ],
    }
    catalog_path = catalog_dir / "atom_catalog.yaml"
    catalog_path.write_text(yaml.safe_dump(catalog), encoding="utf-8")

    report = {
        "pack": "music_forge",
        "capability_id": "music_forge",
        "sources": [{"path": str(trash_file.relative_to(repo)), "role": "evidence"}],
    }
    report_path = tmp_path / "harvest-music_forge.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")

    script = _repo_root() / "scripts" / "eliteew" / "extract-adapt-map.py"
    proc = subprocess.run(
        [
            sys.executable,
            str(script),
            "--report",
            str(report_path),
            "--catalog",
            str(catalog_path),
            "--repo-root",
            str(repo),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["mode"] == "dry-run"
    assert payload["ok_count"] >= 1
    dest = Path(payload["proposals"][0]["dest"])
    assert "EliteEW" in dest.parts
    assert dest.name == "music_demo.py"
    # dry-run: file not copied
    assert not dest.is_file()


def test_extract_adapt_apply_blocked_without_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ELITEEW_FACTORY_EXTRACT_APPLY", raising=False)
    repo = tmp_path / "repo"
    trash_file = repo / "trash" / "x" / "EWGen" / "music_demo.py"
    trash_file.parent.mkdir(parents=True)
    trash_file.write_text("# harvest fixture\n", encoding="utf-8")
    (repo / "EliteEW").mkdir()
    catalog_dir = repo / ".cursor" / "orchestration" / "recipes"
    catalog_dir.mkdir(parents=True)
    catalog = {
        "eliteew_root_default": "EliteEW",
        "packs": [
            {
                "pack": "music_forge",
                "upstream_eliteew_globs": ["web/frontend/src/pages/MusicForge/**"],
                "trash_harvest_globs": ["trash/*/EWGen/**/music*"],
            }
        ],
    }
    catalog_path = catalog_dir / "atom_catalog.yaml"
    catalog_path.write_text(yaml.safe_dump(catalog), encoding="utf-8")
    report = {
        "pack": "music_forge",
        "sources": [{"path": str(trash_file.relative_to(repo)), "role": "evidence"}],
    }
    report_path = tmp_path / "harvest-music_forge.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")
    script = _repo_root() / "scripts" / "eliteew" / "extract-adapt-map.py"
    proc = subprocess.run(
        [
            sys.executable,
            str(script),
            "--report",
            str(report_path),
            "--catalog",
            str(catalog_path),
            "--repo-root",
            str(repo),
            "--apply",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 2
    assert "extract_adapt_apply_blocked" in proc.stderr
    assert not (repo / "EliteEW" / "music_demo.py").is_file()

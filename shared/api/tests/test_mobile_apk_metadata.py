#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Unit tests for mobile APK publish sidecar metadata reader.
# Invariants:
# - Invalid sidecar must not raise; callers receive null version fields.
# Related:
# - api/services/mobile_apk_metadata.py
# ---

from __future__ import annotations

import json
from pathlib import Path

from api.services.mobile_apk_metadata import read_mobile_apk_metadata


def test_read_mobile_apk_metadata_from_valid_sidecar(tmp_path: Path) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK")
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sidecar.write_text(
        json.dumps(
            {
                "version_code": 7,
                "version_name": "0.9.0",
                "published_at": "2026-06-17T00:00:00+00:00",
                "release_notes": "Flagship release",
                "min_supported_version_code": 6,
                "release_notes_history": [
                    {"version_code": 6, "version_name": "0.9.0", "release_notes": "Flagship release"}
                ],
            }
        ),
        encoding="utf-8",
    )
    meta = read_mobile_apk_metadata(apk)
    assert meta.version_code == 7
    assert meta.version_name == "0.9.0"
    assert meta.published_at == "2026-06-17T00:00:00+00:00"
    assert meta.release_notes == "Flagship release"
    assert meta.min_supported_version_code == 6
    assert len(meta.release_notes_history) == 1
    assert meta.release_notes_history[0].version_code == 6


def test_read_mobile_apk_metadata_missing_sidecar(tmp_path: Path) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK")
    meta = read_mobile_apk_metadata(apk)
    assert meta.version_code is None
    assert meta.version_name is None


def test_read_mobile_apk_metadata_invalid_json(tmp_path: Path) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK")
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sidecar.write_text("{not-json", encoding="utf-8")
    meta = read_mobile_apk_metadata(apk)
    assert meta.version_code is None
    assert meta.version_name is None

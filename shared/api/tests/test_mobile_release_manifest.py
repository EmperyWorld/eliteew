#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
"""Tests for stack-mobile-release manifest client."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from api.services import mobile_release_manifest as mrm


@pytest.mark.anyio
async def test_fetch_mobile_release_manifest_parses_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mrm.unified_settings, "mobile_release_base_url", "http://stack-mobile-release")

    class _Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "apk_available": True,
                "apk_size_bytes": 123456,
                "version_code": 6,
                "version_name": "0.1.5",
                "sha256": "b" * 64,
                "published_at": "2026-06-17T00:00:00+00:00",
                "release_notes": "Flagship release",
                "min_supported_version_code": 5,
                "release_notes_history": [
                    {"version_code": 5, "version_name": "0.1.4", "release_notes": "Earlier"},
                    {"version_code": 6, "version_name": "0.1.5", "release_notes": "Flagship release"},
                ],
            }

    client = AsyncMock()
    client.get = AsyncMock(return_value=_Response())
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("api.services.mobile_release_manifest.httpx.AsyncClient", return_value=client):
        manifest = await mrm.fetch_mobile_release_manifest()

    assert manifest is not None
    assert manifest.apk_available is True
    assert manifest.version_code == 6
    assert manifest.version_name == "0.1.5"
    assert manifest.apk_sha256 == "b" * 64
    assert manifest.published_at == "2026-06-17T00:00:00+00:00"
    assert manifest.release_notes == "Flagship release"
    assert manifest.min_supported_version_code == 5
    assert len(manifest.release_notes_history) == 2


@pytest.mark.anyio
async def test_resolve_prefers_release_server(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    apk = tmp_path / "empery-mobile.apk"
    apk.write_bytes(b"PK")
    sidecar = apk.with_name(f"{apk.name}.meta.json")
    sidecar.write_text('{"version_code": 4, "version_name": "0.1.3"}', encoding="utf-8")

    monkeypatch.setattr(
        mrm,
        "fetch_mobile_release_manifest",
        AsyncMock(
            return_value=mrm.MobileReleaseManifest(
                apk_available=True,
                apk_size_bytes=999,
                version_code=6,
                version_name="0.1.5",
                apk_sha256="c" * 64,
                published_at="2026-06-17T00:00:00+00:00",
                release_notes="Flagship release",
                min_supported_version_code=5,
                release_notes_history=mrm._parse_release_notes_history(
                    {
                        "release_notes_history": [
                            {
                                "version_code": 6,
                                "version_name": "0.1.5",
                                "release_notes": "Flagship release",
                            }
                        ]
                    }
                ),
            ),
        ),
    )

    ok, size, meta = await mrm.resolve_mobile_apk_release_state(apk, apk_ok=True, apk_size=apk.stat().st_size)
    assert ok is True
    assert size == 999
    assert meta is not None
    assert meta.version_code == 6
    assert meta.apk_sha256 == "c" * 64
    assert meta.published_at == "2026-06-17T00:00:00+00:00"
    assert meta.release_notes == "Flagship release"
    assert meta.min_supported_version_code == 5
    assert len(meta.release_notes_history) == 1

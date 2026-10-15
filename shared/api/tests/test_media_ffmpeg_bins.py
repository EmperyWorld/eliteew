# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
"""Regression for ffmpeg/ffprobe resolution helpers."""

from __future__ import annotations

import pytest

from api.services.media_ffmpeg_bins import require_ffmpeg_bin, resolve_ffmpeg_bin


def test_resolve_ffmpeg_honors_stack0_env(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    fake = tmp_path / "ffmpeg"
    fake.write_text("#!/bin/sh\n", encoding="utf-8")
    fake.chmod(0o755)
    monkeypatch.setenv("PATH", "")
    monkeypatch.setenv("STACK0_FFMPEG_BIN", str(fake))
    assert resolve_ffmpeg_bin() == str(fake)


def test_require_ffmpeg_raises_when_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PATH", "")
    monkeypatch.setenv("STACK0_FFMPEG_BIN", "")
    with pytest.raises(FileNotFoundError, match="ffmpeg not found"):
        require_ffmpeg_bin()


@pytest.mark.skipif(resolve_ffmpeg_bin() is None, reason="ffmpeg not installed on host")
def test_require_ffmpeg_on_host() -> None:
    assert require_ffmpeg_bin()

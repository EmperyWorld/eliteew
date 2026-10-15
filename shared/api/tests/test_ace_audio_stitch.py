"""ACE long-form MP3 crossfade stitch helper."""

from __future__ import annotations

import base64
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from api.services.ace_audio_stitch import crossfade_concat_mp3_b64, polish_track_tail_mp3_b64


def _make_sine_mp3(path: Path, *, duration_sec: float = 1.0, freq: float = 440.0) -> None:
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency={freq}:duration={duration_sec}",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        pytest.skip(f"ffmpeg unavailable: {proc.stderr.strip()}")


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_crossfade_concat_mp3_b64_stitches_two_segments() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        a = tmp_path / "a.mp3"
        b = tmp_path / "b.mp3"
        _make_sine_mp3(a, duration_sec=2.0, freq=440.0)
        _make_sine_mp3(b, duration_sec=2.0, freq=660.0)
        merged = crossfade_concat_mp3_b64(
            [
                base64.b64encode(a.read_bytes()).decode("ascii"),
                base64.b64encode(b.read_bytes()).decode("ascii"),
            ],
            crossfade_sec=0.5,
        )
        out = tmp_path / "out.mp3"
        out.write_bytes(base64.b64decode(merged))
        assert out.stat().st_size > 1000


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_polish_track_tail_mp3_b64_applies_fade() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / "a.mp3"
        _make_sine_mp3(src, duration_sec=3.0, freq=440.0)
        polished = polish_track_tail_mp3_b64(
            base64.b64encode(src.read_bytes()).decode("ascii"),
            tail_fade_sec=1.0,
        )
        out = tmp_path / "polished.mp3"
        out.write_bytes(base64.b64decode(polished))
        assert out.stat().st_size > 500

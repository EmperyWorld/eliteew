# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose: Crossfade-stitch Comfy ACE MP3 chunks for long-form v4 SFT generation.
# ---

from __future__ import annotations

import base64
import logging
import subprocess
import tempfile
from pathlib import Path

from api.services.media_ffmpeg_bins import require_ffmpeg_bin, require_ffprobe_bin

logger = logging.getLogger(__name__)


def crossfade_concat_mp3_b64(
    segments_b64: list[str],
    *,
    crossfade_sec: float = 2.0,
    crossfade_secs: list[float] | None = None,
) -> str:
    """Decode base64 MP3 segments, crossfade-stitch with ffmpeg, return base64 MP3."""
    if not segments_b64:
        msg = "crossfade_concat_mp3_b64: no segments"
        raise ValueError(msg)
    if len(segments_b64) == 1:
        return segments_b64[0]

    boundary_fades = _resolve_boundary_crossfades(len(segments_b64), crossfade_sec, crossfade_secs)
    with tempfile.TemporaryDirectory(prefix="ace_stitch_") as tmp:
        tmp_path = Path(tmp)
        inputs: list[Path] = []
        for idx, seg_b64 in enumerate(segments_b64):
            raw = base64.b64decode(seg_b64)
            path = tmp_path / f"chunk_{idx:02d}.mp3"
            path.write_bytes(raw)
            inputs.append(path)

        out_path = tmp_path / "stitched.mp3"
        _ffmpeg_crossfade_mp3(inputs, out_path, fade_secs=boundary_fades)
        return base64.b64encode(out_path.read_bytes()).decode("ascii")


def polish_track_tail_mp3_b64(
    audio_b64: str,
    *,
    tail_fade_sec: float = 5.0,
) -> str:
    """Gentle linear fade on the final seconds to tame harsh outro vocal artifacts."""
    fade = max(0.5, min(float(tail_fade_sec), 12.0))
    with tempfile.TemporaryDirectory(prefix="ace_tail_") as tmp:
        tmp_path = Path(tmp)
        src = tmp_path / "in.mp3"
        dst = tmp_path / "out.mp3"
        src.write_bytes(base64.b64decode(audio_b64))
        duration = _probe_duration_seconds(src)
        if duration is None or duration <= fade + 1.0:
            return audio_b64
        start = max(0.0, duration - fade)
        ffmpeg_bin = require_ffmpeg_bin()
        cmd = [
            ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-af",
            f"afade=t=out:st={start:.3f}:d={fade:.3f}",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(dst),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            logger.warning("tail polish skipped: %s", proc.stderr.strip())
            return audio_b64
        return base64.b64encode(dst.read_bytes()).decode("ascii")


def _resolve_boundary_crossfades(
    segment_count: int,
    default_crossfade_sec: float,
    crossfade_secs: list[float] | None,
) -> list[float]:
    boundary_count = segment_count - 1
    if boundary_count <= 0:
        return []
    if crossfade_secs is not None:
        fades = [max(0.1, min(float(v), 8.0)) for v in crossfade_secs[:boundary_count]]
        if len(fades) < boundary_count:
            fades.extend([max(0.1, min(float(default_crossfade_sec), 8.0))] * (boundary_count - len(fades)))
        return fades
    return [max(0.1, min(float(default_crossfade_sec), 8.0))] * boundary_count


def _probe_duration_seconds(path: Path) -> float | None:
    ffprobe_bin = require_ffprobe_bin()
    cmd = [
        ffprobe_bin,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        return None
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return None


def _ffmpeg_crossfade_mp3(inputs: list[Path], out_path: Path, *, fade_secs: list[float]) -> None:
    if len(inputs) < 2:
        msg = "ffmpeg crossfade requires at least two inputs"
        raise ValueError(msg)
    if len(fade_secs) != len(inputs) - 1:
        msg = "fade_secs length must be len(inputs) - 1"
        raise ValueError(msg)

    ffmpeg_bin = require_ffmpeg_bin()
    cmd: list[str] = [ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error"]
    for path in inputs:
        cmd.extend(["-i", str(path)])

    parts: list[str] = []
    prev = "[0:a]"
    for idx in range(1, len(inputs)):
        fade = f"{fade_secs[idx - 1]:.3f}"
        out_label = "[outa]" if idx == len(inputs) - 1 else f"[a{idx:02d}]"
        parts.append(f"{prev}[{idx}:a]acrossfade=d={fade}:c1=tri:c2=tri{out_label}")
        prev = out_label
    filter_complex = ";".join(parts)

    cmd.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            "[outa]",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(out_path),
        ]
    )
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        logger.error("ffmpeg crossfade failed: %s", proc.stderr.strip())
        msg = f"ffmpeg crossfade stitch failed: {proc.stderr.strip() or proc.returncode}"
        raise RuntimeError(msg)

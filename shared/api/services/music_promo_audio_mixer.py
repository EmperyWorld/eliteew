# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Backend module `services/music_promo_audio_mixer.py`; preserves its existing EliteEW API/service responsibilities.
# Invariants:
# - Keep existing public contracts and side effects stable across Python 3.14 syntax remediation.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Promo voiceover mixer.

ACE Step is a music model — it sings any lyrics you feed it instead of speaking
them, which is why "spoken" promo lyrics in `/generate` came out muddy. The
quality fix is to generate the announcer through a real TTS (Silero) and use
ACE only for the instrumental music bed, then mix both with sidechain ducking.

The helpers here:
- ``extract_promo_spoken_text`` strips section headers and English technical
  parentheticals from promo lyrics so only spoken copy is sent to Silero.
- ``mix_promo_voice_with_bed`` takes raw TTS WAV and the ACE bed bytes and
  produces an MP3 with the voice clearly on top of a ducked music bed.
- ``build_instrumental_promo_lyrics`` returns the bare arrangement-only "lyrics"
  string we hand to ACE so it does not try to sing the user copy.
"""

from __future__ import annotations

import asyncio
import logging
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

_FFMPEG_BIN = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
_FFPROBE_BIN = shutil.which("ffprobe") or "/usr/bin/ffprobe"

_SECTION_HEADER_RE = re.compile(r"^\s*\[[^\]\n]{1,80}]\s*$")
_PARENTHETICAL_HINT_RE = re.compile(
    r"^\s*\((?:Arrangement|Voice|Vocal):[^)]{1,400}\)\s*$",
    re.IGNORECASE,
)
_INLINE_PARENTHETICAL_RE = re.compile(
    r"\((?:Arrangement|Voice|Vocal):[^)]{1,400}\)",
    re.IGNORECASE,
)

# Silero is decent on Russian but mangles Latin words and emoji.
# We transliterate Latin → Cyrillic and normalize punctuation so the announcer
# does not pronounce brand names letter-by-letter.
_LATIN_DIGRAPHS: tuple[tuple[str, str], ...] = (
    ("Sch", "Щ"),
    ("sch", "щ"),
    ("Yo", "Ё"),
    ("yo", "ё"),
    ("Yu", "Ю"),
    ("yu", "ю"),
    ("Ya", "Я"),
    ("ya", "я"),
    ("Zh", "Ж"),
    ("zh", "ж"),
    ("Ch", "Ч"),
    ("ch", "ч"),
    ("Sh", "Ш"),
    ("sh", "ш"),
    ("Kh", "Х"),
    ("kh", "х"),
    ("Ts", "Ц"),
    ("ts", "ц"),
)
_LATIN_LETTERS: dict[str, str] = {
    "a": "а",
    "b": "б",
    "c": "к",
    "d": "д",
    "e": "е",
    "f": "ф",
    "g": "г",
    "h": "х",
    "i": "и",
    "j": "дж",
    "k": "к",
    "l": "л",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "п",
    "q": "к",
    "r": "р",
    "s": "с",
    "t": "т",
    "u": "у",
    "v": "в",
    "w": "в",
    "x": "кс",
    "y": "й",
    "z": "з",
    "A": "А",
    "B": "Б",
    "C": "К",
    "D": "Д",
    "E": "Е",
    "F": "Ф",
    "G": "Г",
    "H": "Х",
    "I": "И",
    "J": "Дж",
    "K": "К",
    "L": "Л",
    "M": "М",
    "N": "Н",
    "O": "О",
    "P": "П",
    "Q": "К",
    "R": "Р",
    "S": "С",
    "T": "Т",
    "U": "У",
    "V": "В",
    "W": "В",
    "X": "Кс",
    "Y": "Й",
    "Z": "З",
}
_LATIN_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_'`-]{0,40}")
_EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002600-\U000027bf\U0001f000-\U0001f1ff]+",
)
_DIGIT_PLUS_RE = re.compile(r"\b(\d{1,3})\s*\+(?=\D|$)")
_NUMERIC_RANGE_RE = re.compile(r"\b(\d+)\s*-\s*(\d+)\b")
_MULTI_DOT_RE = re.compile(r"\.{2,}")
_REPEATED_PUNCT_RE = re.compile(r"([!?.,])\1{1,}")
_HASHTAG_RE = re.compile(r"(?<!\w)#[\w]+", re.UNICODE)
_URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)


def _transliterate_latin_word(word: str) -> str:
    rest = word
    for src, dst in _LATIN_DIGRAPHS:
        rest = rest.replace(src, dst)
    return "".join(_LATIN_LETTERS.get(ch, ch) for ch in rest)


def prepare_promo_text_for_tts(text: str) -> str:
    """Normalize spoken copy so Silero reads it like a human announcer.

    - Latin brand names like "Inferno" → "Инферно" (no spelling letter-by-letter).
    - Strip emoji / hashtags / URLs (TTS reads them as garbage).
    - "18+" → "18 плюс", "5-7" → "5 - 7" (Silero adds proper pauses).
    - Collapse "..." into a single comma so we don't pile up dead air.
    - Squash repeated punctuation that LLMs love to add.
    """
    if not text:
        return ""
    out = text
    out = _URL_RE.sub("", out)
    out = _HASHTAG_RE.sub("", out)
    out = _EMOJI_RE.sub("", out)
    out = _LATIN_WORD_RE.sub(lambda m: _transliterate_latin_word(m.group(0)), out)
    out = _DIGIT_PLUS_RE.sub(lambda m: f"{m.group(1)} плюс", out)
    out = _NUMERIC_RANGE_RE.sub(lambda m: f"{m.group(1)} – {m.group(2)}", out)
    out = _MULTI_DOT_RE.sub(",", out)
    out = _REPEATED_PUNCT_RE.sub(r"\1", out)
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\s+\n", "\n", out)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


@dataclass(frozen=True)
class PromoMixSettings:
    """Mix knobs derived from the user's director controls."""

    voice_gain_db: float = 6.0
    bed_gain_db: float = -2.0
    duck_threshold_db: float = -22.0
    duck_ratio: float = 8.0
    duck_attack_ms: int = 6
    duck_release_ms: int = 250
    voice_lead_ms: int = 350
    fade_out_ms: int = 800


def extract_promo_spoken_text(lyrics: str) -> str:
    """Return only spoken copy lines, joined with single newlines."""
    spoken: list[str] = []
    for raw in (lyrics or "").splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if _SECTION_HEADER_RE.match(line):
            spoken.append("")
            continue
        if _PARENTHETICAL_HINT_RE.match(line):
            continue
        cleaned = _INLINE_PARENTHETICAL_RE.sub("", line).strip()
        if cleaned:
            spoken.append(cleaned)
    text = "\n".join(s for s in spoken if s is not None).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def build_instrumental_promo_lyrics(*, preset: str, bpm: int) -> str:
    """ACE-only "lyrics" with no spoken copy: just arrangement hints in English.

    ACE Step always tries to sing whatever appears as plain text. Feeding it a
    pure instrumental brief (English production words inside parentheses,
    section headers without copy) keeps the bed clean and lets the real TTS
    handle speech.
    """
    p = (preset or "pirate_radio").strip().lower()
    b = max(80, min(130, int(bpm)))
    arr_by_preset: dict[str, str] = {
        "pirate_radio": (
            f"{b} BPM lo-fi pirate radio bumper bed, vinyl crackle, distant foghorn, "
            "filtered air band, short brass stabs, ducked under speech, no vocals"
        ),
        "trailer_epic": (
            f"{b} BPM cinematic trailer bed, dark sub pulses, reverse cymbal, "
            "low strings, braam impact, tense risers, ducked under speech, no vocals"
        ),
        "tv_clean": (
            f"{b} BPM clean broadcast bed, soft piano, light pluck, subtle pad, "
            "neutral logo accent, ducked under speech, no vocals"
        ),
        "late_night": (
            f"{b} BPM late-night lo-fi jazz bed, Rhodes pad, brushed hats, room tone, "
            "warm tape thump, ducked under speech, no vocals"
        ),
        "tech_keynote": (
            f"{b} BPM premium tech keynote bed, glassy plucks, airy pads, soft riser, "
            "clean clicks, no EDM drop, ducked under speech, no vocals"
        ),
        "playful_brand": (
            f"{b} BPM bouncy branded pop bumper bed, claps, plucks, bright transient, "
            "fun loop, ducked under speech, no vocals"
        ),
    }
    arrangement = arr_by_preset.get(p, arr_by_preset["pirate_radio"])
    return (
        "[Intro]\n"
        f"(Arrangement: {arrangement})\n"
        "[Verse]\n"
        f"(Arrangement: {arrangement})\n"
        "[Bridge]\n"
        f"(Arrangement: {arrangement})\n"
        "[Outro]\n"
        f"(Arrangement: {arrangement})\n"
    )


def silero_voice_for_promo(vocal: str | None, *, voice_strength: int = 7) -> tuple[str, float]:
    """Map promo vocal/voice strength to a concrete Silero voice + speed."""
    v = (vocal or "male").strip().lower()
    if v == "female":
        voice_id = "kseniya" if voice_strength >= 7 else "xenia"
    elif v == "duet":
        voice_id = "aidar"
    else:
        voice_id = "aidar" if voice_strength >= 7 else "eugene"
    speed = 1.0
    if voice_strength >= 9:
        speed = 1.05
    elif voice_strength <= 3:
        speed = 0.9
    return voice_id, speed


def settings_for_director(factors: dict[str, int] | None) -> PromoMixSettings:
    """Compose mix knobs from the same director profile used for prompt/tags."""
    f = factors or {}
    base = PromoMixSettings()
    bed_level = int(f.get("bed_level") or 5)
    voice_strength = int(f.get("voice_strength") or 6)
    drama = int(f.get("drama_contrast") or 5)
    clarity = int(f.get("clarity") or 7)
    voice_gain = base.voice_gain_db + (voice_strength - 6) * 0.7 + (clarity - 7) * 0.4
    bed_gain = base.bed_gain_db - max(0, 6 - bed_level) * 0.6 + max(0, bed_level - 7) * 0.5
    duck_threshold = base.duck_threshold_db - (clarity - 7) * 1.2 - max(0, voice_strength - 7) * 1.0
    duck_release = base.duck_release_ms + max(0, drama - 5) * 30
    voice_lead = base.voice_lead_ms + max(0, drama - 5) * 60
    return PromoMixSettings(
        voice_gain_db=round(max(-3.0, min(12.0, voice_gain)), 2),
        bed_gain_db=round(max(-12.0, min(3.0, bed_gain)), 2),
        duck_threshold_db=round(max(-40.0, min(-10.0, duck_threshold)), 2),
        duck_ratio=base.duck_ratio,
        duck_attack_ms=base.duck_attack_ms,
        duck_release_ms=int(duck_release),
        voice_lead_ms=int(voice_lead),
        fade_out_ms=base.fade_out_ms,
    )


async def _run_ffmpeg(args: list[str]) -> None:
    """Invoke ffmpeg in a subprocess; raise on non-zero exit with stderr."""
    proc = await asyncio.create_subprocess_exec(
        _FFMPEG_BIN,
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        tail = (stderr.decode("utf-8", errors="ignore") or "").strip().splitlines()[-12:]
        msg = "\n".join(tail) or f"ffmpeg exited with code {proc.returncode}"
        raise RuntimeError(f"ffmpeg failed: {msg}")


async def _probe_duration_seconds(path: Path) -> float:
    proc = await asyncio.create_subprocess_exec(
        _FFPROBE_BIN,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, _ = await proc.communicate()
    try:
        return float((out or b"0").decode("utf-8").strip() or 0.0)
    except (TypeError, ValueError):  # fmt: skip
        return 0.0


async def mix_promo_voice_with_bed(
    *,
    voice_wav: bytes,
    bed_audio: bytes,
    bed_format_hint: str = "mp3",
    settings: PromoMixSettings | None = None,
    target_duration_sec: int | None = None,
) -> bytes:
    """Mix Silero WAV with the ACE music bed using sidechain ducking.

    Returns MP3 bytes (192 kbps, 48 kHz). Designed to fail loudly; callers
    should catch and decide whether to fall back to the un-mixed bed.
    """
    if not voice_wav:
        raise ValueError("voice_wav is empty; nothing to mix")
    if not bed_audio:
        raise ValueError("bed_audio is empty; nothing to mix")
    cfg = settings or PromoMixSettings()
    with tempfile.TemporaryDirectory(prefix="promo-mix-") as tmpdir:
        tmp = Path(tmpdir)
        voice_path = tmp / "voice.wav"
        bed_path = tmp / f"bed.{(bed_format_hint or 'mp3').lstrip('.')}"
        out_path = tmp / "mix.mp3"
        voice_path.write_bytes(voice_wav)
        bed_path.write_bytes(bed_audio)
        voice_dur = await _probe_duration_seconds(voice_path)
        bed_dur = await _probe_duration_seconds(bed_path)
        target_dur = target_duration_sec or 0
        # Bed must cover (voice + lead-in + fade-out tail). Keep at least 30s.
        needed_bed = max(
            voice_dur + cfg.voice_lead_ms / 1000.0 + cfg.fade_out_ms / 1000.0 + 1.5,
            float(target_dur or 30),
            30.0,
        )
        if bed_dur < needed_bed - 0.05:
            logger.warning(
                "promo mixer: bed shorter than needed (bed=%.2fs need=%.2fs); padding with apad",
                bed_dur,
                needed_bed,
            )
        # Voice goes through a gentle compressor so peaks do not slap; sidechain
        # uses the voice signal to duck the music bed.
        fade_dur_s = cfg.fade_out_ms / 1000.0
        voice_end = voice_dur + cfg.voice_lead_ms / 1000.0
        # Final track length: honor target duration when given, otherwise hug the
        # voice (with a short tail). Bed must extend at least to the fade end.
        if target_duration_sec and target_duration_sec > 0:
            total_dur = max(float(target_duration_sec), voice_end + fade_dur_s + 0.5)
        else:
            total_dur = voice_end + fade_dur_s + 0.5
        fade_start = max(0.5, voice_end + 0.3, total_dur - fade_dur_s)
        trim_to = max(needed_bed, total_dur + 0.2)
        filter_complex = (
            "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            "highpass=f=80,lowpass=f=12000,"
            "acompressor=threshold=-18dB:ratio=3:attack=8:release=180,"
            f"adelay={cfg.voice_lead_ms}|{cfg.voice_lead_ms},"
            f"apad,atrim=0:{trim_to:.3f},"
            f"volume={cfg.voice_gain_db:+.2f}dB,asplit=2[voice][voice_sc];"
            "[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
            f"apad,atrim=0:{trim_to:.3f},"
            f"volume={cfg.bed_gain_db:+.2f}dB[bedraw];"
            "[bedraw][voice_sc]sidechaincompress="
            f"threshold={cfg.duck_threshold_db}dB:ratio={cfg.duck_ratio}:"
            f"attack={cfg.duck_attack_ms}:release={cfg.duck_release_ms}:"
            "makeup=1[bedduck];"
            "[bedduck][voice]amix=inputs=2:weights=1 1.4:normalize=0:duration=longest,"
            f"atrim=0:{total_dur:.3f},"
            f"afade=t=out:st={fade_start:.3f}:d={fade_dur_s:.3f},"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        )
        args = [
            "-hide_banner",
            "-nostdin",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(voice_path),
            "-i",
            str(bed_path),
            "-filter_complex",
            filter_complex,
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(out_path),
        ]
        await _run_ffmpeg(args)
        if not out_path.exists() or out_path.stat().st_size < 4096:
            raise RuntimeError("ffmpeg produced an empty or undersized mix")
        return out_path.read_bytes()


__all__ = [
    "PromoMixSettings",
    "build_instrumental_promo_lyrics",
    "extract_promo_spoken_text",
    "mix_promo_voice_with_bed",
    "prepare_promo_text_for_tts",
    "settings_for_director",
    "silero_voice_for_promo",
]

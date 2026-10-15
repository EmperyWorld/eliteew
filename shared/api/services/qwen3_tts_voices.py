# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Load Qwen3-TTS voice contract (aliases, persona map, catalog) from canonical JSON.
# Invariants:
# - Canonical file: ``docker/data/stack9/qwen3-tts/voice_contract.json`` (+ bundled copies under ``api/data``).
# - Profile metadata (name/gender/ref_wav) lives in ``voice_profiles.json``; aliases/persona map in ``voice_contract.json``.
# Related:
# - docker/scripts/sync-qwen3-voice-contract.sh
# - api/services/voice/legacy_tts/silero_service.py
# ---

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Final, TypedDict

_API_ROOT = Path(__file__).resolve().parent.parent
_MONOREPO_ROOT = _API_ROOT.parent.parent


class _VoiceMeta(TypedDict):
    name: str
    gender: str
    description: str


class _VoiceContract(TypedDict):
    version: int
    default_profile: str
    recording_ref_text: str
    aliases: dict[str, str]
    persona_voices: dict[str, str]
    legacy_alias_labels: dict[str, _VoiceMeta]


def _contract_search_paths() -> list[Path]:
    env = (os.environ.get("QWEN3_VOICE_CONTRACT") or "").strip()
    paths: list[Path] = []
    if env:
        env_path = Path(env)
        if env_path.is_file():
            paths.append(env_path)
    paths.extend(
        [
            _API_ROOT / "data" / "qwen3_tts" / "voice_contract.json",
            _MONOREPO_ROOT / "docker" / "data" / "stack9" / "qwen3-tts" / "voice_contract.json",
        ]
    )
    return paths


def _profiles_search_paths() -> list[Path]:
    env = (os.environ.get("QWEN3_VOICE_PROFILES") or "").strip()
    paths: list[Path] = []
    if env:
        env_path = Path(env)
        if env_path.is_file():
            paths.append(env_path)
    paths.extend(
        [
            _API_ROOT / "data" / "qwen3_tts" / "voice_profiles.json",
            _MONOREPO_ROOT / "docker" / "data" / "stack9" / "qwen3-tts" / "voice_profiles.json",
        ]
    )
    return paths


def _first_existing(paths: list[Path]) -> Path:
    for path in paths:
        if path.is_file():
            return path
    joined = ", ".join(str(p) for p in paths)
    raise FileNotFoundError(f"Qwen3 voice file not found; tried: {joined}")


@lru_cache(maxsize=1)
def load_voice_contract() -> _VoiceContract:
    path = _first_existing(_contract_search_paths())
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw  # type: ignore[return-value]


@lru_cache(maxsize=1)
def load_voice_profiles() -> dict[str, dict[str, Any]]:
    path = _first_existing(_profiles_search_paths())
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not str(k).startswith("_")}


def qwen3_tts_default_profile() -> str:
    return str(load_voice_contract().get("default_profile") or "companion_ewa")


QWEN3_TTS_DEFAULT_PROFILE: Final[str] = qwen3_tts_default_profile()


def qwen3_tts_voice_aliases() -> dict[str, str]:
    return dict(load_voice_contract().get("aliases") or {})


QWEN3_TTS_VOICE_ALIASES: Final[dict[str, str]] = qwen3_tts_voice_aliases()


def companion_tts_profile_ids() -> frozenset[str]:
    profiles = load_voice_profiles()
    return frozenset(k for k in profiles if k.startswith("companion_"))


COMPANION_TTS_PROFILE_IDS: Final[frozenset[str]] = companion_tts_profile_ids()


def persona_tts_voice_map() -> dict[str, str]:
    return dict(load_voice_contract().get("persona_voices") or {})


def normalize_qwen3_tts_voice_key(voice: str | None) -> str:
    """Lowercase trimmed client voice id (alias or profile)."""
    default = qwen3_tts_default_profile()
    raw = (voice or default).strip().lower()
    return raw or default


def resolve_qwen3_tts_profile_id(voice: str | None) -> str:
    """Map client voice id to Qwen3 ``voice_profiles.json`` profile key."""
    key = normalize_qwen3_tts_voice_key(voice)
    return qwen3_tts_voice_aliases().get(key, key)


def is_known_qwen3_tts_voice(voice: str | None) -> bool:
    """True when voice is a catalog profile or a registered alias."""
    profiles = load_voice_profiles()
    aliases = qwen3_tts_voice_aliases()
    key = normalize_qwen3_tts_voice_key(voice)
    if key in aliases or key in profiles:
        return True
    resolved = aliases.get(key, key)
    return resolved in profiles


def list_qwen3_tts_voice_catalog(*, live_profile_ids: set[str] | None = None) -> list[dict[str, Any]]:
    """Voice list for gateway UI: profiles from JSON, then legacy alias labels."""
    contract = load_voice_contract()
    profiles = load_voice_profiles()
    live = live_profile_ids or set()
    out: list[dict[str, Any]] = []

    for voice_id, meta in profiles.items():
        entry: dict[str, Any] = {
            "id": voice_id,
            "name": str(meta.get("name") or voice_id),
            "language": "ru-RU",
            "gender": str(meta.get("gender") or "unknown"),
            "description": str(meta.get("description") or ""),
        }
        if live:
            resolved = resolve_qwen3_tts_profile_id(voice_id)
            entry["available"] = voice_id in live or resolved in live
        out.append(entry)

    for voice_id, meta in (contract.get("legacy_alias_labels") or {}).items():
        entry = {
            "id": voice_id,
            "name": str(meta.get("name") or voice_id),
            "language": "ru-RU",
            "gender": str(meta.get("gender") or "unknown"),
            "description": str(meta.get("description") or ""),
        }
        if live:
            resolved = resolve_qwen3_tts_profile_id(voice_id)
            entry["available"] = voice_id in live or resolved in live
        out.append(entry)

    return out


def canonical_voice_contract_path() -> Path:
    return _first_existing(_contract_search_paths())


def canonical_voice_profiles_path() -> Path:
    return _first_existing(_profiles_search_paths())

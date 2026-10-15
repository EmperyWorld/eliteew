# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Persist Music Evolution UGS payloads and ComfyUI POST /prompt JSON under generated_files
# for operator debugging (parity with Music Generator debug dumps).
# Invariants:
# - Writes are best-effort; failures must not block pipeline or UGS dispatch.
# - Disable via MUSIC_EVOLUTION_DEBUG_JSON_DISABLE=1; root via MUSIC_EVOLUTION_DEBUG_JSON_DIR
#   or default /app/generated_files/music_evolution_debug_json.
# Related:
# - api/services/music_evolution_pipeline.py
# - api/services/ugs/providers/comfyui_provider.py
# - documentation/product/MUSIC-EVOLUTION-APP.md
# ---

from __future__ import annotations

import json
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

_DEFAULT_DEBUG_ROOT = "/app/generated_files/music_evolution_debug_json"
_DISABLE_ENV = "MUSIC_EVOLUTION_DEBUG_JSON_DISABLE"


def _debug_disabled() -> bool:
    return os.environ.get(_DISABLE_ENV, "").strip().lower() in ("1", "true", "yes", "on")


def resolve_music_evolution_debug_root() -> Path | None:
    """Return debug root directory or None when persistence is disabled."""
    if _debug_disabled():
        return None
    raw = (os.environ.get("MUSIC_EVOLUTION_DEBUG_JSON_DIR") or _DEFAULT_DEBUG_ROOT).strip()
    if not raw:
        return None
    return Path(raw).expanduser()


def _safe_run_segment(run_id: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", (run_id or "unknown")[:64]).strip("_") or "unknown"
    return cleaned


def _safe_step_segment(step: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_-]+", "_", (step or "step").lower())[:48].strip("_") or "step"
    return cleaned


def save_music_evolution_ugs_payload(
    *,
    run_id: str,
    step: str,
    type_key: str,
    input_data: dict[str, Any],
    user_id: str | None = None,
) -> Path | None:
    """Save the exact UGS input_data dict for one pipeline step."""
    root = resolve_music_evolution_debug_root()
    if root is None:
        return None
    try:
        out_dir = root / "ugs_input" / _safe_run_segment(run_id) / _safe_step_segment(step)
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        safe_type = re.sub(r"[^a-z0-9_-]+", "_", (type_key or "ugs").lower())[:64].strip("_") or "ugs"
        uid_short = re.sub(r"[^a-zA-Z0-9_-]+", "_", (user_id or "anon")[:16]).strip("_") or "anon"
        out_path = out_dir / f"{ts}_{uid_short}_{safe_type}_{uuid4().hex[:8]}.json"
        payload = {
            "eliteew_meta": {
                "run_id": run_id,
                "step": step,
                "type_key": type_key,
                "user_id": user_id,
                "saved_at": datetime.now(UTC).isoformat(),
            },
            "ugs_input_data": input_data,
        }
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        logger.info(
            "Music Evolution: saved UGS payload run_id=%s step=%s type_key=%s -> %s",
            run_id,
            step,
            type_key,
            out_path,
        )
        return out_path
    except OSError as exc:
        logger.warning("Music Evolution UGS debug save failed (IO): %s", exc)
    except Exception:
        logger.warning("Music Evolution UGS debug save failed", exc_info=True)
    return None


def save_music_evolution_comfy_prompt(
    *,
    run_id: str,
    workflow: dict[str, Any],
    input_data: dict[str, Any] | None = None,
    generation_type: str | None = None,
) -> Path | None:
    """Save the ComfyUI POST /prompt body ({version, prompt}) for Music Evolution audio."""
    root = resolve_music_evolution_debug_root()
    if root is None:
        return None
    try:
        out_dir = root / "comfy_prompt" / _safe_run_segment(run_id)
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        out_path = out_dir / f"comfy_prompt_{ts}_{uuid4().hex[:8]}.json"
        seed_applied = None
        seed_node = workflow.get("109") if isinstance(workflow, dict) else None
        if isinstance(seed_node, dict):
            raw_seed = seed_node.get("inputs", {}).get("value")
            try:
                seed_applied = int(raw_seed) if raw_seed is not None else None
            except TypeError, ValueError:
                seed_applied = raw_seed
        payload: dict[str, Any] = {
            "version": "1.0",
            "prompt": workflow,
            "eliteew_meta": {
                "run_id": run_id,
                "generation_type": generation_type,
                "saved_at": datetime.now(UTC).isoformat(),
                "seed_applied": seed_applied,
                "seed_wire_note": (
                    'Поля seed ["109", 0] — ссылка на ноду PrimitiveInt id=109. '
                    "Смотри eliteew_meta.seed_applied или prompt.109.inputs.value."
                ),
            },
        }
        if input_data is not None:
            payload["ugs_input_data"] = input_data
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        logger.info(
            "Music Evolution: saved Comfy prompt run_id=%s generation_type=%s -> %s",
            run_id,
            generation_type,
            out_path,
        )
        return out_path
    except OSError as exc:
        logger.warning("Music Evolution Comfy debug save failed (IO): %s", exc)
    except Exception:
        logger.warning("Music Evolution Comfy debug save failed", exc_info=True)
    return None

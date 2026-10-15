# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ComfyUI debug/observability helpers and z-image prompt finalization for UGS provider split.
# Invariants:
# - Debug saves are best-effort and must not break generation paths.
# - z-image positive finalize lives in api.services.ugs.z_image_prompt (re-exported here).
# Related:
# - api/services/ugs/providers/comfyui_provider.py
# - api/services/ugs/z_image_prompt.py
# ---
# pyright: reportAttributeAccessIssue=false, reportUnusedFunction=false, reportUnusedImport=false
# Helpers are used from comfyui_execution / comfyui_provider facade.

from __future__ import annotations

import json
import logging
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from api.services.ugs.z_image_prompt import _finalize_z_image_user_prompt as _finalize_z_image_user_prompt

logger = logging.getLogger(__name__)

HTTP_STATUS_OK = 200
HTTP_STATUS_TIMEOUT = 150
MIN_IMAGES_COUNT = 2

_COMFYUI_DEBUG_SAVE_PROMPT_DIR = os.environ.get("COMFYUI_DEBUG_SAVE_PROMPT_DIR", "").strip()


def save_comfyui_audio_history_fact_from_response(history_data: dict[str, Any], *, base_url: str) -> None:
    """
    После успешной аудио-генерации: сохранить тело ответа GET /history/{prompt_id} в файл
    (тот же JSON, что даст curl). Папка: generated_files/.../curl_audio_fact на GENERATED_FILES_BASE.
    Отключение: COMFYUI_AUDIO_FACT_DISABLE=1.
    """
    if os.environ.get("COMFYUI_AUDIO_FACT_DISABLE", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ):
        return
    if not isinstance(history_data, dict) or not history_data:
        return
    try:
        base = (os.environ.get("GENERATED_FILES_BASE") or "/app").strip()
        out_dir = Path(base) / "generated_files" / "comfyui_debug_prompts" / "curl_audio_fact"
        out_dir.mkdir(parents=True, exist_ok=True)
        prompt_id = next(iter(history_data.keys()), "unknown")
        short = prompt_id[:8] if isinstance(prompt_id, str) and len(prompt_id) >= 8 else "unknown"
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        name = f"comfy_GET_history_{ts}_{short}.json"
        out_path = out_dir / name
        payload: dict[str, Any] = dict(history_data)
        try:
            entry = history_data.get(prompt_id)
            wf = None
            if isinstance(entry, dict):
                pr = entry.get("prompt")
                if isinstance(pr, list) and len(pr) >= 3 and isinstance(pr[2], dict):
                    wf = pr[2]
                elif isinstance(pr, dict):
                    wf = pr
            if wf:
                from api.services.music_generator_xl_base_pipeline import extract_comfy_seed_from_workflow

                seed_val = extract_comfy_seed_from_workflow(wf)
                payload = {
                    "eliteew_meta": {
                        "seed_applied": seed_val,
                        "seed_node_id": "109",
                        "seed_wire_note": (
                            'Comfy fields seed ["109",0] reference PrimitiveInt node id 109; '
                            "actual integer seed is seed_applied / prompt.109.inputs.value."
                        ),
                    },
                    "comfy_history": history_data,
                }
        except Exception as exc:  # noqa: BLE001 — fall back to raw Comfy history payload
            logger.debug("ComfyUI audio fact eliteew_meta enrich skipped: %s", exc, exc_info=True)
            payload = history_data
        out_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
        logger.info(
            "ComfyUI: saved audio history fact (equivalent: GET %s/history/%s) -> %s",
            base_url.rstrip("/"),
            prompt_id,
            out_path,
        )
    except OSError as e:
        logger.warning("ComfyUI audio fact save failed (IO): %s", e)
    except Exception:
        logger.warning("ComfyUI audio fact save failed", exc_info=True)


def maybe_save_comfyui_prompt_workflow(workflow: dict[str, Any], *, kind: str) -> None:
    """
    Если задан COMFYUI_DEBUG_SAVE_PROMPT_DIR, сохраняет JSON для сравнения с экспортом ComfyUI.
    В файл добавляется поле version (как в UI); реальный POST /prompt по-прежнему только {"prompt": ...}.
    """
    if not _COMFYUI_DEBUG_SAVE_PROMPT_DIR:
        return
    try:
        root = Path(_COMFYUI_DEBUG_SAVE_PROMPT_DIR).expanduser()
        safe_kind = re.sub(r"[^a-z0-9_-]+", "_", (kind or "prompt").lower())[:32].strip("_") or "prompt"
        out_dir = root / safe_kind
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%d_%H%M%S_%f")
        fname = f"comfy_prompt_{ts}_{uuid4().hex[:8]}.json"
        payload: dict[str, Any] = {"version": "1.0", "prompt": workflow}
        seed_applied = None
        seed_node = workflow.get("109") if isinstance(workflow, dict) else None
        if isinstance(seed_node, dict):
            raw_seed = seed_node.get("inputs", {}).get("value")
            try:
                seed_applied = int(raw_seed) if raw_seed is not None else None
            except (TypeError, ValueError):  # fmt: skip
                seed_applied = raw_seed
        payload["meta"] = {
            "seed_applied": seed_applied,
            "seed_wire_note": (
                'Поля seed ["109", 0] — ссылка на ноду PrimitiveInt id=109, не значение seed. '
                "Смотри meta.seed_applied или prompt.109.inputs.value."
            ),
        }
        (out_dir / fname).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("ComfyUI debug prompt save failed (IO): %s", e)
    except Exception:
        logger.warning("ComfyUI debug prompt save failed", exc_info=True)


# Re-export: tests and mixins import finalize from this module.

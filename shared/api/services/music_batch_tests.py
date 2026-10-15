# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   Серверная оркестрация batch-тестов Music Generator (подходы, UGS payload, XL studio apply).
# Invariants:
#   - workflow_key v2_base/v2_sft не смешивается с Turbo; apply в XL-студию сохраняет ugs_workflow.
#   - v2_base batch rows проходят тот же XL Base lyrics/tags pipeline, что POST /generate.
# Related:
#   - api/routers/music_generator.py, api/services/studio_comfy_workflows.py
#   - api/services/music_generator_xl_base_quality_loop.py
# ---

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import random
import re
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.schemas.music_batch_tests import (
    MusicBatchApproachDetail,
    MusicBatchApproachListResponse,
    MusicBatchApproachSummary,
    MusicBatchCreateRequest,
    MusicBatchGenerationPayloadResponse,
    MusicBatchGenerationSummary,
    MusicBatchLikedRecipesCreateRequest,
    MusicBatchProgress,
    MusicBatchXlStudioApplyResponse,
    music_batch_feedback_highlight_catalog,
)
from api.schemas.unified_content import Content, ContentCreate, ContentType, Visibility
from api.services.music_generator_liked_recipe import (
    content_eligible_for_liked_recipe,
    effective_params_from_recipe_metadata,
)
from api.services.music_generator_xl_base_quality_loop import apply_xl_base_pipeline_to_batch_ugs_input
from api.services.rabbitmq_service import QUEUE_AI_GENERATION, get_rabbitmq_service
from api.services.studio_comfy_workflows import ACE_STEP_KEYSCALES_ORDERED, normalize_keyscale_for_ace_comfy
from api.services.ugs.unified_generation_service import UnifiedGenerationService
from api.utils.json_safe import truncate_for_log

if TYPE_CHECKING:
    from api.services.unified_content.content_storage_service import ContentStorageService

logger = logging.getLogger(__name__)

SUPPORTED_WORKFLOWS = ("v2", "v2_base", "v2_sft", "v3")

_BATCH_WORKFLOW_LABELS: dict[str, str] = {
    "v2": "XL Turbo",
    "v2_base": "XL Base",
    "v2_sft": "XL SFT",
    "v3": "ACE V3",
}

# Desktop system folder item_id (see api/routers/desktop.py SYSTEM_FOLDER_KEYS) — «Проекты» / Projects.
MUSIC_BATCH_SAVED_CONTENT_FOLDER_ITEM_ID = "projects"


def _sanitize_batch_approach_name_segment(value: str) -> str:
    text = str(value or "").strip()
    text = re.sub(r"[^\w\-\s\u0400-\u04FF.]+", "", text, flags=re.UNICODE)
    text = re.sub(r"\s+", "_", text).strip("._-")
    return text or "x"


def _default_music_batch_approach_name(body: MusicBatchCreateRequest) -> str:
    version = _sanitize_batch_approach_name_segment(_BATCH_WORKFLOW_LABELS.get(body.workflow_key, body.workflow_key))
    genre_src = (body.genre_label or "").strip() or body.style
    genre = _sanitize_batch_approach_name_segment(genre_src)
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H-%M")
    return f"{version}_{genre}_{body.count}_{stamp}"


def _default_liked_recipes_batch_name(body: MusicBatchLikedRecipesCreateRequest, *, style: str) -> str:
    version = _sanitize_batch_approach_name_segment(_BATCH_WORKFLOW_LABELS["v2_base"])
    genre = _sanitize_batch_approach_name_segment((body.genre_label or "").strip() or style)
    count = len(body.content_ids)
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H-%M")
    return f"{version}_liked_{genre}_{count}_{stamp}"


def _finalize_v2_base_batch_row(
    workflow_key: str,
    effective: dict[str, Any],
    ugs_input_data: dict[str, Any],
    *,
    ksampler_use_comfy_template: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """XL Base pipeline на batch row; синхронизирует lyrics/tags в effective_params."""
    eff = dict(effective)
    ugs = dict(ugs_input_data)
    if workflow_key != "v2_base":
        return eff, ugs
    if ksampler_use_comfy_template:
        ugs["ksampler_use_comfy_template"] = True
    ugs, _obs = apply_xl_base_pipeline_to_batch_ugs_input(ugs, strict_lyrics=True)
    eff["lyrics"] = ugs.get("lyrics", eff.get("lyrics"))
    eff["tags"] = ugs.get("tags", eff.get("tags"))
    return eff, ugs


DEMO_BLOCK_TYPES = ("verse_chorus", "drop", "hook", "instrumental_motif", "custom_short_block")
SAMPLERS = ("euler", "er_sde", "heun", "ddim", "dpmpp_2m", "dpmpp_sde", "uni_pc")
SCHEDULERS = ("simple", "linear_quadratic", "normal", "karras", "sgm_uniform", "ddim_uniform")
VOCALS = ("male", "female", "duet")
TIMESIGNATURES = ("2", "3", "4", "6")

_COMMON_PARAMS = {
    "style",
    "vocal",
    "bpm",
    "keyscale",
    "timesignature",
    "temperature",
    "cfg_scale",
    "top_p",
    "top_k",
    "min_p",
    "seed",
    "generate_audio_codes",
    "duration_seconds",
    "lyrics",
    "tags",
    "language",
}
_WORKFLOW_PARAMS: dict[str, set[str]] = {
    "v2": _COMMON_PARAMS,
    "v2_base": _COMMON_PARAMS | {"cfg", "sampler_name", "scheduler", "denoise"},
    "v2_sft": _COMMON_PARAMS | {"cfg", "sampler_name", "scheduler", "denoise"},
    "v3": _COMMON_PARAMS | {"steps", "cfg", "sampler_name", "scheduler", "denoise", "shift", "soloist"},
}


def _env_int(name: str, default: int, *, min_value: int | None = None, max_value: int | None = None) -> int:
    raw = os.environ.get(name, "")
    try:
        value = int(raw) if raw.strip() else default
    except (TypeError, ValueError):  # fmt: skip
        value = default
    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def batch_tests_enabled() -> bool:
    return os.environ.get("MUSIC_BATCH_TESTS_ENABLED", "1").strip().lower() not in {"0", "false", "off", "no"}


def batch_limits_snapshot() -> dict[str, Any]:
    return {
        "enabled": batch_tests_enabled(),
        "max_items_per_approach": _env_int("MUSIC_BATCH_MAX_ITEMS", 50, min_value=1, max_value=50),
        "max_duration_seconds": 30,
        "max_active_approaches_per_user": _env_int("MUSIC_BATCH_MAX_ACTIVE_APPROACHES_PER_USER", 1, min_value=1),
        "max_active_rows_per_user": _env_int("MUSIC_BATCH_MAX_ACTIVE_ROWS_PER_USER", 1, min_value=1),
        "max_active_rows_global": _env_int("MUSIC_BATCH_MAX_ACTIVE_ROWS_GLOBAL", 1, min_value=1),
        "row_retry_max": _env_int("MUSIC_BATCH_ROW_RETRY_MAX", 1, min_value=0, max_value=3),
        "requeue_delay_seconds": _env_int("MUSIC_BATCH_REQUEUE_DELAY_SECONDS", 5, min_value=1, max_value=60),
        "cost_per_item_credits": 750,
        # 0 = выключено: Celery-задача не сбрасывает зависшие running.
        "stale_running_reap_after_seconds": _env_int(
            "MUSIC_BATCH_ROW_STALE_RUNNING_SECONDS", 900, min_value=0, max_value=86400
        ),
    }


def music_batch_capabilities() -> dict[str, Any]:
    limits = batch_limits_snapshot()
    return {
        "enabled": limits["enabled"],
        "limits": limits,
        "demo_block_types": list(DEMO_BLOCK_TYPES),
        "workflows": [
            {
                "key": "v2",
                "label": "XL Turbo",
                "cost_per_item_credits": 750,
                "supported_params": sorted(_WORKFLOW_PARAMS["v2"]),
                "notes": ["Turbo keeps KSampler steps fixed at 8."],
            },
            {
                "key": "v2_base",
                "label": "XL Base",
                "cost_per_item_credits": 750,
                "supported_params": sorted(_WORKFLOW_PARAMS["v2_base"]),
                "notes": ["KSampler cfg is clamped to a safe 1.2..3.2 window."],
            },
            {
                "key": "v2_sft",
                "label": "XL SFT",
                "cost_per_item_credits": 750,
                "supported_params": sorted(_WORKFLOW_PARAMS["v2_sft"]),
                "notes": ["KSampler cfg is clamped to a safe 1.2..3.2 window."],
            },
            {
                "key": "v3",
                "label": "ACE V3",
                "cost_per_item_credits": 750,
                "supported_params": sorted(_WORKFLOW_PARAMS["v3"]),
                "notes": ["Internal Comfy batch_size is forced to 1 in batch tests."],
            },
        ],
        "params": {
            "vocal": {"type": "enum", "values": list(VOCALS)},
            "bpm": {"type": "number", "min": 10, "max": 300, "safe_min": 60, "safe_max": 180, "step": 1},
            "keyscale": {"type": "enum", "values": list(ACE_STEP_KEYSCALES_ORDERED)},
            "timesignature": {"type": "enum", "values": list(TIMESIGNATURES)},
            "temperature": {"type": "number", "min": 0, "max": 2, "safe_min": 0.6, "safe_max": 1.1, "step": 0.01},
            "cfg_scale": {"type": "number", "min": 0, "max": 100, "safe_min": 1.5, "safe_max": 3, "step": 0.01},
            "top_p": {"type": "number", "min": 0, "max": 1, "safe_min": 0.85, "safe_max": 0.95, "step": 0.01},
            "top_k": {"type": "number", "min": 0, "max": 100, "step": 1},
            "min_p": {"type": "number", "min": 0, "max": 1, "safe_min": 0, "safe_max": 0.08, "step": 0.01},
            "seed": {"type": "seed", "modes": ["random", "fixed", "sequential"]},
            "cfg": {"type": "number", "min": 0, "max": 8, "safe_min": 1.2, "safe_max": 3.2, "step": 0.1},
            "steps": {"type": "number", "min": 1, "max": 100, "safe_min": 36, "safe_max": 60, "step": 1},
            "sampler_name": {"type": "enum", "values": list(SAMPLERS)},
            "scheduler": {"type": "enum", "values": list(SCHEDULERS)},
            "denoise": {"type": "number", "min": 0, "max": 1, "step": 0.01},
            "shift": {"type": "number", "min": 0, "max": 12, "step": 0.1},
            "generate_audio_codes": {"type": "boolean"},
        },
        "feedback_highlights": music_batch_feedback_highlight_catalog(),
    }


def _jsonable(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=_jsonable)


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str) and value:
        try:
            parsed = json.loads(value)
            return dict(parsed) if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x) for x in value if x is not None and str(x).strip()]
    if isinstance(value, str) and value:
        try:
            parsed = json.loads(value)
            return [str(x) for x in parsed] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _safe_mp3_original_filename(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", (name or "batch-demo").strip())[:80].strip("._-")
    return f"{stem or 'batch-demo'}.mp3"


def _unwrap_audio_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "audio" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "audio" in inner:
            return inner
    return block if isinstance(block, dict) else {}


def _payload_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_json_dumps(payload).encode("utf-8")).hexdigest()


def _coerce_float(value: Any, default: float, min_value: float, max_value: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):  # fmt: skip
        number = default
    return max(min_value, min(max_value, number))


def _coerce_int(value: Any, default: int, min_value: int, max_value: int) -> int:
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError):  # fmt: skip
        number = default
    return max(min_value, min(max_value, number))


def _choice_param(value: Any, allowed: tuple[str, ...], default: str) -> str:
    item = str(value or "").strip()
    return item if item in allowed else default


def _validate_spec_param_names(workflow_key: str, fixed_params: dict[str, Any], random_params: dict[str, Any]) -> None:
    supported = _WORKFLOW_PARAMS[workflow_key]
    fixed_names = set(fixed_params)
    random_names = set(random_params)
    unsupported = sorted((fixed_names | random_names) - supported)
    if unsupported:
        raise ValueError(f"Unsupported batch parameters for {workflow_key}: {', '.join(unsupported)}")
    overlap = sorted(fixed_names & random_names)
    if overlap:
        raise ValueError(f"Parameters cannot be both fixed and random: {', '.join(overlap)}")


def _random_number(spec: dict[str, Any], default_min: float, default_max: float) -> float | int:
    min_value = _coerce_float(spec.get("min"), default_min, -1_000_000.0, 1_000_000.0)
    max_value = _coerce_float(spec.get("max"), default_max, -1_000_000.0, 1_000_000.0)
    if max_value < min_value:
        min_value, max_value = max_value, min_value
    step = spec.get("step")
    rng = random.SystemRandom()
    if step is not None:
        step_value = _coerce_float(step, 1.0, 0.000001, 1_000_000.0)
        slots = int((max_value - min_value) / step_value)
        value = min_value + rng.randint(0, max(0, slots)) * step_value
    else:
        value = rng.uniform(min_value, max_value)
    if float(value).is_integer() and (step is None or float(step or 1).is_integer()):
        return int(value)
    return round(float(value), 4)


def _resolve_random_value(param: str, spec: Any, row_index: int) -> Any:
    if not isinstance(spec, dict):
        raise ValueError(f"Random parameter {param} must be an object")
    kind = str(spec.get("type") or "").strip().lower()
    if param == "seed" or kind == "seed":
        mode = str(spec.get("mode") or "random").strip().lower()
        if mode == "fixed":
            return _coerce_int(spec.get("value"), 0, 0, 2**53 - 1)
        if mode == "sequential":
            start = _coerce_int(spec.get("start"), 0, 0, 2**53 - 1)
            return max(0, min(2**53 - 1, start + row_index - 1))
        return random.SystemRandom().randint(0, 2**53 - 1)
    if kind == "enum":
        values = [str(v) for v in (spec.get("values") or []) if str(v).strip()]
        if not values:
            raise ValueError(f"Random enum parameter {param} has no values")
        return random.SystemRandom().choice(values)
    if kind == "boolean":
        values = spec.get("values")
        if isinstance(values, list) and values:
            return bool(random.SystemRandom().choice(values))
        return bool(random.SystemRandom().randint(0, 1))
    if kind == "number" or "min" in spec or "max" in spec:
        return _random_number(spec, 0.0, 1.0)
    raise ValueError(f"Unsupported random spec for {param}")


def _normalize_effective_params(workflow_key: str, params: dict[str, Any]) -> dict[str, Any]:
    out = dict(params)
    out["duration_seconds"] = _coerce_int(out.get("duration_seconds"), 30, 1, 30)
    out["style"] = str(out.get("style") or "pop").strip().lower() or "pop"
    out["lyrics"] = str(out.get("lyrics") or "").strip()[:8000]
    out["tags"] = str(out.get("tags") or "").strip()[:2000]
    out["language"] = str(out.get("language") or "ru").strip()[:16] or "ru"
    out["vocal"] = _choice_param(out.get("vocal"), VOCALS, "female")
    out["bpm"] = _coerce_int(out.get("bpm"), 120, 10, 300)
    out["keyscale"] = normalize_keyscale_for_ace_comfy(str(out.get("keyscale") or "C major"))
    out["timesignature"] = _choice_param(out.get("timesignature"), TIMESIGNATURES, "4")
    out["temperature"] = _coerce_float(out.get("temperature"), 0.85, 0.0, 2.0)
    out["cfg_scale"] = _coerce_float(out.get("cfg_scale"), 2.0, 0.0, 100.0)
    out["top_p"] = _coerce_float(out.get("top_p"), 0.9, 0.0, 1.0)
    out["top_k"] = _coerce_int(out.get("top_k"), 0, 0, 100)
    out["min_p"] = _coerce_float(out.get("min_p"), 0.0, 0.0, 1.0)
    out["generate_audio_codes"] = bool(out.get("generate_audio_codes", True))
    if "seed" not in out or out.get("seed") in (None, ""):
        out["seed"] = random.SystemRandom().randint(0, 2**53 - 1)
    out["seed"] = _coerce_int(out.get("seed"), 0, 0, 2**53 - 1)
    if workflow_key in {"v2_base", "v2_sft", "v3"}:
        out["cfg"] = _coerce_float(
            out.get("cfg"), 2.0, 1.2 if workflow_key != "v3" else 0.0, 3.2 if workflow_key != "v3" else 8.0
        )
        out["sampler_name"] = _choice_param(out.get("sampler_name"), SAMPLERS, "euler")
        out["scheduler"] = _choice_param(out.get("scheduler"), SCHEDULERS, "simple")
        out["denoise"] = _coerce_float(out.get("denoise"), 1.0, 0.0, 1.0)
    if workflow_key == "v3":
        out["steps"] = _coerce_int(out.get("steps"), 50, 1, 100)
        out["shift"] = _coerce_float(out.get("shift"), 3.0, 0.0, 12.0)
        out["batch_size"] = 1
        out["ugs_workflow"] = "v3"
    elif workflow_key in {"v2", "v2_base", "v2_sft"}:
        out["steps"] = 8
        out["ugs_workflow"] = workflow_key
    return out


def _build_payloads(body: MusicBatchCreateRequest) -> list[dict[str, Any]]:
    workflow_key = body.workflow_key
    fixed_params = dict(body.fixed_params or {})
    random_params = dict(body.random_params or {})
    _validate_spec_param_names(workflow_key, fixed_params, random_params)
    base = {
        "lyrics": body.base_prompt.lyrics,
        "tags": body.base_prompt.tags or "",
        "language": body.base_prompt.language,
        "style": body.style,
        "duration_seconds": body.duration_seconds,
    }
    rows: list[dict[str, Any]] = []
    for row_index in range(1, body.count + 1):
        effective = {**base, **fixed_params}
        for param, spec in random_params.items():
            effective[param] = _resolve_random_value(param, spec, row_index)
        effective = _normalize_effective_params(workflow_key, effective)
        ugs_input_data = _to_ugs_input_data(workflow_key, effective)
        effective, ugs_input_data = _finalize_v2_base_batch_row(workflow_key, effective, ugs_input_data)
        request_payload = {
            "workflow_key": workflow_key,
            "demo_block_type": body.demo_block_type,
            "effective_params": effective,
        }
        rows.append(
            {
                "row_index": row_index,
                "seed_used": effective["seed"],
                "effective_params": effective,
                "request_payload": request_payload,
                "ugs_input_data": ugs_input_data,
            }
        )
    return rows


def _build_payloads_from_liked_recipes(
    body: MusicBatchLikedRecipesCreateRequest,
    *,
    recipes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Одна batch-строка на лайкнутый рецепт; workflow_key всегда v2_base.
    recipes: [{content_id, content_name, metadata}, ...] в порядке content_ids.
    """
    workflow_key = "v2_base"
    rows: list[dict[str, Any]] = []
    for row_index, recipe in enumerate(recipes, start=1):
        md = _as_dict(recipe.get("metadata"))
        cid = str(recipe.get("content_id") or "")
        cname = str(recipe.get("content_name") or "")
        effective = effective_params_from_recipe_metadata(
            md,
            content_id=cid,
            content_name=cname,
            duration_seconds=body.duration_seconds,
        )
        effective = _normalize_effective_params(workflow_key, effective)
        ugs_input_data = _to_ugs_input_data(workflow_key, effective)
        effective, ugs_input_data = _finalize_v2_base_batch_row(
            workflow_key,
            effective,
            ugs_input_data,
            ksampler_use_comfy_template=body.ksampler_use_comfy_template,
        )
        request_payload = {
            "workflow_key": workflow_key,
            "demo_block_type": body.demo_block_type,
            "effective_params": effective,
            "source": "liked_recipes",
            "liked_recipe_content_id": cid,
        }
        rows.append(
            {
                "row_index": row_index,
                "seed_used": effective["seed"],
                "effective_params": effective,
                "request_payload": request_payload,
                "ugs_input_data": ugs_input_data,
            }
        )
    return rows


def _to_ugs_input_data(workflow_key: str, effective: dict[str, Any]) -> dict[str, Any]:
    input_data = {
        "lyrics": effective["lyrics"],
        "tags": effective["tags"],
        "vocal": effective["vocal"],
        "style": effective["style"],
        "bpm": effective["bpm"],
        "duration_seconds": effective["duration_seconds"],
        "language": effective["language"],
        "keyscale": effective["keyscale"],
        "timesignature": effective["timesignature"],
        "temperature": effective["temperature"],
        "cfg_scale": effective["cfg_scale"],
        "top_p": effective["top_p"],
        "top_k": effective["top_k"],
        "min_p": effective["min_p"],
        "seed": effective["seed"],
        "steps": effective["steps"],
        "generate_audio_codes": effective["generate_audio_codes"],
        "batch_size": 1,
    }
    if workflow_key in {"v2", "v2_base", "v2_sft"}:
        input_data["ugs_workflow"] = workflow_key
        if workflow_key in {"v2_base", "v2_sft"}:
            input_data["cfg"] = effective.get("cfg")
            input_data["sampler_name"] = effective.get("sampler_name")
            input_data["scheduler"] = effective.get("scheduler")
            input_data["denoise"] = effective.get("denoise")
    else:
        input_data.update(
            {
                "ugs_workflow": "v3",
                "cfg": effective.get("cfg"),
                "sampler_name": effective.get("sampler_name"),
                "scheduler": effective.get("scheduler"),
                "denoise": effective.get("denoise"),
                "shift": effective.get("shift"),
            }
        )
    return input_data


async def enqueue_music_batch_approach(approach_id: str, user_id: str) -> bool:
    return await get_rabbitmq_service().publish(
        QUEUE_AI_GENERATION,
        {
            "task_type": "music_batch_approach",
            "approach_id": approach_id,
            "user_id": user_id,
        },
    )


_STALE_RUNNING_LOG_MSG = "Row remained in running past stale timeout; reaper reset for retry or terminal fail"


async def reap_stale_music_batch_running_rows(
    db: AsyncSession,
) -> tuple[int, list[tuple[str, str]]]:
    """
    Сбрасывает строки, зависшие в status=running (падение воркера / UGS без завершения).
    Возвращает (число затронутых строк, уникальные (approach_id, user_id) для постановки в очередь).
    Вызывающий делает commit, затем enqueue по списку пар.
    """
    limits = batch_limits_snapshot()
    stale_sec = int(limits.get("stale_running_reap_after_seconds") or 0)
    if stale_sec <= 0:
        return 0, []
    retry_max = int(limits["row_retry_max"])
    result = await db.execute(
        text(
            """
            WITH stale AS (
                SELECT
                    g.id,
                    g.approach_id,
                    g.attempt_count,
                    a.user_id::text AS user_id,
                    CASE
                        WHEN g.attempt_count <= :retry_max THEN 'retrying'
                        ELSE 'failed'
                    END AS new_status
                FROM music_batch_generations g
                INNER JOIN music_batch_approaches a ON a.id = g.approach_id
                WHERE g.status = 'running'
                  AND g.started_at IS NOT NULL
                  AND g.started_at < NOW() - (:stale_sec * INTERVAL '1 second')
            ),
            upd AS (
                UPDATE music_batch_generations g
                SET
                    status = stale.new_status,
                    error_code = 'stale_running_timeout',
                    error_message = :err_msg,
                    completed_at = CASE
                        WHEN stale.new_status = 'failed' THEN NOW()
                        ELSE g.completed_at
                    END,
                    updated_at = NOW()
                FROM stale
                WHERE g.id = stale.id
                RETURNING g.approach_id, g.id AS generation_id, stale.new_status, stale.user_id
            )
            SELECT * FROM upd
            """
        ),
        {
            "retry_max": retry_max,
            "stale_sec": stale_sec,
            "err_msg": _STALE_RUNNING_LOG_MSG[:1000],
        },
    )
    touched = list(result.mappings().all())
    if not touched:
        return 0, []
    aid_to_user: dict[str, str] = {}
    for row in touched:
        aid = str(row["approach_id"])
        uid = str(row["user_id"])
        aid_to_user.setdefault(aid, uid)
    service = MusicBatchTestService(db)
    for aid in aid_to_user:
        await service._refresh_approach_progress(aid)
    pairs = list(aid_to_user.items())
    logger.warning(
        "music_batch_stale_reaper rows_reset=%s approaches=%s stale_sec=%s",
        len(touched),
        len(pairs),
        stale_sec,
    )
    return len(touched), pairs


async def reap_stale_music_batch_running_rows_and_requeue() -> int:
    """Полный цикл: сброс зависших running, commit, постановка затронутых подходов в RabbitMQ."""
    from api.core.database_manager import get_database_manager

    manager = await get_database_manager()
    async with manager.get_postgres_session() as db:
        n, pairs = await reap_stale_music_batch_running_rows(db)
        if n == 0:
            return 0
        await db.commit()
    for approach_id, user_id in pairs:
        await enqueue_music_batch_approach(approach_id, user_id)
    return n


class MusicBatchTestService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_approach(self, body: MusicBatchCreateRequest, user_id: str) -> MusicBatchApproachSummary:
        limits = batch_limits_snapshot()
        if not limits["enabled"]:
            raise ValueError("Music batch tests are disabled")
        if body.count > int(limits["max_items_per_approach"]):
            raise ValueError(f"Batch count exceeds current limit: {limits['max_items_per_approach']}")
        active_count = await self.db.scalar(
            text(
                """
                SELECT COUNT(*)
                FROM music_batch_approaches
                WHERE user_id = :user_id
                  AND status IN ('queued', 'running')
                """
            ),
            {"user_id": user_id},
        )
        if int(active_count or 0) >= int(limits["max_active_approaches_per_user"]):
            raise ValueError("Only one active music batch approach is allowed per user")

        rows = _build_payloads(body)
        name = (body.name or "").strip() or _default_music_batch_approach_name(body)
        fixed_params = dict(body.fixed_params or {})
        random_params = dict(body.random_params or {})
        base_payload = {
            "base_prompt": body.base_prompt.model_dump(mode="json"),
            "style": body.style,
            "workflow_key": body.workflow_key,
            "demo_block_type": body.demo_block_type,
        }
        cost_estimate = {
            "count": body.count,
            "cost_per_item_credits": limits["cost_per_item_credits"],
            "total_credits": body.count * int(limits["cost_per_item_credits"]),
            "retry_max": limits["row_retry_max"],
        }
        result = await self.db.execute(
            text(
                """
                INSERT INTO music_batch_approaches (
                    user_id, name, status, workflow_key, style, genre_label, demo_block_type,
                    requested_count, duration_seconds, fixed_params, random_params_spec,
                    base_payload, cost_estimate, limits_snapshot, progress_total
                )
                VALUES (
                    :user_id, :name, 'queued', :workflow_key, :style, :genre_label, :demo_block_type,
                    :requested_count, :duration_seconds, CAST(:fixed_params AS jsonb), CAST(:random_params_spec AS jsonb),
                    CAST(:base_payload AS jsonb), CAST(:cost_estimate AS jsonb), CAST(:limits_snapshot AS jsonb), :progress_total
                )
                RETURNING *
                """
            ),
            {
                "user_id": user_id,
                "name": name,
                "workflow_key": body.workflow_key,
                "style": body.style,
                "genre_label": body.genre_label,
                "demo_block_type": body.demo_block_type,
                "requested_count": body.count,
                "duration_seconds": body.duration_seconds,
                "fixed_params": _json_dumps(fixed_params),
                "random_params_spec": _json_dumps(random_params),
                "base_payload": _json_dumps(base_payload),
                "cost_estimate": _json_dumps(cost_estimate),
                "limits_snapshot": _json_dumps(limits),
                "progress_total": body.count,
            },
        )
        approach = dict(result.mappings().one())
        approach_id = str(approach["id"])
        await self.db.execute(
            text(
                """
                INSERT INTO music_batch_generations (
                    approach_id, row_index, status, seed_used, effective_params, request_payload, ugs_input_data
                )
                VALUES (
                    :approach_id, :row_index, 'pending', :seed_used,
                    CAST(:effective_params AS jsonb), CAST(:request_payload AS jsonb), CAST(:ugs_input_data AS jsonb)
                )
                """
            ),
            [
                {
                    "approach_id": approach_id,
                    "row_index": row["row_index"],
                    "seed_used": row["seed_used"],
                    "effective_params": _json_dumps(row["effective_params"]),
                    "request_payload": _json_dumps(row["request_payload"]),
                    "ugs_input_data": _json_dumps(row["ugs_input_data"]),
                }
                for row in rows
            ],
        )
        await self.db.commit()
        logger.info(
            "music_batch_approach_created approach_id=%s user_id=%s workflow=%s count=%s",
            approach_id,
            user_id,
            body.workflow_key,
            body.count,
        )
        return self._approach_summary_from_row(approach)

    async def create_approach_from_liked_recipes(
        self,
        body: MusicBatchLikedRecipesCreateRequest,
        user_id: str,
    ) -> MusicBatchApproachSummary:
        limits = batch_limits_snapshot()
        if not limits["enabled"]:
            raise ValueError("Music batch tests are disabled")
        count = len(body.content_ids)
        if count > int(limits["max_items_per_approach"]):
            raise ValueError(f"Batch count exceeds current limit: {limits['max_items_per_approach']}")
        active_count = await self.db.scalar(
            text(
                """
                SELECT COUNT(*)
                FROM music_batch_approaches
                WHERE user_id = :user_id
                  AND status IN ('queued', 'running')
                """
            ),
            {"user_id": user_id},
        )
        if int(active_count or 0) >= int(limits["max_active_approaches_per_user"]):
            raise ValueError("Only one active music batch approach is allowed per user")

        id_list = [str(cid) for cid in body.content_ids]
        result = await self.db.execute(
            text(
                """
                SELECT id::text AS content_id, name, sub_type, tags, metadata
                FROM unified_content
                WHERE user_id = CAST(:user_id AS uuid)
                  AND id = ANY(CAST(:ids AS uuid[]))
                """
            ),
            {"user_id": user_id, "ids": id_list},
        )
        by_id = {str(row["content_id"]): dict(row) for row in result.mappings().all()}
        missing = [cid for cid in id_list if cid not in by_id]
        if missing:
            raise ValueError(f"Content not found or not owned: {', '.join(missing[:5])}")

        now = datetime.now(UTC)
        recipes: list[dict[str, Any]] = []
        ineligible: list[str] = []
        for cid in id_list:
            row = by_id[cid]
            tags_raw = row.get("tags")
            tags: list[str] = []
            if isinstance(tags_raw, list):
                tags = [str(x) for x in tags_raw]
            elif tags_raw:
                tags = [str(tags_raw)]
            probe = Content.model_validate(
                {
                    "id": UUID(cid),
                    "user_id": user_id,
                    "name": str(row.get("name") or ""),
                    "content_type": ContentType.AUDIO,
                    "sub_type": row.get("sub_type"),
                    "tags": tags,
                    "metadata": _as_dict(row.get("metadata")),
                    "created_at": now,
                    "updated_at": now,
                }
            )
            if not content_eligible_for_liked_recipe(probe):
                ineligible.append(cid)
                continue
            recipes.append(
                {
                    "content_id": cid,
                    "content_name": str(row.get("name") or ""),
                    "metadata": _as_dict(row.get("metadata")),
                }
            )
        if ineligible:
            raise ValueError(f"Content not eligible for liked recipe batch: {', '.join(ineligible[:5])}")
        if not recipes:
            raise ValueError("No eligible liked recipes in request")

        try:
            rows = _build_payloads_from_liked_recipes(body, recipes=recipes)
        except ValueError as exc:
            raise ValueError(f"XL Base pipeline rejected recipe lyrics: {exc}") from exc

        first_eff = rows[0]["effective_params"]
        style = str(first_eff.get("style") or "pop")
        name = (body.name or "").strip() or _default_liked_recipes_batch_name(body, style=style)
        base_payload = {
            "source": "liked_recipes",
            "content_ids": id_list,
            "workflow_key": "v2_base",
            "demo_block_type": body.demo_block_type,
            "ksampler_use_comfy_template": body.ksampler_use_comfy_template,
            "base_prompt": {
                "lyrics": first_eff.get("lyrics", ""),
                "tags": first_eff.get("tags", ""),
                "language": first_eff.get("language", "ru"),
            },
            "style": style,
        }
        cost_estimate = {
            "count": len(rows),
            "cost_per_item_credits": limits["cost_per_item_credits"],
            "total_credits": len(rows) * int(limits["cost_per_item_credits"]),
            "retry_max": limits["row_retry_max"],
        }
        insert = await self.db.execute(
            text(
                """
                INSERT INTO music_batch_approaches (
                    user_id, name, status, workflow_key, style, genre_label, demo_block_type,
                    requested_count, duration_seconds, fixed_params, random_params_spec,
                    base_payload, cost_estimate, limits_snapshot, progress_total
                )
                VALUES (
                    :user_id, :name, 'queued', 'v2_base', :style, :genre_label, :demo_block_type,
                    :requested_count, :duration_seconds, CAST(:fixed_params AS jsonb), CAST(:random_params_spec AS jsonb),
                    CAST(:base_payload AS jsonb), CAST(:cost_estimate AS jsonb), CAST(:limits_snapshot AS jsonb), :progress_total
                )
                RETURNING *
                """
            ),
            {
                "user_id": user_id,
                "name": name,
                "style": style,
                "genre_label": body.genre_label,
                "demo_block_type": body.demo_block_type,
                "requested_count": len(rows),
                "duration_seconds": body.duration_seconds,
                "fixed_params": _json_dumps({}),
                "random_params_spec": _json_dumps({}),
                "base_payload": _json_dumps(base_payload),
                "cost_estimate": _json_dumps(cost_estimate),
                "limits_snapshot": _json_dumps(limits),
                "progress_total": len(rows),
            },
        )
        approach = dict(insert.mappings().one())
        approach_id = str(approach["id"])
        await self.db.execute(
            text(
                """
                INSERT INTO music_batch_generations (
                    approach_id, row_index, status, seed_used, effective_params, request_payload, ugs_input_data
                )
                VALUES (
                    :approach_id, :row_index, 'pending', :seed_used,
                    CAST(:effective_params AS jsonb), CAST(:request_payload AS jsonb), CAST(:ugs_input_data AS jsonb)
                )
                """
            ),
            [
                {
                    "approach_id": approach_id,
                    "row_index": row["row_index"],
                    "seed_used": row["seed_used"],
                    "effective_params": _json_dumps(row["effective_params"]),
                    "request_payload": _json_dumps(row["request_payload"]),
                    "ugs_input_data": _json_dumps(row["ugs_input_data"]),
                }
                for row in rows
            ],
        )
        await self.db.commit()
        logger.info(
            "music_batch_approach_created_from_liked_recipes approach_id=%s user_id=%s count=%s",
            approach_id,
            user_id,
            len(rows),
        )
        return self._approach_summary_from_row(approach)

    async def mark_enqueue_failed(self, approach_id: str, user_id: str, error_message: str) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_batch_approaches
                SET status = 'failed', completed_at = NOW(), updated_at = NOW()
                WHERE id = :approach_id AND user_id = :user_id
                """
            ),
            {"approach_id": approach_id, "user_id": user_id},
        )
        await self.db.execute(
            text(
                """
                UPDATE music_batch_generations
                SET status = 'failed', error_code = 'enqueue_failed', error_message = :error_message,
                    completed_at = NOW(), updated_at = NOW()
                WHERE approach_id = :approach_id AND status IN ('pending', 'retrying')
                """
            ),
            {"approach_id": approach_id, "error_message": error_message[:1000]},
        )
        await self._refresh_approach_progress(approach_id)
        await self.db.commit()

    async def list_approaches(
        self, user_id: str, *, limit: int = 20, offset: int = 0
    ) -> MusicBatchApproachListResponse:
        limit = max(1, min(200, limit))
        offset = max(0, offset)
        total = int(
            await self.db.scalar(
                text("SELECT COUNT(*) FROM music_batch_approaches WHERE user_id = :user_id"),
                {"user_id": user_id},
            )
            or 0
        )
        result = await self.db.execute(
            text(
                """
                SELECT *
                FROM music_batch_approaches
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {"user_id": user_id, "limit": limit, "offset": offset},
        )
        return MusicBatchApproachListResponse(
            items=[self._approach_summary_from_row(dict(row)) for row in result.mappings().all()],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get_approach_detail(self, approach_id: str, user_id: str) -> MusicBatchApproachDetail | None:
        approach = await self._get_approach_row(approach_id, user_id)
        if approach is None:
            return None
        rows_result = await self.db.execute(
            text(
                """
                SELECT g.*, uc.name AS content_name
                FROM music_batch_generations g
                LEFT JOIN unified_content uc ON uc.id = g.content_id
                WHERE g.approach_id = :approach_id
                ORDER BY g.row_index ASC
                """
            ),
            {"approach_id": approach_id},
        )
        summary = self._approach_summary_from_row(approach)
        return MusicBatchApproachDetail(
            **summary.model_dump(),
            fixed_params=_as_dict(approach.get("fixed_params")),
            random_params_spec=_as_dict(approach.get("random_params_spec")),
            base_payload=_as_dict(approach.get("base_payload")),
            generations=[self._generation_summary_from_row(dict(row)) for row in rows_result.mappings().all()],
        )

    async def rename_approach(self, approach_id: str, user_id: str, name: str) -> MusicBatchApproachSummary | None:
        result = await self.db.execute(
            text(
                """
                UPDATE music_batch_approaches
                SET name = :name, updated_at = NOW()
                WHERE id = :approach_id AND user_id = :user_id
                RETURNING *
                """
            ),
            {"approach_id": approach_id, "user_id": user_id, "name": name},
        )
        row = result.mappings().first()
        await self.db.commit()
        return self._approach_summary_from_row(dict(row)) if row else None

    async def cancel_approach(self, approach_id: str, user_id: str) -> MusicBatchApproachSummary | None:
        approach = await self._get_approach_row(approach_id, user_id)
        if approach is None:
            return None
        await self.db.execute(
            text(
                """
                UPDATE music_batch_generations
                SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
                WHERE approach_id = :approach_id
                  AND status IN ('pending', 'retrying')
                """
            ),
            {"approach_id": approach_id},
        )
        await self._refresh_approach_progress(approach_id)
        result = await self.db.execute(
            text("SELECT * FROM music_batch_approaches WHERE id = :approach_id"),
            {"approach_id": approach_id},
        )
        await self.db.commit()
        row = result.mappings().first()
        return self._approach_summary_from_row(dict(row)) if row else None

    async def set_generation_feedback(
        self,
        generation_id: str,
        user_id: str,
        *,
        rating: str,
        comment: str | None,
        highlights: list[str] | None = None,
    ) -> MusicBatchGenerationSummary | None:
        comment_value = (comment or "").strip() or None
        highlights_for_db = _json_dumps(highlights) if rating == "tagged" and highlights else "[]"
        result = await self.db.execute(
            text(
                """
                UPDATE music_batch_generations g
                SET sample_feedback = :rating,
                    sample_feedback_comment = :comment,
                    sample_feedback_highlights = CAST(:highlights AS jsonb),
                    sample_feedback_at = NOW(),
                    updated_at = NOW()
                FROM music_batch_approaches a
                WHERE g.id = :generation_id
                  AND g.approach_id = a.id
                  AND a.user_id = :user_id
                  AND g.status = 'succeeded'
                RETURNING g.*,
                    (SELECT uc.name FROM unified_content uc WHERE uc.id = g.content_id LIMIT 1)
                        AS content_name
                """
            ),
            {
                "generation_id": generation_id,
                "user_id": user_id,
                "rating": rating,
                "comment": comment_value,
                "highlights": highlights_for_db,
            },
        )
        row = result.mappings().first()
        await self.db.commit()
        if not row:
            return None
        data = dict(row)
        summary = self._generation_summary_from_row(data)
        logger.info(
            "music_batch_sample_feedback generation_id=%s approach_id=%s rating=%s has_comment=%s highlights_n=%s",
            generation_id,
            data.get("approach_id"),
            rating,
            bool(comment_value),
            len(summary.sample_feedback_highlights),
        )
        return summary

    async def get_generation_payload(
        self, generation_id: str, user_id: str
    ) -> MusicBatchGenerationPayloadResponse | None:
        result = await self.db.execute(
            text(
                """
                SELECT g.*, a.fixed_params, a.random_params_spec, uc.metadata AS content_metadata
                FROM music_batch_generations g
                JOIN music_batch_approaches a ON a.id = g.approach_id
                LEFT JOIN unified_content uc ON uc.id = g.content_id
                WHERE g.id = :generation_id AND a.user_id = :user_id
                """
            ),
            {"generation_id": generation_id, "user_id": user_id},
        )
        row = result.mappings().first()
        if not row:
            return None
        data = dict(row)
        return MusicBatchGenerationPayloadResponse(
            generation_id=data["id"],
            approach_id=data["approach_id"],
            row_index=data["row_index"],
            status=data["status"],
            configured={
                "fixed_params": _as_dict(data.get("fixed_params")),
                "random_params_spec": _as_dict(data.get("random_params_spec")),
            },
            effective_params=_as_dict(data.get("effective_params")),
            request_payload=_as_dict(data.get("request_payload")),
            ugs_input_data=_as_dict(data.get("ugs_input_data")),
            provider_meta=_as_dict(data.get("provider_meta")),
            content_metadata_snapshot=_as_dict(data.get("content_metadata")),
        )

    async def get_xl_studio_apply(self, generation_id: str, user_id: str) -> MusicBatchXlStudioApplyResponse | None:
        p = await self.get_generation_payload(generation_id, user_id)
        if p is None:
            return None
        u: dict[str, Any] = dict(p.ugs_input_data or {})
        e: dict[str, Any] = dict(p.effective_params or {})
        req = dict(p.request_payload or {})
        wk = str(u.get("ugs_workflow") or req.get("workflow_key") or "v2_sft").strip().lower()
        if wk not in ("v2", "v2_base", "v2_sft", "v3"):
            wk = "v2_sft"
        workflow_key = wk  # type: ignore[assignment]
        st = str(e.get("style") or "pop").strip() or "pop"
        music_generate: dict[str, Any] = {
            "lyrics": (u.get("lyrics") if u.get("lyrics") is not None else e.get("lyrics")) or "",
            "tags": (u.get("tags") if u.get("tags") is not None else e.get("tags")) or "",
            "style": st,
            "vocal": (u.get("vocal") or e.get("vocal") or "female"),
            "bpm": u.get("bpm", e.get("bpm")),
            "duration_seconds": u.get("duration_seconds", e.get("duration_seconds")) or 30,
            "language": (u.get("language") or e.get("language") or "ru"),
            "keyscale": (u.get("keyscale") or e.get("keyscale") or "C major"),
            "timesignature": str(u.get("timesignature") or e.get("timesignature") or "4"),
            "temperature": u.get("temperature", e.get("temperature")),
            "cfg_scale": u.get("cfg_scale", e.get("cfg_scale")),
            "top_p": u.get("top_p", e.get("top_p")),
            "top_k": u.get("top_k", e.get("top_k")),
            "min_p": u.get("min_p", e.get("min_p")),
        }
        if wk in ("v2", "v2_base", "v2_sft"):
            music_generate["ugs_workflow"] = wk
        if wk in ("v2_base", "v2_sft"):
            music_generate["source_mode"] = "xl_base_sft_tab"
        has_custom_ksampler = bool(u.get("sampler_name") or u.get("scheduler") or u.get("cfg") is not None)
        if wk in ("v2_base", "v2_sft") and not has_custom_ksampler:
            music_generate["ksampler_use_comfy_template"] = True
        if u.get("cfg") is not None:
            music_generate["cfg"] = u.get("cfg")
        if u.get("sampler_name"):
            music_generate["sampler_name"] = u.get("sampler_name")
        if u.get("scheduler"):
            music_generate["scheduler"] = u.get("scheduler")
        if u.get("denoise") is not None:
            music_generate["denoise"] = u.get("denoise")
        if u.get("generate_audio_codes") is not None:
            music_generate["generate_audio_codes"] = u.get("generate_audio_codes")
        return MusicBatchXlStudioApplyResponse(
            generation_id=p.generation_id,
            approach_id=p.approach_id,
            workflow_key=workflow_key,  # type: ignore[arg-type]
            style=st,
            ugs_input_data=u,
            effective_params=e,
            music_generate=music_generate,
        )

    async def process_next_row(
        self,
        *,
        approach_id: str,
        user_id: str,
        content_service: ContentStorageService,
        ugs: UnifiedGenerationService,
    ) -> bool:
        limits = batch_limits_snapshot()
        if not limits["enabled"]:
            await self._cancel_pending_for_disabled(approach_id)
            return False
        if await self._active_rows_global() >= int(limits["max_active_rows_global"]):
            await self._sleep_before_requeue(limits)
            return True
        if await self._active_rows_for_user(user_id) >= int(limits["max_active_rows_per_user"]):
            await self._sleep_before_requeue(limits)
            return True

        row = await self._claim_next_row(approach_id, user_id)
        if row is None:
            await self._refresh_approach_progress(approach_id)
            await self.db.commit()
            return False

        should_requeue = True
        start = time.monotonic()
        generation_id = str(row["id"])
        row_index = int(row["row_index"])
        workflow_key = str(row["workflow_key"])
        ugs_input_data = _as_dict(row.get("ugs_input_data"))
        try:
            type_key = "music_generator_generate_ace_v3" if workflow_key == "v3" else "music_generator_generate_ace_v2"
            logger.info(
                "music_batch_row_started approach_id=%s generation_id=%s row_index=%s workflow=%s",
                approach_id,
                generation_id,
                row_index,
                workflow_key,
            )
            resp = await run_studio_ugs_generate(
                ugs,
                user_id=user_id,
                type_key=type_key,
                input_data=ugs_input_data,
                idempotency_key=f"music-batch:{generation_id}:attempt:{row['attempt_count']}",
            )
            block = _unwrap_audio_block(resp)
            audio_list = block.get("audio") or []
            if not audio_list or not isinstance(audio_list[0], dict) or not audio_list[0].get("data"):
                raise RuntimeError("UGS returned no audio data")
            audio_bytes = base64.b64decode(audio_list[0]["data"])
            content = await self._save_row_content(
                content_service=content_service,
                user_id=user_id,
                approach_id=approach_id,
                generation_id=generation_id,
                row_index=row_index,
                workflow_key=workflow_key,
                genre_label=row.get("genre_label"),
                effective_params=_as_dict(row.get("effective_params")),
                request_payload=_as_dict(row.get("request_payload")),
                audio_bytes=audio_bytes,
            )
            duration_ms = int((time.monotonic() - start) * 1000)
            provider_meta = {
                "ugs_request_id": resp.get("request_id"),
                "status": resp.get("status"),
                "execution_backend": resp.get("execution_backend"),
                "duration_ms": duration_ms,
            }
            await self.db.execute(
                text(
                    """
                    UPDATE music_batch_generations
                    SET status = 'succeeded',
                        content_id = :content_id,
                        ugs_request_id = :ugs_request_id,
                        provider_meta = CAST(:provider_meta AS jsonb),
                        error_code = NULL,
                        error_message = NULL,
                        duration_ms = :duration_ms,
                        cost_credits = :cost_credits,
                        completed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = :generation_id
                    """
                ),
                {
                    "generation_id": generation_id,
                    "content_id": str(content.id),
                    "ugs_request_id": resp.get("request_id"),
                    "provider_meta": _json_dumps(provider_meta),
                    "duration_ms": duration_ms,
                    "cost_credits": batch_limits_snapshot()["cost_per_item_credits"],
                },
            )
            logger.info(
                "music_batch_row_completed approach_id=%s generation_id=%s row_index=%s duration_ms=%s",
                approach_id,
                generation_id,
                row_index,
                duration_ms,
            )
        except Exception as exc:
            should_requeue = await self._mark_row_failed_or_retrying(row, exc)
        await self._refresh_approach_progress(approach_id)
        await self.db.commit()
        return should_requeue

    async def _save_row_content(
        self,
        *,
        content_service: ContentStorageService,
        user_id: str,
        approach_id: str,
        generation_id: str,
        row_index: int,
        workflow_key: str,
        genre_label: str | None = None,
        effective_params: dict[str, Any],
        request_payload: dict[str, Any],
        audio_bytes: bytes,
    ) -> Any:
        name = f"Batch {workflow_key.upper()} #{row_index:02d}"
        metadata = {
            "music_generator_lyrics": effective_params.get("lyrics", ""),
            "music_generator_tags": effective_params.get("tags", ""),
            "music_generator_style": effective_params.get("style", "pop"),
            "music_generator_vocal": effective_params.get("vocal", "female"),
            "music_generator_language": effective_params.get("language", "ru"),
            "music_generator_bpm": effective_params.get("bpm"),
            "music_generator_duration_seconds": effective_params.get("duration_seconds"),
            "music_generator_keyscale": effective_params.get("keyscale"),
            "music_generator_timesignature": effective_params.get("timesignature"),
            "music_generator_temperature": effective_params.get("temperature"),
            "music_generator_cfg_scale": effective_params.get("cfg_scale"),
            "music_generator_top_p": effective_params.get("top_p"),
            "music_generator_top_k": effective_params.get("top_k"),
            "music_generator_min_p": effective_params.get("min_p"),
            "music_generator_steps": effective_params.get("steps"),
            "music_generator_seed_used": effective_params.get("seed"),
            "music_generator_billing_mode": "batch_test",
            "ugs_workflow": "v3" if workflow_key == "v3" else workflow_key,
            "music_batch_approach_id": approach_id,
            "music_batch_generation_id": generation_id,
            "music_batch_row_index": row_index,
            "music_batch_workflow_key": workflow_key,
            "music_batch_payload_hash": _payload_hash(request_payload),
            "music_batch_effective_params_summary": {
                key: effective_params.get(key)
                for key in (
                    "style",
                    "vocal",
                    "bpm",
                    "keyscale",
                    "temperature",
                    "cfg_scale",
                    "top_p",
                    "top_k",
                    "min_p",
                    "cfg",
                    "sampler_name",
                    "scheduler",
                    "denoise",
                    "shift",
                    "seed",
                )
                if key in effective_params
            },
        }
        _genre_lbl = (genre_label or "").strip()
        if _genre_lbl:
            metadata["music_generator_genre_label"] = _genre_lbl
        content_data = ContentCreate(
            user_id=user_id,
            name=name,
            description="Короткое демо из Batch Test / Подходы",
            content_type=ContentType.AUDIO,
            mime_type="audio/mpeg",
            sub_type="music_generator",
            original_filename=_safe_mp3_original_filename(name),
            tags=["music_generator", "music_batch_test"],
            visibility=Visibility.PRIVATE,
            source_service="music_generator",
            source_id=generation_id,
            metadata=metadata,
            company_id=None,
            project_id=None,
            title=None,
            word_count=None,
            character_count=None,
            access_level=None,
            is_public=None,
            folder_item_id=MUSIC_BATCH_SAVED_CONTENT_FOLDER_ITEM_ID,
            apply_project_desktop_folder=False,
        )
        return await content_service.create_content(
            content_data=content_data,
            file_data=audio_bytes,
            user_id=user_id,
        )

    async def _claim_next_row(self, approach_id: str, user_id: str) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                SELECT g.*, a.workflow_key, a.genre_label
                FROM music_batch_generations g
                JOIN music_batch_approaches a ON a.id = g.approach_id
                WHERE g.approach_id = :approach_id
                  AND a.user_id = :user_id
                  AND a.status IN ('queued', 'running', 'partial_failed')
                  AND g.status IN ('pending', 'retrying')
                ORDER BY g.row_index ASC
                LIMIT 1
                FOR UPDATE OF g SKIP LOCKED
                """
            ),
            {"approach_id": approach_id, "user_id": user_id},
        )
        row = result.mappings().first()
        if not row:
            return None
        data = dict(row)
        await self.db.execute(
            text(
                """
                UPDATE music_batch_approaches
                SET status = 'running',
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE id = :approach_id
                """
            ),
            {"approach_id": approach_id},
        )
        await self.db.execute(
            text(
                """
                UPDATE music_batch_generations
                SET status = 'running',
                    attempt_count = attempt_count + 1,
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE id = :generation_id
                RETURNING attempt_count
                """
            ),
            {"generation_id": str(data["id"])},
        )
        data["attempt_count"] = int(data.get("attempt_count") or 0) + 1
        await self.db.commit()
        return data

    async def _mark_row_failed_or_retrying(self, row: dict[str, Any], exc: Exception) -> bool:
        retry_max = int(batch_limits_snapshot()["row_retry_max"])
        attempt_count = int(row.get("attempt_count") or 1)
        status = "retrying" if attempt_count <= retry_max else "failed"
        raw_message = str(getattr(exc, "detail", None) or exc)
        message = raw_message[:2000]
        code = "provider_error"
        if isinstance(exc, HTTPException):
            code = f"http_{exc.status_code}"
        await self.db.execute(
            text(
                """
                UPDATE music_batch_generations
                SET status = :status,
                    error_code = :error_code,
                    error_message = :error_message,
                    completed_at = CASE WHEN :status = 'failed' THEN NOW() ELSE completed_at END,
                    updated_at = NOW()
                WHERE id = :generation_id
                """
            ),
            {
                "generation_id": str(row["id"]),
                "status": status,
                "error_code": code,
                "error_message": message,
            },
        )
        logger.warning(
            "music_batch_row_failed approach_id=%s generation_id=%s row_index=%s status=%s error=%s",
            row.get("approach_id"),
            row.get("id"),
            row.get("row_index"),
            status,
            truncate_for_log(raw_message, max_chars=500),
            exc_info=False,
        )
        return True

    async def _refresh_approach_progress(self, approach_id: str) -> None:
        result = await self.db.execute(
            text(
                """
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'succeeded')::int AS done,
                    COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                    COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
                    COUNT(*) FILTER (WHERE status IN ('pending', 'queued', 'retrying', 'running'))::int AS active
                FROM music_batch_generations
                WHERE approach_id = :approach_id
                """
            ),
            {"approach_id": approach_id},
        )
        counts = dict(result.mappings().one())
        total = int(counts["total"] or 0)
        done = int(counts["done"] or 0)
        failed = int(counts["failed"] or 0)
        cancelled = int(counts["cancelled"] or 0)
        active = int(counts["active"] or 0)
        if active == 0:
            if done == total and total > 0:
                status = "completed"
            elif done > 0 and failed + cancelled > 0:
                status = "partial_failed"
            elif cancelled == total and total > 0:
                status = "cancelled"
            else:
                status = "failed"
            completed_sql = "NOW()"
        else:
            status = "running"
            completed_sql = "completed_at"
        await self.db.execute(
            text(
                f"""
                UPDATE music_batch_approaches
                SET status = :status,
                    progress_total = :total,
                    progress_done = :done,
                    progress_failed = :failed,
                    progress_cancelled = :cancelled,
                    completed_at = {completed_sql},
                    updated_at = NOW()
                WHERE id = :approach_id
                """
            ),
            {
                "approach_id": approach_id,
                "status": status,
                "total": total,
                "done": done,
                "failed": failed,
                "cancelled": cancelled,
            },
        )

    async def _active_rows_global(self) -> int:
        return int(
            await self.db.scalar(text("SELECT COUNT(*) FROM music_batch_generations WHERE status = 'running'")) or 0
        )

    async def _active_rows_for_user(self, user_id: str) -> int:
        return int(
            await self.db.scalar(
                text(
                    """
                    SELECT COUNT(*)
                    FROM music_batch_generations g
                    JOIN music_batch_approaches a ON a.id = g.approach_id
                    WHERE a.user_id = :user_id AND g.status = 'running'
                    """
                ),
                {"user_id": user_id},
            )
            or 0
        )

    async def _sleep_before_requeue(self, limits: dict[str, Any]) -> None:
        await self.db.commit()
        delay = int(limits["requeue_delay_seconds"])
        logger.info("music_batch_backpressure delay_seconds=%s", delay)
        await asyncio.sleep(delay)

    async def _cancel_pending_for_disabled(self, approach_id: str) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_batch_generations
                SET status = 'cancelled', error_code = 'feature_disabled',
                    error_message = 'Music batch tests were disabled by operator',
                    completed_at = NOW(), updated_at = NOW()
                WHERE approach_id = :approach_id AND status IN ('pending', 'retrying')
                """
            ),
            {"approach_id": approach_id},
        )
        await self._refresh_approach_progress(approach_id)
        await self.db.commit()

    async def _get_approach_row(self, approach_id: str, user_id: str) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                SELECT *
                FROM music_batch_approaches
                WHERE id = :approach_id AND user_id = :user_id
                """
            ),
            {"approach_id": approach_id, "user_id": user_id},
        )
        row = result.mappings().first()
        return dict(row) if row else None

    def _approach_summary_from_row(self, row: dict[str, Any]) -> MusicBatchApproachSummary:
        return MusicBatchApproachSummary(
            id=row["id"],
            name=row["name"],
            status=row["status"],
            workflow_key=row["workflow_key"],
            style=row["style"],
            genre_label=row.get("genre_label"),
            demo_block_type=row["demo_block_type"],
            requested_count=int(row["requested_count"] or 0),
            duration_seconds=int(row["duration_seconds"] or 0),
            progress=MusicBatchProgress(
                total=int(row.get("progress_total") or row.get("requested_count") or 0),
                done=int(row.get("progress_done") or 0),
                failed=int(row.get("progress_failed") or 0),
                cancelled=int(row.get("progress_cancelled") or 0),
            ),
            cost_estimate=_as_dict(row.get("cost_estimate")),
            limits_snapshot=_as_dict(row.get("limits_snapshot")),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
        )

    def _generation_summary_from_row(self, row: dict[str, Any]) -> MusicBatchGenerationSummary:
        return MusicBatchGenerationSummary(
            id=row["id"],
            approach_id=row["approach_id"],
            row_index=int(row["row_index"]),
            status=row["status"],
            content_id=row.get("content_id"),
            content_name=row.get("content_name"),
            seed_used=row.get("seed_used"),
            effective_params=_as_dict(row.get("effective_params")),
            error_code=row.get("error_code"),
            error_message=row.get("error_message"),
            attempt_count=int(row.get("attempt_count") or 0),
            duration_ms=row.get("duration_ms"),
            cost_credits=float(row["cost_credits"]) if row.get("cost_credits") is not None else None,
            sample_feedback=row.get("sample_feedback"),
            sample_feedback_comment=row.get("sample_feedback_comment"),
            sample_feedback_highlights=_as_str_list(row.get("sample_feedback_highlights")),
            sample_feedback_at=row.get("sample_feedback_at"),
            created_at=row.get("created_at"),
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
        )

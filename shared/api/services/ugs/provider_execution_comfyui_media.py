# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ComfyUI image/video/image_studio and generic image_generation_comfyui branches for UGS.
# Invariants:
# - generation_type routing matches former inline branches in provider_execution_comfyui.
# - Returns None when generation_type is not a handled image/video ComfyUI type.
# Related:
# - api/services/ugs/provider_execution_comfyui.py
# - api/services/ugs/provider_manager_service_v2.py
# ---

from __future__ import annotations

import json
import logging
import secrets
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from api.routers.creative_studio_utils import build_unique_upload_filename
from api.services.image_studio.rotate_modes import STUDIO_ROTATE_OUTPUT_NODES as _STUDIO_ROTATE_OUTPUT_NODES
from api.services.ugs.provider_config_models import ProviderError

logger = logging.getLogger(__name__)

_GENERIC_IMAGE_TYPES = frozenset(
    {
        "image_generation_comfyui",
        "image_generate_sd",
        "image_style_transfer",
    }
)


def _provider_media_payload(generation_type: str, result: Any) -> dict[str, Any]:
    return {
        "provider": "comfyui",
        "generation_type": generation_type,
        "result": result,
        "timestamp": datetime.now(UTC).isoformat(),
    }


def _is_generic_image_generation_type(generation_type: str) -> bool:
    desktop_chat = isinstance(generation_type, str) and generation_type.startswith("desktop_ai_chat_image_")
    return generation_type in _GENERIC_IMAGE_TYPES or desktop_chat


async def _run_image_studio_text_to_image(
    comfy: Any, generation_type: str, input_data: dict[str, Any]
) -> dict[str, Any]:
    prompt = input_data.get("prompt", "")
    if not isinstance(prompt, str) or not prompt.strip():
        msg = "Prompt cannot be empty for image generation."
        raise ProviderError(msg)
    width = max(256, min(2048, int(input_data.get("width") or 1024)))
    height = max(256, min(2048, int(input_data.get("height") or 1024)))
    seed_raw = input_data.get("seed")
    try:
        seed_int = int(seed_raw) if seed_raw is not None else -1
    except (TypeError, ValueError):  # fmt: skip
        seed_int = -1
    # Шаблон 01_top.json (рекламный / баннерный пайплайн), выход SaveImage — узел "60"
    seed_for_workflow = None if seed_int == -1 else seed_int
    workflow = comfy.get_text_to_image_workflow(
        prompt=prompt.strip(),
        negative_prompt="",
        width=width,
        height=height,
        seed=seed_for_workflow,
        workflow_template="01_top.json",
    )
    result = await comfy.generate_image(workflow, output_node="60", timeout=300)
    return _provider_media_payload(generation_type, result)


async def _run_image_studio_image_edit(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    *,
    decode_binary_payload: Callable[..., bytes],
) -> dict[str, Any]:
    prompt = (input_data.get("prompt") or "").strip()
    if not prompt:
        msg = "prompt is required"
        raise ProviderError(msg)
    image_bytes = decode_binary_payload(input_data.get("image_base64"), field_name="image_base64")
    negative_prompt = (input_data.get("negative_prompt") or "").strip()
    seed_raw = input_data.get("seed")
    try:
        seed_int = int(seed_raw) if seed_raw is not None and str(seed_raw).strip() else -1
    except (TypeError, ValueError):  # fmt: skip
        seed_int = -1
    uploaded_name = await comfy.upload_image(
        image_bytes,
        build_unique_upload_filename(
            "input.png",
            prefix="ugs_image_edit",
            fallback_extension=".png",
        ),
    )
    workflow = comfy.get_redactor_image_edit_workflow(
        image_filename=uploaded_name,
        positive_prompt=prompt,
        negative_prompt=negative_prompt,
        seed=seed_int,
    )
    result = await comfy.generate_image(workflow, output_node="60", timeout=300)
    return _provider_media_payload(generation_type, result)


async def _run_image_studio_image_rotate(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    *,
    decode_binary_payload: Callable[..., bytes],
) -> dict[str, Any]:
    image_bytes = decode_binary_payload(input_data.get("image_base64"), field_name="image_base64")
    mode_key = (input_data.get("mode") or "angle90_right").strip() or "angle90_right"
    all_key = "all"
    if mode_key != all_key and mode_key not in _STUDIO_ROTATE_OUTPUT_NODES:
        msg = f"Invalid mode '{mode_key}' for image rotate"
        raise ProviderError(msg)
    uploaded_name = await comfy.upload_image(
        image_bytes,
        build_unique_upload_filename(
            "input.png",
            prefix="ugs_image_rotate",
            fallback_extension=".png",
        ),
    )
    workflow = comfy.get_rotate_image_workflow(uploaded_name)
    if mode_key == all_key:
        output_nodes = [node_id for node_id, _ in _STUDIO_ROTATE_OUTPUT_NODES.values()]
        result = await comfy.generate_image(workflow, output_node=output_nodes, timeout=300)
    else:
        output_node, _label = _STUDIO_ROTATE_OUTPUT_NODES[mode_key]
        result = await comfy.generate_image(workflow, output_node=output_node, timeout=300)
    return _provider_media_payload(generation_type, result)


async def _run_video_studio_image_to_video(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    *,
    decode_binary_payload: Callable[..., bytes],
) -> dict[str, Any]:
    prompt = (input_data.get("prompt") or "").strip()
    if not prompt:
        msg = "prompt is required"
        raise ProviderError(msg)
    image_bytes = decode_binary_payload(input_data.get("image_base64"), field_name="image_base64")
    negative_prompt = (input_data.get("negative_prompt") or "").strip()
    run_id = uuid4().hex[:8]
    uploaded_name = await comfy.upload_image(
        image_bytes,
        build_unique_upload_filename(
            "input.png",
            prefix="video_i2v_ugs",
            fallback_extension=".png",
        ),
    )
    workflow = comfy.get_wan_i2v_workflow(
        image_filename=uploaded_name,
        positive_prompt=prompt,
        negative_prompt=negative_prompt,
        run_id=run_id,
    )
    result = await comfy.generate_video(
        workflow,
        output_node="108",
        timeout=600,
        output_filename_prefix=f"video/Wan2.2_i2v_{run_id}",
    )
    return _provider_media_payload(generation_type, result)


async def _build_generic_image_workflow(
    comfy: Any,
    input_data: dict[str, Any],
    *,
    load_comfyui_workflow_template_json: Callable[[str], Awaitable[Any]],
    db: Any,
) -> Any:
    workflow = input_data.get("workflow")
    if workflow:
        return workflow

    from .runtime_settings_service import UGSRuntimeSettingsService

    prompt = input_data.get("prompt", "")
    # Validate prompt: prompt must not be empty for image generation
    if not isinstance(prompt, str) or not prompt.strip():
        msg = "Prompt cannot be empty for image generation. Please provide a valid text prompt."
        raise ProviderError(msg)
    negative_prompt = input_data.get("negative_prompt", "")
    cfg = input_data.get("cfg_scale", 7.0)
    steps = input_data.get("steps", 20)
    width = input_data.get("width", 1024)
    height = input_data.get("height", 1024)
    seed = input_data.get("seed")

    workflow_template = input_data.get("workflow_template") or input_data.get("workflow_key")
    legacy_type = str(input_data.get("workflow_type") or "").strip().lower()
    if not workflow_template and legacy_type in ("text2img", "txt2img"):
        workflow_template = "text_to_image"

    runtime_settings = UGSRuntimeSettingsService(db)
    if not workflow_template:
        workflow_template = await runtime_settings.get_comfyui_default_workflow_slug()
    if not workflow_template:
        workflow_template = "text_to_image"

    slug_norm = str(workflow_template).strip().removesuffix(".json")

    # Repo comfyui/text_to_image.json (z-image-turbo): always build via provider helper,
    # not DB create_workflow_from_template (avoids wrong CLIP pairing / stale stored JSON).
    if slug_norm == "text_to_image":
        max_seed_value = 2**31 - 1
        if seed is None or seed == -1:
            seed = secrets.randbelow(max_seed_value) + 1
        logger.info(
            "ComfyUI: text_to_image.json (z-image-turbo), prompt='%s...', size=%sx%s, seed=%s",
            (prompt[:50] + "..." if len(prompt) > 50 else prompt),
            width,
            height,
            seed,
        )
        return comfy.get_text_to_image_z_turbo_workflow(
            prompt=prompt,
            width=width,
            height=height,
            seed=seed,
        )

    if workflow_template:
        db_workflow = await load_comfyui_workflow_template_json(str(workflow_template))
        if db_workflow:
            comfy.register_workflow_template(str(workflow_template), db_workflow)
            workflow = comfy.create_workflow_from_template(
                str(workflow_template),
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
                steps=steps,
                cfg_scale=cfg,
                seed=seed,
                model=input_data.get("model"),
            )
        else:
            slug = str(workflow_template).strip().removesuffix(".json")
            try:
                workflow = comfy.create_workflow_from_template(
                    slug,
                    prompt=prompt,
                    negative_prompt=negative_prompt,
                    width=width,
                    height=height,
                    steps=steps,
                    cfg_scale=cfg,
                    seed=seed,
                    model=input_data.get("model"),
                )
                logger.info(
                    "ComfyUI: using filesystem workflow template '%s' (not in comfyui_workflows)",
                    slug,
                )
            except (
                FileNotFoundError,
                OSError,
                json.JSONDecodeError,
                ValueError,
                TypeError,
            ) as disk_err:
                logger.warning(
                    "ComfyUI: could not load workflow template '%s' from DB or disk: %s",
                    workflow_template,
                    disk_err,
                )
                workflow = None

        if workflow is not None:
            logger.info(
                "ComfyUI: using workflow template '%s' (DB or disk)",
                workflow_template,
            )

    if workflow is not None:
        return workflow

    # SDXL-style workflow (4kimage.json etc.): checkpoint + resolve
    cfg_from_input = input_data.get("cfg_scale")
    steps_from_input = input_data.get("steps")
    width_from_input = input_data.get("width")
    height_from_input = input_data.get("height")
    seed_from_input = input_data.get("seed")
    logger.info(
        "ComfyUI input_data extraction: cfg_scale=%s (from input: %s), steps=%s (from input: %s), "
        "width=%s (from input: %s), height=%s (from input: %s), seed=%s (from input: %s)",
        cfg,
        cfg_from_input,
        steps,
        steps_from_input,
        width,
        width_from_input,
        height,
        height_from_input,
        seed,
        seed_from_input,
    )
    max_seed_value = 2**31 - 1
    if seed is None or seed == -1:
        seed = secrets.randbelow(max_seed_value) + 1
        logger.debug("ComfyUI: Generated random seed: %s", seed)
    resolved_model = await comfy.resolve_checkpoint_name(input_data.get("model"))
    prompt_preview = prompt[:50] if len(prompt) > 50 else prompt
    negative_preview = (
        (negative_prompt[:30] if len(negative_prompt) > 30 else negative_prompt) if negative_prompt else "none"
    )
    logger.info(
        "ComfyUI generation params: prompt='%s...', negative='%s...', seed=%s, steps=%s, cfg=%s, "
        "size=%sx%s, model=%s, workflow_template=%s",
        prompt_preview,
        negative_preview,
        seed,
        steps,
        cfg,
        width,
        height,
        resolved_model,
        workflow_template,
    )
    return comfy.get_text_to_image_workflow(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        steps=steps,
        cfg_scale=cfg,
        model=resolved_model,
        seed=seed,
        workflow_template=workflow_template,
    )


async def _run_generic_image_generation(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    *,
    load_comfyui_workflow_template_json: Callable[[str], Awaitable[Any]],
    db: Any,
) -> dict[str, Any]:
    workflow = await _build_generic_image_workflow(
        comfy,
        input_data,
        load_comfyui_workflow_template_json=load_comfyui_workflow_template_json,
        db=db,
    )
    result = await comfy.generate_image(workflow=workflow)
    return _provider_media_payload(generation_type, result)


async def _run_image_upscale_4k(comfy: Any, generation_type: str, input_data: dict[str, Any]) -> dict[str, Any]:
    workflow = input_data.get("workflow")
    if not workflow:
        msg = "Upscale workflow must be provided for ComfyUI"
        raise ProviderError(msg)
    result = await comfy.generate_image(workflow=workflow)
    return _provider_media_payload(generation_type, result)


async def execute_comfyui_media_generation(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    *,
    decode_binary_payload: Callable[..., bytes],
    load_comfyui_workflow_template_json: Callable[[str], Awaitable[Any]],
    db: Any,
) -> dict[str, Any] | None:
    """Run image studio / video / generic image / upscale ComfyUI branches.

    Returns the same provider payload dict shape as the former inline mixin
    branches, or None when ``generation_type`` is not handled here.
    """
    if generation_type == "image_studio_text_to_image":
        return await _run_image_studio_text_to_image(comfy, generation_type, input_data)
    if generation_type == "image_studio_image_edit":
        return await _run_image_studio_image_edit(
            comfy,
            generation_type,
            input_data,
            decode_binary_payload=decode_binary_payload,
        )
    if generation_type == "image_studio_image_rotate":
        return await _run_image_studio_image_rotate(
            comfy,
            generation_type,
            input_data,
            decode_binary_payload=decode_binary_payload,
        )
    if generation_type == "video_studio_image_to_video":
        return await _run_video_studio_image_to_video(
            comfy,
            generation_type,
            input_data,
            decode_binary_payload=decode_binary_payload,
        )
    if _is_generic_image_generation_type(generation_type):
        return await _run_generic_image_generation(
            comfy,
            generation_type,
            input_data,
            load_comfyui_workflow_template_json=load_comfyui_workflow_template_json,
            db=db,
        )
    if generation_type == "image_upscale_4k":
        return await _run_image_upscale_4k(comfy, generation_type, input_data)
    return None

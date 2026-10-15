# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ComfyUI music/ACE/DiffRhythm/m2m audio generation branches for UGS provider execution.
# Invariants:
# - generation_type routing matches former inline branches in provider_execution_comfyui.
# - Returns None when generation_type is not a handled music ComfyUI type.
# Related:
# - api/services/ugs/provider_execution_comfyui.py
# - api/services/ugs/provider_manager_service_v2.py
# ---

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from api.routers.creative_studio_utils import build_unique_upload_filename
from api.services.music_generator_xl_base_pipeline import (
    build_xl_base_output_observability,
    merge_xl_base_observability_into_result_metadata,
)
from api.services.studio_comfy_workflows import (
    build_ace_music_v3_workflow,
    build_ace_music_v5_big_xl_sft_workflow,
    build_diffrhythm_music_workflow,
    build_m2m_edit_workflow,
    resolve_ace_v2_workflow_flag,
)
from api.services.ugs.provider_config_models import ProviderError

_ACE_FAMILY_TYPES = frozenset(
    {
        "music_generator_generate_ace",
        "music_generator_generate_ace_wizard",
        "music_generator_generate_ace_professional",
        "music_generator_generate_ace_v2",
        "music_generator_generate_ace_v2_base_companion",
        "music_generator_evolution_xl_base",
        "music_generator_forge_audio",
        "music_generator_forge_ace15_mvp",
        "music_generator_generate_ace_chaotic",
    }
)

_DIFFRHYTHM_TYPES = frozenset(
    {
        "music_generator_generate_diffrhythm",
        "music_generator_generate_diffrhythm_wizard",
        "music_generator_generate_diffrhythm_professional",
    }
)

_COMFYUI_MUSIC_GENERATION_TYPES = frozenset(
    {
        *_ACE_FAMILY_TYPES,
        "music_generator_generate_ace_v3",
        "music_generator_generate_ace_v5",
        "music_generator_generate_ace_v4",
        *_DIFFRHYTHM_TYPES,
        "music_generator_edit",
    }
)


def is_comfyui_music_generation_type(generation_type: str) -> bool:
    return generation_type in _COMFYUI_MUSIC_GENERATION_TYPES


def _provider_audio_payload(generation_type: str, result: Any, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "provider": "comfyui",
        "generation_type": generation_type,
        "result": result,
        "timestamp": datetime.now(UTC).isoformat(),
    }
    payload.update(extra)
    return payload


async def _execute_v4_sft_comfy(
    comfy: Any,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    from api.services.ace_audio_stitch import crossfade_concat_mp3_b64, polish_track_tail_mp3_b64
    from api.services.studio_comfy_workflows import (
        ACE_V4_SFT_FINAL_CHUNK_CROSSFADE_SECONDS,
        ACE_V4_SFT_LONG_FORM_CROSSFADE_SECONDS,
        ACE_V4_SFT_TAIL_POLISH_FADE_SECONDS,
        plan_v4_sft_chunk_durations,
        v4_sft_long_form_enabled,
    )
    from api.services.ugs import provider_manager_service_v2 as _pms_v2

    build_ace_music_v4_sft_workflow = _pms_v2.build_ace_music_v4_sft_workflow
    try:
        total_duration = float(input_data.get("duration_seconds") or 120)
    except (TypeError, ValueError):  # fmt: skip
        total_duration = 120.0
    chunk_durations = plan_v4_sft_chunk_durations(total_duration) if v4_sft_long_form_enabled() else [total_duration]
    if len(chunk_durations) <= 1:
        single_input = dict(input_data)
        if total_duration >= 90.0:
            single_input["v4_is_final_chunk"] = True
        workflow, out_node = build_ace_music_v4_sft_workflow(single_input)
        result = await comfy.generate_audio(
            workflow,
            output_node=out_node,
            timeout=music_timeout_seconds,
        )
        if total_duration >= 90.0:
            from api.services.ace_audio_stitch import polish_track_tail_mp3_b64
            from api.services.studio_comfy_workflows import ACE_V4_SFT_TAIL_POLISH_FADE_SECONDS

            audio_list = result.get("audio") or []
            if audio_list and audio_list[0].get("data"):
                audio_list[0]["data"] = polish_track_tail_mp3_b64(
                    str(audio_list[0]["data"]),
                    tail_fade_sec=ACE_V4_SFT_TAIL_POLISH_FADE_SECONDS,
                )
        return result

    stitched_b64: list[str] = []
    offset_sec = 0.0
    crossfade = ACE_V4_SFT_LONG_FORM_CROSSFADE_SECONDS
    last_result: dict[str, Any] | None = None
    chunk_total = len(chunk_durations)
    for chunk_index, chunk_duration in enumerate(chunk_durations):
        is_final_chunk = chunk_index == chunk_total - 1
        chunk_input = {
            **input_data,
            "duration_seconds": int(round(chunk_duration)),
            "v4_chunk_index": chunk_index,
            "v4_chunk_count": chunk_total,
            "v4_is_final_chunk": is_final_chunk,
            "v4_chunk_offset_sec": int(round(offset_sec)) if chunk_index > 0 else 0,
        }
        workflow, out_node = build_ace_music_v4_sft_workflow(chunk_input)
        chunk_timeout = max(music_timeout_seconds, int(chunk_duration) * 8)
        chunk_result = await comfy.generate_audio(
            workflow,
            output_node=out_node,
            timeout=chunk_timeout,
        )
        audio_list = chunk_result.get("audio") or []
        if not audio_list or not audio_list[0].get("data"):
            msg = f"v4 SFT chunk {chunk_index + 1}/{len(chunk_durations)} returned no audio"
            raise ProviderError(msg)
        stitched_b64.append(str(audio_list[0]["data"]))
        last_result = chunk_result
        if chunk_index < len(chunk_durations) - 1:
            offset_sec += max(0.0, chunk_duration - crossfade)

    boundary_crossfades = [crossfade] * max(0, chunk_total - 1)
    if boundary_crossfades:
        boundary_crossfades[-1] = ACE_V4_SFT_FINAL_CHUNK_CROSSFADE_SECONDS
    merged_b64 = crossfade_concat_mp3_b64(
        stitched_b64,
        crossfade_sec=crossfade,
        crossfade_secs=boundary_crossfades,
    )
    merged_b64 = polish_track_tail_mp3_b64(
        merged_b64,
        tail_fade_sec=ACE_V4_SFT_TAIL_POLISH_FADE_SECONDS,
    )
    assert last_result is not None
    merged = dict(last_result)
    audio_list = list(merged.get("audio") or [])
    if audio_list:
        audio_list[0] = {**audio_list[0], "data": merged_b64}
    else:
        audio_list = [{"data": merged_b64, "filename": "ACE_V4_sft_stitched.mp3", "subfolder": ""}]
    merged["audio"] = audio_list
    metadata = dict(merged.get("metadata") or {})
    metadata["v4_long_form_chunks"] = len(chunk_durations)
    metadata["v4_long_form_chunk_durations"] = chunk_durations
    merged["metadata"] = metadata
    return merged


async def _run_ace_family(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    from api.services.ugs import provider_manager_service_v2 as _pms_v2

    build_ace_music_workflow = _pms_v2.build_ace_music_workflow
    build_music_forge_ace15_mvp_workflow = _pms_v2.build_music_forge_ace15_mvp_workflow

    try:
        if generation_type == "music_generator_forge_ace15_mvp":
            workflow, out_node = build_music_forge_ace15_mvp_workflow(input_data)
        elif generation_type in (
            "music_generator_evolution_xl_base",
            "music_generator_forge_audio",
        ):
            evolution_workflow = str(
                input_data.get("ugs_workflow") or input_data.get("ace_workflow") or "v2_base"
            ).strip()
            if evolution_workflow == "v5":
                workflow, out_node = build_ace_music_v5_big_xl_sft_workflow(input_data)
            elif evolution_workflow in {"v4", "v4_luna"}:
                result = await _execute_v4_sft_comfy(comfy, input_data, music_timeout_seconds)
                return _provider_audio_payload(generation_type, result)
            else:
                workflow, out_node = build_ace_music_workflow(input_data)
        else:
            workflow, out_node = build_ace_music_workflow(input_data)
    except (FileNotFoundError, OSError, ValueError, TypeError) as e:
        raise ProviderError(str(e)) from e
    if generation_type == "music_generator_evolution_xl_base":
        from api.services.music_evolution_debug_io import save_music_evolution_comfy_prompt

        evolution_run_id = str(input_data.get("music_evolution_run_id") or "").strip()
        if evolution_run_id:
            save_music_evolution_comfy_prompt(
                run_id=evolution_run_id,
                workflow=workflow,
                input_data=dict(input_data),
                generation_type=generation_type,
            )
    xl_obs: dict[str, Any] = {}
    if resolve_ace_v2_workflow_flag(input_data) == "v2_base":
        xl_obs = build_xl_base_output_observability(input_data, workflow)
    result = await comfy.generate_audio(
        workflow,
        output_node=out_node,
        timeout=music_timeout_seconds,
    )
    if xl_obs:
        merge_xl_base_observability_into_result_metadata(result, xl_obs)
    provider_payload = _provider_audio_payload(generation_type, result)
    if xl_obs:
        provider_payload["metadata"] = dict(xl_obs)
        provider_payload["xl_base"] = dict(xl_obs)
    return provider_payload


async def _run_ace_v3(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    try:
        workflow, out_node = build_ace_music_v3_workflow(input_data)
    except (FileNotFoundError, OSError, ValueError, TypeError) as e:
        raise ProviderError(str(e)) from e
    result = await comfy.generate_audio(
        workflow,
        output_node=out_node,
        timeout=music_timeout_seconds,
    )
    return _provider_audio_payload(generation_type, result)


async def _run_ace_v5(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    try:
        workflow, out_node = build_ace_music_v5_big_xl_sft_workflow(input_data)
    except (FileNotFoundError, OSError, ValueError, TypeError) as e:
        raise ProviderError(str(e)) from e
    v5_timeout_seconds = max(music_timeout_seconds, 1800)
    result = await comfy.generate_audio(
        workflow,
        output_node=out_node,
        timeout=v5_timeout_seconds,
    )
    return _provider_audio_payload(generation_type, result)


async def _run_ace_v4(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    try:
        result = await _execute_v4_sft_comfy(comfy, input_data, music_timeout_seconds)
    except (FileNotFoundError, OSError, ValueError, TypeError, RuntimeError) as e:
        raise ProviderError(str(e)) from e
    return _provider_audio_payload(generation_type, result)


async def _run_diffrhythm(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
) -> dict[str, Any]:
    try:
        workflow, out_node = build_diffrhythm_music_workflow(input_data)
    except (FileNotFoundError, OSError, ValueError, TypeError) as e:
        raise ProviderError(str(e)) from e
    try:
        result = await comfy.generate_audio(
            workflow,
            output_node=out_node,
            timeout=music_timeout_seconds,
        )
    except Exception as e:
        err_str = str(e)
        if "missing_node_type" in err_str or "MultiLineLyricsDR" in err_str:
            msg = (
                "Альтернативный режим генерации музыки недоступен на сервере. "
                "Выберите стандартный режим или обратитесь к администратору."
            )
            raise ProviderError(msg) from e
        raise
    return _provider_audio_payload(generation_type, result)


async def _run_m2m_edit(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
    *,
    decode_binary_payload: Callable[..., bytes],
) -> dict[str, Any]:
    audio_bytes = decode_binary_payload(
        input_data.get("audio_base64"),
        field_name="audio_base64",
    )
    uploaded_audio_name = await comfy.upload_audio(
        audio_bytes,
        build_unique_upload_filename(
            "source.mp3",
            prefix="ugs_m2m",
            fallback_extension=".mp3",
        ),
    )
    try:
        workflow, out_node = build_m2m_edit_workflow(
            input_data,
            audio_filename=uploaded_audio_name,
        )
    except (FileNotFoundError, OSError, ValueError, TypeError) as e:
        raise ProviderError(str(e)) from e
    result = await comfy.generate_audio(
        workflow,
        output_node=out_node,
        timeout=music_timeout_seconds,
    )
    return _provider_audio_payload(generation_type, result)


async def execute_comfyui_music_generation(
    comfy: Any,
    generation_type: str,
    input_data: dict[str, Any],
    music_timeout_seconds: int,
    *,
    decode_binary_payload: Callable[..., bytes],
) -> dict[str, Any] | None:
    """Run ACE / DiffRhythm / m2m ComfyUI audio branches.

    Returns the same provider payload dict shape as the former inline mixin
    branches, or None when ``generation_type`` is not handled here.
    """
    if generation_type in _ACE_FAMILY_TYPES:
        return await _run_ace_family(comfy, generation_type, input_data, music_timeout_seconds)
    if generation_type == "music_generator_generate_ace_v3":
        return await _run_ace_v3(comfy, generation_type, input_data, music_timeout_seconds)
    if generation_type == "music_generator_generate_ace_v5":
        return await _run_ace_v5(comfy, generation_type, input_data, music_timeout_seconds)
    if generation_type == "music_generator_generate_ace_v4":
        return await _run_ace_v4(comfy, generation_type, input_data, music_timeout_seconds)
    if generation_type in _DIFFRHYTHM_TYPES:
        return await _run_diffrhythm(comfy, generation_type, input_data, music_timeout_seconds)
    if generation_type == "music_generator_edit":
        return await _run_m2m_edit(
            comfy,
            generation_type,
            input_data,
            music_timeout_seconds,
            decode_binary_payload=decode_binary_payload,
        )
    return None

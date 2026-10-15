# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Closed stage-type handlers for MusicForge PipelineInterpreter (Wave B).
# Invariants:
# - Only ALLOWED_STAGE_TYPES are dispatched; settings drive UGS keys / lane refs.
# Related:
# - api/services/music_forge/pipeline_interpreter.py
# - api/services/music_forge/config/stage_types.py
# ---
"""Stage-type handlers for the MusicForge pipeline interpreter."""

from __future__ import annotations

import base64
import logging
import re
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text

from api.routers.creative_studio_utils import run_studio_ugs_generate
from api.routers.music_generator_tag_finalize import normalize_vocal_token_in_tags
from api.schemas.unified_content import ContentCreate, ContentType, Visibility
from api.services.music_forge.algorithm import (
    MUSIC_FORGE_AUDIO_TYPE_KEY,
    MUSIC_FORGE_BLUEPRINT_TYPE_KEY,
    MUSIC_FORGE_LYRICS_TYPE_KEY,
    MUSIC_FORGE_STYLE_TYPE_KEY,
    align_style_caption_to_vocal,
    build_audio_input_data,
    build_blueprint_messages,
    build_content_metadata,
    build_lyrics_messages,
    build_style_capsule,
    build_style_messages,
    enrich_music_forge_lyrics_for_ace,
    infer_music_forge_style_key,
    parse_song_blueprint,
    resolve_music_forge_vocal,
    slim_ace_style_caption,
    validate_and_repair_lyrics,
)
from api.services.music_forge.algorithm.audio import (
    music_forge_version_for_lane,
    resolve_ace_sample_fields,
    resolve_comfy_sampler_fields,
)
from api.services.music_forge.algorithm.lyrics_craft import (
    LYRICS_CRAFT_FAIL_CODES,
    lyrics_rewrite_notes,
)
from api.services.music_forge.corpus import collect_music_forge_corpus
from api.services.music_forge.pipeline_context import MusicForgePipelineContext
from api.services.music_forge.pipeline_mode import resolve_mode_for_intent
from api.services.music_forge.pipeline_repository import _json_param, _uuid
from api.services.music_generator_xl_base_pipeline import (
    build_xl_base_input_observability,
    prepare_xl_base_lyrics_for_comfy,
    prepare_xl_base_tags_for_comfy,
    stamp_xl_base_observability_on_input_data,
)
from api.utils.llm_json_extract import strip_llm_thinking_prefix

logger = logging.getLogger(__name__)

StageHandler = Callable[[MusicForgePipelineContext, dict[str, Any]], Awaitable[dict[str, Any]]]


def _safe_mp3_filename(name: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9а-яА-ЯёЁ._ -]+", "_", (name or "music-forge").strip()).strip(" ._-")
    return f"{(stem or 'music-forge')[:80]}.mp3"


def _text_from_ugs_result(ugs_result: dict[str, Any]) -> str:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict):
        if isinstance(block.get("result"), dict):
            inner = block["result"]
            return str(inner.get("text") or inner.get("content") or inner.get("response") or "").strip()
        return str(block.get("text") or block.get("content") or block.get("response") or "").strip()
    return ""


def _plain_text_from_ugs_llm_result(ugs_result: dict[str, Any]) -> str:
    return strip_llm_thinking_prefix(_text_from_ugs_result(ugs_result))


def _unwrap_audio_block(ugs_result: dict[str, Any]) -> dict[str, Any]:
    block = ugs_result.get("result") or {}
    if isinstance(block, dict) and "audio" not in block and isinstance(block.get("result"), dict):
        inner = block.get("result")
        if isinstance(inner, dict) and "audio" in inner:
            return inner
    return block if isinstance(block, dict) else {}


def extract_ugs_request_id(ugs_result: dict[str, Any]) -> UUID | None:
    candidates: list[Any] = [ugs_result.get("request_id"), ugs_result.get("id")]
    metadata = ugs_result.get("metadata")
    if isinstance(metadata, dict):
        candidates.extend((metadata.get("request_id"), metadata.get("generation_request_id")))
        lifecycle = metadata.get("lifecycle")
        if isinstance(lifecycle, dict):
            candidates.extend((lifecycle.get("request_id"), lifecycle.get("generation_request_id")))
    result = ugs_result.get("result")
    if isinstance(result, dict):
        candidates.extend((result.get("request_id"), result.get("generation_request_id")))
    for candidate in candidates:
        parsed = _uuid(candidate)
        if parsed is not None:
            return parsed
    return None


async def handle_intent_normalize(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    use_corpus = bool(settings.get("corpus", True))
    corpus = (
        await collect_music_forge_corpus(ctx.db, user_id=ctx.user_id, intent=ctx.intent)
        if use_corpus
        else {"selected_count": 0}
    )
    mode, model_lane, _stages = resolve_mode_for_intent(ctx.config, ctx.intent, corpus=corpus)
    ctx.corpus = corpus
    ctx.mode = mode
    ctx.model_lane = model_lane
    lane_name = model_lane.get("lane") or model_lane.get("lane_key")
    # Overwrite provisional create-time lane/version (normalize hardcodes SFT) with Mode lane.
    ctx.intent = {
        **ctx.intent,
        "lane": lane_name,
        "model_lane": lane_name,
        "mode_key": mode.get("mode_key"),
        "version": music_forge_version_for_lane(model_lane),
        "corpus_selected_count": int(corpus.get("selected_count") or 0),
    }
    await ctx.repo._persist_json(ctx.run_id, "normalized_input", ctx.intent)
    return {
        "normalized_input": ctx.intent,
        "model_lane": ctx.intent["model_lane"],
        "mode_key": ctx.intent["mode_key"],
        "corpus_selected_count": ctx.intent["corpus_selected_count"],
    }


async def handle_llm_generate(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    prompt_kind = str(settings.get("prompt_kind") or "").strip()
    ugs_type_key = str(settings.get("ugs_type_key") or "").strip()
    persist_field = str(settings.get("persist_field") or "").strip()
    temperature = float(settings.get("temperature") if settings.get("temperature") is not None else 0.7)
    json_format = bool(settings.get("json_format", False))

    if prompt_kind == "blueprint" or ugs_type_key == MUSIC_FORGE_BLUEPRINT_TYPE_KEY:
        messages = build_blueprint_messages(ctx.intent, corpus=ctx.corpus, config=ctx.config)
        ugs_type_key = ugs_type_key or MUSIC_FORGE_BLUEPRINT_TYPE_KEY
        persist_field = persist_field or "song_blueprint"
        json_format = True if "json_format" not in settings else json_format
    elif prompt_kind == "lyrics" or ugs_type_key == MUSIC_FORGE_LYRICS_TYPE_KEY:
        messages = build_lyrics_messages(ctx.intent, ctx.blueprint, config=ctx.config, corpus=ctx.corpus)
        ugs_type_key = ugs_type_key or MUSIC_FORGE_LYRICS_TYPE_KEY
        persist_field = persist_field or "lyrics_raw"
    elif prompt_kind == "style" or ugs_type_key == MUSIC_FORGE_STYLE_TYPE_KEY:
        messages = build_style_messages(ctx.intent, ctx.blueprint, ctx.lyrics, config=ctx.config)
        ugs_type_key = ugs_type_key or MUSIC_FORGE_STYLE_TYPE_KEY
        persist_field = persist_field or "style_raw"
    else:
        raise ValueError(f"music_forge_llm_generate_unsupported:{prompt_kind or ugs_type_key}")

    input_data: dict[str, Any] = {
        "messages": messages,
        "options": {"temperature": temperature},
    }
    if json_format:
        input_data["json_format"] = True
    resp = await run_studio_ugs_generate(
        ctx.ugs,
        user_id=ctx.user_id,
        type_key=ugs_type_key,
        input_data=input_data,
    )
    text_out = _plain_text_from_ugs_llm_result(resp)

    if persist_field == "song_blueprint":
        ctx.blueprint = parse_song_blueprint(text_out, ctx.intent)
        await ctx.repo._persist_json(ctx.run_id, "song_blueprint", ctx.blueprint)
        return dict(ctx.blueprint)
    if persist_field == "lyrics_raw":
        ctx.lyrics_raw = text_out
        return {"chars": len(text_out), "preview": text_out[:700]}
    if persist_field == "style_raw":
        return {"chars": len(text_out), "preview": text_out[:700], "style_raw": text_out}

    return {"chars": len(text_out), "preview": text_out[:700], "persist_field": persist_field}


async def handle_lyrics_gate(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    fail_on = settings.get("fail_on")
    fail_codes = (
        {str(x) for x in fail_on}
        if isinstance(fail_on, list)
        else {"empty_lyrics", "json_leak", "missing_sections", "stack_leak"}
    )
    fail_codes |= LYRICS_CRAFT_FAIL_CODES
    retry_once = bool(settings.get("retry_once", True))
    lyrics_payload = validate_and_repair_lyrics(ctx.lyrics_raw, ctx.intent, ctx.blueprint)
    errors = [str(e) for e in (lyrics_payload.get("errors") or [])]
    blocking = sorted(fail_codes.intersection(errors))
    retried = False
    retry_resolved = False
    if blocking and retry_once:
        retried = True
        logger.info(
            "[STEP] music_forge_lyrics_gate_retry codes=%s run_id=%s",
            ",".join(blocking),
            ctx.run_id,
        )
        from api.services.music_forge.observability import music_forge_metric_inc

        await music_forge_metric_inc(
            "lyrics_gate_retry",
            code=blocking[0] if len(blocking) == 1 else "multi",
        )
        messages = build_lyrics_messages(
            ctx.intent,
            ctx.blueprint,
            config=ctx.config,
            corpus=ctx.corpus,
            rewrite_notes=lyrics_rewrite_notes(blocking),
        )
        resp = await run_studio_ugs_generate(
            ctx.ugs,
            user_id=ctx.user_id,
            type_key=MUSIC_FORGE_LYRICS_TYPE_KEY,
            input_data={
                "messages": messages,
                "options": {"temperature": 0.72},
            },
        )
        ctx.lyrics_raw = _plain_text_from_ugs_llm_result(resp)
        lyrics_payload = validate_and_repair_lyrics(ctx.lyrics_raw, ctx.intent, ctx.blueprint)
        errors = [str(e) for e in (lyrics_payload.get("errors") or [])]
        blocking = sorted(fail_codes.intersection(errors))
        if blocking:
            await music_forge_metric_inc(
                "lyrics_gate_retry_fail",
                code=blocking[0] if len(blocking) == 1 else "multi",
            )
        else:
            retry_resolved = True
            await music_forge_metric_inc("lyrics_gate_retry_ok")
    for code in blocking:
        raise ValueError(f"music_forge_lyrics_invalid:{code}")
    ctx.lyrics = str(lyrics_payload["lyrics"])
    ctx.lyrics_payload = lyrics_payload
    await ctx.repo._persist_json(ctx.run_id, "lyrics_payload", lyrics_payload)
    craft_codes = sorted(set(errors).intersection(LYRICS_CRAFT_FAIL_CODES))
    return {
        "ok": True,
        "errors": errors,
        "craft_codes": craft_codes,
        "retried": retried,
        "retry_resolved": retry_resolved,
    }


async def handle_style_build(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    temperature = float(settings.get("temperature") if settings.get("temperature") is not None else 0.58)
    ugs_type_key = str(settings.get("ugs_type_key") or MUSIC_FORGE_STYLE_TYPE_KEY)
    style_input = {
        "messages": build_style_messages(ctx.intent, ctx.blueprint, ctx.lyrics, config=ctx.config),
        "options": {"temperature": temperature},
    }
    style_resp = await run_studio_ugs_generate(
        ctx.ugs,
        user_id=ctx.user_id,
        type_key=ugs_type_key,
        input_data=style_input,
    )
    style_capsule = build_style_capsule(
        _plain_text_from_ugs_llm_result(style_resp),
        ctx.intent,
        ctx.blueprint,
        config=ctx.config,
    )
    style_key_early = str(style_capsule.get("style_key") or infer_music_forge_style_key(ctx.intent, ctx.blueprint))
    vocal = resolve_music_forge_vocal(
        ctx.intent,
        ctx.blueprint,
        ctx.corpus,
        style_caption=str(style_capsule.get("caption") or ""),
        style_key=style_key_early,
    )
    style_capsule["vocal"] = vocal
    style_capsule["style_key"] = style_key_early
    style_capsule["caption"] = align_style_caption_to_vocal(str(style_capsule.get("caption") or ""), vocal)
    style_capsule["caption"] = slim_ace_style_caption(str(style_capsule.get("caption") or ""))
    # Stamp lane.sampler ACE/KSampler knobs so inspector matches Comfy payload precedence.
    style_capsule.update(resolve_ace_sample_fields(model_lane=ctx.model_lane, style_capsule=style_capsule))
    style_capsule.update(resolve_comfy_sampler_fields(model_lane=ctx.model_lane, style_capsule=style_capsule))
    ctx.style_capsule = style_capsule
    await ctx.repo._persist_json(ctx.run_id, "style_capsule", style_capsule)
    return style_capsule


async def _enrich_lyrics_inplace(ctx: MusicForgePipelineContext) -> None:
    vocal = str(ctx.style_capsule.get("vocal") or "female")
    if vocal not in {"male", "female", "duet"}:
        vocal = "female"
        ctx.style_capsule["vocal"] = vocal
    style_key = str(ctx.style_capsule.get("style_key") or "pop")
    bpm_i = int(ctx.style_capsule["bpm"])
    enrich_seed = abs(hash(f"{ctx.run_id}:{style_key}:{vocal}")) % (10**9)
    lyrics = enrich_music_forge_lyrics_for_ace(
        ctx.lyrics,
        vocal=vocal,
        style_key=style_key,
        bpm=bpm_i,
        seed=enrich_seed,
        structure_prepare=True,
    )
    lyrics = prepare_xl_base_lyrics_for_comfy(
        lyrics,
        language=str(ctx.intent["language"]),
        strict=True,
    )
    lyrics = enrich_music_forge_lyrics_for_ace(
        lyrics,
        vocal=vocal,
        style_key=style_key,
        bpm=bpm_i,
        seed=enrich_seed + 1,
        structure_prepare=False,
    )
    from api.routers.music_lyrics_validation import coerce_enriched_arrangement_bpm_lines

    ctx.lyrics = coerce_enriched_arrangement_bpm_lines(lyrics, bpm_i)
    ctx.lyrics_enriched = True


async def handle_lyrics_enrich(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    del settings  # structure_prepare reserved for future toggles
    await _enrich_lyrics_inplace(ctx)
    return {"chars": len(ctx.lyrics), "enriched": True}


async def handle_audio_comfy(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    if not ctx.lyrics_enriched:
        await _enrich_lyrics_inplace(ctx)
    lane_key = str(settings.get("lane_key") or ctx.mode.get("lane_key") or "")
    if lane_key and lane_key in ctx.config.lanes:
        ctx.model_lane = dict(ctx.config.lanes[lane_key])
    vocal = str(ctx.style_capsule.get("vocal") or "female")
    style_key = str(ctx.style_capsule.get("style_key") or "pop")
    bpm_i = int(ctx.style_capsule["bpm"])
    from api.services.music_evolution_vocal import capitalize_ace_section_tags_in_style

    tags = prepare_xl_base_tags_for_comfy(
        ctx.style_capsule["caption"],
        style_key=style_key,
        bpm_hint=bpm_i,
        ace_workflow=str(ctx.model_lane["ace_workflow"]),
    )
    tags = capitalize_ace_section_tags_in_style(tags)
    tags = normalize_vocal_token_in_tags(tags, vocal)
    ctx.style_capsule["caption"] = tags
    ctx.style_capsule = {**ctx.style_capsule, "vocal": vocal, "style_key": style_key}
    audio_input = build_audio_input_data(
        run_id=ctx.run_id,
        intent=ctx.intent,
        blueprint=ctx.blueprint,
        lyrics=ctx.lyrics,
        tags=tags,
        style_capsule=ctx.style_capsule,
        model_lane=ctx.model_lane,
        corpus=ctx.corpus,
    )
    xl_obs = build_xl_base_input_observability(ctx.lyrics, tags, language=str(ctx.intent["language"]))
    stamp_xl_base_observability_on_input_data(audio_input, xl_obs)
    ctx.audio_input = audio_input
    await ctx.repo._persist_json(ctx.run_id, "render_payload", {"input_data": audio_input})
    audio_type = str(ctx.config.product.get("audio_type_key") or MUSIC_FORGE_AUDIO_TYPE_KEY)
    audio_resp = await run_studio_ugs_generate(
        ctx.ugs,
        user_id=ctx.user_id,
        type_key=audio_type,
        input_data=audio_input,
    )
    ugs_request_id = extract_ugs_request_id(audio_resp) or await ctx.repo._find_latest_ugs_request_id_for_run(
        run_id=ctx.run_id,
        active_only=False,
    )
    await ctx.repo._persist_ugs_request_id(run_id=ctx.run_id, ugs_request_id=ugs_request_id)
    block = _unwrap_audio_block(audio_resp)
    audio_list = block.get("audio") or []
    if not audio_list or not isinstance(audio_list[0], dict) or not audio_list[0].get("data"):
        raise ValueError("music_forge_empty_audio")
    ctx.audio_bytes = base64.b64decode(audio_list[0]["data"])
    return {
        "bytes": len(ctx.audio_bytes),
        "ugs_request_id": str(ugs_request_id) if ugs_request_id else None,
        "model_lane": ctx.model_lane.get("lane") or ctx.model_lane.get("lane_key"),
    }


async def handle_content_persist(ctx: MusicForgePipelineContext, settings: dict[str, Any]) -> dict[str, Any]:
    del settings
    if ctx.content_service is None:
        raise HTTPException(status_code=503, detail="content service unavailable")
    name = f"{ctx.intent['idea'][:80]} — MusicForge".strip()
    metadata = build_content_metadata(
        run_id=ctx.run_id,
        intent=ctx.intent,
        blueprint=ctx.blueprint,
        lyrics=ctx.lyrics,
        style_capsule=ctx.style_capsule,
        audio_input=ctx.audio_input,
    )
    content = await ctx.content_service.create_content(
        content_data=ContentCreate(
            user_id=ctx.user_id,
            name=name,
            description="Аудиотрек, созданный в новой MusicForge студии",
            content_type=ContentType.AUDIO,
            mime_type="audio/mpeg",
            sub_type="music_generator",
            original_filename=_safe_mp3_filename(name),
            tags=["music_generator", "music_forge", str(ctx.model_lane.get("model_scope") or "xl")],
            visibility=Visibility.PRIVATE,
            source_service="music_forge",
            source_id=str(uuid4()),
            metadata=metadata,
            company_id=None,
            project_id=None,
            title=None,
            word_count=None,
            character_count=None,
            access_level=None,
            is_public=None,
            folder_item_id=None,
            apply_project_desktop_folder=True,
        ),
        file_data=ctx.audio_bytes,
        user_id=ctx.user_id,
    )
    ctx.content_id = str(content.id)
    result_payload = {
        "content_id": str(content.id),
        "name": content.name or name,
        "download_url": f"/api/v1/content/{content.id}/download",
        "duration_seconds": int(ctx.intent["duration_seconds"]),
        "mime_type": "audio/mpeg",
    }
    await ctx.db.execute(
        text(
            """
            UPDATE music_forge_runs
            SET content_id = CAST(:content_id AS uuid),
                result_payload = CAST(:result_payload AS jsonb),
                updated_at = NOW()
            WHERE id = CAST(:run_id AS uuid)
            """
        ),
        {
            "run_id": ctx.run_id,
            "content_id": str(content.id),
            "result_payload": _json_param(result_payload),
        },
    )
    return {"content_id": str(content.id)}


STAGE_HANDLERS: dict[str, StageHandler] = {
    "intent_normalize": handle_intent_normalize,
    "llm_generate": handle_llm_generate,
    "lyrics_gate": handle_lyrics_gate,
    "style_build": handle_style_build,
    "lyrics_enrich": handle_lyrics_enrich,
    "audio_comfy": handle_audio_comfy,
    "content_persist": handle_content_persist,
}

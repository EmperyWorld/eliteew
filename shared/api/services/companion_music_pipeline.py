# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# EWA companion music wizard pipeline via direct service/router calls (Postgres UGS) — no user JWT HTTP self-calls.
# Invariants:
# - ``catalog_user_id`` is main Postgres user id (content catalog); billing runs as that user.
# - UGS correlation keys (`ewa_companion_run_id`, etc.) always attached before generate.
# Related:
# - api/routers/music_generator.py
# - api/ewa_platform/companion/orchestration/tool_registry.py
# - api/ewa_platform/companion/jobs/music_run_reconcile.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]
from starlette.requests import Request as StarletteRequest

from api.core.auth import User
from api.core.database_manager import get_database_manager
from api.routers.music_generator_constants import MAX_EWA_COMPANION_CONTEXT_CHARS
from api.schemas.music_generate_request import MusicGenerateRequest
from api.schemas.music_suggest_production_params import SuggestProductionParamsRequest
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

_COMPANION_INTERNAL_HTTP_SCOPE: dict[str, Any] = {
    "type": "http",
    "asgi": {"spec_version": "2.3", "version": "3.0"},
    "http_version": "1.1",
    "method": "POST",
    "path": "/internal/companion-music-generate",
    "raw_path": b"/internal/companion-music-generate",
    "query_string": b"",
    "headers": [],
    "client": ("127.0.0.1", 0),
    "server": ("testserver", 80),
}


def _companion_internal_http_request() -> StarletteRequest:
    """Minimal ASGI scope for in-process ``generate_music`` (no Idempotency-Key headers)."""
    return StarletteRequest(_COMPANION_INTERNAL_HTTP_SCOPE)


StageCallback = Callable[[int, str], Awaitable[None]]


@dataclass(slots=True)
class CompanionMusicPipelineError(Exception):
    """Structured failure from a music wizard stage (maps to companion task-run error_payload)."""

    message: str
    stage: str
    http_status: int | None = None
    body_prefix: str = ""

    def __str__(self) -> str:
        return self.message


@dataclass(frozen=True, slots=True)
class CompanionMusicPipelineResult:
    content_id: str
    track_name: str
    next_lyrics: str
    style_key: str
    gen_bpm: int | None
    gen_duration_seconds: int | None


async def _build_ugs(db: AsyncSession) -> UnifiedGenerationService:
    content_service = None
    try:
        from api.routers.unified_content import get_content_service  # noqa: PLC0415

        content_service = await get_content_service()
    except Exception as exc:
        from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug

        companion_degrade_debug(
            logger,
            "music_pipeline_content_service",
            "ContentStorageService unavailable for companion music pipeline",
            exc=exc,
        )
    return UnifiedGenerationService(db, content_service=content_service)


def _companion_user(catalog_user_id: str) -> User:
    uid = str(catalog_user_id or "").strip()
    return User(id=uid, email="", username="companion-worker")


def _http_error_to_pipeline(exc: HTTPException, *, stage: str) -> CompanionMusicPipelineError:
    detail = exc.detail
    if isinstance(detail, dict):
        prefix = json.dumps(detail, ensure_ascii=False)[:800]
        message = str(detail.get("code") or detail.get("message") or stage)
    else:
        prefix = str(detail)[:800]
        message = prefix[:500] or stage
    return CompanionMusicPipelineError(
        message=message,
        stage=stage,
        http_status=int(exc.status_code),
        body_prefix=prefix,
    )


async def execute_companion_music_wizard(
    *,
    catalog_user_id: str,
    run_id: str,
    step_id: str,
    principal_id: str,
    style_key: str,
    vocal_eff: str,
    language_e: str,
    ugs_wf: str,
    theme: str,
    lyrics_arg: str,
    voice_diversity: str,
    luna_mode: str | None,
    bpm_override: int | None,
    duration_override: int | None,
    name_arg: str,
    explicit_tags: str,
    skip_lyrics_validation: bool,
    billing_mode: str,
    ksampler_use_comfy_template: bool,
    ewa_companion_context: str,
    w_temp: float,
    w_cfg: float,
    w_top: float,
    suggest_t: float,
    suggest_c: float,
    suggest_p: float,
    default_pipeline_bpm: int,
    clamp_lyrics: Callable[[str], str],
    coerce_bpm_for_style: Callable[[str, int], int],
    on_stage: StageCallback | None = None,
) -> CompanionMusicPipelineResult:
    """Run lyrics → suggest → style → generate without HTTP self-calls."""

    from api.ewa_platform.companion.jobs.music_run_reconcile import companion_ugs_correlation_payload
    from api.routers.music_generator import (  # noqa: PLC0415
        generate_lyrics,
        generate_music,
        generate_style,
        suggest_production_params,
    )

    uid = str(catalog_user_id or "").strip()
    if not uid:
        raise CompanionMusicPipelineError(message="music_generation_missing_catalog_user", stage="init")

    ugs_corr = companion_ugs_correlation_payload(
        run_id=run_id,
        step_id=step_id,
        principal_id=principal_id,
    )
    user = _companion_user(uid)

    async def _stage(idx: int, status: str) -> None:
        if on_stage is not None:
            await on_stage(idx, status)

    manager = await get_database_manager()
    if not manager.postgres_session_factory:
        raise CompanionMusicPipelineError(
            message="postgres_session_factory_unavailable",
            stage="init",
        )

    async with manager.get_postgres_session() as db:
        ugs = await _build_ugs(db)
        try:
            next_lyrics = lyrics_arg.strip()
            await _stage(1, "running")
            if not next_lyrics:
                if not theme.strip():
                    raise CompanionMusicPipelineError(message="music_generation_missing_theme", stage="lyrics")
                lyrics_body: dict[str, Any] = {
                    "theme": theme,
                    "style": style_key,
                    "language": language_e,
                    "vocal": vocal_eff,
                    "voice_diversity": voice_diversity,
                    "temperature": w_temp,
                    "cfg_scale": w_cfg,
                    "top_p": w_top,
                }
                if ugs_wf in ("v2_base", "v2_sft"):
                    lyrics_body["target_ugs_workflow"] = ugs_wf
                if ewa_companion_context.strip():
                    lyrics_body["ewa_companion_context"] = ewa_companion_context.strip()[
                        :MAX_EWA_COMPANION_CONTEXT_CHARS
                    ]
                lyrics_body.update(ugs_corr)
                if style_key == "luna" and luna_mode:
                    lyrics_body["luna_mode"] = luna_mode
                logger.info(
                    "[STEP] companion_music_v2_lyrics_service run_id=%s theme_chars=%d style=%s ugs=%s",
                    run_id,
                    len(theme),
                    style_key,
                    ugs_wf,
                )
                try:
                    lj = await generate_lyrics(lyrics_body, user=user, ugs=ugs)
                except HTTPException as exc:
                    raise _http_error_to_pipeline(exc, stage="lyrics") from exc
                next_lyrics = clamp_lyrics(str(lj.get("lyrics") or ""))
                if not next_lyrics:
                    raise CompanionMusicPipelineError(message="music_generation_empty_lyrics", stage="lyrics")
            else:
                next_lyrics = clamp_lyrics(next_lyrics)

            await _stage(1, "completed")
            await _stage(2, "running")

            suggest_req = SuggestProductionParamsRequest(
                lyrics=next_lyrics,
                style=style_key,
                ewa_companion_context=ewa_companion_context.strip()[:MAX_EWA_COMPANION_CONTEXT_CHARS] or None,
                temperature=suggest_t,
                cfg_scale=suggest_c,
                top_p=suggest_p,
            )
            logger.info("[STEP] companion_music_v2_suggest_service run_id=%s", run_id)
            try:
                sj = await suggest_production_params(suggest_req, user=user, ugs=ugs)
            except HTTPException as exc:
                raise _http_error_to_pipeline(exc, stage="suggest-production-params") from exc

            await _stage(2, "completed")
            await _stage(3, "running")

            pipeline_bpm = max(10, min(300, int(sj.bpm or default_pipeline_bpm)))
            pipeline_bpm = coerce_bpm_for_style(style_key, pipeline_bpm)
            if bpm_override is not None:
                pipeline_bpm = bpm_override

            pipeline_duration = max(30, min(300, int(sj.duration_seconds or 195)))
            if duration_override is not None:
                pipeline_duration = duration_override

            pipeline_language = str(sj.language or language_e).strip() or language_e
            pipeline_keyscale = str(sj.keyscale or "C major").strip() or "C major"
            pipeline_timesignature = str(sj.timesignature or "4").strip() or "4"
            if pipeline_timesignature not in ("3", "4", "6"):
                pipeline_timesignature = "4"

            style_body: dict[str, Any] = {
                "lyrics": next_lyrics,
                "style": style_key,
                "vocal": vocal_eff,
                "temperature": w_temp,
                "cfg_scale": w_cfg,
                "top_p": w_top,
            }
            if ugs_wf in ("v2_base", "v2_sft"):
                style_body["target_ugs_workflow"] = ugs_wf
            if ewa_companion_context.strip():
                style_body["ewa_companion_context"] = ewa_companion_context.strip()[:MAX_EWA_COMPANION_CONTEXT_CHARS]
            style_body.update(ugs_corr)
            if style_key == "luna" and luna_mode:
                style_body["luna_mode"] = luna_mode
            logger.info("[STEP] companion_music_v2_generate_style_service run_id=%s", run_id)
            try:
                tj = await generate_style(style_body, user=user, ugs=ugs)
            except HTTPException as exc:
                raise _http_error_to_pipeline(exc, stage="generate-style") from exc
            next_tags = str(tj.get("tags") or "").strip()

            await _stage(3, "completed")
            await _stage(4, "running")

            gen_body = MusicGenerateRequest(
                lyrics=next_lyrics,
                tags=next_tags or None,
                style=style_key,
                vocal=vocal_eff,
                model="ace_step",
                generate_title=True,
                billing_mode=billing_mode,  # type: ignore[arg-type]
                ugs_workflow=ugs_wf if ugs_wf in ("v2", "v2_base", "v2_sft", "v4", "v5") else "v2",  # type: ignore[arg-type]
                bpm=pipeline_bpm,
                duration_seconds=pipeline_duration,
                language=pipeline_language,
                keyscale=pipeline_keyscale,
                timesignature=pipeline_timesignature,
                skip_lyrics_validation=bool(skip_lyrics_validation),
                ksampler_use_comfy_template=bool(ksampler_use_comfy_template),
                luna_mode=luna_mode if luna_mode in ("classic", "experimental") else None,
                name=name_arg or None,
                ewa_companion_run_id=ugs_corr.get("ewa_companion_run_id"),
                ewa_companion_step_id=ugs_corr.get("ewa_companion_step_id"),
                ewa_companion_principal_id=ugs_corr.get("ewa_companion_principal_id"),
            )
            if explicit_tags:
                gen_body = gen_body.model_copy(update={"tags": explicit_tags})
            if style_key == "luna" and luna_mode:
                pass  # luna_mode already on gen_body

            from api.routers.unified_content import get_content_service  # noqa: PLC0415

            content_service = await get_content_service()
            logger.info(
                "[STEP] companion_music_v2_generate_service run_id=%s lyrics_chars=%d bpm=%s style=%s ugs=%s",
                run_id,
                len(next_lyrics),
                pipeline_bpm,
                style_key,
                ugs_wf,
            )
            try:
                data_obj = await generate_music(
                    gen_body,
                    _companion_internal_http_request(),
                    user=user,
                    content_service=content_service,
                    ugs=ugs,
                )
            except HTTPException as exc:
                err = _http_error_to_pipeline(exc, stage="generate")
                err_l = (err.body_prefix or err.message or "").lower()
                if "timeout" in err_l and "generation" in err_l:
                    err = CompanionMusicPipelineError(
                        message="music_generation_ugs_timeout",
                        stage="generate",
                        http_status=err.http_status,
                        body_prefix=err.body_prefix,
                    )
                raise err from exc

            content_id = str(data_obj.get("content_id") or "").strip()
            track_name = str(data_obj.get("name") or "").strip()
            if not content_id:
                raise CompanionMusicPipelineError(
                    message="music_generation_missing_content_id",
                    stage="generate",
                )

            await _stage(4, "completed")
            return CompanionMusicPipelineResult(
                content_id=content_id,
                track_name=track_name,
                next_lyrics=next_lyrics,
                style_key=style_key,
                gen_bpm=pipeline_bpm,
                gen_duration_seconds=pipeline_duration,
            )
        finally:
            await ugs.close()

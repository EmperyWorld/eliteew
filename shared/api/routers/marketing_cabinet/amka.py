# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   HTTP API `api/routers/marketing_cabinet/amka.py`: эндпоинты и контракт — в коде и
#   OpenAPI (в т.ч. read-only **core-alignment** через AmkaCoreEngine; approve/resume/continue-step/cancel через `marketing_amka_driver_act_for_http`;
#   run progress SSE documents named text/event-stream payload, Wave B5b).
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
#   - AMKA progress SSE wire framing unchanged; OpenAPI names the JSON ``data:`` envelopes.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
#   - api/schemas/marketing_cabinet/sse.py
#   - documentation/api/BE-FE-CONTRACT-INTEGRITY-REMEDIATION.md (B5b)
# ------------------------------------------------------------------------------
from __future__ import annotations

import asyncio
import json
import logging
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from asyncpg.exceptions import UniqueViolationError  # type: ignore[import-not-found]
from fastapi import (  # type: ignore[import-untyped]
    APIRouter,
    Body,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from fastapi.responses import JSONResponse, StreamingResponse  # type: ignore[import-untyped]

from api.ewa_platform.schemas.pydantic.sse_openapi import event_stream_openapi_responses
from api.routers.marketing_cabinet.common import (
    assert_marketing_amka_preset_editor,
    get_marketing_db_pool,
    get_marketing_user_id,
    require_marketing_trusted_operator,
)
from api.schemas.marketing_cabinet.amka import (
    AmkaAsyncStartResponse,
    AmkaCancelResponse,
    AmkaContinueStepResponse,
    AmkaCoreAlignmentOut,
    AmkaResumeRequest,
    AmkaResumeResponse,
    AmkaRunDetailResponse,
    AmkaRunListResponse,
    AmkaStartRequest,
    EwaApproveRequest,
    EwaApproveResponse,
)
from api.schemas.marketing_cabinet.amka_operator_config import (
    AmkaOperatorConfigBundleOut,
    AmkaOperatorConfigPutBody,
)
from api.schemas.marketing_cabinet.amka_preset import (
    AmkaPresetCreateBody,
    AmkaPresetCreateBodyResolved,
    AmkaPresetListResponse,
    AmkaPresetOneResponse,
    AmkaPresetTemplateListResponse,
    AmkaPresetUpdateBody,
)
from api.schemas.marketing_cabinet.sse import AmkaRunEventsStreamSsePayloadDoc
from api.services.amka_core.marketing_core_bridge import (
    build_marketing_amka_core_alignment,
    marketing_amka_core_alignment_weak_etag,
)
from api.services.amka_core.marketing_driver_http import marketing_amka_driver_act_for_http
from api.services.marketing_cabinet.amka_operator_config import (
    load_operator_config_bundle,
    upsert_operator_config,
)
from api.services.marketing_cabinet.amka_preset_service import (
    create_preset,
    delete_preset,
    get_preset,
    list_preset_templates,
    list_presets,
    update_preset,
)
from api.services.marketing_cabinet.amka_run_export_markdown import (
    build_amka_run_export_markdown,
    save_amka_run_reports_to_generated_files,
)
from api.services.marketing_cabinet.amka_service import AmkaService

router = APIRouter(prefix="/amka", tags=["Marketing Cabinet - AMKA"])
logger = logging.getLogger(__name__)

_AMKA_RUN_EVENTS_STREAM_RESPONSES = event_stream_openapi_responses(
    model=AmkaRunEventsStreamSsePayloadDoc,
    description=(
        "`text/event-stream` — SSE `data:` JSON progress snapshots "
        "(`AmkaRunEventsStreamSsePayloadDoc`); `: ping` comments while polling; "
        "stops on terminal status or snapshot error."
    ),
)


@router.get("/operator-config", response_model=AmkaOperatorConfigBundleOut)
async def get_amka_operator_config(
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    _user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaOperatorConfigBundleOut:
    stored, effective, caps, updated_at, updated_by_user_id = await load_operator_config_bundle(db_pool)
    return AmkaOperatorConfigBundleOut(
        stored=stored,
        effective=effective,
        env_caps=caps,
        updated_at=updated_at,
        updated_by_user_id=updated_by_user_id,
    )


@router.put("/operator-config", response_model=AmkaOperatorConfigBundleOut)
async def put_amka_operator_config(
    body: AmkaOperatorConfigPutBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(require_marketing_trusted_operator),  # noqa: B008
) -> AmkaOperatorConfigBundleOut:
    await upsert_operator_config(db_pool, config=body.config, updated_by_user_id=user_id)
    stored, effective, caps, updated_at, updated_by_user_id = await load_operator_config_bundle(db_pool)
    return AmkaOperatorConfigBundleOut(
        stored=stored,
        effective=effective,
        env_caps=caps,
        updated_at=updated_at,
        updated_by_user_id=updated_by_user_id,
    )


@router.get("/preset-templates", response_model=AmkaPresetTemplateListResponse)
async def list_amka_preset_templates(
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    _user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaPresetTemplateListResponse:
    data = await list_preset_templates(db_pool)
    return AmkaPresetTemplateListResponse.model_validate(data)


@router.get("/presets", response_model=AmkaPresetListResponse)
async def list_amka_presets(
    project_id: UUID = Query(..., description="Проект, к которому относятся пресеты"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaPresetListResponse:
    data = await list_presets(db_pool, project_id=project_id, user_id=user_id)
    return AmkaPresetListResponse.model_validate(data)


@router.post("/presets", response_model=AmkaPresetOneResponse)
async def create_amka_preset(
    body: AmkaPresetCreateBody,
    project_id: UUID = Query(..., description="Проект для нового пресета"),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaPresetOneResponse:
    await assert_marketing_amka_preset_editor(db_pool, project_id, user_id)
    try:
        resolved = AmkaPresetCreateBodyResolved.from_body(body)
        out = await create_preset(
            db_pool,
            project_id=project_id,
            user_id=user_id,
            body=resolved,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except UniqueViolationError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пресет с таким ключом уже существует в проекте.",
        ) from exc
    return AmkaPresetOneResponse(preset=out)


@router.get("/presets/{preset_id}", response_model=AmkaPresetOneResponse)
async def get_amka_preset(
    preset_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaPresetOneResponse:
    one = await get_preset(db_pool, preset_id=preset_id, user_id=user_id)
    if one is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пресет не найден")
    return AmkaPresetOneResponse(preset=one)


@router.put("/presets/{preset_id}", response_model=AmkaPresetOneResponse)
async def update_amka_preset(
    preset_id: UUID,
    body: AmkaPresetUpdateBody,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaPresetOneResponse:
    existing = await get_preset(db_pool, preset_id=preset_id, user_id=user_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пресет не найден")
    await assert_marketing_amka_preset_editor(db_pool, UUID(existing.project_id), user_id)
    try:
        updated = await update_preset(
            db_pool,
            preset_id=preset_id,
            user_id=user_id,
            body=body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пресет не найден")
    return AmkaPresetOneResponse(preset=updated)


@router.delete("/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_amka_preset(
    preset_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> Response:
    existing = await get_preset(db_pool, preset_id=preset_id, user_id=user_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пресет не найден")
    await assert_marketing_amka_preset_editor(db_pool, UUID(existing.project_id), user_id)
    ok = await delete_preset(db_pool, preset_id=preset_id, user_id=user_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пресет не найден")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/project/{project_id}/runs", response_model=AmkaRunListResponse)
async def list_amka_runs(
    project_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaRunListResponse:
    return AmkaRunListResponse.model_validate(
        await AmkaService(db_pool).list_runs(project_id=project_id, user_id=user_id, limit=limit)
    )


@router.get("/runs/{run_id}", response_model=AmkaRunDetailResponse)
async def get_amka_run_detail(
    run_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaRunDetailResponse:
    return AmkaRunDetailResponse.model_validate(
        await AmkaService(db_pool).get_run_detail(run_id=run_id, user_id=user_id)
    )


@router.get(
    "/runs/{run_id}/core-alignment",
    response_model=AmkaCoreAlignmentOut,
    responses={304: {"description": "Not Modified — repeat If-None-Match"}},
)
async def get_amka_run_core_alignment(
    run_id: UUID,
    request: Request,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaCoreAlignmentOut | Response:
    """Align persisted run + master plan through AmkaCoreEngine (read-only; no LLM replan when plan is stored)."""

    svc = AmkaService(db_pool)
    run = await svc._get_run_checked(run_id=run_id, user_id=user_id, for_mutation=False)
    etag = marketing_amka_core_alignment_weak_etag(run_id=run_id, run_row=run)
    cache_hdr = {"ETag": etag, "Cache-Control": "private, max-age=60"}
    inm = request.headers.get("if-none-match")
    if inm and inm.strip() == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=cache_hdr)

    payload = await build_marketing_amka_core_alignment(db_pool, run_id=run_id, user_id=user_id, run_row=run)
    body = AmkaCoreAlignmentOut.model_validate(payload)
    return JSONResponse(status_code=status.HTTP_200_OK, content=body.model_dump(mode="json"), headers=cache_hdr)


@router.get("/runs/{run_id}/export.md")
async def export_amka_run_markdown(
    run_id: UUID,
    include_core_alignment: bool = Query(
        False,
        description="When true, append AmkaCoreEngine alignment JSON (persisted plan path; heavier).",
    ),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> Response:
    """Markdown-отчёт по прогону (серверная сборка; паритет с клиентским экспортом)."""
    detail = await AmkaService(db_pool).get_run_detail(run_id=run_id, user_id=user_id)
    run_row = detail["run"]
    steps_rows = detail["steps"]
    core_alignment = None
    if include_core_alignment:
        core_alignment = await build_marketing_amka_core_alignment(db_pool, run_id=run_id, user_id=user_id)
    run_payload = run_row if isinstance(run_row, dict) else dict(run_row)
    steps_payload = list(steps_rows) if isinstance(steps_rows, list) else []
    user_md = build_amka_run_export_markdown(
        run_payload,
        steps_payload,
        pulse=detail.get("pulse") if isinstance(detail.get("pulse"), dict) else None,
        standalone_projection=detail.get("standalone_projection")
        if isinstance(detail.get("standalone_projection"), dict)
        else None,
        core_alignment=core_alignment,
        technical_details=False,
    )
    technical_md = build_amka_run_export_markdown(
        run_payload,
        steps_payload,
        pulse=detail.get("pulse") if isinstance(detail.get("pulse"), dict) else None,
        standalone_projection=detail.get("standalone_projection")
        if isinstance(detail.get("standalone_projection"), dict)
        else None,
        core_alignment=core_alignment,
        technical_details=True,
    )
    report_headers: dict[str, str] = {}
    try:
        saved = save_amka_run_reports_to_generated_files(
            run_id=run_id,
            user_markdown=user_md,
            technical_markdown=technical_md,
        )
        report_headers["X-AMKA-Technical-Report"] = saved["relative_technical_report"]
    except Exception:
        logger.exception("AMKA export: failed to persist reports in generated_files (run_id=%s)", run_id)
    filename = f"amka-run-{run_id}.md"
    return Response(
        content=user_md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', **report_headers},
    )


_TERMINAL_AMKA = frozenset({"completed", "failed", "cancelled"})


@router.get("/runs/{run_id}/events", responses=_AMKA_RUN_EVENTS_STREAM_RESPONSES)
async def stream_amka_run_events(
    run_id: UUID,
    request: Request,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> StreamingResponse:
    """SSE прогресса запуска (лёгкий снимок). При ошибке клиент продолжает обычный polling."""

    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            # Comment line keeps some proxies from treating the stream as idle during slow DB work.
            yield ": ping\n\n"
            try:
                snap = await AmkaService(db_pool).get_run_progress_snapshot(
                    run_id=run_id,
                    user_id=user_id,
                )
            except Exception as exc:
                yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=False)}\n\n"
                break
            yield f"data: {json.dumps(snap, ensure_ascii=False, default=str)}\n\n"
            st = str(snap.get("status") or "")
            if st in _TERMINAL_AMKA:
                break
            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/runs", response_model=AmkaAsyncStartResponse)
async def create_amka_run(
    body: AmkaStartRequest,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaAsyncStartResponse:
    auto_cycle_total = (
        int(body.auto_cycle_count) if body.run_mode == "auto" and body.auto_cycle_count is not None else 1
    )
    preset_uuid: UUID | None = None
    if body.preset_id is not None and str(body.preset_id).strip():
        try:
            preset_uuid = UUID(str(body.preset_id).strip())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный preset_id",
            ) from exc
    return AmkaAsyncStartResponse.model_validate(
        await AmkaService(db_pool).create_run(
            project_id=UUID(body.project_id),
            company_id=UUID(body.company_id),
            user_id=user_id,
            scope_key=body.scope_key,
            user_instruction=body.user_instruction,
            section_keys=list(body.section_keys) if body.section_keys else None,
            imc_type_key=body.imc_type_key,
            imc_focus=body.imc_focus,
            imc_max_wait_seconds=body.imc_max_wait_seconds,
            run_mode=body.run_mode,
            auto_cycle_total=auto_cycle_total,
            per_step_execution=body.per_step_execution,
            preset_id=preset_uuid,
            use_web_search=body.use_web_search,
            web_search_quality=body.web_search_quality,
        )
    )


@router.post("/runs/{run_id}/approve", response_model=EwaApproveResponse)
async def approve_amka_run(
    run_id: UUID,
    body: EwaApproveRequest = Body(),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> EwaApproveResponse:
    return EwaApproveResponse.model_validate(
        await marketing_amka_driver_act_for_http(
            db_pool,
            run_id=run_id,
            user_id=user_id,
            operation="approve",
            skip_section_keys=list(body.skip_section_keys),
            skip_operation_keys=list(body.skip_operation_keys),
            skip_step_ids=list(body.skip_step_ids),
        )
    )


@router.post("/runs/{run_id}/resume", response_model=AmkaResumeResponse)
async def resume_amka_run(
    run_id: UUID,
    body: AmkaResumeRequest = Body(default=AmkaResumeRequest()),
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaResumeResponse:
    return AmkaResumeResponse.model_validate(
        await marketing_amka_driver_act_for_http(
            db_pool,
            run_id=run_id,
            user_id=user_id,
            operation="resume",
            skip_section_keys=list(body.skip_section_keys),
            skip_operation_keys=list(body.skip_operation_keys),
            skip_step_ids=list(body.skip_step_ids),
        )
    )


@router.post("/runs/{run_id}/continue-step", response_model=AmkaContinueStepResponse)
async def continue_amka_step(
    run_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaContinueStepResponse:
    return AmkaContinueStepResponse.model_validate(
        await marketing_amka_driver_act_for_http(
            db_pool,
            run_id=run_id,
            user_id=user_id,
            operation="continue_step",
        )
    )


@router.post("/runs/{run_id}/cancel", response_model=AmkaCancelResponse)
async def cancel_amka_run(
    run_id: UUID,
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
) -> AmkaCancelResponse:
    return AmkaCancelResponse.model_validate(
        await marketing_amka_driver_act_for_http(
            db_pool,
            run_id=run_id,
            user_id=user_id,
            operation="cancel",
        )
    )

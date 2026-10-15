# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   IMC (AI research) API for marketing cabinet.
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""IMC (AI research) API for marketing cabinet."""

from __future__ import annotations

import logging
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import JSONResponse  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.database_manager import get_postgres_session
from api.routers.marketing_cabinet.common import (
    get_accessible_company,
    get_accessible_project,
    get_marketing_db_pool,
    get_marketing_user_id,
)
from api.routers.marketing_cabinet.rate_limit import check_marketing_cabinet_ai_rate_limit
from api.routers.ugs import get_ugs_service
from api.schemas.imc import (
    ImcCancelResponse,
    ImcRagHintsResponse,
    ImcResearchDeleteResponse,
    ImcResearchListResponse,
    ImcResearchRunDetail,
    ImcResearchStatusResponse,
    ImcResearchTypesResponse,
    ImcRunResearchRequest,
    ImcRunResearchResponse,
)
from api.services.imc.imc_errors import ImcDeprecatedTypeKeyError, ImcInsufficientProjectContextError
from api.services.imc.imc_service import ImcService
from api.services.marketing_project_rag_service import MarketingRagInfrastructureError
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imc", tags=["Marketing Cabinet - IMC"])


async def get_imc_service_readonly(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
) -> ImcService:
    """Списки / типы / удаление — без UGS, чтобы не поднимать ContentStorage на каждый poll."""
    return ImcService(db, ugs=None)


async def get_imc_service_with_ugs(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ugs: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
) -> ImcService:
    """Запуск, статус, деталка, отмена — нужен UGS + опционально unified content."""
    return ImcService(db, ugs=ugs)


@router.get("/types", response_model=ImcResearchTypesResponse)
async def list_imc_types(
    svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
) -> ImcResearchTypesResponse:
    types = await svc.list_types_for_cabinet()
    return ImcResearchTypesResponse(types=types)


@router.get("/project/{project_id}/rag-hints", response_model=ImcRagHintsResponse)
async def get_imc_project_rag_hints(
    project_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
) -> ImcRagHintsResponse:
    await get_accessible_project(db_pool, project_id, user_id)
    return await svc.get_rag_hints(
        user_id=user_id,
        project_id=project_id,
        marketing_db_pool=db_pool,
    )


@router.post(
    "/research/run",
    response_model=ImcRunResearchResponse,
    responses={202: {"model": ImcRunResearchResponse}},
)
async def run_imc_research(
    body: ImcRunResearchRequest,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_with_ugs),  # noqa: B008
) -> JSONResponse:
    try:
        company_uuid = UUID(body.company_id)
        project_uuid = UUID(body.project_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный UUID company_id или project_id",
        ) from e

    project = await get_accessible_project(db_pool, project_uuid, user_id, for_mutation=True, required_mc_module="imc")
    if str(project["company_id"]) != str(company_uuid):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id не принадлежит указанной company_id",
        )
    await get_accessible_company(db_pool, company_uuid, user_id)

    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов маркетингового кабинета. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )

    try:
        out = await svc.run_research(user_id=user_id, body=body, marketing_db_pool=db_pool)
    except ImcDeprecatedTypeKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "deprecated_imc_type",
                "deprecated_type_key": e.deprecated_type_key,
                "successor_type_key": e.successor_type_key,
                "message": str(e),
            },
        ) from e
    except ImcInsufficientProjectContextError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e
    except MarketingRagInfrastructureError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception:
        logger.exception("[IMC] run_research failed user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось поставить исследование в очередь UGS",
        ) from None

    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=out.model_dump())


@router.post(
    "/research/{research_id}/rerun",
    response_model=ImcRunResearchResponse,
    responses={202: {"model": ImcRunResearchResponse}},
)
async def rerun_imc_research(
    research_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_with_ugs),  # noqa: B008
) -> JSONResponse:
    allowed, retry_after = await check_marketing_cabinet_ai_rate_limit(str(user_id))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит AI-запросов маркетингового кабинета. Попробуйте через минуту.",
            headers={"Retry-After": str(int(retry_after or 60))},
        )
    try:
        out = await svc.rerun_research(
            user_id=user_id,
            research_id=research_id,
            marketing_db_pool=db_pool,
        )
    except ImcDeprecatedTypeKeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "deprecated_imc_type",
                "deprecated_type_key": e.deprecated_type_key,
                "successor_type_key": e.successor_type_key,
                "message": str(e),
            },
        ) from e
    except ImcInsufficientProjectContextError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        ) from e
    except MarketingRagInfrastructureError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception:
        logger.exception("[IMC] rerun_research failed user_id=%s research_id=%s", user_id, research_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось поставить повтор исследования в очередь UGS",
        ) from None

    return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content=out.model_dump())


@router.get("/research/{research_id}/status", response_model=ImcResearchStatusResponse)
async def get_imc_research_status(
    research_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_with_ugs),  # noqa: B008
) -> ImcResearchStatusResponse:
    out = await svc.get_research_status(research_id, user_id, db_pool)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")
    return out


@router.get("/research/{research_id}", response_model=ImcResearchRunDetail)
async def get_imc_research(
    research_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_with_ugs),  # noqa: B008
) -> ImcResearchRunDetail:
    out = await svc.get_research_detail(research_id, user_id, db_pool)
    if out is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")
    return out


@router.get("/company/{company_id}/researches", response_model=ImcResearchListResponse)
async def list_imc_researches_for_company(
    company_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
    type_key: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    active_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ImcResearchListResponse:
    await get_accessible_company(db_pool, company_id, user_id)
    total, items = await svc.list_for_company(
        user_id=user_id,
        company_id=company_id,
        type_key=type_key,
        status=status_filter,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
    return ImcResearchListResponse(company_id=str(company_id), total=total, items=items)


@router.get("/project/{project_id}/researches", response_model=ImcResearchListResponse)
async def list_imc_researches_for_project(
    project_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
    type_key: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    active_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ImcResearchListResponse:
    await get_accessible_project(db_pool, project_id, user_id)
    total, items = await svc.list_for_project(
        user_id=user_id,
        project_id=project_id,
        type_key=type_key,
        status=status_filter,
        active_only=active_only,
        limit=limit,
        offset=offset,
    )
    return ImcResearchListResponse(project_id=str(project_id), total=total, items=items)


@router.post("/research/{research_id}/cancel", response_model=ImcCancelResponse)
async def cancel_imc_research(
    research_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_with_ugs),  # noqa: B008
) -> ImcCancelResponse:
    try:
        outcome = await svc.cancel_research(research_id, user_id, db_pool)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    if outcome is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")
    if outcome == "already_done":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Исследование уже завершено или отменено",
        )
    return ImcCancelResponse()


@router.delete("/research/{research_id}", response_model=ImcResearchDeleteResponse)
async def delete_imc_research(
    research_id: UUID,
    user_id: UUID = Depends(get_marketing_user_id),  # noqa: B008
    db_pool: asyncpg.Pool = Depends(get_marketing_db_pool),  # noqa: B008
    svc: ImcService = Depends(get_imc_service_readonly),  # noqa: B008
) -> ImcResearchDeleteResponse:
    try:
        ok = await svc.delete_research(research_id=research_id, user_id=user_id, marketing_db_pool=db_pool)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e)) from e
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")
    return ImcResearchDeleteResponse(id=str(research_id))

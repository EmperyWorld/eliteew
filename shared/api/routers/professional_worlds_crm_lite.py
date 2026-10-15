# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# CRM-lite HTTP routes (generic clients/deals for profession verticals).
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Every handler is current-user scoped via `_service` / `_current_user_id`.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/routers/professional_worlds.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_deps import _current_user_id, _service
from api.schemas.professional_worlds import (
    ProfessionalClientCreate,
    ProfessionalClientOut,
    ProfessionalClientUpdate,
    ProfessionalDealCreate,
    ProfessionalDealOut,
    ProfessionalDealPropertyLinkBackfillOut,
    ProfessionalDealUpdate,
)
from api.services.professional_worlds.service import REALTOR_VERTICAL_SLUG

crm_lite_router = APIRouter()


@crm_lite_router.get("/clients", response_model=list[ProfessionalClientOut])
async def list_clients(
    vertical_slug: str | None = Query(default=None, description="Filter by active profession vertical"),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List CRM-lite clients for the given profession vertical."""
    slug = (vertical_slug or "").strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).list_clients(_current_user_id(user), vertical_slug=slug)


@crm_lite_router.post("/clients", response_model=ProfessionalClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ProfessionalClientCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create CRM-lite client."""
    return await _service(db).create_client(_current_user_id(user), payload)


@crm_lite_router.patch("/clients/{client_id}", response_model=ProfessionalClientOut)
async def update_client(
    client_id: UUID,
    payload: ProfessionalClientUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch CRM-lite client."""
    row = await _service(db).update_client(_current_user_id(user), client_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return row


@crm_lite_router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Delete CRM-lite client when no deals remain linked."""
    from api.services.professional_worlds.professional_crm_service import ClientHasDealsError

    try:
        deleted = await _service(db).delete_client(_current_user_id(user), client_id)
    except ClientHasDealsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "client_has_deals",
                "deal_count": exc.deal_count,
                "message": "Remove linked deals before deleting this client.",
            },
        ) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")


@crm_lite_router.get("/deals", response_model=list[ProfessionalDealOut])
async def list_deals(
    vertical_slug: str | None = Query(default=None, description="Filter by active profession vertical"),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List deals for the given profession vertical."""
    slug = (vertical_slug or "").strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).list_deals(_current_user_id(user), vertical_slug=slug)


@crm_lite_router.post("/deals", response_model=ProfessionalDealOut, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: ProfessionalDealCreate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create deal."""
    return await _service(db).create_deal(_current_user_id(user), payload)


@crm_lite_router.patch("/deals/{deal_id}", response_model=ProfessionalDealOut)
async def update_deal(
    deal_id: UUID,
    payload: ProfessionalDealUpdate,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch deal."""
    row = await _service(db).update_deal(_current_user_id(user), deal_id, payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")
    return row


@crm_lite_router.delete("/deals/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(
    deal_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Delete deal."""
    deleted = await _service(db).delete_deal(_current_user_id(user), deal_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")


@crm_lite_router.post(
    "/deals/backfill-property-links",
    response_model=ProfessionalDealPropertyLinkBackfillOut,
)
async def backfill_deal_property_links(
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, int]:
    """Persist unique legacy deal title→listing matches into deal_data.property_id."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).backfill_deal_property_links(_current_user_id(user), slug)

# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Professional Worlds bootstrap HTTP routes: verticals, profile, runtime config, activations, snapshot.
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/routers/professional_worlds.py
# ---

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_deps import _current_user_id, _schema_validation_http, _service
from api.schemas.professional_worlds import (
    ProfessionalUserVerticalActivationOut,
    ProfessionalUserVerticalActivationUpsert,
    ProfessionalUserVerticalOnboardingPatch,
    ProfessionalWorldsMultiRuntimeConfig,
    ProfessionalWorldsRuntimeConfig,
    ProfessionalWorldsSnapshotOut,
    ProfessionVerticalOut,
    SpecialistProfileOut,
    SpecialistProfileUpsert,
)
from api.services.professional_worlds import ProfessionalWorldsRuntimeService
from api.services.professional_worlds.service import REALTOR_VERTICAL_SLUG, ActiveSchemaValidationError

core_router = APIRouter()


@core_router.get("/verticals", response_model=list[ProfessionVerticalOut])
async def list_verticals(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    _user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List profession verticals available for Professional Worlds."""
    return await _service(db).list_verticals()


@core_router.get("/me/profile", response_model=SpecialistProfileOut | None)
async def get_my_profile(
    vertical_slug: str = "realtor",
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any] | None:
    """Return current user's specialist profile."""
    return await _service(db).get_profile(_current_user_id(user), vertical_slug)


@core_router.put("/me/profile", response_model=SpecialistProfileOut)
async def upsert_my_profile(
    payload: SpecialistProfileUpsert,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Create or update the current user's specialist profile."""
    try:
        return await _service(db).upsert_profile(_current_user_id(user), payload)
    except ActiveSchemaValidationError as exc:
        raise _schema_validation_http(exc) from exc


@core_router.get("/me/runtime-config", response_model=ProfessionalWorldsRuntimeConfig)
async def get_my_runtime_config(
    vertical_slug: str = "realtor",
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return runtime-enabled modules/actions/presets for a vertical without internal prompts."""
    return await ProfessionalWorldsRuntimeService(_service(db)).get_config(vertical_slug, _current_user_id(user))


@core_router.get("/me/vertical-activations", response_model=list[ProfessionalUserVerticalActivationOut])
async def list_my_vertical_activations(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List profession verticals activated for the current user."""
    return await _service(db).list_user_vertical_activations(_current_user_id(user))


@core_router.post("/me/vertical-activations/{vertical_slug}", response_model=ProfessionalUserVerticalActivationOut)
async def upsert_my_vertical_activation(
    vertical_slug: str,
    payload: ProfessionalUserVerticalActivationUpsert,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Activate or deactivate a vertical for the current account."""
    row = await _service(db).upsert_user_vertical_activation(
        _current_user_id(user), vertical_slug, is_active=payload.is_active
    )
    return {
        "vertical_slug": row["vertical_slug"],
        "is_active": row["is_active"],
        "onboarding": row.get("onboarding") or {},
        "entitlements": row.get("entitlements") or {},
    }


@core_router.patch(
    "/me/vertical-activations/{vertical_slug}/onboarding", response_model=ProfessionalUserVerticalActivationOut
)
async def patch_my_vertical_onboarding(
    vertical_slug: str,
    payload: ProfessionalUserVerticalOnboardingPatch,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Patch onboarding JSON for a vertical."""
    row = await _service(db).patch_user_vertical_onboarding(_current_user_id(user), vertical_slug, payload.onboarding)
    return {
        "vertical_slug": row["vertical_slug"],
        "is_active": row["is_active"],
        "onboarding": row.get("onboarding") or {},
        "entitlements": row.get("entitlements") or {},
    }


@core_router.get("/me/runtime-configs", response_model=ProfessionalWorldsMultiRuntimeConfig)
async def list_my_runtime_configs(
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return runtime configs for every active vertical."""
    configs = await _service(db).list_runtime_configs_for_user(_current_user_id(user))
    return {"configs": configs}


@core_router.get("/me/snapshot", response_model=ProfessionalWorldsSnapshotOut)
async def get_my_professional_worlds_snapshot(
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return aggregated Desktop bootstrap data for the active profession vertical."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).load_user_snapshot(_current_user_id(user), slug)

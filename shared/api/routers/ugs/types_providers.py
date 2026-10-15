# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
#   UGS generation types CRUD (admin) and provider status listing endpoints.
# Invariants:
#   - Admin-only mutations use ``require_admin_user`` (UGS admin gate).
# Related:
#   - api/services/ugs/generation_type_service.py
#   - api/services/ugs/provider_manager_service_v2.py
# ---
"""UGS types and providers routes."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.routers.ugs.deps import (
    get_generation_type_service,
    get_provider_manager,
    get_ugs_service,
    logger,
    require_admin_user,
)
from api.schemas.ugs import (
    GenerationTypeCreate,
    GenerationTypeListResponse,
    GenerationTypeResponse,
    GenerationTypeUpdate,
    ProviderStatusResponse,
)
from api.services.ugs.generation_type_service import GenerationTypeService
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2
from api.services.ugs.unified_generation_service import UnifiedGenerationService


def register_types_and_providers_routes(router: APIRouter) -> None:

    # ========================================
    # GENERATION TYPES ENDPOINTS
    # ========================================

    @router.get(
        "/types",
        response_model=GenerationTypeListResponse,
        summary="List Generation Types",
        description="Get list of available generation types",
    )
    async def list_generation_types(
        category: str | None = Query(None, description="Filter by category"),
        user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> GenerationTypeListResponse:
        """
        🔥 LIST GENERATION TYPES 🔥

        Get all available generation types, optionally filtered by category.

        - **category**: Filter by content category (text, image, audio, video, document, composite)
        """
        try:
            types_list = await ugs_service.get_available_types(category)
            return GenerationTypeListResponse(types=types_list, total=len(types_list))

        except (OSError, RuntimeError) as e:
            logger.exception("Types listing failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.post(
        "/types",
        response_model=GenerationTypeResponse,
        summary="Create Generation Type",
        description="Create a new generation type (admin only)",
    )
    async def create_generation_type(
        type_data: GenerationTypeCreate,
        admin_user: User = Depends(require_admin_user),  # noqa: B008
        ugs_service: UnifiedGenerationService = Depends(get_ugs_service),  # noqa: B008
    ) -> GenerationTypeResponse:
        """
        🔥 CREATE GENERATION TYPE 🔥

        Create a new generation type. Requires admin privileges.

        - **type_key**: Unique identifier for the type
        - **category**: Content category
        - **provider**: AI provider to use
        - **model_name**: Specific model name
        """
        try:
            result = await ugs_service.create_generation_type(type_data.model_dump(), str(admin_user.id))
            return GenerationTypeResponse.model_validate(result)

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except (OSError, RuntimeError) as e:
            logger.exception("Type creation failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.put(
        "/types/{type_key}",
        response_model=GenerationTypeResponse,
        summary="Update Generation Type",
        description="Update an existing generation type (admin only)",
    )
    async def update_generation_type(
        type_key: str,
        update_data: GenerationTypeUpdate,
        admin_user: User = Depends(require_admin_user),  # noqa: ARG001, B008
        type_service: GenerationTypeService = Depends(get_generation_type_service),  # noqa: B008
    ) -> GenerationTypeResponse:
        """
        🔥 UPDATE GENERATION TYPE 🔥

        Update an existing generation type. Requires admin privileges.

        - **type_key**: Type key to update
        """
        try:
            result = await type_service.update_type(type_key, update_data.model_dump(exclude_unset=True))

            if not result:
                msg = "Generation type not found"
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
            return GenerationTypeResponse.model_validate(result)

        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Type update failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.delete(
        "/types/{type_key}",
        summary="Deactivate Generation Type",
        description="Deactivate a generation type (admin only)",
    )
    async def deactivate_generation_type(
        type_key: str,
        admin_user: User = Depends(require_admin_user),  # noqa: ARG001, B008
        type_service: GenerationTypeService = Depends(get_generation_type_service),  # noqa: B008
    ) -> dict[str, str]:
        """
        🔥 DEACTIVATE GENERATION TYPE 🔥

        Deactivate a generation type. Requires admin privileges.

        - **type_key**: Type key to deactivate
        """
        try:
            success = await type_service.deactivate_type(type_key)

            if not success:
                msg = "Generation type not found"
                raise HTTPException(status_code=404, detail=msg)  # noqa: TRY301
            return {"message": "Generation type deactivated successfully"}  # noqa: TRY300

        except HTTPException:
            raise
        except (OSError, RuntimeError) as e:
            logger.exception("Type deactivation failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    # ========================================
    # PROVIDER ENDPOINTS
    # ========================================

    @router.get(
        "/providers",
        response_model=list[ProviderStatusResponse],
        summary="List Provider Status",
        description="Get status of all AI providers",
    )
    async def list_providers(
        user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
        provider_manager: ProviderManagerServiceV2 = Depends(get_provider_manager),  # noqa: B008
    ) -> list[ProviderStatusResponse]:
        """
        🔥 LIST PROVIDER STATUS 🔥

        Get the current status of all configured AI providers.
        """
        try:
            providers = await provider_manager.get_available_providers()
            statuses = await asyncio.gather(
                *[provider_manager.check_provider_status(p["name"]) for p in providers],
                return_exceptions=True,
            )
            result = []
            for provider, status in zip(providers, statuses, strict=False):
                if isinstance(status, Exception):
                    logger.warning("Provider %s status check failed: %s", provider.get("name"), status)
                    status_payload: dict[str, Any] = {
                        "available": False,
                        "response_time": None,
                        "last_checked": datetime.now(UTC),
                        "error": str(status),
                    }
                else:
                    status_payload = cast(dict[str, Any], status)
                last_checked = status_payload.get("last_checked")
                if isinstance(last_checked, str):
                    last_checked = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
                elif not isinstance(last_checked, datetime):
                    last_checked = datetime.now(UTC)
                result.append(
                    ProviderStatusResponse(
                        name=provider["name"],
                        available=status_payload["available"],
                        response_time=status_payload.get("response_time"),
                        last_checked=last_checked,
                        error=status_payload.get("error"),
                    )
                )
            return result  # noqa: TRY300

        except (OSError, RuntimeError) as e:
            logger.exception("Provider listing failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

    @router.get(
        "/providers/{provider_name}/status",
        response_model=ProviderStatusResponse,
        summary="Get Provider Status",
        description="Get detailed status of a specific provider",
    )
    async def get_provider_status(
        provider_name: str,
        user: User = Depends(require_oauth2_user),  # noqa: ARG001, B008
        provider_manager: ProviderManagerServiceV2 = Depends(get_provider_manager),  # noqa: B008
    ) -> ProviderStatusResponse:
        """
        🔥 GET PROVIDER STATUS 🔥

        Get detailed status information for a specific AI provider.

        - **provider_name**: Name of the provider (llama, comfyui, etc.)
        """
        try:
            status = await provider_manager.check_provider_status(provider_name)

            last_checked_raw = status.get("last_checked")
            if isinstance(last_checked_raw, str):
                last_checked = datetime.fromisoformat(last_checked_raw.replace("Z", "+00:00"))
            elif isinstance(last_checked_raw, datetime):
                last_checked = last_checked_raw
            else:
                last_checked = datetime.now(UTC)

            return ProviderStatusResponse(
                name=provider_name,
                available=status["available"],
                response_time=status.get("response_time"),
                last_checked=last_checked,
                error=status.get("error"),
            )

        except (OSError, RuntimeError) as e:
            logger.exception("Provider status check failed")
            raise HTTPException(status_code=500, detail="Internal server error") from e

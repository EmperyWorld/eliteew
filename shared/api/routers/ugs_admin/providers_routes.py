# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
#   UGS Admin generation provider CRUD, runtime bootstrap, and Llama model discovery.
# Invariants:
#   - All routes require ``require_ugs_admin_user``; provider payloads normalized before persist.
# Related:
#   - api/services/ugs/provider_manager_service_v2.py
#   - api/models/database_models.GenerationProvider
# ---

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

import aiohttp  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from fastapi.responses import Response  # type: ignore[import-untyped]
from sqlalchemy import select  # type: ignore[import-untyped]

from api.core.database_manager import get_postgres_session
from api.models.database_models import GenerationProvider
from api.routers.ugs_admin._helpers import model_to_response, normalize_generation_provider_payload
from api.schemas.ugs_admin import (
    GenerationProviderCreate,
    GenerationProviderResponse,
    GenerationProviderUpdate,
)
from api.services.ugs.admin_access import require_ugs_admin_user
from api.services.ugs.provider_manager_service_v2 import ProviderManagerServiceV2

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

    from api.core.auth import User as AuthUser

logger = logging.getLogger(__name__)


def register_providers_routes(router: APIRouter) -> None:
    @router.get("/providers", response_model=list[GenerationProviderResponse])
    async def list_generation_providers(
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> list[GenerationProviderResponse]:
        result = await db.execute(select(GenerationProvider).order_by(GenerationProvider.provider_name))
        providers = result.scalars().all()
        return [model_to_response(provider, GenerationProviderResponse) for provider in providers]

    @router.get("/providers/{provider_name}", response_model=GenerationProviderResponse)
    async def get_generation_provider(
        provider_name: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> GenerationProviderResponse:
        result = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == provider_name))
        provider = result.scalar_one_or_none()
        if not provider:
            msg = "Провайдер не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        return model_to_response(provider, GenerationProviderResponse)

    @router.post("/providers", response_model=GenerationProviderResponse, status_code=status.HTTP_201_CREATED)
    async def create_generation_provider(
        payload: GenerationProviderCreate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> GenerationProviderResponse:
        data = normalize_generation_provider_payload(payload.model_dump(mode="json"))

        existing = await db.execute(
            select(GenerationProvider).where(GenerationProvider.provider_name == data["provider_name"])
        )
        if existing.scalar_one_or_none():
            msg = "Провайдер с таким именем уже существует."
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)

        provider = GenerationProvider(**data)
        db.add(provider)
        await db.commit()
        await db.refresh(provider)
        return model_to_response(provider, GenerationProviderResponse)

    @router.put("/providers/{provider_name}", response_model=GenerationProviderResponse)
    async def update_generation_provider(
        provider_name: str,
        payload: GenerationProviderUpdate,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> GenerationProviderResponse:
        result = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == provider_name))
        provider = result.scalar_one_or_none()
        if not provider:
            msg = "Провайдер не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        update_data = normalize_generation_provider_payload(
            payload.model_dump(exclude_unset=True, mode="json"),
            provider_name_hint=provider_name,
            provider_type_hint=str(provider.provider_type) if provider.provider_type is not None else None,
        )
        for field, value in update_data.items():
            setattr(provider, field, value)

        await db.commit()
        await db.refresh(provider)
        return model_to_response(provider, GenerationProviderResponse)

    @router.delete("/providers/{provider_name}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_generation_provider(
        provider_name: str,
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> Response:
        result = await db.execute(select(GenerationProvider).where(GenerationProvider.provider_name == provider_name))
        provider = result.scalar_one_or_none()
        if not provider:
            msg = "Провайдер не найден."
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)

        await db.delete(provider)
        await db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post("/providers/bootstrap-runtime")
    async def bootstrap_runtime_generation_providers(
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
        db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    ) -> dict[str, Any]:
        provider_manager = ProviderManagerServiceV2(db)
        try:
            seeds = await provider_manager.get_bootstrap_provider_seeds()
        finally:
            await provider_manager.close()

        created: list[str] = []
        skipped: list[str] = []

        for seed in seeds:
            existing = await db.execute(
                select(GenerationProvider).where(GenerationProvider.provider_name == seed["provider_name"])
            )
            existing_provider = existing.scalar_one_or_none()
            normalized_seed = normalize_generation_provider_payload(seed)
            if existing_provider is not None:
                existing_health_endpoint = (
                    str(existing_provider.health_endpoint).strip()
                    if existing_provider.health_endpoint is not None
                    else None
                )
                if existing_health_endpoint in {"", "/"} and normalized_seed.get("health_endpoint"):
                    existing_provider.health_endpoint = normalized_seed["health_endpoint"]
                    skipped.append(f"{seed['provider_name']} (health repaired)")
                else:
                    skipped.append(seed["provider_name"])
                continue

            db.add(GenerationProvider(**normalized_seed))
            created.append(seed["provider_name"])

        if created:
            await db.commit()
        else:
            await db.rollback()

        return {
            "created": created,
            "skipped": skipped,
            "total_created": len(created),
            "total_skipped": len(skipped),
        }

    @router.get("/llama-models")
    async def get_llama_models(
        base_url: str = Query(..., description="Text LLM base URL, e.g. http://stack2-llama-chat:8080"),
        _: AuthUser = Depends(require_ugs_admin_user),  # noqa: B008
    ) -> dict[str, list[str]]:
        """
        Fetch list of available models from an Llama instance.
        Used in UGS Admin when configuring Llama providers to choose default_model.
        """
        base_url = (base_url or "").rstrip("/")
        if not base_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите base_url.")
        parsed = urlparse(base_url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="base_url должен начинаться с http:// или https://.",
            )

        names: list[str] = []
        timeout = aiohttp.ClientTimeout(total=10, connect=3)
        for path, key, name_key in (("/api/tags", "models", "name"), ("/v1/models", "data", "id")):
            try:
                async with aiohttp.ClientSession(timeout=timeout) as session, session.get(f"{base_url}{path}") as resp:
                    if resp.status != 200:
                        continue
                    data = await resp.json()
                if not isinstance(data, dict):
                    continue
                items = data.get(key) or []
                if not isinstance(items, list):
                    continue
                for m in items:
                    if isinstance(m, dict) and m.get(name_key):
                        names.append(str(m[name_key]))
                if names:
                    break
            except (aiohttp.ClientError, ValueError) as e:
                logger.warning("Llama models fetch failed %s%s: %s", base_url, path, e)
                continue
        return {"models": names}

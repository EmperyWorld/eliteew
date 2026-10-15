# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop bootstrap snapshot assembly for Professional Worlds — module-aware parallel fetches.
# Invariants:
# - Snapshot slice queries run only when runtime modules enable the corresponding fetch flag.
# - Provider health degrade signal is best-effort; failures return None without aborting snapshot.
# Related:
# - api/services/professional_worlds/snapshot_helpers.py
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/ops_metrics_service.py
# ---

from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.snapshot_helpers import (
    REALTOR_VERTICAL_SLUG,
    _should_fetch_artifacts_snapshot,
    _should_fetch_clients_snapshot,
    _should_fetch_deals_snapshot,
    _should_fetch_learning_snapshot,
    _should_fetch_profile_snapshot,
    _vertical_supports_listing_workspace,
)

logger = logging.getLogger(__name__)


class UserSnapshotDeps(Protocol):
    """Facade surface required to assemble a Professional Worlds user snapshot."""

    db: AsyncSession

    async def list_verticals(self) -> list[dict[str, Any]]: ...

    async def list_user_vertical_activations(self, user_id: UUID) -> list[dict[str, Any]]: ...

    async def get_runtime_config(
        self, vertical_slug: str = REALTOR_VERTICAL_SLUG, *, user_id: UUID | None = None
    ) -> dict[str, Any]: ...

    async def get_profile(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> dict[str, Any] | None: ...

    async def list_clients(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]: ...

    async def list_deals(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]: ...

    async def list_courses(self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG) -> list[dict[str, Any]]: ...

    async def list_artifacts(
        self, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
    ) -> list[dict[str, Any]]: ...

    async def list_properties(self, user_id: UUID) -> list[dict[str, Any]]: ...


def normalize_snapshot_vertical_slug(vertical_slug: str) -> str:
    """Resolve the effective vertical slug for snapshot assembly."""
    slug = (vertical_slug or REALTOR_VERTICAL_SLUG).strip() or REALTOR_VERTICAL_SLUG
    return slug


async def resolve_snapshot_runtime_configs(
    deps: UserSnapshotDeps,
    user_id: UUID,
    slug: str,
    activations: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Build runtime_configs for active verticals and pick the config for slug."""
    runtime_configs = (
        list(
            await asyncio.gather(
                *[deps.get_runtime_config(str(row["vertical_slug"]), user_id=user_id) for row in activations]
            )
        )
        if activations
        else []
    )
    runtime_config = next(
        (cfg for cfg in runtime_configs if str(cfg.get("vertical_slug")) == slug),
        None,
    )
    if runtime_config is None:
        runtime_config = await deps.get_runtime_config(slug, user_id=user_id)
        if not any(str(cfg.get("vertical_slug")) == slug for cfg in runtime_configs):
            runtime_configs = [*runtime_configs, runtime_config]
    return runtime_config, runtime_configs


async def fetch_snapshot_domain_slices(
    deps: UserSnapshotDeps,
    user_id: UUID,
    slug: str,
    modules: list[dict[str, Any]],
) -> tuple[
    dict[str, Any] | None,
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """Parallel module-aware fetches for profile, CRM, learning, artifacts and listings."""

    async def fetch_profile() -> dict[str, Any] | None:
        return await deps.get_profile(user_id, slug) if _should_fetch_profile_snapshot(modules) else None

    async def fetch_clients() -> list[dict[str, Any]]:
        return await deps.list_clients(user_id, vertical_slug=slug) if _should_fetch_clients_snapshot(modules) else []

    async def fetch_deals() -> list[dict[str, Any]]:
        return await deps.list_deals(user_id, vertical_slug=slug) if _should_fetch_deals_snapshot(modules) else []

    async def fetch_courses() -> list[dict[str, Any]]:
        return await deps.list_courses(user_id, vertical_slug=slug) if _should_fetch_learning_snapshot(modules) else []

    async def fetch_artifacts() -> list[dict[str, Any]]:
        return (
            await deps.list_artifacts(user_id, vertical_slug=slug) if _should_fetch_artifacts_snapshot(modules) else []
        )

    async def fetch_properties() -> list[dict[str, Any]]:
        return await deps.list_properties(user_id) if _vertical_supports_listing_workspace(slug, modules) else []

    return await asyncio.gather(
        fetch_profile(),
        fetch_clients(),
        fetch_deals(),
        fetch_courses(),
        fetch_artifacts(),
        fetch_properties(),
    )


async def load_snapshot_provider_health(
    db: AsyncSession,
    user_id: UUID,
) -> dict[str, Any] | None:
    """Best-effort UGS provider health probe for Desktop degrade signaling."""
    from api.services.professional_worlds.ops_metrics_service import load_ugs_provider_health

    try:
        return await load_ugs_provider_health(db)
    except Exception:
        logger.warning(
            "professional_worlds.load_user_snapshot_provider_health_failed user_id=%s",
            user_id,
            exc_info=True,
        )
        return None


async def load_user_snapshot(
    deps: UserSnapshotDeps,
    user_id: UUID,
    vertical_slug: str = REALTOR_VERTICAL_SLUG,
) -> dict[str, Any]:
    """Build the Desktop bootstrap snapshot for one vertical with module-aware fetches."""
    slug = normalize_snapshot_vertical_slug(vertical_slug)
    verticals, activations = await asyncio.gather(
        deps.list_verticals(),
        deps.list_user_vertical_activations(user_id),
    )
    runtime_config, runtime_configs = await resolve_snapshot_runtime_configs(deps, user_id, slug, activations)
    modules = list(runtime_config.get("modules") or [])
    profile, clients, deals, courses, artifacts, properties = await fetch_snapshot_domain_slices(
        deps,
        user_id,
        slug,
        modules,
    )
    provider_health = await load_snapshot_provider_health(deps.db, user_id)
    return {
        "verticals": verticals,
        "runtime_config": runtime_config,
        "runtime_configs": runtime_configs,
        "vertical_activations": activations,
        "profile": profile,
        "properties": properties,
        "clients": clients,
        "deals": deals,
        "courses": courses,
        "artifacts": artifacts,
        "provider_health": provider_health,
    }

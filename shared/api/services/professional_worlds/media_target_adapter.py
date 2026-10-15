# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Resolve professional-worlds media targets by vertical context (realtor listing vs unsupported).
# Invariants:
# - Realtor targets require an owned property UUID; consultant context is explicitly unsupported.
# - HTTP routes remain unchanged; services import this helper for future context-aware media paths.
# Related:
# - api/services/professional_worlds/realtor_properties_service.py
# - shared/web/frontend/src/features/professional-worlds/desktop/ProfessionalMediaWorkbench.tsx
# ---

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.realtor_properties_service import get_property

REALTOR_MEDIA_CONTEXT = "realtor"
CONSULTANT_MEDIA_CONTEXT = "consultant"


@dataclass(frozen=True, slots=True)
class MediaTarget:
    """Resolved media scope for a professional vertical context."""

    context_type: str
    property_id: UUID


class UnsupportedMediaContextError(ValueError):
    """Raised when listing media is requested for a vertical without a media target layer."""

    def __init__(self, context_type: str) -> None:
        self.context_type = context_type
        super().__init__(f"media context '{context_type}' is not supported")


class MediaTargetNotFoundError(LookupError):
    """Raised when the target id is missing or not owned by the authenticated user."""

    def __init__(self, context_type: str, target_id: UUID) -> None:
        self.context_type = context_type
        self.target_id = target_id
        super().__init__(f"media target not found for context '{context_type}' and id '{target_id}'")


async def resolve_media_target(
    db: AsyncSession,
    *,
    user_id: UUID,
    context_type: str,
    target_id: str | UUID,
) -> MediaTarget:
    """Map `(context_type, target_id)` to an owned realtor property or raise structured errors."""
    normalized_context = context_type.strip().lower()
    if normalized_context == CONSULTANT_MEDIA_CONTEXT:
        raise UnsupportedMediaContextError(normalized_context)
    if normalized_context != REALTOR_MEDIA_CONTEXT:
        raise UnsupportedMediaContextError(normalized_context)

    property_id = target_id if isinstance(target_id, UUID) else UUID(str(target_id).strip())
    if await get_property(db, user_id, property_id) is None:
        raise MediaTargetNotFoundError(normalized_context, property_id)

    return MediaTarget(context_type=normalized_context, property_id=property_id)

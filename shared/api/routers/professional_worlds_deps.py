# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Shared FastAPI dependencies and small helpers for Professional Worlds HTTP routes.
# Invariants:
# - `_current_user_id` rejects malformed authenticated user ids with HTTP 401.
# Related:
# - api/routers/professional_worlds.py
# - api/routers/professional_worlds_realtor_crm.py
# - api/routers/professional_worlds_realtor_media.py
# ---

from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, Request, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.services.professional_worlds.playbook_service import ProfessionalWorldsPlaybookService
from api.services.professional_worlds.service import ActiveSchemaValidationError, ProfessionalWorldsService


def _current_user_id(user: User) -> UUID:
    """Return current user UUID or fail with a clear auth error."""
    try:
        return UUID(str(user.id))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authenticated user id") from exc


def _service(db: AsyncSession) -> ProfessionalWorldsService:
    """Construct the Professional Worlds service."""
    return ProfessionalWorldsService(db)


def _schema_validation_http(exc: ActiveSchemaValidationError) -> HTTPException:
    """Map active schema validation failures to a structured 422 response."""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": "schema_validation_failed",
            "schema_key": exc.schema_key,
            "missing_fields": exc.missing_fields,
            "message": str(exc),
        },
    )


def _playbook_service(db: AsyncSession) -> ProfessionalWorldsPlaybookService:
    """Construct the Professional Worlds playbook orchestrator."""
    return ProfessionalWorldsPlaybookService(db)


def _sse(event: str, data: dict[str, Any]) -> str:
    """Format one SSE message."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _idempotency_key(body_key: str | None, request: Request) -> str | None:
    """Prefer body idempotency key, then common headers."""
    raw = body_key or request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
    if not raw:
        return None
    value = str(raw).strip()
    return value[:120] if value else None


def _strip_unresolved_prompt_tokens(prompt: str) -> str:
    """Remove unresolved mustache placeholders left in template text."""
    return re.sub(r"\{\{[^{}]+\}\}", "", prompt)


__all__ = (
    "_current_user_id",
    "_idempotency_key",
    "_playbook_service",
    "_schema_validation_http",
    "_service",
    "_sse",
    "_strip_unresolved_prompt_tokens",
)

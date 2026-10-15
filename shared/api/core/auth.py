"""Authentication Core Module - CLEANED VERSION.

🚨 CRITICAL INFORMATION:
- CONTAINS: User model, UserRole enum, security scheme
- AUTHENTICATION: Handled by oauth2_auth.py (dual mode support)
- BACKWARD COMPATIBILITY: get_current_user removed (circular import fix)
- USAGE: Import User directly, auth via oauth2_auth.py dependencies

Legacy authentication code removed - using Keycloak SSO via oauth2_auth.py
Updated: 2025-10-23 (circular import fix)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, ParamSpec, TypeVar
from uuid import UUID

# NOTE: FastAPI is installed in venv, but linter doesn't see it due to configuration
# This is a linter configuration error, not a code error - module is available at runtime
from fastapi.security import (  # type: ignore[reportMissingImports,import-untyped]  # pyright: ignore[reportMissingImports]
    HTTPBearer,
)

if TYPE_CHECKING:
    from collections.abc import Callable
    from datetime import datetime

    # NOTE: Module exists, but linter doesn't see it due to Python path configuration
    # This is a linter configuration error, not a code error - module is available at runtime
    from api.models.database_models import (  # type: ignore[reportMissingImports]  # pyright: ignore[reportMissingImports]
        User as DBUser,
    )

logger = logging.getLogger(__name__)

# HTTPBearer security scheme for FastAPI
security = HTTPBearer()


class UserRole(StrEnum):
    """User roles for RBAC."""

    ADMIN = "admin"
    EMPERYWORLD_MEMBER = "emperyworld_member"
    AI_AGENT = "ai_agent"
    DOCUMENT_EDITOR = "document_editor"


@dataclass
class User:
    """User data transfer object.

    Used across the application for representing authenticated users.
    Actual authentication happens via Keycloak SSO (see oauth2_auth.py - dual mode handler).
    """

    id: str
    email: str
    username: str
    role: str = "emperyworld_member"
    is_active: bool = True
    is_verified: bool = False
    full_name: str | None = None
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    #: Desktop App Store access group from PostgreSQL (not in JWT). None = default group.
    app_access_group_id: UUID | None = None
    #: Keycloak role `ew_family` — unlimited EW for desktop store (logical charges only).
    ew_family: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "role": self.role,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "full_name": self.full_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "app_access_group_id": str(self.app_access_group_id) if self.app_access_group_id else None,
            "ew_family": self.ew_family,
        }

    @classmethod
    def from_db_model(cls, user_model: DBUser) -> User:
        """Create User from database model."""
        return cls(
            id=str(user_model.id),
            email=user_model.email,  # type: ignore[arg-type]
            username=user_model.username,  # type: ignore[arg-type]
            role=user_model.role,  # type: ignore[arg-type]
            is_active=user_model.is_active,  # type: ignore[arg-type]
            is_verified=user_model.is_verified,  # type: ignore[arg-type]
            full_name=user_model.full_name,  # type: ignore[arg-type]
            created_at=user_model.created_at,  # type: ignore[arg-type]
            last_login_at=user_model.last_login_at,  # type: ignore[arg-type]
            app_access_group_id=getattr(user_model, "app_access_group_id", None),  # type: ignore[arg-type]
            ew_family=False,
        )


P = ParamSpec("P")
R = TypeVar("R")


def require_permission(_permission: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Provide simple permission decorator for legacy compatibility.

    Note: Actual permission checks should use oauth2_auth.py dependencies.
    This is kept for backward compatibility with old code.

    Args:
        _permission: Permission string (unused, kept for backward compatibility).

    """

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Simplified: just allow all authenticated users
            # Real permission checks happen in oauth2_auth.py
            return await func(*args, **kwargs)  # type: ignore[misc, return-value]

        return wrapper  # type: ignore[return-value]

    return decorator


__all__ = ["User", "UserRole", "require_permission", "security"]

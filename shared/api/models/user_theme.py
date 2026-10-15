#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ORM темы пользователя (JSONB, один активный на пользователя).
# Invariants:
# - created_at/updated_at — UTC naive через utc_now_naive.
# Related:
# - `database_models.User.themes`; сервисы темизации UI.
# ---

"""
User theme persistence (JSONB config, single active theme per user).

Stores personalized UI customization; cascades when user deletes.
"""

import uuid  # noqa: I001
from api.utils.datetime_helpers import utc_now_naive
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # type: ignore[import-not-found]
from sqlalchemy.orm import relationship, validates  # type: ignore[import-not-found]

from api.models.database_models import Base


class UserTheme(Base):
    """
    User theme model.
    Stores personalized UI themes for each user with:
    - Complete theme configuration in JSONB
    - Active theme tracking (only one active per user)
    - Automatic timestamps
    - Cascade deletion with user
    """

    __tablename__ = "user_themes"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    theme_data = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now_naive)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive)

    # Relationships
    user = relationship("User", back_populates="themes")

    # Constraints and Indexes
    __table_args__ = (
        CheckConstraint(
            "theme_data ? 'id' AND theme_data ? 'name' AND theme_data ? 'type' AND theme_data ? 'colors' AND theme_data ? 'effects'",
            name="user_themes_theme_data_check",
        ),
        Index("idx_user_themes_user_id", "user_id"),
        Index("idx_user_themes_active", "user_id", "is_active"),
        Index("idx_user_themes_created_at", "created_at"),
    )

    @validates("theme_data")
    def validate_theme_data(self, key: str, theme_data: dict[str, Any]) -> dict[str, Any]:  # noqa: ARG002
        """
        Validate theme_data structure
        Required keys: id, name, type, colors, effects
        """
        required_keys = ["id", "name", "type", "colors", "effects"]

        for required_key in required_keys:
            if required_key not in theme_data:
                msg = f"Theme data must contain '{required_key}' key"
                raise ValueError(msg)

        # Validate type
        if theme_data["type"] not in ["preset", "custom"]:
            msg = "Theme type must be 'preset' or 'custom'"
            raise ValueError(msg)

        # Validate colors structure
        if not isinstance(theme_data.get("colors"), dict):
            msg = "Theme colors must be a dictionary"
            raise TypeError(msg)

        required_colors = ["primary", "secondary", "accent", "background", "surface", "text"]
        for color_key in required_colors:
            if color_key not in theme_data["colors"]:
                msg = f"Theme colors must contain '{color_key}' key"
                raise ValueError(msg)

        # Validate effects structure
        if not isinstance(theme_data.get("effects"), dict):
            msg = "Theme effects must be a dictionary"
            raise TypeError(msg)

        return theme_data

    def to_dict(self) -> dict[str, Any]:
        """Convert theme to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "theme_data": self.theme_data,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }

    def __repr__(self) -> str:
        theme_name = self.theme_data.get("name", "Unknown")
        active_status = "ACTIVE" if self.is_active is True else "inactive"
        return f"<UserTheme(id={self.id}, user_id={self.user_id}, name='{theme_name}', {active_status})>"

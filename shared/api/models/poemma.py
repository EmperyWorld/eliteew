# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ORM models for POEMMA server-first workspace storage and per-user role bindings.
# Invariants:
# - Exactly one owner workspace per `owner_user_id`.
# - Membership role is constrained to owner/team/manager/smm/production.
# - `storage_payload` keeps scoped snapshot entries produced by frontend backup export.
# Related:
# - api/routers/poemma.py
# - api/services/poemma_service.py
# - api/migrations/applied/20260603_02_poemma_workspace_domain.sql
# ---

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from api.models.database_models import Base
from api.utils.datetime_helpers import utc_now_naive


class PoemmaWorkspace(Base):
    """Server-side snapshot workspace for a POEMMA owner."""

    __tablename__ = "poemma_workspaces"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_user_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    org_id = Column(String(120), nullable=False)
    payload_version = Column(String(32), nullable=False, default="v1")
    storage_payload = Column(JSON, nullable=False, default=dict)
    migrated_from_local = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)

    memberships = relationship(
        "PoemmaWorkspaceMembership",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class PoemmaWorkspaceMembership(Base):
    """Role binding for a user inside a POEMMA workspace."""

    __tablename__ = "poemma_workspace_memberships"
    __table_args__ = (PrimaryKeyConstraint("workspace_id", "user_id", name="poemma_workspace_memberships_pk"),)

    workspace_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("poemma_workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(24), nullable=False, default="team")
    created_at = Column(DateTime, nullable=False, default=utc_now_naive)
    updated_at = Column(DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive)

    workspace = relationship("PoemmaWorkspace", back_populates="memberships")

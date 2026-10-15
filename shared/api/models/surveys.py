# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ORM models for Survey Hub (surveys, questions, audience, responses, GAF deliveries).
# Invariants:
# - One response per user per survey (UNIQUE on survey_responses).
# Related:
# - api/services/surveys/
# - api/routers/product_desktop_surveys.py
# ---

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (  # type: ignore[import-untyped]
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship  # type: ignore[import-untyped]

from api.models.database_models import Base
from api.utils.datetime_helpers import utc_now_naive

if TYPE_CHECKING:
    from api.models.database_models import AppAccessGroup


class SurveyStatus(enum.StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class SurveyAudienceMode(enum.StrEnum):
    GROUPS_ONLY = "groups_only"
    USERS_ONLY = "users_only"
    GROUPS_OR_USERS = "groups_or_users"
    GROUPS_AND_USERS = "groups_and_users"


survey_audience_groups = Table(
    "survey_audience_groups",
    Base.metadata,
    Column(
        "survey_id",
        PGUUID(as_uuid=True),
        ForeignKey("surveys.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "app_access_group_id",
        PGUUID(as_uuid=True),
        ForeignKey("app_access_groups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


def _default_reward_json() -> dict[str, int]:
    return {"ugs_credits": 0, "ew_balance": 0, "web_search_coins": 0}


class Survey(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "surveys"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description_user: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_admin: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=SurveyStatus.DRAFT.value)
    audience_mode: Mapped[str] = mapped_column(
        String(32), nullable=False, default=SurveyAudienceMode.GROUPS_OR_USERS.value
    )
    reward_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=_default_reward_json)
    gaf_notify_body_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive
    )

    questions: Mapped[list[SurveyQuestion]] = relationship(
        "SurveyQuestion", back_populates="survey", cascade="all, delete-orphan"
    )
    audience_groups: Mapped[list[AppAccessGroup]] = relationship(
        "AppAccessGroup",
        secondary=survey_audience_groups,
        lazy="selectin",
    )
    audience_users: Mapped[list[SurveyAudienceUser]] = relationship(
        "SurveyAudienceUser", back_populates="survey", cascade="all, delete-orphan"
    )


class SurveyQuestion(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "survey_questions"
    __table_args__ = (UniqueConstraint("survey_id", "question_key", name="uq_survey_questions_key"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    survey_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_key: Mapped[str] = mapped_column(String(64), nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    options_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    validation_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now_naive, onupdate=utc_now_naive
    )

    survey: Mapped[Survey] = relationship("Survey", back_populates="questions")


class SurveyAudienceUser(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "survey_audience_users"

    survey_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    survey: Mapped[Survey] = relationship("Survey", back_populates="audience_users")


class SurveyResponse(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "survey_responses"
    __table_args__ = (UniqueConstraint("survey_id", "user_id", name="uq_survey_responses_user"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    survey_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answers_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    reward_granted_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    client_meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now_naive)


class SurveyGafDelivery(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "survey_gaf_deliveries"

    survey_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    sent_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now_naive)
    message_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)

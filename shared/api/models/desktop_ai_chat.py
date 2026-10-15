# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ORM tables for Desktop AI Chat (ensemble plans, chats, collaboration members, memory cells,
# discussion sessions/turns) on shared `Base`.
# Invariants:
# - `desktop_ai_chats.user_id` is the permanent creator (owner); members never rewrite ownership.
# - Memory cells are owner-scoped (≤3 soft quota); chats bind at most one via `memory_cell_id`.
# - At most one non-terminal discussion session per chat (enforced by partial unique index).
# Related:
# - `database_models.Base`; routers/services consuming desktop ensemble / Llama chat.
# - documentation/product/desktop/DESKTOP-AI-CHAT-COLLABORATION.md
# - documentation/product/desktop/DESKTOP-AI-CHAT-MEMORY-CELLS.md
# - documentation/product/desktop/DESKTOP-AI-CHAT-DISCUSSION-MODE.md
# ---

"""Desktop AI Chat (Llama) — ensemble plans and per-user/per-project chats."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (  # type: ignore[import-untyped]
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship  # type: ignore[import-untyped]

from api.models.database_models import Base


class DesktopAiChatConfig(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "desktop_ai_chat_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    defaults: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class DesktopEnsemblePlanTemplate(Base):  # type: ignore[valid-type,misc]
    """Blueprint plan template (JSON); merged with file catalog in blueprint/stream_turn."""

    __tablename__ = "desktop_ensemble_plan_templates"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    keywords: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class DesktopAiChatPromptTemplate(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "desktop_ai_chat_prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_key: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)


class DesktopAiChat(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "desktop_ai_chats"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Новый чат")
    llama_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    system_prompt_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    use_project_rag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    solo_slot_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    solo_slot_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    solo_slot_duration_hours: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    memory_cell_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("desktop_ai_memory_cells.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    messages: Mapped[list[DesktopAiChatMessage]] = relationship(
        "DesktopAiChatMessage",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="DesktopAiChatMessage.created_at",
    )
    attachments: Mapped[list[DesktopAiChatAttachment]] = relationship(
        "DesktopAiChatAttachment",
        back_populates="chat",
        cascade="all, delete-orphan",
    )
    members: Mapped[list[DesktopAiChatMember]] = relationship(
        "DesktopAiChatMember",
        back_populates="chat",
        cascade="all, delete-orphan",
    )
    discussion_sessions: Mapped[list[DesktopAiDiscussionSession]] = relationship(
        "DesktopAiDiscussionSession",
        back_populates="chat",
        cascade="all, delete-orphan",
    )


class DesktopAiChatMember(Base):  # type: ignore[valid-type,misc]
    """Friend collaboration membership (invite → accept → leave/revoke)."""

    __tablename__ = "desktop_ai_chat_members"
    __table_args__ = (UniqueConstraint("chat_id", "user_id", name="desktop_ai_chat_members_chat_user_uq"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chats.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="guest")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=datetime.now)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chat: Mapped[DesktopAiChat] = relationship("DesktopAiChat", back_populates="members")


class DesktopAiChatMessage(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "desktop_ai_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chats.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tool_calls: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSONB, nullable=True)
    message_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now)

    chat: Mapped[DesktopAiChat] = relationship("DesktopAiChat", back_populates="messages")


class DesktopAiChatAttachment(Base):  # type: ignore[valid-type,misc]
    __tablename__ = "desktop_ai_chat_attachments"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chats.id", ondelete="CASCADE"), nullable=False
    )
    content_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("unified_content.id", ondelete="SET NULL"), nullable=True
    )
    source_label: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rag_indexed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime, default=datetime.now)

    chat: Mapped[DesktopAiChat] = relationship("DesktopAiChat", back_populates="attachments")


class DesktopAiMemoryCell(Base):  # type: ignore[valid-type,misc]
    """Owner-scoped portable RAG memory extracted from a Desktop AI Chat."""

    __tablename__ = "desktop_ai_memory_cells"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="Память")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ready")
    source_chat_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chats.id", ondelete="SET NULL"), nullable=True
    )
    message_count_indexed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    char_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_built_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=datetime.now)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )


class DesktopAiDiscussionSession(Base):  # type: ignore[valid-type,misc]
    """Explicit Discussion mode session (bounded worker batches; never auto from Council)."""

    __tablename__ = "desktop_ai_discussion_sessions"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chats.id", ondelete="CASCADE"), nullable=False
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    anchor_message_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_chat_messages.id", ondelete="SET NULL"), nullable=True
    )
    preset_id: Mapped[str] = mapped_column(String(64), nullable=False)
    topic: Mapped[str] = mapped_column(Text, nullable=False, default="")
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    roster: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    intensity: Mapped[str] = mapped_column(String(32), nullable=False, default="professional_confrontational")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    pause_reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pause_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    total_ai_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checkpoint_ai_turns: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    segment_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_actor_hero_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    document_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_transcript_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    document_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lease_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    client_request_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    settings: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    participant_display_name: Mapped[str] = mapped_column(Text, nullable=False, default="")
    participant_role_title: Mapped[str] = mapped_column(Text, nullable=False, default="инкогнито")
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=datetime.now)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    chat: Mapped[DesktopAiChat] = relationship("DesktopAiChat", back_populates="discussion_sessions")
    turns: Mapped[list[DesktopAiDiscussionTurn]] = relationship(
        "DesktopAiDiscussionTurn",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="DesktopAiDiscussionTurn.ordinal",
        foreign_keys="DesktopAiDiscussionTurn.session_id",
    )


class DesktopAiDiscussionTurn(Base):  # type: ignore[valid-type,misc]
    """One Discussion transcript turn (AI / user / system) with stable ordinal."""

    __tablename__ = "desktop_ai_discussion_turns"
    __table_args__ = (UniqueConstraint("session_id", "ordinal", name="desktop_ai_discussion_turns_session_ordinal_uq"),)

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_discussion_sessions.id", ondelete="CASCADE"), nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    hero_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    relation: Mapped[str] = mapped_column(String(32), nullable=False, default="opening")
    reply_to_turn_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("desktop_ai_discussion_turns.id", ondelete="SET NULL"), nullable=True
    )
    tone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    turn_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    client_request_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=datetime.now)

    session: Mapped[DesktopAiDiscussionSession] = relationship(
        "DesktopAiDiscussionSession",
        back_populates="turns",
        foreign_keys=[session_id],
    )

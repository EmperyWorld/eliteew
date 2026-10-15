# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Consolidated SQLAlchemy declarative models for the legacy-compatible PostgreSQL schema (users/sessions,
# chat, AI generations, content, projects, Telegram, billing-related fields, UGS settings, etc.).
# Invariants:
# - Column definitions and table names MUST stay aligned with migrations and runtime expectations.
# Related:
# - `shared/api/migrations/`; import sites use `database_models.Base` and model symbols from this module.
# ---
"""EliteEW database models — SQLAlchemy ORM for PostgreSQL."""

# NOTE: SQLAlchemy Column types in class definitions are descriptors
# At runtime, accessing instance attributes (self.column) returns actual values, not Column objects
# Pyright cannot infer this, so we disable reportGeneralTypeIssues and reportArgumentType globally
# cSpell:ignore ELITEEW TSVECTOR onupdate ondelete backref supergroup dicom seaweedfs jtbd llama comfyui medichat monotykamary

# isort: off
import enum
import re
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

# UTC for compatibility with Python 3.10-3.12
# Imported from datetime, no need to reassign

from sqlalchemy import (  # type: ignore[import-not-found]
    ARRAY,
    DECIMAL,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import JSON as JSONB  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import INET, TSVECTOR  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # type: ignore[import-not-found]
from sqlalchemy.orm import declarative_base, relationship, validates  # type: ignore[import-not-found]
# isort: on

Base = declarative_base()


class User(Base):  # type: ignore[valid-type,misc]
    """
    User account, profile, billing-related fields, and related ORM edges.

    Comprehensive user model with authentication, profile, and security tracking.
    """

    __tablename__ = "users"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="emperyworld_member")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_trusted = Column(Boolean, default=False, server_default="false")
    is_system_account = Column(Boolean, default=False, server_default="false")
    admin_badge_label = Column(String(64), nullable=True)
    admin_badge_hint = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Profile fields
    full_name = Column(String(255))
    avatar_url = Column(Text)
    bio = Column(Text)
    preferences = Column(JSONB, default={})

    # Billing fields
    credits: Column[Decimal] = Column(DECIMAL(10, 2), default=100.0)  # Available credits
    daily_credit_limit = Column(Integer, default=100)  # Daily credit limit
    monthly_credit_limit = Column(Integer, default=3000)  # Monthly credit limit
    concurrent_requests_limit = Column(Integer, default=5)  # Concurrent requests limit

    # Authentication tracking
    last_login_at = Column(DateTime)
    onboarding_gaf_sent_at = Column(DateTime(timezone=True), nullable=True)
    login_count = Column(Integer, default=0)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime)

    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    ai_generations = relationship("AIGeneration", back_populates="user")
    themes = relationship("UserTheme", back_populates="user", cascade="all, delete-orphan")

    # Ultimate Document Editor relationships
    ultimate_documents = relationship("UltimateDocument", back_populates="user", cascade="all, delete-orphan")
    ultimate_ai_prompts = relationship("UltimateAIPrompt", back_populates="user", cascade="all, delete-orphan")

    # Audio transcription (Whisper jobs); model lives in `transcription.py` (same Base, no import cycle).
    transcriptions = relationship("Transcription", back_populates="user", cascade="all, delete-orphan")

    # Desktop configuration relationship
    desktop_config = relationship("DesktopConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    site_instance = relationship("UserSiteInstance", back_populates="user", uselist=False, cascade="all, delete-orphan")
    installed_apps = relationship("UserInstalledApp", back_populates="user", cascade="all, delete-orphan")

    # Desktop app store: which access group determines visible apps (NULL = default group)
    app_access_group_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("app_access_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    app_access_group = relationship("AppAccessGroup", back_populates="users")

    # Elite Worlds balance (desktop app store monthly billing; EW not used for UGS tokens)
    ew_balance = Column(Integer, nullable=False, default=100, server_default="100")

    # Web search quota: admin coins + optional per-user monthly cap (NULL = platform default)
    web_search_coins = Column(Integer, nullable=False, default=0, server_default="0")
    web_search_monthly_limit = Column(Integer, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint("length(username) >= 3", name="users_username_length"),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="users_email_format",
        ),
        CheckConstraint(
            "role IN ('admin', 'emperyworld_member', 'ai_agent', 'moderator')",
            name="users_role_valid",
        ),
        CheckConstraint("web_search_coins >= 0", name="users_web_search_coins_nonneg"),
        CheckConstraint(
            "web_search_monthly_limit IS NULL OR web_search_monthly_limit >= 0",
            name="users_web_search_monthly_limit_nonneg",
        ),
        Index("idx_users_username", "username"),
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
        Index("idx_users_created_at", "created_at"),
    )

    @validates("email")
    def validate_email(self, key: str, address: str) -> str:  # noqa: ARG002
        """Validate email format"""
        pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
        if not re.match(pattern, address):
            msg = "Invalid email format"
            raise ValueError(msg)
        return address

    @validates("username")
    def validate_username(self, key: str, username: str) -> str:  # noqa: ARG002
        """Validate username length"""
        min_username_length = 3
        if len(username) < min_username_length:
            msg = "Username must be at least 3 characters"
            raise ValueError(msg)
        return username

    def to_dict(self) -> dict[str, Any]:
        """Convert user to dictionary (excluding sensitive data)"""
        return {
            "id": str(self.id),
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "preferences": self.preferences,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at is not None else None,
            "login_count": self.login_count,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class WebSearchMonthlyUsage(Base):  # type: ignore[valid-type,misc]
    """Monthly web search consumption counter per user (calendar month, UTC)."""

    __tablename__ = "web_search_monthly_usage"

    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    period_month = Column(Date, primary_key=True)
    used_count = Column(Integer, nullable=False, default=0, server_default="0")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    user = relationship("User", backref="web_search_monthly_usage_rows")

    __table_args__ = (
        CheckConstraint("used_count >= 0", name="web_search_monthly_usage_used_nonneg"),
        Index("idx_web_search_monthly_usage_period", "period_month"),
    )


class UserSession(Base):  # type: ignore[valid-type,misc]
    """
    Authenticated session row (JWT and security tracking).

    JWT session management with security tracking.
    """

    __tablename__ = "user_sessions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False)
    refresh_token_hash = Column(String(255), unique=True)
    expires_at = Column(DateTime, nullable=False)
    refresh_expires_at = Column(DateTime)
    ip_address = Column(INET)
    user_agent = Column(Text)
    device_info = Column(JSONB, default={})
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)

    # Security fields
    suspicious_activity = Column(Boolean, default=False)
    location_info = Column(JSONB, default={})

    # Relationships
    user = relationship("User", back_populates="sessions")

    # Constraints
    __table_args__ = (
        CheckConstraint("expires_at > created_at", name="session_expires_future"),
        Index("idx_user_sessions_user_id", "user_id"),
        Index("idx_user_sessions_token_hash", "token_hash"),
        Index("idx_user_sessions_expires_at", "expires_at"),
        Index("idx_user_sessions_is_active", "is_active"),
    )

    def is_expired(self) -> bool:
        """Check if session is expired"""
        if self.expires_at is None:
            return False
        expires_at_value = self.expires_at
        if isinstance(expires_at_value, datetime):
            return datetime.now(UTC) > expires_at_value
        return False

    def to_dict(self) -> dict[str, Any]:
        """Convert session to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "expires_at": self.expires_at.isoformat(),
            "ip_address": str(self.ip_address) if self.ip_address is not None else None,
            "user_agent": self.user_agent,
            "device_info": self.device_info,
            "is_active": self.is_active,
            "last_used_at": self.last_used_at.isoformat(),
            "created_at": self.created_at.isoformat(),
            "suspicious_activity": self.suspicious_activity,
            "location_info": self.location_info,
        }


class ChatSession(Base):  # type: ignore[valid-type,misc]
    """
    Chat session container (settings and usage stats).

    AI chat sessions with comprehensive settings and statistics.
    """

    __tablename__ = "chat_sessions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, default="New Chat")
    model_name = Column(String(100), nullable=False)
    status = Column(String(20), default="active")

    # Chat configuration
    settings = Column(
        JSONB,
        default={
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 1.0,
            "frequency_penalty": 0,
            "presence_penalty": 0,
        },
    )

    # Statistics
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    total_cost: Column[Decimal] = Column(DECIMAL(10, 4), default=Decimal("0.0000"))

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_message_at = Column(DateTime)

    # Metadata
    tags: Column[list[str]] = Column(ARRAY(String), default=[])
    is_favorite = Column(Boolean, default=False)
    shared_with: Column[list[str]] = Column(ARRAY(String), default=[])

    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    session_documents = relationship("ChatSessionDocument", back_populates="session", cascade="all, delete-orphan")
    ai_generations = relationship("AIGeneration", back_populates="session")

    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('active', 'archived', 'deleted', 'shared')", name="chat_status_valid"),
        CheckConstraint("length(title) <= 255", name="chat_title_length"),
        Index("idx_chat_sessions_user_id", "user_id"),
        Index("idx_chat_sessions_status", "status"),
        Index("idx_chat_sessions_created_at", "created_at"),
        Index("idx_chat_sessions_model_name", "model_name"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert chat session to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "model_name": self.model_name,
            "status": self.status,
            "settings": self.settings,
            "message_count": self.message_count,
            "total_tokens": self.total_tokens,
            "total_cost": float(self.total_cost) if self.total_cost is not None else 0.0,  # type: ignore[arg-type]
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at is not None else None,
            "tags": self.tags,
            "is_favorite": self.is_favorite,
            "shared_with": self.shared_with,
        }


class ChatMessage(Base):  # type: ignore[valid-type,misc]
    """
    Single message in a chat session (incl. AI performance metadata).

    Individual chat messages with AI performance metrics.
    """

    __tablename__ = "chat_messages"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    reply_to = Column(PG_UUID(as_uuid=True), ForeignKey("chat_messages.id", ondelete="SET NULL"), nullable=True)
    attached_content_ids: Column[list[uuid.UUID]] = Column(ARRAY(PG_UUID(as_uuid=True)), default=[], nullable=False)

    # AI specific fields
    model_name = Column(String(100))
    token_count = Column(Integer)
    finish_reason = Column(String(50))

    # Performance metrics
    response_time_ms = Column(Integer)
    processing_started_at = Column(DateTime)
    processing_completed_at = Column(DateTime)

    # Metadata
    meta_data = Column("metadata", JSONB, default={})  # Use meta_data in code, but metadata in DB
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    # Constraints
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system', 'function')", name="message_role_valid"),
        CheckConstraint("length(trim(content)) > 0", name="message_content_not_empty"),
        Index("idx_chat_messages_session_id", "session_id"),
        Index("idx_chat_messages_role", "role"),
        Index("idx_chat_messages_created_at", "created_at"),
        Index("idx_chat_messages_model_name", "model_name"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert chat message to dictionary"""
        return {
            "id": str(self.id),
            "session_id": str(self.session_id),
            "role": self.role,
            "content": self.content,
            "model_name": self.model_name,
            "token_count": self.token_count,
            "finish_reason": self.finish_reason,
            "response_time_ms": self.response_time_ms,
            "processing_started_at": self.processing_started_at.isoformat()
            if self.processing_started_at is not None
            else None,
            "processing_completed_at": self.processing_completed_at.isoformat()
            if self.processing_completed_at is not None
            else None,
            "attached_content_ids": [str(cid) for cid in (self.attached_content_ids or [])],
            "metadata": self.meta_data,  # meta_data in code, metadata in JSON
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
        }


class ChatSessionDocument(Base):  # type: ignore[valid-type,misc]
    """
    RAG: documents attached to a chat session for knowledge-base search.
    M2M link session <-> unified_content with indexed_status (pending/processing/indexed/error).
    """

    __tablename__ = "chat_session_documents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("unified_content.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    indexed_status = Column(String(20), nullable=False, default="pending")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    # Relationships
    session = relationship("ChatSession", back_populates="session_documents")
    user = relationship("User", backref="chat_session_documents")

    __table_args__ = (
        CheckConstraint(
            "indexed_status IN ('pending', 'processing', 'indexed', 'error')",
            name="chat_session_doc_status_valid",
        ),
        UniqueConstraint("session_id", "document_id", name="uq_chat_session_documents_session_doc"),
        Index("idx_chat_session_documents_session_id", "session_id"),
        Index("idx_chat_session_documents_document_id", "document_id"),
        Index("idx_chat_session_documents_user_id", "user_id"),
        Index("idx_chat_session_documents_indexed_status", "indexed_status"),
    )


class AIGeneration(Base):  # type: ignore[valid-type,misc]
    """
    AI generation job / result tracking.

    Comprehensive AI generation tracking with performance metrics.
    """

    __tablename__ = "ai_generations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    session_id = Column(PG_UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL"))

    # Generation details
    type = Column(String(50), nullable=False)  # 'text', 'image', 'code', 'analysis', 'translation'
    prompt = Column(Text, nullable=False)
    result = Column(Text)
    model_name = Column(String(100), nullable=False)
    status = Column(String(20), default="pending")

    # Error handling
    error_message = Column(Text)
    error_code = Column(String(50))
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Performance & cost tracking
    processing_time_ms = Column(Integer)
    tokens_used = Column(Integer)
    cost_estimate: Column[Decimal | None] = Column(DECIMAL(10, 4))
    quality_score: Column[Decimal | None] = Column(DECIMAL(3, 2))  # 0.00 to 1.00

    # Advanced metadata
    meta_data = Column("metadata", JSONB, default={})  # Use meta_data in code, but metadata in DB
    input_parameters = Column(JSONB, default={})
    output_metadata = Column(JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Version control
    version = Column(Integer, default=1)
    parent_generation_id = Column(PG_UUID(as_uuid=True), ForeignKey("ai_generations.id", ondelete="SET NULL"))

    # Relationships
    user = relationship("User", back_populates="ai_generations")
    session = relationship("ChatSession", back_populates="ai_generations")
    parent_generation = relationship("AIGeneration", remote_side=[id])

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "type IN ('text', 'image', 'code', 'analysis', 'translation', 'summarization')",
            name="ai_gen_type_valid",
        ),
        CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')",
            name="ai_gen_status_valid",
        ),
        CheckConstraint(
            "quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)",
            name="ai_gen_quality_range",
        ),
        Index("idx_ai_generations_user_id", "user_id"),
        Index("idx_ai_generations_session_id", "session_id"),
        Index("idx_ai_generations_type", "type"),
        Index("idx_ai_generations_status", "status"),
        Index("idx_ai_generations_model_name", "model_name"),
        Index("idx_ai_generations_created_at", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert AI generation to dictionary"""
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "session_id": str(self.session_id) if self.session_id is not None else None,
            "type": self.type,
            "prompt": self.prompt,
            "result": self.result,
            "model_name": self.model_name,
            "status": self.status,
            "error_message": self.error_message,
            "error_code": self.error_code,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "processing_time_ms": self.processing_time_ms,
            "tokens_used": self.tokens_used,
            "cost_estimate": float(self.cost_estimate) if self.cost_estimate is not None else None,  # type: ignore[arg-type]
            "quality_score": float(self.quality_score) if self.quality_score is not None else None,  # type: ignore[arg-type]
            "metadata": self.meta_data,  # meta_data in code, metadata in JSON
            "input_parameters": self.input_parameters,
            "output_metadata": self.output_metadata,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at is not None else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at is not None else None,
            "version": self.version,
            "parent_generation_id": str(self.parent_generation_id) if self.parent_generation_id is not None else None,
        }


class AgentConfig(Base):  # type: ignore[valid-type,misc]
    """
    Named agent configuration (capabilities and usage analytics).

    AI agent configurations with capabilities and usage analytics.
    """

    __tablename__ = "agent_configs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    type = Column(String(50), nullable=False)
    display_name = Column(String(255))
    description = Column(Text)

    # Configuration
    config = Column(JSONB, nullable=False, default={})
    capabilities: Column[list[str]] = Column(ARRAY(String), default=[])
    supported_models: Column[list[str]] = Column(ARRAY(String), default=[])

    # Status
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)

    # Usage analytics
    usage_count = Column(Integer, default=0)
    success_rate: Column[Decimal] = Column(DECIMAL(5, 2), default=Decimal("0.00"))
    average_response_time = Column(Integer)  # in milliseconds
    last_used_at = Column(DateTime)

    # Version control
    version = Column(String(20), default="1.0.0")
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    updated_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Metadata
    meta_data = Column("metadata", JSONB, default={})  # Use meta_data in code, but metadata in DB
    tags: Column[list[str]] = Column(ARRAY(String), default=[])

    # Constraints
    __table_args__ = (
        Index("idx_agent_configs_name", "name"),
        Index("idx_agent_configs_type", "type"),
        Index("idx_agent_configs_is_active", "is_active"),
        Index("idx_agent_configs_is_public", "is_public"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert agent config to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "type": self.type,
            "display_name": self.display_name,
            "description": self.description,
            "config": self.config,
            "capabilities": self.capabilities,
            "supported_models": self.supported_models,
            "is_active": self.is_active,
            "is_public": self.is_public,
            "usage_count": self.usage_count,
            "success_rate": float(self.success_rate) if self.success_rate is not None else 0.0,  # type: ignore[arg-type]
            "average_response_time": self.average_response_time,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at is not None else None,
            "version": self.version,
            "created_by": str(self.created_by) if self.created_by is not None else None,
            "updated_by": str(self.updated_by) if self.updated_by is not None else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.meta_data,  # meta_data in code, metadata in JSON
            "tags": self.tags,
        }


# Additional utility models (documents, logs, Telegram, content, billing-related types, …)


class Document(Base):  # type: ignore[valid-type,misc]
    """Unified-editor `documents` row (stack1 schema): текст и метаданные; владелец — `author_id` (UUID string)."""

    __tablename__ = "documents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    content = Column(Text)
    document_type = Column(String(50), nullable=False, default="md")
    status = Column(String(50), default="draft")
    author_id = Column(String(255), nullable=False)
    collaborators = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    doc_metadata = Column("doc_metadata", JSONB, default=dict)
    tags: Column[list[str]] = Column(ARRAY(String), default=list)
    is_template = Column(Boolean, default=False)
    access_level = Column(String(20), default="private")

    __table_args__ = (
        Index("idx_documents_author_id", "author_id"),
        Index("idx_documents_status", "status"),
        Index("idx_documents_document_type", "document_type"),
        Index("idx_documents_created_at", "created_at"),
        Index("idx_documents_updated_at", "updated_at"),
    )


class APILog(Base):  # type: ignore[valid-type,misc]
    """API request logging model"""

    __tablename__ = "api_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    ip_address = Column(INET)
    user_agent = Column(Text)
    request_data = Column(JSONB)
    response_data = Column(JSONB)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("idx_api_logs_user_id", "user_id"),
        Index("idx_api_logs_endpoint", "endpoint"),
        Index("idx_api_logs_status_code", "status_code"),
        Index("idx_api_logs_created_at", "created_at"),
    )


class SystemMetric(Base):  # type: ignore[valid-type,misc]
    """System metrics model"""

    __tablename__ = "system_metrics"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name = Column(String(100), nullable=False)
    metric_value: Column[Decimal | None] = Column(DECIMAL(15, 4))
    metric_unit = Column(String(20))
    metric_type = Column(String(50))  # 'counter', 'gauge', 'histogram'
    labels = Column(JSONB, default={})
    timestamp = Column(DateTime, default=datetime.now)
    # Optional: used by metrics_storage / Prometheus-style ingestion
    service_name = Column(String(255), nullable=True)
    host = Column(String(255), nullable=True)
    value = Column(DECIMAL(15, 4), nullable=True)  # alias used by some metrics writers
    unit = Column(String(20), nullable=True)  # alias for metric_unit used by some metrics writers
    name = Column(String(255), nullable=True)  # alias for metric_name (Prometheus-style)
    type = Column(String(50), nullable=True)  # alias for metric_type (Prometheus-style)
    tags = Column(JSONB, nullable=True)  # used by some metrics writers (alias/label style)

    __table_args__ = (
        Index("idx_system_metrics_name", "metric_name"),
        Index("idx_system_metrics_type", "metric_type"),
        Index("idx_system_metrics_timestamp", "timestamp"),
    )


# EXPORT ALL MODELS
class DiagnosticReport(Base):  # type: ignore[valid-type,misc]
    """
    Diagnostic report model.
    AI-powered system diagnostics reports with full analysis
    """

    __tablename__ = "diagnostic_reports"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(String(100), unique=True, nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))

    # Report metadata
    mode = Column(String(50), nullable=False)  # quick, deep, forensic, predictive, browser
    status = Column(String(50), nullable=False, default="running")  # running, completed, error

    # Analysis results
    executive_summary = Column(Text, nullable=False)
    ai_analysis = Column(Text)

    # Structured data (JSONB for flexibility)
    system_metrics = Column(JSONB, default={})
    configuration_analysis = Column(JSONB, default=[])
    log_analysis = Column(JSONB, default={})
    action_plan = Column(JSONB, default={})
    browser_console_analysis = Column(JSONB)  # nullable

    # Metadata
    generated_by = Column(String(100), nullable=False)
    error_message = Column(Text)
    processing_time_ms = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        CheckConstraint(
            "mode IN ('quick', 'deep', 'forensic', 'predictive', 'browser')",
            name="diagnostic_reports_mode_valid",
        ),
        CheckConstraint("status IN ('running', 'completed', 'error')", name="diagnostic_reports_status_valid"),
        Index("idx_diagnostic_reports_report_id", "report_id"),
        Index("idx_diagnostic_reports_user_id", "user_id"),
        Index("idx_diagnostic_reports_mode", "mode"),
        Index("idx_diagnostic_reports_status", "status"),
        Index("idx_diagnostic_reports_created_at", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert report to dictionary"""
        return {
            "id": str(self.id),
            "report_id": self.report_id,
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "mode": self.mode,
            "status": self.status,
            "executive_summary": self.executive_summary,
            "ai_analysis": self.ai_analysis,
            "system_metrics": self.system_metrics,
            "configuration_analysis": self.configuration_analysis,
            "log_analysis": self.log_analysis,
            "action_plan": self.action_plan,
            "browser_console_analysis": self.browser_console_analysis,
            "generated_by": self.generated_by,
            "error_message": self.error_message,
            "processing_time_ms": self.processing_time_ms,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "started_at": self.started_at.isoformat() if self.started_at is not None else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at is not None else None,
        }


# ========================================
# TELEGRAM INTEGRATION MODELS
# ========================================


class TelegramUser(Base):  # type: ignore[valid-type,misc]
    """
    Links EliteEW users to Telegram accounts
    """

    __tablename__ = "telegram_users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    telegram_user_id = Column(BigInteger, unique=True, nullable=False)
    telegram_username = Column(String(255))
    telegram_first_name = Column(String(255))
    telegram_last_name = Column(String(255))
    telegram_photo_url = Column(Text)
    is_bot = Column(Boolean, default=False)
    language_code = Column(String(10))
    is_premium = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    user = relationship("User", backref="telegram_users")

    # Constraints
    __table_args__ = (
        Index("idx_telegram_users_telegram_id", "telegram_user_id"),
        Index("idx_telegram_users_user_id", "user_id"),
        Index("idx_telegram_users_username", "telegram_username"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "telegram_user_id": self.telegram_user_id,
            "telegram_username": self.telegram_username,
            "telegram_first_name": self.telegram_first_name,
            "telegram_last_name": self.telegram_last_name,
            "telegram_photo_url": self.telegram_photo_url,
            "is_bot": self.is_bot,
            "language_code": self.language_code,
            "is_premium": self.is_premium,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class TelegramChat(Base):  # type: ignore[valid-type,misc]
    """
    Telegram chats, groups, and channels metadata
    """

    __tablename__ = "telegram_chats"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(BigInteger, unique=True, nullable=False)
    chat_type = Column(String(20), nullable=False)
    title = Column(String(255))
    username = Column(String(255))
    description = Column(Text)
    invite_link = Column(Text)
    member_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "chat_type IN ('private', 'group', 'supergroup', 'channel')",
            name="telegram_chats_type_valid",
        ),
        Index("idx_telegram_chats_chat_id", "chat_id"),
        Index("idx_telegram_chats_type", "chat_type"),
        Index("idx_telegram_chats_username", "username"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "chat_id": self.chat_id,
            "chat_type": self.chat_type,
            "title": self.title,
            "username": self.username,
            "description": self.description,
            "invite_link": self.invite_link,
            "member_count": self.member_count,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class TelegramMessage(Base):  # type: ignore[valid-type,misc]
    """
    Telegram message history for analytics
    """

    __tablename__ = "telegram_messages"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(BigInteger, nullable=False)
    chat_id = Column(BigInteger, nullable=False)
    telegram_user_id = Column(BigInteger)
    text = Column(Text)
    message_type = Column(String(50), default="text")
    file_id = Column(String(255))
    file_unique_id = Column(String(255))
    reply_to_message_id = Column(BigInteger)
    forward_from_chat_id = Column(BigInteger)
    edit_date = Column(DateTime)
    is_bot = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    # Constraints
    __table_args__ = (
        UniqueConstraint("chat_id", "message_id", name="unique_telegram_message"),
        Index("idx_telegram_messages_chat", "chat_id", "created_at"),
        Index("idx_telegram_messages_user", "telegram_user_id", "created_at"),
        Index("idx_telegram_messages_type", "message_type"),
        Index("idx_telegram_messages_created", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "message_id": self.message_id,
            "chat_id": self.chat_id,
            "telegram_user_id": self.telegram_user_id,
            "text": self.text,
            "message_type": self.message_type,
            "file_id": self.file_id,
            "file_unique_id": self.file_unique_id,
            "reply_to_message_id": self.reply_to_message_id,
            "forward_from_chat_id": self.forward_from_chat_id,
            "edit_date": self.edit_date.isoformat() if self.edit_date is not None else None,
            "is_bot": self.is_bot,
            "created_at": self.created_at.isoformat(),
        }


class TelegramBotCommand(Base):  # type: ignore[valid-type,misc]
    """
    Bot command execution log for monitoring
    """

    __tablename__ = "telegram_bot_commands"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_user_id = Column(BigInteger, nullable=False)
    chat_id = Column(BigInteger, nullable=False)
    command = Column(String(100), nullable=False)
    arguments = Column(Text)
    response = Column(Text)
    execution_time_ms = Column(Integer)
    status = Column(String(20), default="success")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)

    # Constraints
    __table_args__ = (
        CheckConstraint("status IN ('success', 'error', 'timeout')", name="telegram_bot_commands_status_valid"),
        Index("idx_telegram_bot_commands_user", "telegram_user_id", "created_at"),
        Index("idx_telegram_bot_commands_command", "command"),
        Index("idx_telegram_bot_commands_status", "status"),
        Index("idx_telegram_bot_commands_created", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "telegram_user_id": self.telegram_user_id,
            "chat_id": self.chat_id,
            "command": self.command,
            "arguments": self.arguments,
            "response": self.response,
            "execution_time_ms": self.execution_time_ms,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat(),
        }


class TelegramNotification(Base):  # type: ignore[valid-type,misc]
    """
    Outgoing notification queue for Telegram
    """

    __tablename__ = "telegram_notifications"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    telegram_user_id = Column(BigInteger)
    chat_id = Column(BigInteger)
    message_text = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")
    media_url = Column(Text)
    priority = Column(Integer, default=5)
    scheduled_at = Column(DateTime)
    sent_at = Column(DateTime)
    status = Column(String(20), default="pending")
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    user = relationship("User", backref="telegram_notifications")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "message_type IN ('text', 'photo', 'video', 'document')",
            name="telegram_notifications_type_valid",
        ),
        CheckConstraint("priority BETWEEN 1 AND 10", name="telegram_notifications_priority_valid"),
        CheckConstraint(
            "status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')",
            name="telegram_notifications_status_valid",
        ),
        Index("idx_telegram_notifications_status", "status", "scheduled_at"),
        Index("idx_telegram_notifications_user", "user_id"),
        Index("idx_telegram_notifications_telegram_user", "telegram_user_id"),
        Index("idx_telegram_notifications_priority", "priority", "created_at"),
        Index("idx_telegram_notifications_scheduled", "scheduled_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "telegram_user_id": self.telegram_user_id,
            "chat_id": self.chat_id,
            "message_text": self.message_text,
            "message_type": self.message_type,
            "media_url": self.media_url,
            "priority": self.priority,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at is not None else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at is not None else None,
            "status": self.status,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ========================================
# UNIFIED CONTENT MODELS
# ========================================


class UnifiedContent(Base):  # type: ignore[valid-type,misc]
    """
    Unified content system for all types of content
    """

    __tablename__ = "unified_content"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    content_type = Column(String(50), nullable=False)
    mime_type = Column(String(100))
    name = Column(String(255))
    title = Column(String(500))
    description = Column(Text)
    tags: Column[list[str]] = Column(ARRAY(String), default=[])
    storage_backend = Column(String(50), default="postgresql")
    file_path = Column(Text)
    file_data = Column(LargeBinary)
    file_size = Column(Integer)
    file_hash = Column(String(64))
    extracted_text = Column(Text)
    version = Column(Integer, default=1)
    visibility = Column(String(20), default="private")
    access_level = Column(String(20), default="private")
    is_public = Column(Boolean, default=False)
    word_count = Column(Integer, default=0)
    character_count = Column(Integer, default=0)
    content_metadata = Column(JSONB, default={})
    search_vector = Column(TSVECTOR)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    last_accessed_at = Column(DateTime, default=datetime.now)
    deleted_at = Column(DateTime)
    marketing_rag_included = Column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", backref="unified_contents")
    versions = relationship("ContentVersion", back_populates="unified_content", cascade="all, delete-orphan")
    comment_threads = relationship(
        "UnifiedContentCommentThread",
        back_populates="content",
        cascade="all, delete-orphan",
        foreign_keys="UnifiedContentCommentThread.content_id",
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "content_type IN ('document', 'image', 'video', 'audio', 'presentation', 'analysis', 'other')",
            name="unified_content_type_valid",
        ),
        CheckConstraint(
            "visibility IN ('private', 'shared', 'public', 'friends')",
            name="unified_content_visibility_valid",
        ),
        CheckConstraint(
            "access_level IN ('private', 'shared', 'public')",
            name="unified_content_access_level_valid",
        ),
        CheckConstraint(
            "storage_backend IN ('postgresql', 'minio', 'seaweedfs', 'filesystem')",
            name="unified_content_storage_valid",
        ),
        Index("idx_uc_user_id", "user_id"),
        Index("idx_uc_content_type", "content_type"),
        Index("idx_uc_visibility", "visibility"),
        Index("idx_uc_is_public", "is_public"),
        Index("idx_uc_created_at", "created_at"),
        Index("idx_uc_title", "title"),
        Index("idx_uc_word_count", "word_count"),
        Index("idx_uc_search_vector", "search_vector", postgresql_using="gin"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "content_type": self.content_type,
            "mime_type": self.mime_type,
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "tags": self.tags,
            "storage_backend": self.storage_backend,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "extracted_text": self.extracted_text[:500]
            if self.extracted_text is not None
            else None,  # Truncate for display
            "version": self.version,
            "visibility": self.visibility,
            "access_level": self.access_level,
            "is_public": self.is_public,
            "word_count": self.word_count,
            "character_count": self.character_count,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "last_accessed_at": self.last_accessed_at.isoformat() if self.last_accessed_at is not None else None,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at is not None else None,
        }


class ContentVersion(Base):  # type: ignore[valid-type,misc]
    """
    Version history for unified content
    """

    __tablename__ = "content_versions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(PG_UUID(as_uuid=True), ForeignKey("unified_content.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    file_path = Column(Text)
    file_data = Column(LargeBinary)
    file_size = Column(Integer)
    file_hash = Column(String(64))
    content_metadata = Column(JSONB, default={})
    changes_description = Column(Text)
    changed_by = Column(String(255))
    change_type = Column(String(50), default="update")
    title = Column(String(500))
    content = Column(Text)
    word_count = Column(Integer)
    character_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    unified_content = relationship("UnifiedContent", back_populates="versions")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "change_type IN ('create', 'update', 'delete', 'restore')",
            name="content_version_change_type_valid",
        ),
        Index("idx_cv_content_id", "content_id"),
        Index("idx_cv_version", "version"),
        Index("idx_cv_created_at", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "content_id": str(self.content_id),
            "version": self.version,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "metadata": self.metadata,
            "changes_description": self.changes_description,
            "changed_by": self.changed_by,
            "change_type": self.change_type,
            "title": self.title,
            "content": self.content[:500] if self.content is not None else None,  # Truncate
            "word_count": self.word_count,
            "character_count": self.character_count,
            "created_at": self.created_at.isoformat(),
        }


# ========================================
# UNIFIED CONTENT COMMENTS (doc editor)
# ========================================


class UnifiedContentCommentThread(Base):  # type: ignore[valid-type,misc]
    """Comment thread (one per selection) for doc editor."""

    __tablename__ = "unified_content_comment_threads"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("unified_content.id", ondelete="CASCADE"),
        nullable=False,
    )
    selection = Column(JSONB, default=dict)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    content = relationship("UnifiedContent", back_populates="comment_threads")
    creator = relationship("User")
    comments = relationship(
        "UnifiedContentComment",
        back_populates="thread",
        cascade="all, delete-orphan",
        foreign_keys="UnifiedContentComment.thread_id",
    )


class UnifiedContentComment(Base):  # type: ignore[valid-type,misc]
    """Single comment or reply in a thread."""

    __tablename__ = "unified_content_comments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("unified_content_comment_threads.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_comment_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("unified_content_comments.id", ondelete="CASCADE"),
        nullable=True,
    )
    author_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    thread = relationship("UnifiedContentCommentThread", back_populates="comments", foreign_keys=[thread_id])
    author = relationship("User", foreign_keys=[author_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'resolved', 'deleted')",
            name="unified_content_comments_status_check",
        ),
    )


# ========================================
# COMPANY & PROJECT MODELS
# ========================================


class Company(Base):  # type: ignore[valid-type,misc]
    """
    Company model.
    Multi-tenant company management with subscription tiers
    """

    __tablename__ = "companies"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, unique=True)
    industry = Column(String(100))
    size: Column[str | None] = Column(
        PG_ENUM("solo", "small", "medium", "large", "enterprise", name="company_size", create_type=False)
    )
    country = Column(String(100))
    timezone = Column(String(100))
    website = Column(String(500))
    description = Column(Text)
    logo_url = Column(String(500))
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    representative_user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Subscription management
    subscription_tier: Column[str] = Column(
        PG_ENUM(
            "free",
            "starter",
            "professional",
            "enterprise",
            name="subscription_tier",
            create_type=False,
        ),
        default="free",
    )
    subscription_status: Column[str] = Column(
        PG_ENUM("active", "trial", "expired", "cancelled", name="subscription_status", create_type=False),
        default="active",
    )
    subscription_expires_at = Column(DateTime)

    # Resource limits
    max_users = Column(Integer, default=5)
    max_projects = Column(Integer, default=10)
    max_storage_gb = Column(Integer, default=10)

    # Flexible fields
    settings = Column(JSONB, default={})
    meta_data = Column("metadata", JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime)

    # Relationships
    projects = relationship("Project", back_populates="company")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "size IN ('startup', 'small', 'medium', 'large', 'enterprise')",
            name="companies_size_valid",
        ),
        CheckConstraint(
            "subscription_tier IN ('free', 'starter', 'professional', 'enterprise')",
            name="companies_tier_valid",
        ),
        CheckConstraint(
            "subscription_status IN ('active', 'expired', 'cancelled', 'suspended')",
            name="companies_status_valid",
        ),
        Index("idx_companies_slug", "slug"),
        Index("idx_companies_subscription_tier", "subscription_tier"),
        Index("idx_companies_created_at", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert company to dictionary"""
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "industry": self.industry,
            "size": self.size,
            "country": self.country,
            "timezone": self.timezone,
            "website": self.website,
            "description": self.description,
            "logo_url": self.logo_url,
            "subscription_tier": self.subscription_tier,
            "subscription_status": self.subscription_status,
            "subscription_expires_at": self.subscription_expires_at.isoformat()
            if self.subscription_expires_at is not None
            else None,
            "max_users": self.max_users,
            "max_projects": self.max_projects,
            "max_storage_gb": self.max_storage_gb,
            "settings": self.settings,
            "metadata": self.meta_data,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at is not None else None,
        }


class Project(Base):  # type: ignore[valid-type,misc]
    """
    Project model.
    Project management with module configuration and team collaboration
    """

    __tablename__ = "projects"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(PG_UUID(as_uuid=True), nullable=True)  # OAuth2 user UUID (no FK - users in Keycloak)

    # Project info
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text)
    category: Column[str | None] = Column(
        PG_ENUM(
            "market_research",
            "product_development",
            "business_transformation",
            "marketing_campaign",
            "competitive_analysis",
            "other",
            name="project_category",
            create_type=False,  # Don't create type, it already exists in DB
        )
    )
    tags: Column[list[str]] = Column(ARRAY(String), default=[])
    status: Column[str] = Column(
        PG_ENUM(
            "active",
            "paused",
            "completed",
            "archived",
            "cancelled",
            name="project_status",
            create_type=False,
        ),
        default="active",
    )
    priority: Column[str] = Column(
        PG_ENUM("low", "medium", "high", "urgent", name="project_priority", create_type=False),
        default="medium",
    )

    # Timeline
    start_date = Column(DateTime)
    end_date = Column(DateTime)

    # Module configuration
    enabled_modules: Column[list[str]] = Column(
        ARRAY(String),
        default=[
            "jtbd",
            "value_proposition",
            "swot",
            "competitors",
            "researches",
            "content_ai",
            "context_chat",
            "segments",
            "campaigns",
            "funnel",
            "tasks",
            "alerts",
            "ai_studio",
            "client_interaction",
        ],
    )

    # Flexible fields
    settings = Column(JSONB, default={})
    meta_data = Column("metadata", JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime)

    # Relationships
    company = relationship("Company", back_populates="projects")
    # created_by_user removed - users are in Keycloak, not in DB
    members = relationship("ProjectMember", back_populates="project")

    # Constraints
    __table_args__ = (
        Index("idx_projects_company_id", "company_id"),
        Index("idx_projects_created_by", "created_by"),
        Index("idx_projects_status", "status"),
        Index("idx_projects_slug", "slug"),
        Index("idx_projects_created_at", "created_at"),
    )

    @property
    def goals(self) -> str | None:
        """Цели проекта (маркетинговый кабинет) — JSON metadata.cabinet_goals."""
        md = self.meta_data
        if not isinstance(md, dict):
            return None
        raw = md.get("cabinet_goals")
        if raw is None:
            return None
        s = str(raw).strip()
        return s or None

    @property
    def key_tasks(self) -> str | None:
        """Ключевые задачи / фокус — JSON metadata.cabinet_key_tasks."""
        md = self.meta_data
        if not isinstance(md, dict):
            return None
        raw = md.get("cabinet_key_tasks")
        if raw is None:
            return None
        s = str(raw).strip()
        return s or None

    def to_dict(self) -> dict[str, Any]:
        """Convert project to dictionary"""
        return {
            "id": str(self.id),
            "company_id": str(self.company_id),
            "created_by": str(self.created_by),
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "goals": self.goals,
            "key_tasks": self.key_tasks,
            "category": self.category,
            "tags": self.tags,
            "status": self.status,
            "priority": self.priority,
            "start_date": self.start_date.isoformat() if self.start_date is not None else None,
            "end_date": self.end_date.isoformat() if self.end_date is not None else None,
            "enabled_modules": self.enabled_modules,
            "settings": self.settings,
            "metadata": self.meta_data,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at is not None else None,
        }


# ========================================
# ENUMS FOR PROJECT MEMBERS
# ========================================


class ProjectMemberRole(enum.StrEnum):
    """Project member roles"""

    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    MEMBER = "member"
    VIEWER = "viewer"


class MemberStatus(enum.StrEnum):
    """Project member status"""

    INVITED = "invited"
    ACTIVE = "active"
    INACTIVE = "inactive"
    REMOVED = "removed"


class ProjectMember(Base):  # type: ignore[valid-type,misc]
    """
    Project member model.
    Team member roles and permissions for projects
    """

    __tablename__ = "project_members"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invited_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))

    # Role & permissions
    role: Column[ProjectMemberRole] = Column(
        PG_ENUM(
            ProjectMemberRole,
            name="project_member_role",
            create_type=False,
            # Persist/read lowercase PG labels (owner, admin, …), not Python member names (OWNER, …)
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ProjectMemberRole.MEMBER,
    )
    permissions: Column[list[str]] = Column(ARRAY(String), default=[])
    status: Column[MemberStatus] = Column(
        PG_ENUM(
            MemberStatus,
            name="member_status",
            create_type=False,
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=MemberStatus.ACTIVE,
    )

    # Timestamps
    joined_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    project = relationship("Project", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])
    invited_by_user = relationship("User", foreign_keys=[invited_by])

    # Constraints
    __table_args__ = (
        # ENUM types provide validation, no need for CheckConstraints
        Index("idx_project_members_project_id", "project_id"),
        Index("idx_project_members_user_id", "user_id"),
        Index("idx_project_members_status", "status"),
        Index("idx_project_members_created_at", "created_at"),
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert project member to dictionary"""
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "user_id": str(self.user_id),
            "invited_by": str(self.invited_by) if self.invited_by is not None else None,
            "role": self.role,
            "permissions": self.permissions,
            "status": self.status,
            "joined_at": self.joined_at.isoformat() if self.joined_at is not None else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


# ========================================
# UNIFIED GENERATION SYSTEM (UGS) MODELS
# ========================================


class GenerationType(Base):  # type: ignore[valid-type,misc]
    """
    Generation type model.
    Registry of all available generation types in UGS
    Similar to analysis_type_templates but for all content types
    """

    __tablename__ = "generation_types"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_key = Column(String(100), unique=True, nullable=False)  # text_chat, image_banner, etc.
    category = Column(String(50), nullable=False)  # text, image, audio, video, document, composite
    display_name = Column(String(255), nullable=False)
    description = Column(Text)

    # Provider configuration
    provider = Column(String(100), nullable=False)  # llama, comfyui, stable_diffusion, etc.
    model_name = Column(String(255), nullable=False)
    parameters = Column(JSONB, default={})  # Model-specific parameters

    # Performance & limits
    complexity = Column(String(20), default="medium")  # low, medium, high
    estimated_time = Column(Integer, default=30)  # seconds
    max_retries = Column(Integer, default=3)
    priority = Column(Integer, default=5)  # 1-10, higher = more priority
    cost_credits: Column[Decimal] = Column(DECIMAL(10, 2), default=1.0)

    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Metadata
    type_metadata = Column(JSONB, default={})

    # Relationships
    requests = relationship("GenerationRequest", back_populates="generation_type")
    templates = relationship("GenerationTemplate", back_populates="generation_type")

    def __repr__(self) -> str:
        return f"<GenerationType(type_key='{self.type_key}', provider='{self.provider}')>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "type_key": self.type_key,
            "category": self.category,
            "display_name": self.display_name,
            "description": self.description,
            "provider": self.provider,
            "model_name": self.model_name,
            "parameters": self.parameters or {},
            "complexity": self.complexity,
            "estimated_time": self.estimated_time,
            "max_retries": self.max_retries,
            "priority": self.priority,
            "cost_credits": float(self.cost_credits) if self.cost_credits is not None else 0.0,
            "is_active": self.is_active,
            "metadata": self.type_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


class GenerationRequest(Base):  # type: ignore[valid-type,misc]
    """
    Generation request model.
    Tracks all generation requests through UGS pipeline
    """

    __tablename__ = "generation_requests"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    company_id = Column(PG_UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    type_id = Column(PG_UUID(as_uuid=True), ForeignKey("generation_types.id"), nullable=False)

    # Status tracking
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, cancelled
    priority = Column(Integer, default=5)  # 1-10

    # Data
    input_data = Column(JSONB, default={})
    output_data = Column(JSONB, default={})

    # Airflow integration
    dag_run_id = Column(String(255), nullable=True)

    # Timing
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Error handling
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)

    # Billing
    credits_used: Column[Decimal] = Column(DECIMAL(10, 2), default=0.0)

    # Metadata
    request_metadata = Column(JSONB, default={})
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    deleted_by_user = relationship("User", foreign_keys=[deleted_by])
    project = relationship("Project")
    company = relationship("Company")
    generation_type = relationship("GenerationType", back_populates="requests")
    queue_entries = relationship("GenerationQueue", back_populates="request")

    def __repr__(self) -> str:
        return f"<GenerationRequest(id='{self.id}', status='{self.status}', type_id='{self.type_id}')>"


class ImcResearchRun(Base):  # type: ignore[valid-type,misc]
    """Marketing cabinet IMC (AI research) run; execution via UGS."""

    __tablename__ = "imc_research_runs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    company_id = Column(PG_UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    type_key = Column(String(100), nullable=False)
    workflow_key = Column(String(100), nullable=True)
    ugs_request_id = Column(PG_UUID(as_uuid=True), ForeignKey("generation_requests.id"), nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    idempotency_key = Column(String(120), nullable=True)
    input_payload = Column(JSONB, default={})
    result_text = Column(Text, nullable=True)
    parsed_data = Column(JSONB, nullable=True)
    steps = Column(JSONB, nullable=True)
    errors = Column(JSONB, nullable=True)
    display_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    company = relationship("Company")
    project = relationship("Project")
    generation_request = relationship("GenerationRequest", foreign_keys=[ugs_request_id])


class GenerationTemplate(Base):  # type: ignore[valid-type,misc]
    """
    Generation template model.
    Pre-configured templates for common generation tasks
    """

    __tablename__ = "generation_templates"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type_id = Column(PG_UUID(as_uuid=True), ForeignKey("generation_types.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Template data
    template_data = Column(JSONB, default={})  # Pre-configured parameters

    # Categorization
    category = Column(String(100), nullable=True)
    tags: Column[list[str]] = Column(ARRAY(String), default=[])

    # Usage tracking
    usage_count = Column(Integer, default=0)
    rating: Column[Decimal] = Column(DECIMAL(3, 2), default=0.0)  # 0.0 - 5.0
    is_public = Column(Boolean, default=False)

    # Ownership
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    generation_type = relationship("GenerationType", back_populates="templates")
    creator = relationship("User")

    def __repr__(self) -> str:
        return f"<GenerationTemplate(name='{self.name}', type_id='{self.type_id}')>"


class GenerationQueue(Base):  # type: ignore[valid-type,misc]
    """
    Generation queue model.
    Queue management for generation requests
    """

    __tablename__ = "generation_queue"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(PG_UUID(as_uuid=True), ForeignKey("generation_requests.id"), nullable=False)

    # Queue properties
    priority = Column(Integer, default=5)  # 1-10
    queue_name = Column(String(100), default="normal")  # high_priority, normal, batch
    estimated_start_time = Column(DateTime, nullable=True)

    # Resource requirements
    resource_requirements = Column(JSONB, default={})  # GPU, memory, etc.
    dependencies = Column(JSONB, default={})  # Other requests this depends on

    # Status
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, cancelled

    # Relationships
    request = relationship("GenerationRequest", back_populates="queue_entries")

    def __repr__(self) -> str:
        return f"<GenerationQueue(request_id='{self.request_id}', priority={self.priority})>"


class GenerationCache(Base):  # type: ignore[valid-type,misc]
    """
    Generation Cache Model
    Caching of generation results for performance improvement
    """

    __tablename__ = "generation_cache"

    # Primary fields
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cache_key = Column(String(255), unique=True, nullable=False)  # MD5 hash of key

    # Cached data
    cached_data = Column(JSONB, nullable=False)

    # Cache management
    expires_at = Column(DateTime, nullable=False)
    access_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def __repr__(self) -> str:
        return f"<GenerationCache(key='{self.cache_key[:16]}...', expires='{self.expires_at}')>"


class GenerationProvider(Base):  # type: ignore[valid-type,misc]
    """Generation providers (connection settings and fallback)"""

    __tablename__ = "generation_providers"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_name = Column(String(50), unique=True, nullable=False)
    provider_type = Column(String(20), nullable=False)
    base_url = Column(String(255))
    api_key_required = Column(Boolean, default=False)
    health_endpoint = Column(String(255))
    timeout_seconds = Column(Integer, default=30)
    max_concurrent = Column(Integer, default=5)
    enabled = Column(Boolean, default=True)
    cost_per_request: Column[Decimal] = Column(DECIMAL(10, 4), default=Decimal("0.0"))
    fallback_priority = Column(Integer, default=0)
    fallback_for: Column[list[str]] = Column(ARRAY(String), default=list)
    config_json = Column(JSONB, default={})
    display_label = Column(String(120))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("idx_generation_providers_name", "provider_name"),
        Index("idx_generation_providers_type", "provider_type"),
    )

    def __repr__(self) -> str:  # pragma: no cover - repr utility
        return f"<GenerationProvider(name='{self.provider_name}', type='{self.provider_type}')>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "provider_name": self.provider_name,
            "provider_type": self.provider_type,
            "base_url": self.base_url,
            "api_key_required": self.api_key_required,
            "health_endpoint": self.health_endpoint,
            "timeout_seconds": self.timeout_seconds,
            "max_concurrent": self.max_concurrent,
            "enabled": self.enabled,
            "cost_per_request": float(self.cost_per_request)  # type: ignore[arg-type]
            if self.cost_per_request is not None
            else 0.0,
            "fallback_priority": self.fallback_priority,
            "fallback_for": self.fallback_for or [],
            "config_json": self.config_json or {},
            "display_label": self.display_label,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


class ComfyUIWorkflow(Base):  # type: ignore[valid-type,misc]
    """Catalog of ComfyUI workflows, managed through UGS admin panel"""

    __tablename__ = "comfyui_workflows"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    category = Column(String(100))
    description = Column(Text)
    json_body = Column(JSONB, nullable=False, default={})
    model_dependencies = Column(JSONB, default=list)
    meta_data = Column("metadata", JSONB, default={})
    estimated_time = Column(Integer)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    creator = relationship("User", foreign_keys=[created_by])

    __table_args__ = (Index("idx_comfyui_workflows_slug", "slug"),)

    def __repr__(self) -> str:  # pragma: no cover - repr utility
        return f"<ComfyUIWorkflow(name='{self.name}', slug='{self.slug}', version={self.version})>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "slug": self.slug,
            "category": self.category,
            "description": self.description,
            "json_body": self.json_body,
            "model_dependencies": self.model_dependencies,
            "metadata": self.meta_data,
            "estimated_time": self.estimated_time,
            "version": self.version,
            "is_active": self.is_active,
            "created_by": str(self.created_by) if self.created_by is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


class UGSSetting(Base):  # type: ignore[valid-type,misc]
    """Key/value settings for UGS orchestration"""

    __tablename__ = "ugs_settings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(String(20), nullable=False, default="global")
    key = Column(String(150), nullable=False)
    value = Column(JSONB, nullable=False, default={})
    description = Column(Text)
    company_id = Column(PG_UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"))
    project_id = Column(PG_UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"))
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    company = relationship("Company", foreign_keys=[company_id])
    project = relationship("Project", foreign_keys=[project_id])
    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint("scope", "key", "company_id", "project_id", "user_id", name="uq_ugs_settings_scope_key"),
        Index("idx_ugs_settings_scope_key", "scope", "key"),
    )

    def __repr__(self) -> str:  # pragma: no cover - repr utility
        return f"<UGSSetting(scope='{self.scope}', key='{self.key}')>"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "scope": self.scope,
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "company_id": str(self.company_id) if self.company_id is not None else None,
            "project_id": str(self.project_id) if self.project_id is not None else None,
            "user_id": str(self.user_id) if self.user_id is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
        }


# Import desktop models after Base/User declarations so SQLAlchemy can resolve
# string relationships like "DesktopConfig" even in lightweight service scripts.
from api.models.desktop import (
    AppAccessGroup,
    DesktopAppCatalog,
    DesktopConfig,
    DesktopItem,
    ProjectSiteInstance,
    UserInstalledApp,
    UserSiteInstance,
)
from api.models.desktop_ai_chat import (
    DesktopAiChat,
    DesktopAiChatAttachment,
    DesktopAiChatConfig,
    DesktopAiChatMessage,
    DesktopAiChatPromptTemplate,
    DesktopAiDiscussionSession,
    DesktopAiDiscussionTurn,
    DesktopEnsemblePlanTemplate,
)

# ========================================
# EXPORT ALL MODELS
# ========================================

__all__ = [
    "AIGeneration",
    "APILog",
    "AgentConfig",
    "Base",
    "ChatMessage",
    "ChatSession",
    "ChatSessionDocument",
    "ComfyUIWorkflow",
    # Company & Project models
    "Company",
    "ContentVersion",
    "DiagnosticReport",
    "Document",
    "DesktopAppCatalog",
    "DesktopAiChat",
    "DesktopAiChatAttachment",
    "DesktopAiChatConfig",
    "DesktopAiChatMessage",
    "DesktopAiChatPromptTemplate",
    "DesktopAiDiscussionSession",
    "DesktopAiDiscussionTurn",
    "DesktopEnsemblePlanTemplate",
    "DesktopConfig",
    "DesktopItem",
    "GenerationCache",
    "GenerationProvider",
    "GenerationQueue",
    "GenerationRequest",
    "GenerationTemplate",
    # UGS (Unified Generation System) models
    "GenerationType",
    "Project",
    "ProjectMember",
    "SystemMetric",
    "TelegramBotCommand",
    "TelegramChat",
    "TelegramMessage",
    "TelegramNotification",
    # Telegram models
    "TelegramUser",
    "UGSSetting",
    # Unified content models
    "UnifiedContent",
    "UserInstalledApp",
    "ProjectSiteInstance",
    "UserSiteInstance",
    "User",
    "UserSession",
    "AppAccessGroup",
]

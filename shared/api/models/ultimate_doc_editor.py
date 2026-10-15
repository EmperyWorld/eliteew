#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ORM редактора документов: документы, версии, AI prompts, совместное редактирование, embeddings/TSVECTOR.
# Invariants:
# - Таблицы и ограничения должны совпадать с миграциями.
# Related:
# - `database_models.Base`; редактор и поиск документов.
# ---

"""
Ultimate Document Editor — перечень таблиц: documents, versions, prompts, collab, embeddings.
"""

import uuid
from decimal import Decimal

from sqlalchemy import (  # type: ignore[import-not-found]
    ARRAY,
    DECIMAL,
    Boolean,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # type: ignore[import-not-found]
from sqlalchemy.orm import relationship  # type: ignore[import-not-found]
from sqlalchemy.sql import func  # type: ignore[import-not-found]

# Use existing Base from database_models
from api.models.database_models import Base


class UltimateDocument(Base):
    """Main document storage with user binding"""

    __tablename__ = "ultimate_documents"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Content
    title = Column(String(500), nullable=False)
    content = Column(Text)
    content_type = Column(String(50), default="html", nullable=False)

    # Metadata (renamed to avoid SQLAlchemy reserved word)
    doc_metadata = Column("metadata", JSONB, default={})
    tags: Column[list[str]] = Column(ARRAY(Text), default=[])

    # Access control
    is_public = Column(Boolean, default=False)
    access_level = Column(String(20), default="private")

    # Stats
    word_count = Column(Integer, default=0)
    character_count = Column(Integer, default=0)
    version_number = Column(Integer, default=1)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    last_accessed_at = Column(DateTime, default=func.now())

    # Full-text search vector (generated column in SQL)
    # GENERATED ALWAYS AS: setweight(to_tsvector('russian', COALESCE(title, '')), 'A') || setweight(to_tsvector('russian', COALESCE(content, '')), 'B')
    search_vector = Column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('russian', COALESCE(title, '')), 'A') || setweight(to_tsvector('russian', COALESCE(content, '')), 'B')",
            persisted=True,
        ),
    )

    # Soft delete
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="ultimate_documents")
    versions = relationship("UltimateDocumentVersion", back_populates="document", cascade="all, delete-orphan")
    embeddings = relationship("UltimateDocumentEmbedding", back_populates="document", cascade="all, delete-orphan")
    collab_sessions = relationship("UltimateCollabSession", back_populates="document", cascade="all, delete-orphan")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            content_type.in_(["html", "markdown", "text", "docx"]), name="ultimate_documents_content_type_check"
        ),
        CheckConstraint(
            access_level.in_(["private", "shared", "public"]), name="ultimate_documents_access_level_check"
        ),
    )

    def __repr__(self) -> str:
        return f"<UltimateDocument(id={self.id}, title='{self.title}', user_id={self.user_id})>"


class UltimateDocumentVersion(Base):
    """Version history for documents"""

    __tablename__ = "ultimate_document_versions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("ultimate_documents.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)

    # Version content
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), nullable=False)

    # Version metadata (renamed to avoid SQLAlchemy reserved word)
    doc_metadata = Column("metadata", JSONB, default={})
    change_summary = Column(Text, nullable=True)

    # Attribution
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Stats snapshot
    word_count = Column(Integer)
    character_count = Column(Integer)

    # Relationships
    document = relationship("UltimateDocument", back_populates="versions")
    creator = relationship("User")

    # Constraints
    __table_args__ = (UniqueConstraint("document_id", "version_number", name="unique_document_version"),)

    def __repr__(self) -> str:
        return f"<UltimateDocumentVersion(document_id={self.document_id}, version={self.version_number})>"


class UltimateAIPrompt(Base):
    """User's saved AI prompts library"""

    __tablename__ = "ultimate_ai_prompts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Prompt details
    name = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    category = Column(String(50), default="general")

    # Settings
    model = Column(String(100), nullable=True)
    temperature: Column[Decimal] = Column(DECIMAL(3, 2), default=0.7)

    # Access
    is_public = Column(Boolean, default=False)

    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="ultimate_ai_prompts")

    # Constraints
    __table_args__ = (
        CheckConstraint(
            category.in_(
                [
                    "general",
                    "analysis",
                    "generation",
                    "improvement",
                    "correction",
                    "translation",
                    "summarization",
                    "creative",
                    "technical",
                ]
            ),
            name="ultimate_ai_prompts_category_check",
        ),
    )

    def __repr__(self) -> str:
        return f"<UltimateAIPrompt(id={self.id}, name='{self.name}', category='{self.category}')>"


class UltimateCollabSession(Base):
    """Real-time collaboration sessions"""

    __tablename__ = "ultimate_collab_sessions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("ultimate_documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Session details
    socket_id = Column(String(255), nullable=True)
    session_token = Column(String(255), nullable=True)

    # User activity
    cursor_position = Column(JSONB, nullable=True)  # {line: 10, column: 5}
    selection_range = Column(JSONB, nullable=True)  # {from: {line, col}, to: {line, col}}
    current_view = Column(JSONB, nullable=True)  # Viewport position

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    joined_at = Column(DateTime, default=func.now())
    last_activity = Column(DateTime, default=func.now())
    left_at = Column(DateTime, nullable=True)

    # Relationships
    document = relationship("UltimateDocument", back_populates="collab_sessions")
    user = relationship("User")

    # Constraints
    __table_args__ = (UniqueConstraint("document_id", "user_id", name="unique_active_session"),)

    def __repr__(self) -> str:
        return (
            f"<UltimateCollabSession(document_id={self.document_id}, user_id={self.user_id}, active={self.is_active})>"
        )


class UltimateDocumentEmbedding(Base):
    """Vector embeddings for semantic search"""

    __tablename__ = "ultimate_document_embeddings"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(PG_UUID(as_uuid=True), ForeignKey("ultimate_documents.id", ondelete="CASCADE"), nullable=False)

    # Chunk details
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    chunk_hash = Column(String(64), nullable=True)  # SHA256 hash

    # ChromaDB reference
    embedding_id = Column(String(255), nullable=True)
    collection_name = Column(String(255), default="ultimate_documents")

    # Metadata (renamed to avoid SQLAlchemy reserved word)
    doc_metadata = Column("metadata", JSONB, default={})

    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    document = relationship("UltimateDocument", back_populates="embeddings")

    # Constraints
    __table_args__ = (UniqueConstraint("document_id", "chunk_index", name="unique_document_chunk"),)

    def __repr__(self) -> str:
        return f"<UltimateDocumentEmbedding(document_id={self.document_id}, chunk={self.chunk_index})>"

#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# ORM транскриптов аудио (Whisper/метаданные, JSONB сегменты).
# Invariants:
# - Метки времени в БД — UTC naive через utc_now_naive (см. репозиторий при completed_at).
# Related:
# - transcription_repository.py, routers/audio_transcription.
# ---

"""
Audio Transcription Database Models

SQLAlchemy models for storing WhisperX audio transcription results with complete metadata,
segments, and export capabilities.

Created: 2025-10-23
Architecture: Production-ready async SQLAlchemy 2.0 + PostgreSQL JSONB
"""

import uuid
from typing import Any

from sqlalchemy import (  # type: ignore[import-not-found]
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB  # type: ignore[import-not-found]
from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # type: ignore[import-not-found]
from sqlalchemy.orm import relationship, validates  # type: ignore[import-not-found]

from api.models.database_models import Base
from api.utils.datetime_helpers import utc_now_naive


class Transcription(Base):
    """
    Audio Transcription Model

    Stores complete audio transcription results from WhisperX service including:
    - File metadata (name, size, format, duration)
    - Whisper configuration (model, language)
    - Transcription results (text, confidence, segments)
    - Performance metrics (processing time)
    - Export paths (.txt file storage)

    Features:
    - JSONB segments for efficient querying
    - Full-text search capability
    - Performance tracking
    - User ownership with cascade delete
    - Comprehensive indexing for fast queries
    """

    __tablename__ = "transcriptions"

    # ========================================================================
    # PRIMARY FIELDS
    # ========================================================================

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, comment="Primary key UUID")

    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="Owner user ID with cascade delete",
    )

    # ========================================================================
    # FILE METADATA
    # ========================================================================

    filename = Column(String(255), nullable=False, comment="Original filename (e.g., 'meeting_recording.mp3')")

    file_size_bytes = Column(Integer, nullable=False, comment="File size in bytes")

    audio_format = Column(String(20), nullable=False, comment="Audio format (mp3, wav, webm, ogg, m4a, flac, aac)")

    duration_seconds = Column(Float, nullable=True, comment="Audio duration in seconds (extracted from file)")

    # ========================================================================
    # WHISPER CONFIGURATION
    # ========================================================================

    whisper_model = Column(
        String(20),
        nullable=False,
        default="large-v3",
        comment="Whisper model size (tiny, base, small, medium, large, large-v3, turbo)",
    )

    language = Column(String(10), nullable=True, comment="Language code (en, ru, auto, etc.)")

    # ========================================================================
    # TRANSCRIPTION RESULTS
    # ========================================================================

    transcription_text = Column(Text, nullable=False, comment="Complete transcribed text")

    confidence_score = Column(Float, nullable=True, comment="Average confidence score (0.0 - 1.0)")

    segments = Column(
        JSONB, nullable=True, default=[], comment="Timestamped segments: [{text, start, end, confidence}, ...]"
    )

    # ========================================================================
    # PERFORMANCE METRICS
    # ========================================================================

    processing_time_ms = Column(Integer, nullable=True, comment="Total processing time in milliseconds")

    # ========================================================================
    # EXPORT & STORAGE
    # ========================================================================

    txt_file_path = Column(String(500), nullable=True, comment="Path to exported .txt file (optional)")

    storage_backend = Column(
        String(50), nullable=False, default="postgresql", comment="Storage backend: postgresql, minio, filesystem"
    )

    # ========================================================================
    # QUALITY & STATUS
    # ========================================================================

    status = Column(String(20), nullable=False, default="completed", comment="Status: completed, failed, processing")

    error_message = Column(Text, nullable=True, comment="Error message if transcription failed")

    word_count = Column(Integer, nullable=True, default=0, comment="Word count in transcription")

    character_count = Column(Integer, nullable=True, default=0, comment="Character count in transcription")

    # ========================================================================
    # METADATA
    # ========================================================================

    meta_data = Column(
        "metadata",  # Column name in database
        JSONB,
        nullable=True,
        default={},
        comment="Additional metadata (device info, GPU stats, etc.)",
    )

    tags = Column(JSONB, nullable=True, default=[], comment="User-defined tags for organization")

    is_favorite = Column(Boolean, default=False, comment="User favorite flag")

    # ========================================================================
    # TIMESTAMPS
    # ========================================================================

    created_at = Column(DateTime, default=utc_now_naive, nullable=False, comment="Creation timestamp (UTC)")

    updated_at = Column(
        DateTime,
        default=utc_now_naive,
        onupdate=utc_now_naive,
        nullable=False,
        comment="Last update timestamp (UTC)",
    )

    completed_at = Column(DateTime, nullable=True, comment="Transcription completion timestamp (UTC)")

    # ========================================================================
    # RELATIONSHIPS
    # ========================================================================

    user = relationship("User", back_populates="transcriptions", lazy="joined")

    # ========================================================================
    # CONSTRAINTS & INDEXES
    # ========================================================================

    __table_args__ = (
        # CHECK constraints for data validation
        CheckConstraint(
            "audio_format IN ('mp3', 'wav', 'webm', 'ogg', 'm4a', 'flac', 'aac', 'unknown')",
            name="transcriptions_audio_format_valid",
        ),
        CheckConstraint(
            "whisper_model IN ('tiny', 'base', 'small', 'medium', 'large', 'large-v1', 'large-v2', 'large-v3', 'turbo')",
            name="transcriptions_whisper_model_valid",
        ),
        CheckConstraint(
            "status IN ('completed', 'failed', 'processing', 'queued')", name="transcriptions_status_valid"
        ),
        CheckConstraint(
            "confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)",
            name="transcriptions_confidence_range",
        ),
        CheckConstraint("file_size_bytes > 0", name="transcriptions_file_size_positive"),
        CheckConstraint("duration_seconds IS NULL OR duration_seconds >= 0", name="transcriptions_duration_positive"),
        CheckConstraint(
            "storage_backend IN ('postgresql', 'minio', 'filesystem')", name="transcriptions_storage_backend_valid"
        ),
        # Indexes for fast queries
        Index("idx_transcriptions_user_id", "user_id"),
        Index("idx_transcriptions_created_at", "created_at", postgresql_using="btree"),
        Index("idx_transcriptions_status", "status"),
        Index("idx_transcriptions_language", "language"),
        Index("idx_transcriptions_whisper_model", "whisper_model"),
        Index("idx_transcriptions_is_favorite", "is_favorite"),
        # Combined indexes for common queries
        Index("idx_transcriptions_user_created", "user_id", "created_at"),
        Index("idx_transcriptions_user_status", "user_id", "status"),
        # JSONB GIN indexes for fast JSONB queries
        Index("idx_transcriptions_segments", "segments", postgresql_using="gin"),
        Index("idx_transcriptions_metadata", "metadata", postgresql_using="gin"),
        Index("idx_transcriptions_tags", "tags", postgresql_using="gin"),
        # Comment
        {"comment": "Audio transcription results from WhisperX service"},
    )

    # ========================================================================
    # VALIDATORS
    # ========================================================================

    @validates("filename")
    def validate_filename(self, key: str, filename: str) -> str:  # noqa: ARG002
        """Validate filename is not empty"""
        if not filename or not filename.strip():
            msg = "Filename cannot be empty"
            raise ValueError(msg)
        return filename.strip()

    @validates("file_size_bytes")
    def validate_file_size(self, key: str, size: int) -> int:  # noqa: ARG002
        """Validate file size is positive"""
        if size <= 0:
            msg = "File size must be positive"
            raise ValueError(msg)
        return size

    @validates("confidence_score")
    def validate_confidence(self, key: str, score: float | None) -> float | None:  # noqa: ARG002
        """Validate confidence score is in range [0, 1]"""
        if score is not None and not (0.0 <= score <= 1.0):
            msg = "Confidence score must be between 0 and 1"
            raise ValueError(msg)
        return score

    @validates("audio_format")
    def validate_audio_format(self, key: str, fmt: str) -> str:  # noqa: ARG002
        """Validate audio format is supported"""
        valid_formats = {"mp3", "wav", "webm", "ogg", "m4a", "flac", "aac", "unknown"}
        if fmt not in valid_formats:
            msg = f"Audio format must be one of: {valid_formats}"
            raise ValueError(msg)
        return fmt

    # ========================================================================
    # METHODS
    # ========================================================================

    def to_dict(self) -> dict[str, Any]:
        """
        Convert transcription to dictionary (for JSON responses).

        Returns:
            (dict[str, Any])ionary representation with all fields
        """
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "filename": self.filename,
            "file_size_bytes": self.file_size_bytes,
            "audio_format": self.audio_format,
            "duration_seconds": self.duration_seconds,
            "whisper_model": self.whisper_model,
            "language": self.language,
            "transcription_text": self.transcription_text,
            "confidence_score": self.confidence_score,
            "segments": self.segments,
            "processing_time_ms": self.processing_time_ms,
            "txt_file_path": self.txt_file_path,
            "storage_backend": self.storage_backend,
            "status": self.status,
            "error_message": self.error_message,
            "word_count": self.word_count,
            "character_count": self.character_count,
            "metadata": self.meta_data,  # meta_data in code, metadata in JSON
            "tags": self.tags,
            "is_favorite": self.is_favorite,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at is not None else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at is not None else None,
        }

    def to_summary(self) -> dict[str, Any]:
        """
        Convert to summary dictionary (for list views).

        Returns:
            (dict[str, Any])ionary with essential fields only
        """
        return {
            "id": str(self.id),
            "filename": self.filename,
            "duration_seconds": self.duration_seconds,
            "language": self.language,
            "word_count": self.word_count,
            "confidence_score": self.confidence_score,
            "status": self.status,
            "is_favorite": self.is_favorite,
            "created_at": self.created_at.isoformat() if self.created_at is not None else None,
        }

    def calculate_metrics(self) -> None:
        """
        Calculate word_count and character_count from transcription_text.
        Should be called before saving to database.
        """
        if self.transcription_text is not None:
            self.character_count = len(self.transcription_text)  # type: ignore[assignment]
            self.word_count = len(self.transcription_text.split())  # type: ignore[assignment]

    def __repr__(self) -> str:
        """String representation for debugging"""
        return (
            f"<Transcription(id={self.id}, "
            f"filename='{self.filename}', "
            f"language='{self.language}', "
            f"status='{self.status}')>"
        )


# ========================================================================
# UPDATE USER MODEL RELATIONSHIP
# ========================================================================
#

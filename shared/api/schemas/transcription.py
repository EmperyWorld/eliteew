#!/usr/bin/env python3
from pydantic import ConfigDict  # type: ignore[import-untyped]

"""
Audio Transcription Pydantic Schemas

Type-safe request/response models for audio transcription API endpoints.

Features:
- Complete type safety with Pydantic V2
- Input validation with custom validators
- Multiple response formats (full, summary, list)
- OpenAPI documentation integration
- Serialization helpers for datetime/UUID

Created: 2025-10-23
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, JsonValue, field_validator  # type: ignore[import-untyped]

# ============================================================================
# NESTED MODELS
# ============================================================================


class TranscriptionSegment(BaseModel):
    """
    Single transcription segment with timestamps.

    Represents a time-aligned portion of transcribed text with confidence score.
    """

    text: str = Field(..., description="Transcribed text segment", min_length=1, examples=["Hello, how are you?"])

    start: float = Field(..., description="Start time in seconds", ge=0.0, examples=[0.0, 1.5, 10.25])

    end: float = Field(..., description="End time in seconds", ge=0.0, examples=[1.5, 3.0, 12.5])

    confidence: float | None = Field(
        None, description="Confidence score (0-1)", ge=0.0, le=1.0, examples=[0.95, 0.87, 0.99]
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"text": "Hello, how are you today?", "start": 0.0, "end": 2.5, "confidence": 0.95}
        }
    )

    @field_validator("end")
    @classmethod
    def validate_time_range(cls, v: float, info) -> float:
        """Validate end time is after start time"""
        if "start" in info.data and v < info.data["start"]:
            msg = "end time must be greater than or equal to start time"
            raise ValueError(msg)
        return v


# ============================================================================
# CREATE SCHEMAS
# ============================================================================


class TranscriptionCreate(BaseModel):
    """
    Schema for creating a new transcription record.

    Used internally after transcription is completed to store results in database.
    """

    user_id: UUID = Field(..., description="User ID who created the transcription")

    filename: str = Field(
        ...,
        description="Original audio filename",
        min_length=1,
        max_length=255,
        examples=["meeting_recording.mp3", "interview_2025.wav"],
    )

    file_size_bytes: int = Field(..., description="File size in bytes", gt=0, examples=[1048576, 5242880])

    audio_format: str = Field(
        ...,
        description="Audio format",
        pattern="^(mp3|wav|webm|ogg|m4a|flac|aac|unknown)$",
        examples=["mp3", "wav", "webm"],
    )

    duration_seconds: float | None = Field(
        default=None, description="Audio duration in seconds", ge=0.0, examples=[60.5, 120.0, 3600.0]
    )

    whisper_model: str = Field(
        default="large-v3",
        description="Whisper model size (metadata; stack9 STT uses container MODEL_SIZE)",
        pattern="^(tiny|base|small|medium|large|large-v1|large-v2|large-v3|turbo)$",
        examples=["large-v3", "large", "base"],
    )

    language: str | None = Field(
        default=None, description="Language code (ISO 639-1)", max_length=10, examples=["en", "ru", "de", "auto"]
    )

    transcription_text: str = Field(
        ...,
        description="Complete transcribed text",
        min_length=1,
        examples=["This is a sample transcription of the audio file."],
    )

    confidence_score: float | None = Field(
        default=None, description="Average confidence score", ge=0.0, le=1.0, examples=[0.95, 0.87, 0.99]
    )

    segments: list[TranscriptionSegment] | None = Field(
        default=None,
        description="Timestamped segments",
        examples=[
            [
                {"text": "Hello", "start": 0.0, "end": 0.5, "confidence": 0.95},
                {"text": "world", "start": 0.5, "end": 1.0, "confidence": 0.98},
            ]
        ],
    )

    processing_time_ms: int | None = Field(
        default=None, description="Processing time in milliseconds", ge=0, examples=[1500, 3000, 10000]
    )

    txt_file_path: str | None = Field(
        default=None, description="Path to exported .txt file", max_length=500, examples=["/exports/transcriptions/abc123.txt"]
    )

    storage_backend: str = Field(
        default="postgresql",
        description="Storage backend",
        pattern="^(postgresql|minio|filesystem)$",
        examples=["postgresql", "minio"],
    )

    status: str = Field(
        default="completed",
        description="Transcription status",
        pattern="^(completed|failed|processing|queued)$",
        examples=["completed", "failed"],
    )

    error_message: str | None = Field(default=None, description="Error message if failed", max_length=5000)

    metadata: dict[str, Any] | None = Field(
        default=None, description="Additional metadata", examples=[{"device": "cuda:0", "gpu_memory_mb": 8192}]
    )

    tags: list[str] | None = Field(
        default=None, description="User-defined tags", max_length=50, examples=[["meeting", "important"], ["interview", "2025"]]
    )

    is_favorite: bool = Field(default=False, description="Favorite flag")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "user_id": "550e8400-e29b-41d4-a716-446655440000",
                "filename": "meeting_recording.mp3",
                "file_size_bytes": 5242880,
                "audio_format": "mp3",
                "duration_seconds": 120.5,
                "whisper_model": "turbo",
                "language": "en",
                "transcription_text": "This is a sample meeting transcription.",
                "confidence_score": 0.95,
                "segments": [{"text": "Hello everyone", "start": 0.0, "end": 1.5, "confidence": 0.95}],
                "processing_time_ms": 3000,
                "status": "completed",
            }
        }
    )


class TranscriptionUpdate(BaseModel):
    """
    Schema for updating an existing transcription.

    Allows updating mutable fields like tags, favorite status, etc.
    """

    tags: list[str] | None = Field(None, description="Updated tags", max_length=50)

    is_favorite: bool | None = Field(None, description="Updated favorite status")

    metadata: dict[str, Any] | None = Field(None, description="Updated metadata")

    model_config = ConfigDict(
        json_schema_extra={"example": {"tags": ["meeting", "important", "Q1-2025"], "is_favorite": True}}
    )


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class TranscriptionResponse(BaseModel):
    """
    Complete transcription response with all fields.

    Used for GET /transcriptions/{id} endpoint.
    """

    id: UUID = Field(..., description="Transcription ID")
    user_id: UUID = Field(..., description="Owner user ID")

    # File metadata
    filename: str = Field(..., description="Original filename")
    file_size_bytes: int = Field(..., description="File size in bytes")
    audio_format: str = Field(..., description="Audio format")
    duration_seconds: float | None = Field(None, description="Audio duration")

    # Whisper configuration
    whisper_model: str = Field(..., description="Whisper model used")
    language: str | None = Field(None, description="Language code")

    # Results
    transcription_text: str = Field(..., description="Transcribed text")
    confidence_score: float | None = Field(None, description="Average confidence")
    segments: list[TranscriptionSegment] | None = Field(None, description="Segments")

    # Performance
    processing_time_ms: int | None = Field(None, description="Processing time")

    # Export
    txt_file_path: str | None = Field(None, description="Exported file path")
    txt_file_url: str | None = Field(None, description="Download URL for .txt file")
    storage_backend: str = Field(..., description="Storage backend")

    # Status
    status: str = Field(..., description="Status")
    error_message: str | None = Field(None, description="Error message")
    word_count: int | None = Field(None, description="Word count")
    character_count: int | None = Field(None, description="Character count")

    # Metadata
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")
    tags: list[str] | None = Field(None, description="Tags")
    is_favorite: bool = Field(..., description="Favorite flag")

    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    completed_at: datetime | None = Field(None, description="Completion timestamp")

    model_config = ConfigDict(
        from_attributes=True,  # Enable ORM mode for SQLAlchemy
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_id": "660e8400-e29b-41d4-a716-446655440000",
                "filename": "meeting_recording.mp3",
                "file_size_bytes": 5242880,
                "audio_format": "mp3",
                "duration_seconds": 120.5,
                "whisper_model": "turbo",
                "language": "en",
                "transcription_text": "This is a sample meeting transcription.",
                "confidence_score": 0.95,
                "segments": [{"text": "Hello everyone", "start": 0.0, "end": 1.5, "confidence": 0.95}],
                "processing_time_ms": 3000,
                "txt_file_path": "/exports/abc123.txt",
                "txt_file_url": "https://api.example.com/files/abc123.txt",
                "storage_backend": "postgresql",
                "status": "completed",
                "error_message": None,
                "word_count": 6,
                "character_count": 42,
                "metadata": {"device": "cuda:0"},
                "tags": ["meeting", "important"],
                "is_favorite": False,
                "created_at": "2025-10-23T10:30:00Z",
                "updated_at": "2025-10-23T10:30:00Z",
                "completed_at": "2025-10-23T10:30:03Z",
            }
        },
    )


class TranscriptionSummary(BaseModel):
    """
    Summary transcription response for list views.

    Contains essential fields only for performance.
    """

    id: UUID = Field(..., description="Transcription ID")
    filename: str = Field(..., description="Original filename")
    duration_seconds: float | None = Field(None, description="Audio duration")
    language: str | None = Field(None, description="Language code")
    word_count: int | None = Field(None, description="Word count")
    confidence_score: float | None = Field(None, description="Average confidence")
    status: str = Field(..., description="Status")
    is_favorite: bool = Field(..., description="Favorite flag")
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "filename": "meeting_recording.mp3",
                "duration_seconds": 120.5,
                "language": "en",
                "word_count": 250,
                "confidence_score": 0.95,
                "status": "completed",
                "is_favorite": False,
                "created_at": "2025-10-23T10:30:00Z",
            }
        },
    )


class TranscriptionListResponse(BaseModel):
    """
    Paginated list of transcriptions.

    Used for GET /transcriptions endpoint with pagination.
    """

    transcriptions: list[TranscriptionSummary] = Field(..., description="List of transcription summaries")

    total: int = Field(..., description="Total number of transcriptions", ge=0)
    page: int = Field(..., description="Current page number", ge=1)
    page_size: int = Field(..., description="Items per page", ge=1, le=100)
    total_pages: int = Field(..., description="Total number of pages", ge=0)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "transcriptions": [
                    {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "filename": "meeting_recording.mp3",
                        "duration_seconds": 120.5,
                        "language": "en",
                        "word_count": 250,
                        "confidence_score": 0.95,
                        "status": "completed",
                        "is_favorite": False,
                        "created_at": "2025-10-23T10:30:00Z",
                    }
                ],
                "total": 42,
                "page": 1,
                "page_size": 20,
                "total_pages": 3,
            }
        }
    )


# ============================================================================
# STATISTICS SCHEMAS
# ============================================================================


class TranscriptionStats(BaseModel):
    """
    User transcription statistics.

    Aggregated metrics for dashboard/analytics.
    """

    total_transcriptions: int = Field(..., description="Total transcriptions", ge=0)
    total_duration_hours: float = Field(..., description="Total audio hours", ge=0.0)
    total_words: int = Field(..., description="Total words transcribed", ge=0)
    total_processing_time_hours: float = Field(..., description="Total processing time", ge=0.0)

    by_language: dict[str, int] = Field(..., description="Transcription count by language")

    by_model: dict[str, int] = Field(..., description="Transcription count by Whisper model")

    by_status: dict[str, int] = Field(..., description="Transcription count by status")

    average_confidence: float = Field(..., description="Average confidence score", ge=0.0, le=1.0)

    favorite_count: int = Field(..., description="Number of favorites", ge=0)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "total_transcriptions": 42,
                "total_duration_hours": 12.5,
                "total_words": 45000,
                "total_processing_time_hours": 0.5,
                "by_language": {"en": 30, "ru": 10, "de": 2},
                "by_model": {"turbo": 35, "large": 7},
                "by_status": {"completed": 40, "failed": 2},
                "average_confidence": 0.94,
                "favorite_count": 8,
            }
        }
    )


# ============================================================================
# VOICE CENTER HISTORY / METRICS (Wave B8)
# ============================================================================


class VoiceCenterTranscriptionHistoryItemOut(BaseModel):
    """GET /api/voice-center/history list row (text may be truncated)."""

    id: str
    filename: str | None = None
    file_size_bytes: int | None = None
    audio_format: str | None = None
    whisper_model: str | None = None
    language: str | None = None
    text: str = ""
    confidence: float | None = None
    processing_time_ms: int | None = None
    created_at: str | None = None
    is_favorite: bool | None = None


class VoiceCenterTranscriptionDetailOut(BaseModel):
    """GET /api/voice-center/history/{id} full row."""

    id: str
    filename: str | None = None
    file_size_bytes: int | None = None
    audio_format: str | None = None
    whisper_model: str | None = None
    language: str | None = None
    text: str | None = None
    confidence: float | None = None
    segments: list[TranscriptionSegment] = Field(default_factory=list)
    processing_time_ms: int | None = None
    created_at: str | None = None
    is_favorite: bool | None = None
    metadata: dict[str, JsonValue] = Field(default_factory=dict)


class VoiceCenterTranscriptionMetricsOut(BaseModel):
    """GET /api/voice-center/metrics."""

    user_id: str
    total_transcriptions: int = Field(ge=0)
    total_audio_duration_seconds: int = Field(ge=0)
    avg_processing_time_ms: float = Field(ge=0)
    total_processing_time_ms: int = Field(ge=0)
    avg_confidence: float = Field(ge=0)
    languages: dict[str, int] = Field(default_factory=dict)
    models_used: dict[str, int] = Field(default_factory=dict)
    formats_used: dict[str, int] = Field(default_factory=dict)
    favorites_count: int = Field(ge=0)
    timestamp: str


# ============================================================================
# EXPORT ALL
# ============================================================================

__all__ = [
    "TranscriptionCreate",
    "TranscriptionListResponse",
    "TranscriptionResponse",
    "TranscriptionSegment",
    "TranscriptionStats",
    "TranscriptionSummary",
    "TranscriptionUpdate",
    "VoiceCenterTranscriptionDetailOut",
    "VoiceCenterTranscriptionHistoryItemOut",
    "VoiceCenterTranscriptionMetricsOut",
]

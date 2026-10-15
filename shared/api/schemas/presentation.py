#!/usr/bin/env python3
"""
Pydantic schemas for Presentations API

Request and response models for presentation endpoints
"""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from api.utils.llama_models import DEFAULT_MODEL
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator  # type: ignore[import-untyped]

# ============================================================================
# Structured slide models (PRESENT-style)
# ============================================================================


class SlideKind(StrEnum):
    """Kind of slide content (PRESENT-style)."""

    TITLE = "title"
    SECTION = "section"
    CONTENT = "content"
    IMAGE = "image"
    QUOTE = "quote"
    CODE = "code"


class SlideJson(BaseModel):
    """Structured JSON representation of a single slide (PRESENT-style).

    Field aliases follow the historical JSON shape produced by the generator:
    - slideNumber
    - type
    - content (list of bullet points)
    - speakerNotes
    - imagePrompt
    """

    id: str = Field(
        default_factory=lambda: uuid4().hex,
        description="Stable slide identifier used for editing and image linking.",
    )
    slide_number: int = Field(
        default=0,
        alias="slideNumber",
        description="1-based slide index inside the presentation.",
        ge=0,
    )
    kind: SlideKind = Field(
        default=SlideKind.CONTENT,
        alias="type",
        description="Logical type of slide (title/content/image/...).",
    )
    title: str = Field(..., max_length=200, description="Slide title in Russian.")
    body: str | None = Field(
        default=None,
        max_length=2000,
        description="Optional free-form body text (for paragraphs).",
    )
    bullets: list[str] = Field(
        default_factory=list,
        alias="content",
        description="List of bullet points; each element is a single bullet.",
    )
    image_prompt: str | None = Field(
        default=None,
        alias="imagePrompt",
        max_length=300,
        description="English prompt for image generation.",
    )
    speaker_notes: str | None = Field(
        default=None,
        alias="speakerNotes",
        max_length=2000,
        description="Speaker notes in Russian.",
    )
    layout: str | None = Field(
        default=None,
        max_length=50,
        description="Optional layout hint (title, two-column, image-left, etc.).",
    )

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            msg = "Slide title cannot be empty"
            raise ValueError(msg)
        return title[:200]

    @field_validator("bullets")
    @classmethod
    def _normalize_bullets(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            text = str(item).strip()
            if not text:
                continue
            # Hard limit to avoid extremely long bullets
            normalized.append(text[:300])
        return normalized

    @field_validator("image_prompt")
    @classmethod
    def _normalize_image_prompt(cls, value: str | None) -> str | None:
        if value is None:
            return None
        prompt = value.strip()
        if not prompt:
            return None
        # Basic protection against URLs / obvious garbage
        lowered = prompt.lower()
        if "http://" in lowered or "https://" in lowered:
            return None
        if any(bad in lowered for bad in ("watermark", "logo", "text overlay")):
            return None
        return prompt[:300]

    model_config = ConfigDict(extra="allow", populate_by_name=True)


class OutlineSlide(BaseModel):
    """Lightweight outline element for two-phase generation."""

    slide_number: int = Field(
        alias="slideNumber",
        description="1-based slide index inside the outline.",
        ge=1,
    )
    kind: SlideKind = Field(
        default=SlideKind.CONTENT,
        alias="type",
        description="Planned type of slide.",
    )
    title: str = Field(..., max_length=200, description="Planned title for the slide.")
    section: str | None = Field(
        default=None,
        max_length=200,
        description="Optional high-level section the slide belongs to.",
    )
    notes: str | None = Field(
        default=None,
        max_length=500,
        description="Planner notes for this slide (not speaker notes).",
    )

    @field_validator("title")
    @classmethod
    def _validate_outline_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            msg = "Outline slide title cannot be empty"
            raise ValueError(msg)
        return title[:200]

    model_config = ConfigDict(extra="allow", populate_by_name=True)


# ============================================================================
# Request Schemas
# ============================================================================


class PresentationCreateRequest(BaseModel):
    """Request schema for creating a new presentation with strict validation"""

    topic: str = Field(..., description="Topic of the presentation", min_length=3, max_length=5000)
    title: str | None = Field(None, description="Custom title (auto-generated if not provided)", max_length=255)
    description: str | None = Field(None, description="Presentation description", max_length=2000)

    # Generation settings
    ai_model: str = Field(default=DEFAULT_MODEL, description="AI model to use for generation")
    num_slides: int = Field(default=5, ge=3, le=50, description="Number of slides to generate (max 50)")
    theme: str = Field(default="elite", description="Presentation template")
    include_images: bool = Field(default=True, description="Generate images with ComfyUI")
    detail_level: str = Field(default="normal", description="Content detail level: brief, normal, detailed")

    # Context (optional) - will be handled via separate upload endpoint
    use_context: bool = Field(default=False, description="Whether to use uploaded context document")

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        """Validate topic content"""
        if not v or not v.strip():
            msg = "Topic cannot be empty"
            raise ValueError(msg)

        # Check minimum word count
        words = v.strip().split()
        if len(words) < 3:
            msg = "Topic must contain at least 3 words"
            raise ValueError(msg)

        # Check for suspicious patterns (basic spam detection)
        suspicious_patterns = [
            "http://",
            "https://",
            "www.",
            ".com",
            ".ru",
            ".org",
            "spam",
            "scam",
            "click here",
            "buy now",
        ]
        topic_lower = v.lower()
        for pattern in suspicious_patterns:
            if pattern in topic_lower:
                msg = f"Topic contains suspicious content: {pattern}"
                raise ValueError(msg)

        # Check length (after trimming)
        if len(v.strip()) < 10:
            msg = "Topic is too short (minimum 10 characters)"
            raise ValueError(msg)

        return v.strip()

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        """Validate theme name. Maps legacy 'light' to 'modern_minimal'.
        Keep valid_themes in sync with GET /themes (PRESENTATION_THEMES_API) and frontend PRESENTATION_THEMES.
        """
        valid_themes = [
            "elite",
            "business_gradient",
            "professional_blueprint",
            "premium_dark",
            "modern_minimal",
            "tech_startup",
            "corporate_clean",
            "creative_bright",
            "ocean_wave",
            "pro",
            "imperium",
            # Legacy themes
            "black",
            "white",
            "blue",
            "green",
            "red",
        ]
        if v == "light":
            return "modern_minimal"
        if v not in valid_themes:
            msg = f"Invalid theme '{v}'. Valid themes: {', '.join(valid_themes)}"
            raise ValueError(msg)
        return v

    @field_validator("detail_level")
    @classmethod
    def validate_detail_level(cls, v: str) -> str:
        """Validate detail level"""
        valid_levels = ["brief", "normal", "detailed"]
        if v not in valid_levels:
            msg = f"Invalid detail_level '{v}'. Valid levels: {', '.join(valid_levels)}"
            raise ValueError(msg)
        return v

    @field_validator("ai_model")
    @classmethod
    def validate_ai_model(cls, v: str) -> str:
        """Validate AI model name"""
        if not v or not v.strip():
            return DEFAULT_MODEL

        # Basic validation - check format (model:version or model:latest)
        if ":" not in v:
            msg = "AI model must be in format 'model:version' or 'model:latest'"
            raise ValueError(msg)

        # Check for suspicious content
        if any(char in v for char in ["<", ">", "&", '"', "'", "/", "\\"]):
            msg = "AI model name contains invalid characters"
            raise ValueError(msg)

        return v.strip()

    @model_validator(mode="after")
    def validate_num_slides_with_detail_level(self) -> PresentationCreateRequest:
        """Validate num_slides based on detail_level"""
        # For detailed mode, limit to 20 slides to avoid very long generation
        if self.detail_level == "detailed" and self.num_slides > 20:
            msg = "Detailed mode supports maximum 20 slides. Use 'normal' or 'brief' mode for more slides."
            raise ValueError(msg)

        # For brief mode, allow up to 50 slides
        if self.detail_level == "brief" and self.num_slides > 50:
            msg = "Maximum 50 slides allowed in brief mode"
            raise ValueError(msg)

        return self

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str | None) -> str | None:
        """Validate title if provided"""
        if v is None:
            return None

        v = v.strip()
        if len(v) < 3:
            msg = "Title must be at least 3 characters long"
            raise ValueError(msg)

        if len(v) > 255:
            msg = "Title must be at most 255 characters long"
            raise ValueError(msg)

        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        """Validate description if provided"""
        if v is None:
            return None

        if len(v) > 2000:
            msg = "Description must be at most 2000 characters long"
            raise ValueError(msg)

        return v.strip() if v.strip() else None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "topic": "The Future of AI in Healthcare",
                "title": "AI Revolution in Medicine",
                "description": "A comprehensive overview of AI applications in healthcare",
                "ai_model": DEFAULT_MODEL,
                "num_slides": 5,
                "theme": "elite",
                "include_images": True,
                "detail_level": "normal",
            }
        }
    )


class PresentationUpdateRequest(BaseModel):
    """Request schema for updating a presentation. status and progress are server-only and not accepted from client."""

    title: str | None = Field(None, max_length=255)
    description: str | None = None
    markdown_content: str | None = None
    html_content: str | None = None


# ============================================================================
# Response Schemas
# ============================================================================


class ImageMetadata(BaseModel):
    """Metadata for a generated image."""

    slide_number: int
    prompt: str
    path: str | None = None
    comfyui_task_id: str | None = None
    status: str = "pending"  # pending, generating, completed, failed
    slide_id: str | None = None

    model_config = ConfigDict(extra="allow")


class PresentationResponse(BaseModel):
    """Response schema for presentation"""

    id: UUID
    user_id: UUID

    # Metadata
    title: str
    description: str | None = None
    topic: str

    # Generation settings
    ai_model: str
    num_slides: int
    theme: str
    include_images: bool
    detail_level: str

    # Content
    markdown_content: str | None = None
    html_content: str | None = None
    slides_json: list[SlideJson] | None = None

    # Status
    status: str
    progress: int
    error_message: str | None = None

    # Tracking
    generation_job_id: str | None = None
    llama_prompt: str | None = None
    comfyui_job_ids: list[str] | None = None

    # Files
    html_file_path: str | None = None
    preview_image_path: str | None = None

    # Images
    images: list[ImageMetadata] | None = None

    # Context
    context_file_path: str | None = None
    context_text: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None

    @field_validator("slides_json", mode="before")
    @classmethod
    def _normalize_slides_json(cls, value: Any) -> Any:
        """Support both legacy {'slides': [...]} and plain list values."""
        if value is None:
            return None
        if isinstance(value, dict) and "slides" in value:
            return value.get("slides")
        return value

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "AI Revolution in Medicine",
                "description": "A comprehensive overview",
                "topic": "The Future of AI in Healthcare",
                "ai_model": DEFAULT_MODEL,
                "num_slides": 5,
                "theme": "black",
                "include_images": True,
                "status": "completed",
                "progress": 100,
                "created_at": "2025-09-30T12:00:00",
                "updated_at": "2025-09-30T12:05:00",
                "completed_at": "2025-09-30T12:05:00",
            }
        },
    )


class PresentationListResponse(BaseModel):
    """Response schema for list of presentations"""

    presentations: list[PresentationResponse]
    total: int
    page: int
    page_size: int


class PresentationGenerationStatus(BaseModel):
    """Real-time generation status"""

    presentation_id: UUID
    status: str
    progress: int
    current_step: str  # "Generating text", "Generating images", "Assembling HTML", etc.
    error_message: str | None = None

    # Detailed progress
    text_generation_completed: bool = False
    images_generated: int = 0
    images_total: int = 0
    assembly_completed: bool = False


# ============================================================================
# Utility Schemas
# ============================================================================


class PresentationTheme(BaseModel):
    """Available Reveal.js themes"""

    name: str
    display_name: str
    description: str
    preview_url: str | None = None


class AvailableThemesResponse(BaseModel):
    """List of available themes"""

    themes: list[PresentationTheme] = [
        PresentationTheme(name="black", display_name="Black", description="Dark theme with high contrast"),
        PresentationTheme(name="white", display_name="White", description="Clean white theme"),
        PresentationTheme(name="league", display_name="League", description="Gray background, white text"),
        PresentationTheme(name="sky", display_name="Sky", description="Blue gradient background"),
        PresentationTheme(name="beige", display_name="Beige", description="Beige background, brown text"),
        PresentationTheme(name="simple", display_name="Simple", description="White background, black text"),
        PresentationTheme(name="serif", display_name="Serif", description="Serif fonts"),
        PresentationTheme(name="blood", display_name="Blood", description="Dark background, bold text"),
        PresentationTheme(name="night", display_name="Night", description="Black background, thick headers"),
        PresentationTheme(name="moon", display_name="Moon", description="Dark blue theme"),
        PresentationTheme(name="solarized", display_name="Solarized", description="Solarized color scheme"),
    ]


class PresentationStats(BaseModel):
    """Statistics for presentations"""

    total_presentations: int
    completed: int
    in_progress: int
    failed: int
    total_slides_generated: int
    total_images_generated: int
    average_generation_time_seconds: float | None = None

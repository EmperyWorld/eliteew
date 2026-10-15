#!/usr/bin/env python3
"""
Document Conversion API Schemas
Pydantic models for document conversion requests and responses.

Author: Python Pro Agent (Claude)
Date: 2025-10-24
"""

from enum import StrEnum
from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator  # type: ignore[import-untyped]


class TargetFormat(StrEnum):
    """Supported output formats"""

    HTML = "html"
    TEXT = "text"
    JSON = "json"
    CSV = "csv"
    MARKDOWN = "markdown"


class ConversionOptions(BaseModel):
    """Optional conversion parameters"""

    extract_images: bool = Field(default=True, description="Extract images from document (if supported)")
    preserve_formatting: bool = Field(default=True, description="Preserve text formatting (bold, italic, etc.)")
    include_metadata: bool = Field(default=True, description="Include document metadata in result")
    max_pages: int | None = Field(default=None, description="Maximum pages to convert (PDF only)", ge=1, le=1000)
    sheet_name: str | None = Field(default=None, description="Specific sheet to convert (Excel only)")


class ConvertRequest(BaseModel):
    """Request to convert document"""

    content_id: UUID | None = Field(
        default=None, description="Content ID from unified_content table (if already uploaded)"
    )
    target_format: TargetFormat = Field(..., description="Target format for conversion")
    options: ConversionOptions | None = Field(default=None, description="Conversion options")
    use_cache: bool = Field(default=True, description="Use Redis cache if available")

    @model_validator(mode="after")
    def validate_content_id(self) -> Self:
        """Ensure content_id is provided"""
        if self.content_id is None:
            msg = "content_id is required for conversion"
            raise ValueError(msg)
        return self


class ConvertUploadRequest(BaseModel):
    """Request to convert uploaded file (without saving to DB)"""

    target_format: TargetFormat = Field(..., description="Target format for conversion")
    options: ConversionOptions | None = Field(default=None, description="Conversion options")


class FormatDetectionResult(BaseModel):
    """Result of format detection"""

    mime_type: str = Field(..., description="Detected MIME type")
    extension: str | None = Field(None, description="File extension")
    is_supported: bool = Field(..., description="Whether format is supported for conversion")
    detection_method: str = Field(..., description="Detection method (magic_bytes, declared, extension)")
    file_size: int = Field(..., description="File size in bytes")
    filename: str | None = Field(None, description="Original filename")


class ConversionMetadata(BaseModel):
    """Metadata about conversion"""

    source_format: str = Field(..., description="Source format extension")
    target_format: str = Field(..., description="Target format")
    filename: str | None = Field(None, description="Original filename")
    file_size: int = Field(..., description="Original file size in bytes")
    content_hash: str = Field(..., description="SHA256 hash of source content")
    converted_size: int | None = Field(None, description="Converted content size in bytes")


class ConvertResponse(BaseModel):
    """Response with converted content"""

    content: str = Field(..., description="Converted document content")
    metadata: ConversionMetadata = Field(..., description="Conversion metadata")
    cached: bool = Field(..., description="Whether result was served from cache")
    conversion_time: float = Field(..., description="Conversion time in seconds")


class ConversionError(BaseModel):
    """Error response for conversion failures"""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: dict[str, Any] | None = Field(None, description="Additional error details")
    supported_formats: list[str] | None = Field(None, description="List of supported formats")


class SupportedFormatsResponse(BaseModel):
    """Response listing supported formats"""

    input_formats: list[str] = Field(..., description="List of supported input formats")
    output_formats: list[str] = Field(..., description="List of supported output formats")
    conversion_matrix: dict[str, list[str]] = Field(
        ..., description="Matrix showing which input formats can convert to which output formats"
    )
    cache_ttl: int = Field(..., description="Cache TTL in seconds")


class BatchConvertRequest(BaseModel):
    """Request to convert multiple documents"""

    content_ids: list[UUID] = Field(
        ..., min_length=1, max_length=10, description="List of content IDs to convert (max 10)"
    )  # type: ignore[call-overload]
    target_format: TargetFormat = Field(..., description="Target format for all conversions")
    options: ConversionOptions | None = Field(default=None, description="Conversion options (applied to all)")
    use_cache: bool = Field(default=True, description="Use Redis cache if available")


class BatchConvertResult(BaseModel):
    """Result of single conversion in batch"""

    content_id: UUID
    success: bool
    content: str | None = None
    metadata: ConversionMetadata | None = None
    cached: bool | None = None
    conversion_time: float | None = None
    error: str | None = None


class BatchConvertResponse(BaseModel):
    """Response for batch conversion"""

    results: list[BatchConvertResult] = Field(..., description="List of conversion results")
    total: int = Field(..., description="Total conversions requested")
    successful: int = Field(..., description="Number of successful conversions")
    failed: int = Field(..., description="Number of failed conversions")
    total_time: float = Field(..., description="Total processing time in seconds")


class CacheInvalidationRequest(BaseModel):
    """Request to invalidate conversion cache"""

    content_id: UUID | None = Field(default=None, description="Specific content ID to invalidate")
    pattern: str | None = Field(default=None, description="Redis key pattern to delete (e.g., 'doc_convert:abc123:*')")

    @model_validator(mode="after")
    def validate_one_required(self) -> Self:
        """Ensure at least one parameter is provided"""
        if not self.content_id and not self.pattern:
            msg = "Either content_id or pattern must be provided"
            raise ValueError(msg)
        return self


class CacheInvalidationResponse(BaseModel):
    """Response for cache invalidation"""

    success: bool
    keys_deleted: int = Field(..., description="Number of cache keys deleted")
    pattern: str | None = Field(None, description="Pattern used for deletion")

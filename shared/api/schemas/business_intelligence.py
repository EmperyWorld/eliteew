#!/usr/bin/env python3
"""
📋 BUSINESS INTELLIGENCE SCHEMAS
Pydantic models for API request/response validation

Created: 2025-10-01
"""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from api.core.unified_config import unified_settings
from pydantic import BaseModel, Field, field_validator, model_validator  # type: ignore[import-untyped]

# ========================================
# ENUMS
# ========================================


class AnalysisDepth(StrEnum):
    """Analysis depth levels"""

    BASIC = "basic"
    STANDARD = "standard"
    DEEP = "deep"
    EXPERT = "expert"


class DocumentType(StrEnum):
    """Document input types"""

    TEXT = "text"
    PDF = "pdf"
    DOCX = "docx"
    URL = "url"
    FILE = "file"


class AnalysisType(StrEnum):
    """Types of business analyses"""

    EXECUTIVE_SUMMARY = "executive_summary"
    DETAILED_ANALYSIS = "detailed_analysis"
    SWOT_ANALYSIS = "swot_analysis"
    COMPETITIVE_ANALYSIS = "competitive_analysis"
    FINANCIAL_PROJECTION = "financial_projection"
    MARKETING_STRATEGY = "marketing_strategy"
    ACTION_PLAN = "action_plan"
    RISK_ASSESSMENT = "risk_assessment"


class OutputFormat(StrEnum):
    """Output document formats"""

    DOCX = "docx"
    PDF = "pdf"
    MARKDOWN = "markdown"
    JSON = "json"
    HTML = "html"


# ========================================
# REQUEST MODELS
# ========================================


class DocumentInput(BaseModel):
    """Document input for analysis"""

    id: str | None = Field(None, description="Document ID (auto-generated if not provided)")
    type: DocumentType = Field(..., description="Document type")
    name: str = Field(..., description="Document name", min_length=1, max_length=255)
    content: str | None = Field(None, description="Text content (for text type)")
    url: str | None = Field(None, description="URL (for url type)")
    file_data: str | None = Field(None, description="Base64 encoded file data (for pdf/docx/file types)")
    metadata: dict[str, Any] | None = Field(default_factory=dict, description="Additional metadata")

    @model_validator(mode="after")
    def validate_fields_for_type(self) -> DocumentInput:
        """Validate required fields based on document type"""
        if self.type == DocumentType.URL and not self.url:
            msg = "URL is required when type is 'url'"
            raise ValueError(msg)
        if self.type == DocumentType.TEXT and not self.content:
            msg = "Content is required when type is 'text'"
            raise ValueError(msg)
        return self


class GenerationSettings(BaseModel):
    """AI generation settings"""

    model: str = Field(default_factory=lambda: unified_settings.bi_ai_model, description="Llama model name")
    temperature: float = Field(default=0.8, ge=0.0, le=2.0, description="Temperature")
    top_p: float = Field(default=0.95, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: int = Field(default=40, ge=1, le=100, description="Top-k sampling")
    max_tokens: int = Field(default=8000, ge=100, le=32000, description="Max tokens")
    analysis_depth: AnalysisDepth = Field(default=AnalysisDepth.DEEP, description="Analysis depth")
    custom_instructions: str | None = Field(default=None, description="Custom instructions for AI")


class GenerationRequest(BaseModel):
    """Request to generate business analysis"""

    session_id: str | None = Field(None, description="Session ID (auto-generated if not provided)")
    documents: list[DocumentInput] = Field(..., description="Documents to analyze", min_length=1)  # type: ignore[call-overload]
    analysis_types: list[AnalysisType] = Field(..., description="Types of analyses to perform", min_length=1)  # type: ignore[call-overload]
    output_formats: list[OutputFormat] = Field(default=[OutputFormat.DOCX], description="Output formats")
    settings: GenerationSettings = Field(
        default_factory=lambda: GenerationSettings(),
        description="Generation settings",  # type: ignore[call-arg, misc]
    )
    context: str | None = Field(None, description="Additional context")

    @field_validator("documents")
    @classmethod
    def validate_documents_not_empty(cls, v: list[DocumentInput]) -> list[DocumentInput]:
        """Validate at least one document is provided"""
        if len(v) < 1:
            msg = "At least one document is required"
            raise ValueError(msg)
        return v

    @field_validator("analysis_types")
    @classmethod
    def validate_analysis_types_not_empty(cls, v: list[AnalysisType]) -> list[AnalysisType]:
        """Validate at least one analysis type is provided"""
        if len(v) < 1:
            msg = "At least one analysis type is required"
            raise ValueError(msg)
        return v


# ========================================
# RESPONSE MODELS
# ========================================


class AnalysisMetrics(BaseModel):
    """Metrics for a single analysis"""

    tokens_used: int = Field(..., description="Tokens used")
    generation_time: float = Field(..., description="Generation time in seconds")
    tokens_per_second: float = Field(default=0, description="Tokens per second")
    quality_score: float = Field(..., ge=0, le=100, description="Quality score (0-100)")


class SingleAnalysisResult(BaseModel):
    """Result of a single analysis"""

    analysis_id: str = Field(..., description="Analysis ID")
    analysis_type: AnalysisType = Field(..., description="Analysis type")
    title: str = Field(..., description="Analysis title")
    content: str = Field(..., description="Analysis content (markdown)")
    model_used: str = Field(..., description="Model used")
    metrics: AnalysisMetrics = Field(..., description="Analysis metrics")
    success: bool = Field(default=True, description="Success flag")
    error: str | None = Field(None, description="Error message if failed")
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat(), description="Creation timestamp")

    model_config = {
        "protected_namespaces": ()  # Отключает warning для model_* полей
    }


class AnalysisSummary(BaseModel):
    """Summary of all analyses"""

    total_analyses: int = Field(..., description="Total analyses performed")
    successful: int = Field(..., description="Successful analyses")
    failed: int = Field(..., description="Failed analyses")
    total_tokens_used: int = Field(..., description="Total tokens used")
    average_quality_score: float = Field(..., description="Average quality score")
    analyses_breakdown: dict[str, Any] = Field(default_factory=dict, description="Breakdown by type")


class GeneratedDocument(BaseModel):
    """Generated document info"""

    format: OutputFormat = Field(..., description="Document format")
    file_name: str = Field(..., description="File name")
    file_path: str = Field(..., description="File path")
    size: int = Field(..., description="File size in bytes")
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat(), description="Creation timestamp")


class GenerationResult(BaseModel):
    """Complete generation result"""

    session_id: str = Field(..., description="Session ID")
    status: str = Field(..., description="Generation status")
    analyses: list[SingleAnalysisResult] = Field(..., description="Analysis results")
    summary: AnalysisSummary = Field(..., description="Summary")
    documents: list[GeneratedDocument] = Field(default_factory=list, description="Generated documents")
    documents_processed: int = Field(..., description="Number of documents processed")
    metrics: dict[str, Any] = Field(..., description="Overall metrics")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat(), description="Completion timestamp")
    error: str | None = Field(None, description="Error message if failed")


# ========================================
# PROGRESS MODELS
# ========================================


class ProgressUpdate(BaseModel):
    """Progress update for WebSocket"""

    type: str = Field(default="progress", description="Message type")
    session_id: str = Field(..., description="Session ID")
    stage: str = Field(..., description="Current stage")
    progress: int = Field(..., ge=0, le=100, description="Progress percentage")
    message: str = Field(..., description="Progress message")
    details: dict[str, Any] | None = Field(default_factory=dict, description="Additional details")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat(), description="Timestamp")


# ========================================
# SEARCH & HISTORY MODELS
# ========================================


class SearchRequest(BaseModel):
    """Search request for analyses"""

    query: str = Field(..., description="Search query", min_length=1)
    analysis_type: AnalysisType | None = Field(None, description="Filter by analysis type")
    limit: int = Field(default=10, ge=1, le=50, description="Max results")


class SearchResult(BaseModel):
    """Search result item"""

    analysis_id: str
    title: str
    analysis_type: str
    summary: str
    created_at: str
    quality_score: float


class UserStatistics(BaseModel):
    """User statistics"""

    total_analyses: int = Field(..., description="Total analyses performed")
    total_documents: int = Field(..., description="Total documents processed")
    total_tokens_used: int = Field(..., description="Total tokens used")
    average_quality: float = Field(..., description="Average quality score")
    analysis_types_distribution: list[dict[str, Any]] = Field(
        default_factory=list, description="Distribution by analysis types"
    )
    recent_analyses: list[SearchResult] = Field(default_factory=list, description="Recent analyses")


# ========================================
# HEALTH & STATUS MODELS
# ========================================


class ServiceHealth(BaseModel):
    """Service health status"""

    service: str = Field(..., description="Service name")
    status: str = Field(..., description="Status (healthy/unhealthy)")
    url: str | None = Field(None, description="Service URL")
    details: dict[str, Any] | None = Field(default_factory=dict, description="Additional details")


class SystemHealth(BaseModel):
    """Overall system health"""

    status: str = Field(..., description="Overall status")
    elasticsearch: ServiceHealth
    tika: ServiceHealth
    llama: ServiceHealth
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ModelInfo(BaseModel):
    """AI model information"""

    name: str = Field(..., description="Model name")
    display_name: str = Field(..., description="Display name")
    size: int = Field(..., description="Model size in bytes")
    quality: int = Field(..., ge=0, le=100, description="Quality rating")
    speed: int = Field(..., ge=0, le=100, description="Speed rating")
    description: str = Field(..., description="Model description")
    best_for: str = Field(..., description="Best use case")
    capabilities: list[str] = Field(default_factory=list, description="Capabilities")
    default_temp: float = Field(..., description="Default temperature")
    max_tokens: int = Field(..., description="Max tokens")


# ========================================
# ERROR MODELS
# ========================================


class ErrorResponse(BaseModel):
    """Error response"""

    error: str = Field(..., description="Error message")
    detail: str | None = Field(None, description="Error details")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    request_id: str | None = Field(None, description="Request ID for tracking")


# ========================================
# WEBSOCKET MODELS
# ========================================


class WebSocketMessage(BaseModel):
    """Generic WebSocket message"""

    type: str = Field(..., description="Message type")
    session_id: str | None = Field(None, description="Session ID")
    data: dict[str, Any] | None = Field(default_factory=dict, description="Message data")
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

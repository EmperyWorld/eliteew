#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Pydantic contracts for Unified Generation System runtime, task hub, workflows, billing, and OpenAPI pilots.
# Invariants:
# - Envelope models are typed, while result/input/metadata bags remain flexible JSON for provider-specific payloads.
# - Response models used by hot UGS Hub endpoints must preserve existing JSON keys for frontend compatibility.
# - GenerationTypeListResponse.types refs GenerationTypeResponse (not loose object[]); admin twin is AdminGenerationTypeResponse.
# Related:
# - api/routers/ugs/
# - shared/web/frontend/openapi/pilot/ugs.openapi.json
# - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts
# ---
"""Pydantic models for Unified Generation System (UGS)."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator  # type: ignore[import-untyped]

# ========================================
# ENUMS
# ========================================


class GenerationStatus(StrEnum):
    """Generation request status"""

    QUEUED = "queued"
    PENDING = "pending"
    PROCESSING = "processing"
    RETRYING = "retrying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowExecutionStatus(StrEnum):
    """Workflow execution status."""

    PENDING = "pending"
    RUNNING = "running"
    STARTED = "started"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ContentCategory(StrEnum):
    """Content type categories"""

    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    COMPOSITE = "composite"


class ComplexityLevel(StrEnum):
    """Generation complexity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ProviderType(StrEnum):
    """AI provider types"""

    LLAMA = "llama"
    COMFYUI = "comfyui"
    STABLE_DIFFUSION = "stable_diffusion"
    FASTER_WHISPER = "faster_whisper"
    SILERO = "silero"
    PIPER = "piper"
    SUPIR = "supir"
    SADTALKER = "sadtalker"
    OPENWEBUI = "openwebui"
    LOCALAI = "localai"
    MISO = "miso"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


# ========================================
# BASE MODELS
# ========================================


class GenerationTypeBase(BaseModel):
    """Base generation type model"""

    model_config = {"protected_namespaces": ()}

    type_key: str = Field(..., description="Unique type key", min_length=3, max_length=100)
    category: ContentCategory = Field(..., description="Content category")
    display_name: str = Field(..., description="Display name", min_length=1, max_length=255)
    description: str | None = Field(None, description="Description")

    # Provider configuration
    provider: ProviderType = Field(..., description="AI provider")
    model_name: str = Field(..., description="Model name")
    parameters: dict[str, Any] = Field(default_factory=dict, description="Model parameters")

    # Performance settings
    complexity: ComplexityLevel = Field(ComplexityLevel.MEDIUM, description="Complexity level")
    estimated_time: int = Field(30, description="Estimated time in seconds", ge=1)
    max_retries: int = Field(3, description="Maximum retry attempts", ge=0)
    priority: int = Field(5, description="Priority (1-10)", ge=1, le=10)
    cost_credits: float = Field(1.0, description="Cost in credits", ge=0)

    # Status
    is_active: bool = Field(default=True, description="Is type active")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    @classmethod
    @field_validator("type_key")
    def validate_type_key(cls, v: str) -> str:
        """Validate type_key format"""
        if not v.replace("_", "").replace("-", "").isalnum():
            msg = "type_key must be alphanumeric with underscores and hyphens"
            raise ValueError(msg)
        return v.lower()


class GenerationRequestBase(BaseModel):
    """Base generation request model"""

    type_key: str | None = Field(None, description="Generation type key")
    input_data: dict[str, Any] | None = Field(None, description="Input data for generation")
    project_id: UUID | None = Field(None, description="Project ID")
    company_id: UUID | None = Field(None, description="Company ID")
    priority: int = Field(5, description="Request priority (1-10)", ge=1, le=10)
    idempotency_key: str | None = Field(
        None,
        description="Optional key to safely retry the same logical generation request",
        min_length=8,
        max_length=120,
    )

    # Legacy fields for backward compatibility
    prompt: str | None = Field(None, description="Legacy: prompt text (will be converted to input_data)")
    provider: str | None = Field(None, description="Legacy: provider name (will be used to determine type_key)")
    model: str | None = Field(None, description="Legacy: model name (will be included in input_data)")
    max_tokens: int | None = Field(None, description="Legacy: max tokens (will be included in input_data)")

    @model_validator(mode="before")
    @classmethod
    def convert_legacy_format(cls, data: Any) -> dict[str, Any]:  # noqa: ANN401
        """Convert legacy format (prompt/provider/model) to new format (type_key/input_data)"""
        if not isinstance(data, dict):
            return data

        # If already in new format, return as is
        if data.get("type_key") and data.get("input_data"):
            return data

        # Convert legacy format
        prompt = data.get("prompt")
        provider = data.get("provider")
        model = data.get("model")
        max_tokens = data.get("max_tokens")

        if prompt:
            # Build input_data from legacy fields
            input_data: dict[str, Any] = {"prompt": prompt}
            if model:
                input_data["model"] = model
            if max_tokens:
                input_data["max_tokens"] = max_tokens
            # Copy other fields that might be in the request
            for key in ["temperature", "top_p", "stream", "stop"]:
                if key in data:
                    input_data[key] = data[key]

            # Determine type_key from provider
            if not data.get("type_key"):
                provider_type_map = {
                    "llama": "text_chat",
                    "comfyui": "image_generation_comfyui",
                }
                type_key = provider_type_map.get((provider or "").lower(), "text_chat")
                data["type_key"] = type_key

            data["input_data"] = input_data

        return data


# ========================================
# REQUEST MODELS
# ========================================


class GenerationRequestCreate(GenerationRequestBase):
    """Request to create a generation"""

    @model_validator(mode="after")
    def ensure_required_fields(self) -> GenerationRequestCreate:
        """Ensure type_key and input_data are provided (after conversion from legacy format)"""
        if not self.type_key:
            msg = "type_key is required (or provide 'provider' for auto-determination)"
            raise ValueError(msg)
        if not self.input_data:
            msg = "input_data is required (or provide 'prompt' for auto-conversion)"
            raise ValueError(msg)
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "type_key": "text_chat",
                "input_data": {
                    "prompt": "Write a business plan for a startup",
                    "max_tokens": 1000,
                    "temperature": 0.7,
                },
                "project_id": "123e4567-e89b-12d3-a456-426614174000",
                "priority": 5,
            }
        }
    )


class GenerationTypeCreate(GenerationTypeBase):
    """Request to create a generation type"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "type_key": "image_logo",
                "category": "image",
                "display_name": "Company Logo Generator",
                "description": "Generate professional company logos",
                "provider": "comfyui",
                "model_name": "sdxl",
                "parameters": {"width": 512, "height": 512, "steps": 20},
                "complexity": "medium",
                "estimated_time": 45,
                "cost_credits": 2.0,
            }
        }
    )


class GenerationTypeUpdate(BaseModel):
    """Request to update a generation type"""

    display_name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    parameters: dict[str, Any] | None = None
    complexity: ComplexityLevel | None = None
    estimated_time: int | None = Field(None, ge=1)
    max_retries: int | None = Field(None, ge=0)
    priority: int | None = Field(None, ge=1, le=10)
    cost_credits: float | None = Field(None, ge=0)
    is_active: bool | None = None
    metadata: dict[str, Any] | None = None


# ========================================
# RESPONSE MODELS
# ========================================


class GenerationResponse(BaseModel):
    """Response from generation request"""

    request_id: UUID = Field(..., description="Generation request ID")
    dag_run_id: str | None = Field(None, description="Airflow DAG run ID")
    status: GenerationStatus = Field(..., description="Current status")
    estimated_time: int = Field(..., description="Estimated completion time in seconds")
    message: str = Field(..., description="Response message")
    cached: bool = Field(False, description="Was result retrieved from cache")
    result: dict[str, Any] | None = Field(None, description="Generation result payload (if completed inline)")
    result_preview: dict[str, Any] | None = Field(None, description="Sanitized result stored for history/cache")
    error: str | None = Field(None, description="Error message when generation fails")
    execution_backend: str | None = Field(None, description="Resolved execution backend for the request")
    stage: str | None = Field(None, description="Lifecycle stage for the request")
    progress_message: str | None = Field(None, description="Human-readable progress message")
    idempotency_key: str | None = Field(None, description="Idempotency key used for this request")
    reused: bool = Field(False, description="Whether an existing request/result was reused")
    metadata: dict[str, Any] | None = Field(None, description="Lifecycle metadata useful for dashboards and clients")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "dag_run_id": "manual__2025-10-20T10:00:00+00:00",
                "status": "processing",
                "estimated_time": 30,
                "message": "Generation started successfully",
                "cached": False,
                "result": None,
            }
        }
    )


class GenerationStatusResponse(BaseModel):
    """Response with generation status"""

    request_id: UUID = Field(..., description="Generation request ID")
    status: GenerationStatus = Field(..., description="Current status")
    progress: float | None = Field(None, description="Progress percentage (0-100)")
    stage: str | None = Field(None, description="Detailed lifecycle stage")
    progress_message: str | None = Field(None, description="Human-readable progress message")
    estimated_completion: datetime | None = Field(None, description="Estimated completion time")
    started_at: datetime | None = Field(None, description="Started timestamp")
    completed_at: datetime | None = Field(None, description="Completed timestamp")
    queued_at: datetime | None = Field(None, description="When the request entered the queue")
    last_heartbeat_at: datetime | None = Field(
        None, description="Latest heartbeat/update from worker or direct execution"
    )
    queue_status: str | None = Field(None, description="Internal queue lifecycle status")
    execution_backend: str | None = Field(None, description="Resolved execution backend")
    provider_name: str | None = Field(None, description="Provider used or being attempted")
    provider_attempt: int | None = Field(None, description="Current provider attempt number")
    retry_count: int | None = Field(None, description="Retry counter for this request")
    idempotency_key: str | None = Field(None, description="Idempotency key for safe retries")
    error: str | None = Field(None, description="Error message (e.g. when generation_type is missing)")
    error_type: str | None = Field(None, description="Error code for client (e.g. generation_type_not_found)")
    result: dict[str, Any] | None = Field(None, description="Result payload when already available in status")
    metadata: dict[str, Any] | None = Field(None, description="Lifecycle metadata for advanced UIs and debugging")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "processing",
                "progress": 65.5,
                "estimated_completion": "2025-10-20T10:00:45Z",
                "started_at": "2025-10-20T10:00:15Z",
                "completed_at": None,
            }
        }
    )


class GenerationResultResponse(BaseModel):
    """Response with generation result"""

    request_id: UUID = Field(..., description="Generation request ID")
    status: GenerationStatus = Field(..., description="Final status")
    result: dict[str, Any] | None = Field(None, description="Generation result")
    result_preview: dict[str, Any] | None = Field(None, description="Sanitized preview of the generation result")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Result metadata")
    started_at: datetime | None = Field(None, description="Started timestamp")
    completed_at: datetime | None = Field(None, description="Completed timestamp")
    error: str | None = Field(None, description="Error message if failed")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "request_id": "123e4567-e89b-12d3-a456-426614174000",
                "status": "completed",
                "result": {
                    "content": "This is the generated text content...",
                    "tokens_used": 150,
                    "model": "llama2",
                },
                "result_preview": {"content": "This is the generated text content..."},
                "metadata": {"provider": "llama", "processing_time": 12.5},
                "started_at": "2025-10-20T10:00:15Z",
                "completed_at": "2025-10-20T10:00:27Z",
            }
        }
    )


class GenerationTypeResponse(GenerationTypeBase):
    """Response with generation type details"""

    # DB may store providers outside the ProviderType enum; keep Create/Update enum-strict.
    provider: str = Field(..., description="AI provider")
    id: UUID = Field(..., description="Type ID")
    created_at: datetime | None = Field(None, description="Created timestamp")
    updated_at: datetime | None = Field(None, description="Updated timestamp")

    model_config = ConfigDict(
        title="GenerationTypeResponse",
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174001",
                "type_key": "text_chat",
                "category": "text",
                "display_name": "Text Chat Generation",
                "description": "Generate conversational text responses",
                "provider": "llama",
                "model_name": "llama2",
                "parameters": {"temperature": 0.7, "max_tokens": 1000},
                "complexity": "medium",
                "estimated_time": 30,
                "max_retries": 3,
                "priority": 5,
                "cost_credits": 1.0,
                "is_active": True,
                "metadata": {},
                "created_at": "2025-10-20T09:00:00Z",
                "updated_at": "2025-10-20T09:00:00Z",
            }
        },
    )


class GenerationTypeListResponse(BaseModel):
    """Response with list of generation types"""

    types: list[GenerationTypeResponse] = Field(..., description="List of generation types")
    total: int = Field(..., description="Total number of types")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "types": [
                    {
                        "type_key": "text_chat",
                        "display_name": "Text Chat",
                        "category": "text",
                        "description": "Generate text responses",
                        "estimated_time": 30,
                        "cost_credits": 1.0,
                    },
                    {
                        "type_key": "image_banner",
                        "display_name": "Banner Image",
                        "category": "image",
                        "description": "Generate banner images",
                        "estimated_time": 45,
                        "cost_credits": 2.0,
                    },
                ],
                "total": 2,
            }
        }
    )


class UGSTaskResponse(BaseModel):
    """UGS Hub task row used by /tasks and /admin/tasks."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., description="Generation request id")
    type_key: str = Field(..., description="Generation type key")
    status: GenerationStatus = Field(..., description="Public generation status")
    created_at: datetime | None = Field(None, description="Creation timestamp")
    updated_at: datetime | None = Field(None, description="Last update timestamp")
    started_at: datetime | None = Field(None, description="Start timestamp")
    result: dict[str, Any] | None = Field(None, description="Compact result preview or provider payload")
    result_preview: dict[str, Any] | None = Field(None, description="Compact result preview")
    metadata: dict[str, Any] | None = Field(None, description="Compact lifecycle metadata")
    stage: str | None = Field(None, description="Lifecycle stage")
    progress: float | None = Field(None, description="Progress percentage")
    progress_message: str | None = Field(None, description="Human-readable progress message")
    execution_backend: str | None = Field(None, description="Resolved execution backend")
    provider_name: str | None = Field(None, description="Provider name")
    provider_attempt: int | None = Field(None, description="Provider attempt number")
    retry_count: int | None = Field(None, description="Retry counter")
    queued_at: datetime | None = Field(None, description="Queue entry timestamp")
    last_heartbeat_at: datetime | None = Field(None, description="Latest worker heartbeat timestamp")
    error: str | None = Field(None, description="Error message")
    error_type: str | None = Field(None, description="Machine-readable error type")
    user_id: str = Field(..., description="Owner user id")
    project_id: str | None = Field(None, description="Project id")
    company_id: str | None = Field(None, description="Company id")
    priority: int = Field(..., description="Queue priority")
    input_data: dict[str, Any] | None = Field(None, description="Truncated input preview; null in compact rows")
    compact: bool | None = Field(None, description="True when row came from compact listing mode")


class UGSTrayTaskResponse(BaseModel):
    """Lightweight task row for desktop tray polling."""

    model_config = ConfigDict(extra="allow")

    id: str
    type_key: str
    status: GenerationStatus
    created_at: datetime | None = None
    updated_at: datetime | None = None
    started_at: datetime | None = None
    last_heartbeat_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    stage: str | None = None
    progress: float | None = None
    progress_message: str | None = None


class UGSTraySummaryResponse(BaseModel):
    """Desktop tray summary for active UGS tasks and recent transitions."""

    active_count: int = Field(..., ge=0)
    active_tasks: list[UGSTrayTaskResponse] = Field(default_factory=list)
    recent_transitions: list[UGSTrayTaskResponse] = Field(default_factory=list)
    server_time: datetime = Field(..., description="Server snapshot timestamp")


class UGSStatsResponse(BaseModel):
    """UGS dashboard stats payload."""

    total_generations: int = Field(..., ge=0)
    active_tasks: int = Field(..., ge=0)
    completed_today: int = Field(..., ge=0)
    failed_today: int = Field(..., ge=0)
    avg_response_time: float = Field(..., ge=0)
    queue_size: int = Field(..., ge=0)


class UGSAnalyticsTotals(BaseModel):
    """UGS analytics total counters."""

    total_generations: int = Field(0, ge=0)
    successful: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    cancelled: int = Field(0, ge=0)


class UGSAnalyticsTypeBreakdown(BaseModel):
    """UGS analytics per-type counters."""

    model_config = ConfigDict(extra="allow")

    type_key: str | None = None
    successful: int | None = None
    failed: int | None = None
    total: int | None = None


class UGSAnalyticsSummaryResponse(BaseModel):
    """Analytics page summary response."""

    model_config = ConfigDict(extra="allow")

    totals: UGSAnalyticsTotals = Field(default_factory=UGSAnalyticsTotals)
    success_rate: float = Field(0.0, ge=0.0)
    avg_duration_ms: float = Field(0.0, ge=0.0)
    by_type: list[UGSAnalyticsTypeBreakdown] = Field(default_factory=list)
    recent_errors: list[dict[str, Any]] = Field(default_factory=list)
    error_distribution: list[dict[str, Any]] = Field(default_factory=list)


class UGSHealthServicesResponse(BaseModel):
    """Infrastructure status map for UGS health."""

    database: str
    cache: str
    queue: str


class UGSHealthProvidersResponse(BaseModel):
    """Provider summary for UGS health."""

    total: int = Field(..., ge=0)
    healthy: int = Field(..., ge=0)
    unhealthy: int = Field(..., ge=0)


class UGSHealthResponse(BaseModel):
    """UGS aggregate health check response."""

    model_config = ConfigDict(extra="allow")

    status: str
    timestamp: datetime | str
    providers: UGSHealthProvidersResponse | None = None
    services: UGSHealthServicesResponse | None = None
    error: str | None = None


class UGSMetricsPopularType(BaseModel):
    """Popular type row for UGS metrics dashboard."""

    type_key: str
    display_name: str
    count: int = Field(..., ge=0)


class UGSMetricsResponse(BaseModel):
    """UGS metrics payload used by Hub dashboards."""

    total_generations: int = Field(..., ge=0)
    active_generations: int = Field(..., ge=0)
    completed_today: int = Field(..., ge=0)
    failed_today: int = Field(..., ge=0)
    average_generation_time: float = Field(..., ge=0)
    success_rate: float = Field(..., ge=0)
    popular_types: list[UGSMetricsPopularType] = Field(default_factory=list)


class UGSProviderHealthRow(BaseModel):
    """Provider status row for /providers/status."""

    provider_name: str
    display_label: str | None = None
    status: str
    response_time: float | None = None
    last_check: datetime
    error: str | None = None


class UGSProvidersStatusSummary(BaseModel):
    """Summary for /providers/status."""

    total: int = Field(..., ge=0)
    healthy: int = Field(..., ge=0)
    unhealthy: int = Field(..., ge=0)
    average_response_time: float = Field(..., ge=0)


class UGSProvidersStatusResponse(BaseModel):
    """Provider status overview response."""

    providers: list[UGSProviderHealthRow] = Field(default_factory=list)
    summary: UGSProvidersStatusSummary


class UGSQueueOpsHint(BaseModel):
    """Operator hint in queue-ops snapshot."""

    level: str
    code: str
    message: str


class UGSQueueOpsStaleCandidates(BaseModel):
    """Stale candidate counters in Postgres queue snapshot."""

    model_config = ConfigDict(extra="allow")

    pending_orphan: int | None = None
    pending_in_queue: int | None = None
    processing: int | None = None
    total: int | None = None


class UGSQueueOpsPostgresSection(BaseModel):
    """Postgres portion of UGS queue-ops snapshot."""

    model_config = ConfigDict(extra="allow")

    total_queued: int | None = None
    pending_oldest_age_seconds: float | None = None
    stale_candidates: UGSQueueOpsStaleCandidates | None = None
    request_status_counts: dict[str, int] | None = None
    dlq_finalized_failed_24h: int | None = None


class UGSQueueOpsRabbitQueue(BaseModel):
    """RabbitMQ queue row in queue-ops snapshot."""

    model_config = ConfigDict(extra="allow")

    name: str
    messages_ready: int | None = None
    messages_unacknowledged: int | None = None


class UGSQueueOpsRabbitSection(BaseModel):
    """RabbitMQ portion of queue-ops snapshot."""

    model_config = ConfigDict(extra="allow")

    ok: bool | None = None
    error: str | None = None
    queues: list[UGSQueueOpsRabbitQueue] | None = None


class UGSQueueOpsRedisLeases(BaseModel):
    """Redis worker lease subsection."""

    model_config = ConfigDict(extra="allow")

    available: bool | None = None
    active_leases: int | None = None
    truncated: bool | None = None
    error: str | None = None


class UGSQueueOpsRedisSection(BaseModel):
    """Redis portion of queue-ops snapshot."""

    ugs_worker_leases: UGSQueueOpsRedisLeases = Field(default_factory=UGSQueueOpsRedisLeases)


class UGSQueueOpsWorkerTuning(BaseModel):
    """Worker tuning/env subsection."""

    model_config = ConfigDict(extra="allow")

    stale_horizons: dict[str, Any] | None = None


class UGSQueueOpsOperatorSlo(BaseModel):
    """Derived operator SLO cues from queue-ops inputs (no Prometheus)."""

    model_config = ConfigDict(extra="allow")

    level: str
    pending_oldest_age_seconds: float | None = None
    failed_share: float | None = None
    failed_count: int | None = None
    completed_count: int | None = None
    stale_total: int | None = None
    dlq_finalized_failed_24h: int | None = None
    total_queued: int | None = None


class UGSQueueOpsSnapshotResponse(BaseModel):
    """Read-only queue operations snapshot for UGS operators."""

    model_config = ConfigDict(extra="allow")

    status: str
    timestamp: datetime
    postgres: UGSQueueOpsPostgresSection
    rabbitmq: UGSQueueOpsRabbitSection
    redis: UGSQueueOpsRedisSection
    worker_tuning: UGSQueueOpsWorkerTuning | None = None
    operator_slo: UGSQueueOpsOperatorSlo | None = None
    hints: list[UGSQueueOpsHint] = Field(default_factory=list)
    log_grep: list[str] | None = None


class UGSWorkflowRecord(BaseModel):
    """Workflow row for UGS workflow list/detail endpoints."""

    model_config = ConfigDict(extra="allow")

    id: str
    workflow_name: str
    description: str | None = None
    created_by: str | None = None
    project_id: str | None = None
    company_id: str | None = None
    template_id: str | None = None
    is_public: bool = False
    workflow_data: dict[str, Any] | None = None
    execution_count: int | None = None
    last_executed_at: datetime | None = None
    average_execution_time: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    creator_username: str | None = None
    template_name: str | None = None
    template_display_name: str | None = None
    workflow_slug: str | None = None
    workflow_source: str | None = None
    execution_mode: str | None = None
    source_label: str | None = None
    category: str | None = None
    estimated_time: int | None = None
    supports_builder: bool | None = None
    supports_execute: bool | None = None
    supports_duplicate: bool | None = None
    supports_delete: bool | None = None
    supports_export: bool | None = None
    supports_history: bool | None = None
    execution_hint: str | None = None
    quick_execute_type_key: str | None = None


class UGSWorkflowListResponse(BaseModel):
    """Workflow list response."""

    workflows: list[UGSWorkflowRecord] = Field(default_factory=list)


class UGSWorkflowDetailResponse(BaseModel):
    """Workflow detail response."""

    workflow: UGSWorkflowRecord


class UGSWorkflowMutationResponse(BaseModel):
    """Workflow create/duplicate/update/delete message wrapper."""

    message: str
    workflow: UGSWorkflowRecord | None = None
    new_workflow_id: str | None = None


class UGSWorkflowExecutionRecord(BaseModel):
    """Workflow execution row."""

    model_config = ConfigDict(extra="allow")

    id: str
    execution_id: str | None = None
    workflow_id: str
    execution_name: str | None = None
    status: WorkflowExecutionStatus | str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    total_duration_ms: int | None = None
    success_count: int | None = None
    error_count: int | None = None
    skipped_count: int | None = None
    credits_used: float | None = None
    trigger_type: str | None = None
    error_message: str | None = None
    output_data: dict[str, Any] | None = None
    execution_metadata: dict[str, Any] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UGSWorkflowExecutionsResponse(BaseModel):
    """Workflow execution history response."""

    executions: list[UGSWorkflowExecutionRecord] = Field(default_factory=list)
    workflow_id: str | None = None
    total: int = Field(0, ge=0)


class UGSWorkflowExecutionDetailResponse(BaseModel):
    """Single workflow execution detail response."""

    execution: UGSWorkflowExecutionRecord


class UGSWorkflowExecuteResponse(BaseModel):
    """Workflow execute response."""

    model_config = ConfigDict(extra="allow")

    execution_id: str | None = None
    request_id: str | None = None
    id: str | None = None
    status: str
    message: str | None = None


class ProviderStatusResponse(BaseModel):
    """Response with provider status"""

    name: str = Field(..., description="Provider name")
    available: bool = Field(..., description="Is provider available")
    response_time: float | None = Field(None, description="Response time in ms")
    last_checked: datetime = Field(..., description="Last health check timestamp")
    error: str | None = Field(None, description="Error message if unavailable")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "llama",
                "available": True,
                "response_time": 45.2,
                "last_checked": "2025-10-20T10:00:00Z",
                "error": None,
            }
        }
    )


class BillingTopGenerationType(BaseModel):
    """Top generation type spend summary for billing dashboards"""

    type_key: str = Field(..., description="Unique generation type key")
    display_name: str = Field(..., description="Human friendly display name")
    credits_used: float = Field(..., description="Total credits consumed by this type")
    cost_per_unit: float | None = Field(None, description="Average credits per generation for this type")


class BillingTransaction(BaseModel):
    """Recent credit transaction descriptor"""

    id: str = Field(..., description="Transaction identifier")
    type: str = Field(..., description="Transaction type (purchase, spend, refund, etc.)")
    amount: float = Field(..., description="Credits delta, positive or negative")
    timestamp: datetime = Field(..., description="Transaction timestamp")
    description: str | None = Field(None, description="Transaction description")


class BillingStatsResponse(BaseModel):
    """Response with billing statistics"""

    available_credits: float = Field(..., description="Available credits")
    daily_used: float = Field(..., description="Credits used today")
    daily_limit: float = Field(..., description="Daily credit limit")
    monthly_used: float = Field(..., description="Credits used this month")
    monthly_limit: float = Field(..., description="Monthly credit limit")
    total_used: float = Field(..., description="Total credits used")
    active_requests: int = Field(..., description="Number of active requests")
    concurrent_limit: int = Field(..., description="Concurrent requests limit")
    timestamp: datetime | None = Field(None, description="Snapshot timestamp")
    credits_remaining: float | None = Field(None, description="Alias for available credits for compatibility")
    total_credits_used: float | None = Field(None, description="Alias for lifetime credits spent")
    monthly_spend: float | None = Field(None, description="Approximate monetary spend for the current month")
    daily_average: float | None = Field(None, description="Average daily spend for the current month")
    top_generation_types: list[BillingTopGenerationType] | None = Field(
        None, description="Top generation types by credit usage"
    )
    recent_transactions: list[BillingTransaction] | None = Field(None, description="Recent credit transactions")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "available_credits": 85.5,
                "daily_used": 14.5,
                "daily_limit": 10000.0,
                "monthly_used": 285.5,
                "monthly_limit": 10000.0,
                "total_used": 15420.0,
                "active_requests": 2,
                "concurrent_limit": 5,
                "timestamp": "2025-10-24T12:00:00Z",
                "credits_remaining": 85.5,
                "total_credits_used": 15420.0,
                "monthly_spend": 285.5,
                "daily_average": 9.2,
                "top_generation_types": [
                    {
                        "type_key": "text_chat",
                        "display_name": "AI Chat",
                        "credits_used": 120.5,
                        "cost_per_unit": 3.5,
                    }
                ],
                "recent_transactions": [
                    {
                        "id": "f8f9b3e6-9a1b-4c5f-8d1e-1234567890ab",
                        "type": "purchase",
                        "amount": 250.0,
                        "timestamp": "2025-10-23T09:15:00Z",
                        "description": "Purchased Growth Booster Package",
                    }
                ],
            }
        }
    )


class WorkflowBuilderCatalogNode(BaseModel):
    """Builder palette node descriptor."""

    id: str = Field(..., description="Builder node identifier")
    kind: str = Field(..., description="Node kind")
    label: str = Field(..., description="Default display label")
    localized_labels: dict[str, str] = Field(default_factory=dict, description="Localized labels by language code")
    description: str | None = Field(None, description="Human-readable description")
    category: str = Field(..., description="Palette category")
    icon_key: str = Field(..., description="Frontend icon key")
    accent_color: str = Field(..., description="Accent color")
    inputs: list[str] = Field(default_factory=list, description="Input handles")
    outputs: list[str] = Field(default_factory=list, description="Output handles")
    default_config: dict[str, Any] = Field(default_factory=dict, description="Default node config")
    supports_builder: bool = Field(True, description="Can be edited in builder")
    supports_execute: bool = Field(True, description="Can be executed in runtime")
    experimental: bool = Field(False, description="Experimental node")
    runtime_type_key: str | None = Field(None, description="Resolved runtime type key")


class WorkflowBuilderCatalogResponse(BaseModel):
    """Response for builder node catalog endpoint."""

    version: str = Field(..., description="Contract version")
    nodes: list[WorkflowBuilderCatalogNode] = Field(..., description="Available builder nodes")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Contract metadata")


class WorkflowValidationIssue(BaseModel):
    """Single workflow problem entry."""

    severity: str = Field(..., description="error|warning|info")
    code: str = Field(..., description="Machine-readable code")
    message: str = Field(..., description="Human-readable issue")
    node_id: str | None = Field(None, description="Related node")
    edge_id: str | None = Field(None, description="Related edge")


class WorkflowValidationResponse(BaseModel):
    """Validate/compile result for workflow graphs."""

    ok: bool = Field(..., description="True when workflow is executable")
    issues: list[WorkflowValidationIssue] = Field(default_factory=list, description="Detected issues")
    summary: dict[str, int] = Field(default_factory=dict, description="Issue summary by severity")
    supported_generation_types: list[str] = Field(
        default_factory=list, description="Legacy generation types supported by runtime"
    )


# ========================================
# ERROR MODELS
# ========================================


class ErrorResponse(BaseModel):
    """Error response model"""

    error: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")
    details: dict[str, Any] | None = Field(None, description="Additional error details")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "Generation type not found",
                "code": "TYPE_NOT_FOUND",
                "details": {"type_key": "invalid_type"},
            }
        }
    )

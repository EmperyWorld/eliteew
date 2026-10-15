"""Pydantic models for IMC (marketing cabinet AI research) public API."""

from __future__ import annotations

from typing import Any, Literal

from api.schemas.marketing_web_search import WebSearchQuality
from pydantic import BaseModel, Field, field_validator, model_validator  # type: ignore[import-untyped]

ImcResearchStatusLiteral = Literal["pending", "running", "completed", "failed", "cancelled", "partial"]


class ImcResearchTypeOut(BaseModel):
    type_key: str
    display_name: str
    description: str | None = None
    estimated_time_seconds: int = 30
    is_composite: bool = False
    complexity: str = "medium"
    rag_project_only: bool = Field(
        default=False,
        description="Research uses project PG+RAG vault only; file/URL/brief not required.",
    )


class ImcResearchTypesResponse(BaseModel):
    types: list[ImcResearchTypeOut]


class ImcRagHintsResponse(BaseModel):
    """Префлайт покрытия vault / Qdrant для ИМК (без тяжёлого поиска)."""

    project_id: str
    qdrant_points_count: int = Field(
        ...,
        description="Число точек в Qdrant для проекта; -1 если подсчёт недоступен",
    )
    vault_documents_with_text: int = Field(
        ...,
        ge=0,
        description="Документы проекта в Postgres с достаточным extracted_text",
    )
    weak_coverage: bool = Field(
        ...,
        description="True если в vault пусто или в Qdrant 0 точек (при известном qdrant)",
    )


class ImcRunResearchRequest(BaseModel):
    type_key: str = Field(..., min_length=3, max_length=100)
    company_id: str
    project_id: str
    input_file_ids: list[str] = Field(default_factory=list)
    source_url: str | None = None
    context: dict[str, Any] | None = Field(
        default=None,
        description='Опционально brief, document_text; focus: "global" | "rf" | "mixed" — уточнение гео/акцента для запроса и RAG',
    )
    language: Literal["russian"] = "russian"
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)

    @field_validator("language", mode="before")
    @classmethod
    def language_outputs_russian_only(cls, v: object) -> str:
        """Старые клиенты могли слать english; ответы ИМК только на русском."""
        return "russian"

    priority: int = Field(default=5, ge=1, le=10)
    workflow_key: str | None = None
    use_web_search: bool = Field(
        default=False,
        description="Legacy flag; when true and web_search_quality omitted, treated as standard.",
    )
    web_search_quality: WebSearchQuality = Field(
        default="off",
        description="Web search depth: off | light (1 query) | standard (2) | deep (3). Uses search quota.",
    )

    @model_validator(mode="after")
    def at_least_one_source(self) -> ImcRunResearchRequest:
        key = str(self.type_key or "")
        if key.startswith("imc_rag_"):
            return self
        has_files = bool(self.input_file_ids)
        has_url = bool(self.source_url and str(self.source_url).strip())
        ctx = self.context if isinstance(self.context, dict) else {}
        doc_text = ctx.get("document_text")
        brief = ctx.get("brief")
        has_text = isinstance(doc_text, str) and doc_text.strip() or isinstance(brief, str) and brief.strip()
        if not (has_files or has_url or has_text):
            msg = "Нужен хотя бы один источник: input_file_ids, source_url или context.document_text / context.brief"
            raise ValueError(msg)
        return self

    @field_validator("input_file_ids")
    @classmethod
    def cap_file_ids(cls, v: list[str]) -> list[str]:
        if len(v) > 20:
            msg = "Не более 20 файлов в input_file_ids"
            raise ValueError(msg)
        return v

    @field_validator("context")
    @classmethod
    def cap_document_text(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if not v:
            return v
        dt = v.get("document_text")
        if isinstance(dt, str) and len(dt) > 2_000_000:
            msg = "context.document_text слишком длинный"
            raise ValueError(msg)
        f = v.get("focus")
        if f is not None:
            if not isinstance(f, str):
                msg = "context.focus должен быть строкой: global | rf | mixed"
                raise ValueError(msg)
            if f.strip().lower() not in ("global", "rf", "mixed"):
                msg = "context.focus: разрешены только global, rf, mixed"
                raise ValueError(msg)
        return v


class ImcRunResearchResponse(BaseModel):
    id: str
    status: ImcResearchStatusLiteral
    ugs_request_id: str
    estimated_completion: str | None = None
    message: str = "Принято в работу"


class ImcResearchRunSummary(BaseModel):
    id: str
    type_key: str
    display_name: str
    status: ImcResearchStatusLiteral
    company_id: str
    project_id: str
    created_at: str
    updated_at: str | None = Field(
        default=None,
        description="ISO timestamp when present on dashboard bundle rows (sorting).",
    )
    started_at: str | None
    completed_at: str | None
    duration_seconds: float | None = None
    result_preview: str | None = None
    result_char_count: int | None = Field(
        default=None,
        description="Длина полного result_text в символах (для списка без отдачи всего текста)",
    )
    result_line_count: int | None = Field(
        default=None,
        description="Число строк полного result_text (как split по переводам строки)",
    )
    parsed_data: dict[str, Any] | None = None
    ugs_request_id: str
    workflow_id: str | None = None
    started_by_user_id: str | None = Field(
        default=None,
        description="Пользователь (EliteEW users.id), инициировавший запуск",
    )
    started_by_label: str | None = Field(
        default=None,
        description="Отображаемое имя: full_name / username / email",
    )


class ImcResearchDeleteResponse(BaseModel):
    deleted: bool = True
    id: str


class ImcStepStatusOut(BaseModel):
    step_key: str
    type_key: str
    ugs_request_id: str
    status: ImcResearchStatusLiteral
    return_to_user: bool = True
    result_preview: str | None = None
    error: str | None = None


class ImcWorkflowErrorOut(BaseModel):
    step_key: str
    message: str
    skipped_steps: list[str] = Field(default_factory=list)


class ImcResearchRunDetail(ImcResearchRunSummary):
    result_text: str | None = None
    result_structured: dict[str, Any] | None = None
    input_payload: dict[str, Any] | None = None
    steps: list[ImcStepStatusOut] = Field(default_factory=list)
    errors: list[ImcWorkflowErrorOut] = Field(default_factory=list)


class ImcResearchStatusResponse(BaseModel):
    id: str
    status: ImcResearchStatusLiteral
    progress: float = 0.0
    progress_message: str | None = None
    ugs_request_id: str


class ImcResearchListResponse(BaseModel):
    company_id: str | None = None
    project_id: str | None = None
    total: int
    items: list[ImcResearchRunSummary]


class ImcCancelResponse(BaseModel):
    status: Literal["cancelled"] = "cancelled"

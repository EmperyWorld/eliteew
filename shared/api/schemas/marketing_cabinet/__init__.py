"""Pydantic-модели ответов маркетингового кабинета (OpenAPI / контракт с фронтом)."""

from __future__ import annotations

from typing import Any

from api.schemas.imc import ImcResearchRunSummary
from api.schemas.marketing_cabinet.dashboard_analytics import MarketingDashboardAnalytics
from pydantic import BaseModel, ConfigDict, Field  # type: ignore[import-untyped]

# --- Общие -------------------------------------------------------------------


class MarketingOptionOut(BaseModel):
    id: str
    label: str


class ResearchTypesResponse(BaseModel):
    items: list[MarketingOptionOut]


class ReadinessBreakdownOut(BaseModel):
    """Компоненты 0–100 для расшифровки readiness_score (без дублирования формулы на клиенте)."""

    strategy_base: int = 0
    operations: int = 0
    coverage: int = 0
    freshness: int = 0
    strategy_integrity: int = 0


class ReadinessMetaOut(BaseModel):
    """Веса readiness, вклад баллов по компонентам и прозрачность среднего по coverage."""

    model_config = ConfigDict(extra="ignore")

    weights: dict[str, float] = Field(
        default_factory=dict,
        description="Веса компонентов (strategy_base, operations, …) — см. READINESS_WEIGHTS на API.",
    )
    contribution_points: dict[str, int] = Field(
        default_factory=dict,
        description="Приблизительный вклад каждого компонента в итоговый readiness_score (последний ключ поглощает округление).",
    )
    coverage_average_rows_used: int = Field(
        default=0,
        description="Сколько строк coverage с total>0 участвовали в среднем для компонента «coverage».",
    )
    coverage_average_slots_total: int = Field(
        default=0,
        description="Число строк в блоке coverage (слотов метрик связей).",
    )


class MarketingCountsOut(BaseModel):
    jtbd: int
    value_propositions: int
    swot: int
    competitors: int
    researches: int
    content: int
    segments: int = 0
    campaigns: int = 0
    funnels: int = 0
    tasks: int = 0
    alerts: int = 0
    ai_runs: int = 0
    open_alerts: int = 0
    critical_alerts: int = 0


class MarketingProjectSummaryOut(BaseModel):
    id: str
    company_id: str
    name: str
    slug: str
    description: str | None = None
    goals: str | None = None
    key_tasks: str | None = None
    category: str | None = None
    status: str | None = None
    priority: str | None = None
    tags: list[str] = Field(default_factory=list)
    enabled_modules: list[str] = Field(default_factory=list)
    company_name: str | None = None
    company_industry: str | None = None
    company_description: str | None = None
    company_website: str | None = None


class MarketingCoverageMetricOut(BaseModel):
    key: str
    label: str
    covered: int
    total: int
    percentage: int
    status: str = "ok"


class MarketingFreshnessFlagOut(BaseModel):
    key: str
    label: str
    state: str
    age_days: int | None = None
    detail: str | None = None


class MarketingInsightOut(BaseModel):
    code: str
    severity: str
    title: str
    description: str
    target_view: str | None = None
    metric_value: float | int | None = None


class MarketingIssueRemediationOut(BaseModel):
    issue_code: str
    state: str = "none"
    task_id: str | None = None
    task_title: str | None = None
    task_status: str | None = None
    task_owner_name: str | None = None
    task_due_at: str | None = None
    task_is_overdue: bool = False
    task_needs_owner: bool = False
    task_count: int = 0
    alert_id: str | None = None
    alert_title: str | None = None
    alert_status: str | None = None
    alert_owner_name: str | None = None
    alert_count: int = 0


class MarketingRecommendedActionOut(BaseModel):
    id: str
    title: str
    description: str
    target_view: str | None = None
    tone: str = "default"


class MarketingActivityItemOut(BaseModel):
    id: str
    kind: str
    title: str
    description: str | None = None
    target_view: str | None = None
    occurred_at: str | None = None


class MarketingCompanyRollupExcerptOut(BaseModel):
    company_id: str
    company_name: str | None = None
    total_projects: int = 0
    active_projects: int = 0
    latest_activity_at: str | None = None


# --- JTBD --------------------------------------------------------------------


class MarketingJobStoryOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str | None = None
    title: str
    statement: str
    situation: str
    motivation: str
    outcome: str
    category: str | None = None
    priority: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: str | None = None
    importance_score: float | None = None
    satisfaction_score: float | None = None
    opportunity_score: float | None = None
    quality_score: float | None = None
    sentiment_score: float | None = None
    is_validated: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingJobStoryListResponse(BaseModel):
    items: list[MarketingJobStoryOut]
    total: int


class DeleteJobStoryResponse(BaseModel):
    message: str
    story_id: str


# --- Value proposition -------------------------------------------------------


class MarketingValuePropositionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    headline: str | None = None
    subheadline: str | None = None
    value_statement: str | None = None
    proof_points: list[Any] = Field(default_factory=list)
    addressed_job_ids: list[str] = Field(default_factory=list)
    addressed_jobs: list[dict[str, Any]] = Field(default_factory=list)
    status: str | None = None
    target_channels: list[str] = Field(default_factory=list)
    quality_score: float | None = None
    conversion_rate: float | None = None
    click_through_rate: float | None = None
    is_ai_generated: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingValuePropositionListResponse(BaseModel):
    items: list[MarketingValuePropositionOut]
    total: int


class DeleteValuePropositionResponse(BaseModel):
    message: str
    value_proposition_id: str


# --- Competitors -------------------------------------------------------------


class MarketingCompetitorOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    name: str | None = None
    website: str | None = None
    description: str | None = None
    competitor_type: str | None = None
    market_position: str | None = None
    pricing_strategy: str | None = None
    market_share: float | None = None
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingCompetitorListResponse(BaseModel):
    items: list[MarketingCompetitorOut]
    total: int


class DeleteCompetitorResponse(BaseModel):
    message: str
    competitor_id: str


# --- Research ----------------------------------------------------------------


class MarketingResearchOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    title: str | None = None
    description: str | None = None
    research_type: str | None = None
    research_query: str | None = None
    priority: str | None = None
    status: str | None = None
    goals: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)
    result_content_id: str | None = None
    result_summary: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    active_ai_run_id: str | None = Field(
        default=None,
        description="Active marketing_ai_runs id for UI poll resume when status=processing",
    )


class MarketingResearchListResponse(BaseModel):
    items: list[MarketingResearchOut]
    total: int


class DeleteResearchResponse(BaseModel):
    message: str
    research_id: str


# --- Segments ----------------------------------------------------------------


class MarketingSegmentOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    name: str
    description: str | None = None
    segment_type: str | None = None
    status: str | None = None
    priority: str | None = None
    estimated_reach: int = 0
    fit_score: float | None = None
    linked_job_story_ids: list[str] = Field(default_factory=list)
    linked_content_ids: list[str] = Field(default_factory=list)
    linked_competitor_ids: list[str] = Field(default_factory=list)
    pain_points: list[str] = Field(default_factory=list)
    gains: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingSegmentListResponse(BaseModel):
    items: list[MarketingSegmentOut]
    total: int


class DeleteMarketingSegmentResponse(BaseModel):
    message: str
    segment_id: str


# --- Campaigns ---------------------------------------------------------------


class MarketingCampaignOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    name: str
    objective: str | None = None
    channel: str | None = None
    status: str | None = None
    priority: str | None = None
    owner_name: str | None = None
    hypothesis: str | None = None
    budget: float | None = None
    target_metric_name: str | None = None
    target_metric: float | None = None
    actual_metric: float | None = None
    linked_segment_ids: list[str] = Field(default_factory=list)
    linked_value_prop_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    start_date: str | None = None
    end_date: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class MarketingCampaignListResponse(BaseModel):
    items: list[MarketingCampaignOut]
    total: int


class DeleteMarketingCampaignResponse(BaseModel):
    message: str
    campaign_id: str


# --- Funnels -----------------------------------------------------------------


class MarketingFunnelStageOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    stage_name: str
    stage_order: int = 0
    visitors: int = 0
    conversions: int = 0
    conversion_rate: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingFunnelOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    name: str
    status: str | None = None
    primary_goal: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    stages: list[MarketingFunnelStageOut] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingFunnelListResponse(BaseModel):
    items: list[MarketingFunnelOut]
    total: int


class DeleteMarketingFunnelResponse(BaseModel):
    message: str
    funnel_id: str


# --- Tasks & alerts ----------------------------------------------------------


class MarketingTaskOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    title: str
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    owner_name: str | None = None
    due_at: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingTaskListResponse(BaseModel):
    items: list[MarketingTaskOut]
    total: int


class DeleteMarketingTaskResponse(BaseModel):
    message: str
    task_id: str


class MarketingAlertOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str
    title: str
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    owner_name: str | None = None
    source_type: str | None = None
    source_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingAlertListResponse(BaseModel):
    items: list[MarketingAlertOut]
    total: int


class DeleteMarketingAlertResponse(BaseModel):
    message: str
    alert_id: str


class MarketingRemediationActionItemOut(BaseModel):
    issue_code: str
    issue_title: str
    target: str
    status: str
    entity_id: str
    entity_type: str
    title: str
    target_view: str | None = None


class MarketingRemediationActionResponse(BaseModel):
    created: list[MarketingRemediationActionItemOut] = Field(default_factory=list)
    existing: list[MarketingRemediationActionItemOut] = Field(default_factory=list)


# --- AI Studio ---------------------------------------------------------------


class MarketingAiRunOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str | None = None
    company_id: str | None = None
    request_id: str | None = None
    tool_key: str
    status: str | None = None
    prompt_excerpt: str | None = None
    result_excerpt: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    started_at: str | None = None
    finished_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class MarketingAiRunListResponse(BaseModel):
    items: list[MarketingAiRunOut]
    total: int


class MarketingProjectLiveJobsSummaryResponse(BaseModel):
    """Лёгкий снимок для rail/badge: только счётчики активных AI и IMC runs."""

    ai_active_total: int = Field(ge=0)
    imc_active_total: int = Field(ge=0)


class MarketingAiAssistResponse(BaseModel):
    run: MarketingAiRunOut
    output_text: str


class MarketingAiQueueSnapshot(BaseModel):
    status: str | None = None
    waiting_count: int | None = None
    processing_count: int | None = None
    estimated_start_at: str | None = None


class MarketingAiAsyncStartResponse(BaseModel):
    run: MarketingAiRunOut
    poll_after_ms: int = 2000
    queue: MarketingAiQueueSnapshot | None = None


class MarketingAiRunDetailResponse(BaseModel):
    run: MarketingAiRunOut
    poll_after_ms: int = 2000
    queue: MarketingAiQueueSnapshot | None = None
    result_type: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None


# --- AI document autofill ----------------------------------------------------


class MarketingDocumentAutofillPreviewItemOut(BaseModel):
    draft_id: str
    title: str
    description: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    evidence: list[str] = Field(default_factory=list)


class MarketingDocumentAutofillAppliedItemOut(BaseModel):
    entity_id: str
    entity_type: str
    title: str
    target_section: str


class MarketingDocumentAutofillResponse(BaseModel):
    run: MarketingAiRunOut
    target_section: str
    mode: str
    source_content: MarketingContentItemOut
    summary: str | None = None
    warnings: list[str] = Field(default_factory=list)
    preview_items: list[MarketingDocumentAutofillPreviewItemOut] = Field(default_factory=list)
    applied_items: list[MarketingDocumentAutofillAppliedItemOut] = Field(default_factory=list)


# --- SWOT --------------------------------------------------------------------


class MarketingSwotFactorOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    factor_type: str | None = None
    factor_text: str | None = None
    description: str | None = None
    impact_level: str | None = None
    priority_score: float | int = 0
    ai_generated: bool = False
    confidence_score: float | None = None
    ai_reasoning: str | None = None


class MarketingSwotFactorsOut(BaseModel):
    strength: list[MarketingSwotFactorOut] = Field(default_factory=list)
    weakness: list[MarketingSwotFactorOut] = Field(default_factory=list)
    opportunity: list[MarketingSwotFactorOut] = Field(default_factory=list)
    threat: list[MarketingSwotFactorOut] = Field(default_factory=list)


class MarketingSwotOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    project_id: str
    company_id: str | None = None
    title: str | None = None
    description: str | None = None
    company_name: str | None = None
    industry: str | None = None
    status: str | None = None
    executive_summary: str | None = None
    ai_insights: dict[str, Any] = Field(default_factory=dict)
    strengths_count: int = 0
    weaknesses_count: int = 0
    opportunities_count: int = 0
    threats_count: int = 0
    factors: MarketingSwotFactorsOut = Field(default_factory=MarketingSwotFactorsOut)
    created_at: str | None = None
    updated_at: str | None = None


class MarketingSwotListResponse(BaseModel):
    items: list[MarketingSwotOut]
    total: int


class DeleteSwotAnalysisResponse(BaseModel):
    message: str
    analysis_id: str


# --- Content snippet (overview / health) -----------------------------------


class MarketingContentItemOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str | None = None
    content_type: str | None = None
    description: str | None = None
    processing_status: str | None = None
    project_id: str | None = None
    company_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    excerpt: str = ""
    file_size: int | None = None
    mime_type: str | None = None


# --- Project health / overview / dashboard -----------------------------------


class MarketingProjectHealthResponse(BaseModel):
    project: MarketingProjectSummaryOut
    counts: MarketingCountsOut
    readiness_score: int
    readiness_breakdown: ReadinessBreakdownOut | None = None
    readiness_meta: ReadinessMetaOut | None = Field(
        default=None,
        description="Расшифровка формулы готовности: веса, вклад баллов, метаданные среднего по coverage.",
    )
    last_activity_at: str | None = None
    coverage: list[MarketingCoverageMetricOut] = Field(default_factory=list)
    strategy_integrity_score: int = 0
    strategy_integrity: list[MarketingCoverageMetricOut] = Field(default_factory=list)
    strategy_integrity_issues: list[MarketingInsightOut] = Field(default_factory=list)
    issue_remediation: list[MarketingIssueRemediationOut] = Field(default_factory=list)
    freshness: list[MarketingFreshnessFlagOut] = Field(default_factory=list)
    gaps: list[MarketingInsightOut] = Field(default_factory=list)
    highlights: list[MarketingInsightOut] = Field(default_factory=list)
    recommended_actions: list[MarketingRecommendedActionOut] = Field(default_factory=list)
    activity_feed: list[MarketingActivityItemOut] = Field(default_factory=list)
    company_rollup_excerpt: MarketingCompanyRollupExcerptOut | None = None
    latest_swot: MarketingSwotOut | None = None
    recent_content: list[MarketingContentItemOut] = Field(default_factory=list)
    recent_researches: list[MarketingResearchOut] = Field(default_factory=list)
    segments: list[MarketingSegmentOut] = Field(default_factory=list)
    campaigns: list[MarketingCampaignOut] = Field(default_factory=list)
    funnels: list[MarketingFunnelOut] = Field(default_factory=list)
    tasks: list[MarketingTaskOut] = Field(default_factory=list)
    alerts: list[MarketingAlertOut] = Field(default_factory=list)
    ai_runs: list[MarketingAiRunOut] = Field(default_factory=list)


class MarketingProjectOverviewResponse(BaseModel):
    project: MarketingProjectSummaryOut
    job_stories: list[MarketingJobStoryOut]
    value_propositions: list[MarketingValuePropositionOut]
    competitors: list[MarketingCompetitorOut]
    researches: list[MarketingResearchOut]
    content: list[MarketingContentItemOut]
    swot: MarketingSwotOut | None = None


class MarketingDashboardWidgetListSlicesOut(BaseModel):
    """Per-widget list data when GET .../dashboard includes layout_id."""

    model_config = ConfigDict(extra="ignore")

    tasks: list[MarketingTaskOut] = Field(default_factory=list)
    alerts: list[MarketingAlertOut] = Field(default_factory=list)
    campaigns: list[MarketingCampaignOut] = Field(default_factory=list)
    segments: list[MarketingSegmentOut] = Field(default_factory=list)
    researches: list[MarketingResearchOut] = Field(default_factory=list)
    job_stories: list[MarketingJobStoryOut] = Field(default_factory=list)
    value_propositions: list[MarketingValuePropositionOut] = Field(default_factory=list)
    competitors: list[MarketingCompetitorOut] = Field(default_factory=list)
    imc_research_runs: list[ImcResearchRunSummary] = Field(default_factory=list)
    alerts_open_count: int | None = None
    filtered_total: int | None = Field(
        default=None,
        description="Rows matching filters/sort before maxItems cap (list widgets).",
    )


class MarketingProjectDashboardResponse(MarketingProjectHealthResponse, MarketingProjectOverviewResponse):
    """Health + overview в одном ответе (все поля обоих)."""

    model_config = ConfigDict(extra="ignore")

    analytics: MarketingDashboardAnalytics | None = None
    widget_list_slices: dict[str, MarketingDashboardWidgetListSlicesOut] | None = None
    imc_research_runs: list[ImcResearchRunSummary] = Field(default_factory=list)


class MarketingGraphNodeOut(BaseModel):
    id: str
    title: str
    subtitle: str
    target_view: str | None = None
    tone: str = "default"
    metric_label: str | None = None
    metric_value: str | int | float | None = None
    percentage: int | None = None
    bullets: list[str] = Field(default_factory=list)


class MarketingGraphEdgeOut(BaseModel):
    source: str
    target: str
    label: str


class MarketingProjectGraphResponse(BaseModel):
    project: MarketingProjectSummaryOut
    readiness_score: int
    strategy_integrity_score: int = 0
    strategy_integrity_issues: list[MarketingInsightOut] = Field(default_factory=list)
    last_activity_at: str | None = None
    nodes: list[MarketingGraphNodeOut] = Field(default_factory=list)
    edges: list[MarketingGraphEdgeOut] = Field(default_factory=list)

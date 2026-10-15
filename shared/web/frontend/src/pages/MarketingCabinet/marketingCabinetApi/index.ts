/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing Cabinet API barrel: HTTP client slices + OpenAPI SSOT type aliases
 * (Wave 4) + FE-only AMKA pulse/projection overlays from `@/features/amka`.
 *
 * Invariants:
 * - HTTP entity/dashboard/AMKA Out types alias `marketingCabinetOpenApi` (full/lite/org pilots).
 * - SSE stream types stay hand (`marketingCabinetApiStream.types.ts`).
 * - Widget view configs stay hand (`dashboard-widgets/`).
 * - Pilot endpoints validate JSON with Zod before React Query cache.
 *
 * Related:
 * - marketingCabinetOpenApi.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §Adoption Wave 4
 * - shared/api/schemas/marketing_cabinet/amka.py
 * - src/hooks/api/useAmka.ts
 */
import type {
	AmkaPulseArtifact,
	AmkaStandaloneProjection,
} from '@/features/amka/amkaTypes';
import type { ImcResearchRunSummary } from '../../../types/imc';
import type {
	MarketingCompetitor,
	MarketingJobStory,
	MarketingResearch,
	MarketingValueProposition,
} from './marketingCabinetApiCoreEntityTypes';
import type {
	AmkaOperatorConfigV1,
	AmkaRunDetailResponseOpenApi,
	MarketingAlert,
	MarketingCampaign,
	MarketingChatHistoryResponse,
	MarketingDocumentAutofillRequest,
	MarketingDocumentAutofillTarget,
	MarketingProjectHealth,
	MarketingSegment,
	MarketingTask,
	RemediationActionsRequest,
} from './marketingCabinetOpenApi';
import { marketingCabinetEntitiesApi } from './cabinetEntitiesApiSlice';
import { marketingCabinetOrganizationsApi } from './cabinetOrganizationsApiSlice';
import { marketingCabinetDashboardApi } from './dashboardApiSlice';
import { parseWidgetConfig } from '../dashboard-widgets/parseWidgetConfig';
import type { MarketingWidgetConfig } from '../dashboard-widgets/types';

export type {
	MarketingCanvasContentMode,
	MarketingChartMetricWidgetConfig,
	MarketingDashboardWidgetBodyConfig,
	MarketingDashboardWidgetDensity,
	MarketingDashboardWidgetKey,
	MarketingDashboardWidgetListKey,
	MarketingWidgetConfig,
	MarketingWidgetConfigCommon,
	MarketingWidgetDensity,
	MarketingWidgetListConfig,
	MarketingWidgetSortSpec,
	ParsedMarketingWidgetChartMetric,
	ParsedMarketingWidgetConfig,
	ParsedMarketingWidgetList,
	ParsedMarketingWidgetOverviewKpi,
	ParsedMarketingWidgetUnknownKey,
} from '../dashboard-widgets/types';

export type {
	MarketingDashboardAnalytics,
	MarketingDashboardAnalyticsSeries,
	MarketingDashboardSeriesMetricKey,
	MarketingDashboardTimeSeriesPoint,
} from '../marketingDashboardAnalytics';
export {
	MARKETING_DASHBOARD_SERIES_METRIC_KEYS,
	isMarketingDashboardSeriesMetricKey,
} from '../marketingDashboardAnalytics';
export type {
	MarketingPerformanceCampaign,
	MarketingPerformanceCohort,
	MarketingPerformanceDashboard,
	MarketingPerformanceDashboardFilters,
	MarketingPerformanceDashboardRequest,
	MarketingPerformanceDiagnostic,
	MarketingPerformanceSeriesPoint,
	MarketingPerformanceTotals,
} from '../marketingPerformanceDashboard';
export {
	formatMarketingMoney,
	formatMarketingPercent,
	formatMarketingRatio,
} from '../marketingPerformanceDashboard';

export {
	isMarketingDashboardWidgetKey,
	isMarketingDashboardWidgetListKey,
	isParsedMarketingWidgetChartMetric,
	isParsedMarketingWidgetList,
	isParsedMarketingWidgetOverviewKpi,
	isParsedMarketingWidgetUnknown,
	MARKETING_DASHBOARD_LIST_KEYS,
	MARKETING_DASHBOARD_WIDGET_KEYS,
} from '../dashboard-widgets/types';

export { parseWidgetConfig };

import {
	coerceMarketingAutofillResult,
	coerceMarketingJtbdExtractTotal,
	parseMarketingAiRunDetail,
	parseMarketingAiRunList,
	parseMarketingProjectLiveJobsSummary,
	parseMarketingProjectDashboard,
	type MarketingAiRunDetailOpenApi,
	type MarketingAiRunListOpenApi,
	type MarketingAutofillResultCoerced,
	type MarketingProjectDashboardOpenApi,
} from './marketingCabinetApiZod';

export {
	coerceMarketingAutofillResult,
	coerceMarketingJtbdExtractTotal,
	parseMarketingAiRunDetail,
	parseMarketingAiRunList,
	parseMarketingProjectLiveJobsSummary,
	parseMarketingProjectDashboard,
	type MarketingAiRunDetailOpenApi,
	type MarketingAiRunListOpenApi,
	type MarketingAutofillResultCoerced,
	type MarketingProjectDashboardOpenApi,
};

export {
	MARKETING_TIMEOUT_MULTIPLIER,
	MARKETING_API_TIMEOUT_MS,
	MARKETING_LONG_TIMEOUT_MS,
} from './config';

export * from './marketingCabinetApiCoreEntityTypes';

export type {
	MarketingCoverageMetric,
	MarketingFreshnessFlag,
	MarketingInsight,
	MarketingIssueRemediation,
	MarketingRecommendedAction,
	MarketingActivityItem,
	MarketingCompanyRollupExcerpt,
	MarketingSegment,
	MarketingCampaign,
	MarketingFunnel,
	MarketingFunnelStage,
	MarketingTask,
	MarketingAlert,
	MarketingAiRun,
	MarketingAiQueueSnapshot,
	MarketingAiAsyncStartResponse,
	MarketingAiRunDetailResponse,
	AmkaSourceRef,
	AmkaOperation,
	AmkaPlanTask,
	AmkaRun,
	AmkaRunStep,
	AmkaRunListResponse,
	AmkaAsyncStartResponse,
	AmkaPreset,
	AmkaPresetListResponse,
	AmkaPresetOneResponse,
	AmkaPresetTemplateListResponse,
	AmkaPresetConfigV1,
	AmkaPresetExtraPlanTaskIn,
	AmkaOperatorConfigV1,
	AmkaOperatorConfigBundle,
	AmkaControlResponse,
	AmkaPresetTemplate,
	MarketingProjectHealth,
	MarketingProjectOverview,
	MarketingProjectGraph,
	MarketingGraphNode,
	MarketingGraphEdge,
	MarketingDocumentAutofillTarget,
	MarketingDocumentAutofillMode,
	MarketingDocumentAutofillPreviewItem,
	MarketingDocumentAutofillAppliedItem,
	MarketingDocumentAutofillResponse,
	MarketingRemediationActionResponse,
	MarketingRemediationActionItem,
	MarketingOption,
	MarketingChatHistoryResponse,
	MarketingToolAgentResponse,
	ReadinessBreakdownOut as MarketingReadinessBreakdown,
	ReadinessMetaOut as MarketingReadinessMeta,
	ClientInteractionContext,
	ClientChatBridge,
	ClientDocApproval,
	ClientEwrpJobListItem,
	ClientPresShare,
	CustomerFacingSummaryGetResponse,
	CustomerFacingSummaryRecord,
	CustomerFacingSummaryPayload,
	CustomerFacingSummaryBody,
	MarketingClientPartnerOut,
	MarketingOkOut,
	MarketingClientDocCountOut,
	MarketingClientRemovalIdOut,
	MarketingClientShareIdOut,
	MarketingClientApprovalActionOut,
} from './marketingCabinetOpenApi';

export type {
	AmkaCoreAlignmentResponse,
	AmkaPulseArtifact,
	AmkaStandaloneProjection,
} from '@/features/amka/amkaTypes';

/** FE union over OpenAPI `AmkaRunOut.status` string (UI discriminants). */
export type AmkaRunStatus =
	| 'planning'
	| 'awaiting_approval'
	| 'awaiting_step_approval'
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type AmkaStepStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'failed'
	| 'skipped';

/**
 * AMKA run detail: OpenAPI envelope + FE-typed pulse/projection overlays
 * (`AmkaPulseArtifact` / `AmkaStandaloneProjection` from `@/features/amka`).
 */
export type AmkaRunDetailResponse = Omit<
	AmkaRunDetailResponseOpenApi,
	'pulse' | 'standalone_projection' | 'overview_health_preview'
> & {
	pulse?: AmkaPulseArtifact;
	standalone_projection?: AmkaStandaloneProjection;
	overview_health_preview?: MarketingProjectHealth;
};

export const AMKA_OPERATOR_CONFIG_V1_DEFAULT: AmkaOperatorConfigV1 = {
	schema_version: 1,
	baseline_audit: { extra_prompt_suffix: '' },
	section_llm_audit: {
		enabled: true,
		delay_ms: null,
		parallelism: null,
		require_work_needed_quotes: true,
		extra_prompt_instruction: '',
	},
	master_plan: {
		llm_enabled: true,
		max_tokens: null,
		extra_prompt_instruction: '',
		retry_on_parse_failure: false,
		repair_json_on_parse_failure: false,
	},
	execute: {
		max_wait_seconds: null,
		exclude_recent_imc_type_keys: false,
		exclude_recent_imc_type_keys_limit: 3,
		desktop_ensemble_enabled: true,
		ensemble_fallback_to_tool_agent: true,
	},
	final_assessment: {
		llm_enabled: true,
		max_prompt_chars: null,
		extra_prompt_instruction: '',
	},
};

/** Per-widget list payloads when GET .../dashboard includes matching `layout_id`. */
export type MarketingDashboardWidgetListSlices = {
	tasks?: MarketingTask[];
	alerts?: MarketingAlert[];
	campaigns?: MarketingCampaign[];
	segments?: MarketingSegment[];
	researches?: MarketingResearch[];
	job_stories?: MarketingJobStory[];
	value_propositions?: MarketingValueProposition[];
	competitors?: MarketingCompetitor[];
	imc_research_runs?: ImcResearchRunSummary[];
	/** Open alerts count after server-side filters, before `maxItems` cap. */
	alerts_open_count?: number;
	/** Rows matching filters/sort before `maxItems` cap (list widgets). */
	filtered_total?: number;
};

/**
 * Unified GET .../dashboard response.
 * OpenAPI (+ Zod at fetch) is SoT — hand DTOs must not require fields OpenAPI marks optional
 * (`analytics.series`, campaign `linked_*`, segment links, …).
 */
export type MarketingProjectDashboard = MarketingProjectDashboardOpenApi;

export * from './marketingCabinetApiDashboardLayoutTypes';

/** Разделы с кнопкой «Сгенерировать с AI» из контекста проекта (generate-from-project/async). */
export const MARKETING_PROJECT_AUTOFILL_ALL_TARGETS: readonly MarketingDocumentAutofillTarget[] =
	[
		'jtbd',
		'value_propositions',
		'swot',
		'competitors',
		'researches',
		'segments',
		'campaigns',
		'funnels',
		'tasks',
		'alerts',
	];

export type MarketingDocumentAutofillPayload = MarketingDocumentAutofillRequest;

/** Черновики раздела из контекста проекта + RAG (без файла), тот же контракт, что preview «Из документа». */
export interface MarketingDocumentProjectGeneratePayload {
	project_id: string;
	target_section: MarketingDocumentAutofillTarget;
	user_instruction?: string | null;
	idempotency_key?: string;
}

export type MarketingChatHistory = MarketingChatHistoryResponse;
export type MarketingChatHistoryMessage =
	MarketingChatHistoryResponse['messages'][number];

export type MarketingListResponse<T> = {
	items: T[];
	total: number;
};

export * from './marketingCabinetApiMutationPayloadTypes';

export type MarketingRemediationActionPayload = RemediationActionsRequest;

export const marketingCabinetApi = {
	...marketingCabinetDashboardApi,
	...marketingCabinetOrganizationsApi,
	...marketingCabinetEntitiesApi,
};

export type CustomerDiagnosticSettings = {
	project_id: string;
	enabled: boolean;
	updated_at: string | null;
};

export type CustomerDiagnosticSettingsPatch = {
	enabled: boolean;
};

export type CustomerDiagnosticSession = {
	id: string;
	project_id: string;
	company_id?: string | null;
	active_run_id?: string | null;
	state: Record<string, unknown>;
	progress_percent: number;
	computed_results: Record<string, unknown> | null;
	completed_at: string | null;
	updated_at: string;
	module_retake_status?: Record<string, string>;
};

export type CustomerDiagnosticSessionPatch = {
	state: Record<string, unknown>;
	progress_percent: number;
	computed_results?: Record<string, unknown> | null;
	mark_completed?: boolean;
	completed_module_metrics?: Record<string, Record<string, unknown>> | null;
};

export type CustomerDiagnosticRetakeRequestBody = {
	module_key: string;
};

export type CustomerDiagnosticRetakeRequest = {
	id: string;
	run_id: string;
	module_key: string;
	requested_by_user_id: string;
	status: string;
	created_at: string;
	resolved_at: string | null;
	resolved_by_user_id: string | null;
};

export type DiagnosticRetakeResolveBody = {
	approve: boolean;
};

export type DiagnosticRunSummary = {
	id: string;
	project_id: string;
	company_id: string;
	representative_user_id: string;
	run_index: number;
	created_at: string;
	full_completed_at: string | null;
	initiated_by_user_id: string | null;
	has_aggregate: boolean;
	/** Снимок на момент полного сброса (если прогон создан сбросом). */
	reset_initiator_username?: string | null;
	reset_initiator_full_name?: string | null;
	reset_initiator_position?: string | null;
};

export type DiagnosticModuleAttemptItem = {
	id: string;
	run_id: string;
	module_key: string;
	attempt_no: number;
	answers: Record<string, unknown>;
	computed_module: Record<string, unknown> | null;
	completed_at: string;
	lead_user_id_snapshot: string | null;
	previous_attempt_id: string | null;
	delta_vs_previous: Record<string, unknown> | null;
};

export type DiagnosticAdminOverview = {
	project_id: string;
	company_id: string;
	representative_user_id: string | null;
	active_run_id: string | null;
	runs: DiagnosticRunSummary[];
	pending_retake_requests: CustomerDiagnosticRetakeRequest[];
	attempts: DiagnosticModuleAttemptItem[];
};

export type CustomerDiagnosticHistoryResponse = {
	runs: DiagnosticRunSummary[];
	attempts: DiagnosticModuleAttemptItem[];
};

export function slugifyMarketingLabel(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80);
}

/** Slug для проектов: минимум 4 символа (требование API). */
export function slugifyProjectSlug(name: string): string {
	let slug = slugifyMarketingLabel(name);
	if (slug.length < 4) {
		const suffix = Math.random().toString(36).slice(2, 6);
		slug = `${slug || 'proj'}-${suffix}`;
	}
	return slug.slice(0, 255);
}

/** Slug для компаний: латиница из названия; если после транслитерации пусто (кириллица и т.д.) — суффикс (API: min 2 символа). */
export function slugifyCompanySlug(name: string): string {
	let slug = slugifyMarketingLabel(name);
	if (slug.length < 2) {
		const suffix = Math.random().toString(36).slice(2, 8);
		slug = `${slug || 'co'}-${suffix}`;
	}
	return slug.slice(0, 255);
}

/**
 * Coerces raw JSONB `widget_config` into the loose API shape (pass-through for known keys).
 * Never throws; returns `{}` for nullish or non-objects.
 * For key-aware sanitization (density, maxItems, list/chart fields), use {@link parseWidgetConfig}.
 */
export function parseMarketingWidgetConfig(
	raw: unknown
): MarketingWidgetConfig {
	if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
		return raw as MarketingWidgetConfig;
	}
	return {};
}

/**
 * Parses `widget_config` for a specific tile `widget_key` (safe defaults; never throws).
 * Prefer over {@link parseMarketingWidgetConfig} when rendering dashboard bodies.
 */
export function parseMarketingDashboardWidgetConfig(
	widgetKey: string,
	raw: unknown
): ReturnType<typeof parseWidgetConfig> {
	return parseWidgetConfig(widgetKey, raw);
}

export type {
	MarketingAiAssistPayload,
	MarketingAiStreamEvent,
	MarketingChatPayload,
	MarketingChatResponse,
} from './marketingCabinetApiStream.types';
export {
	MARKETING_CABINET_STREAM_AI_ASSIST_URL,
	MARKETING_CABINET_STREAM_CHAT_MESSAGE_URL,
	streamMarketingAiAssist,
	streamMarketingChatMessage,
} from './marketingCabinetApiStream';

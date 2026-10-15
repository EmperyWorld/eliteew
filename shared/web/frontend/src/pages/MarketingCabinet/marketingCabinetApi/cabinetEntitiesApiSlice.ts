/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domain Marketing Cabinet HTTP slice (JTBD, SWOT, chat, AMKA, AI runs). AI run list/detail
 * responses pass through Zod in `marketingCabinetApiZod.ts` before callers consume them.
 *
 * Invariants:
 * - Public `marketingCabinetApi` object shape unchanged (spread from `index.ts`).
 *
 * Related:
 * - `marketingCabinetApi/marketingCabinetApiZod.ts`
 */
import { api, apiClient, unwrapApiData } from '../../../services/api/client';

import { API_OPTIONS, LONG_API_OPTIONS } from './config';
import {
	parseMarketingAiRunDetail,
	parseMarketingAiRunList,
	type MarketingAiRunDetailOpenApi,
	type MarketingAiRunListOpenApi,
} from './marketingCabinetApiZod';
import type {
	AmkaAsyncStartResponse,
	AmkaControlResponse,
	AmkaCoreAlignmentResponse,
	AmkaOperatorConfigBundle,
	AmkaOperatorConfigV1,
	AmkaPresetConfigV1,
	AmkaPresetListResponse,
	AmkaPresetOneResponse,
	AmkaPresetTemplateListResponse,
	AmkaRunDetailResponse,
	AmkaRunListResponse,
	ClientChatBridge,
	ClientDocApproval,
	ClientEwrpJobListItem,
	ClientInteractionContext,
	ClientPresShare,
	CreateAlertPayload,
	CreateCampaignPayload,
	CreateCompetitorPayload,
	CreateFunnelPayload,
	CreateJobStoryPayload,
	CreateResearchPayload,
	CreateSegmentPayload,
	CreateSwotPayload,
	CreateTaskPayload,
	CreateValuePropositionPayload,
	CustomerDiagnosticHistoryResponse,
	CustomerDiagnosticRetakeRequest,
	CustomerDiagnosticRetakeRequestBody,
	CustomerDiagnosticSession,
	CustomerDiagnosticSessionPatch,
	CustomerDiagnosticSettings,
	CustomerDiagnosticSettingsPatch,
	CustomerFacingSummaryGetResponse,
	CustomerFacingSummaryPayload,
	MarketingOkOut,
	MarketingClientDocCountOut,
	MarketingClientRemovalIdOut,
	MarketingClientShareIdOut,
	MarketingClientApprovalActionOut,
	DiagnosticAdminOverview,
	DiagnosticRetakeResolveBody,
	ExtractJobStoriesPayload,
	GenerateSwotPayload,
	MarketingAiAsyncStartResponse,
	MarketingAlert,
	MarketingCampaign,
	MarketingChatHistory,
	MarketingChatPayload,
	MarketingChatResponse,
	MarketingCompetitor,
	MarketingContentItem,
	MarketingDocumentAutofillPayload,
	MarketingDocumentAutofillResponse,
	MarketingDocumentProjectGeneratePayload,
	MarketingFunnel,
	MarketingJobStory,
	MarketingListResponse,
	MarketingOption,
	MarketingRemediationActionPayload,
	MarketingRemediationActionResponse,
	MarketingResearch,
	MarketingSegment,
	MarketingSwot,
	MarketingTask,
	MarketingToolAgentResponse,
	MarketingValueProposition,
	RunResearchPayload,
	UpdateAlertPayload,
	UpdateCampaignPayload,
	UpdateCompetitorPayload,
	UpdateFunnelPayload,
	UpdateJobStoryPayload,
	UpdateResearchPayload,
	UpdateSegmentPayload,
	UpdateSwotPayload,
	UpdateTaskPayload,
	UpdateValuePropositionPayload,
} from './index';

export const marketingCabinetEntitiesApi = {
	listJobStories: (
		projectId: string,
		search?: string,
		limit?: number,
		offset?: number
	) =>
		api.get<MarketingListResponse<MarketingJobStory>>(
			'/marketing-cabinet/jtbd/job-stories',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(search ? { search } : {}),
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createJobStory: (payload: CreateJobStoryPayload) =>
		api.post<MarketingJobStory>(
			'/marketing-cabinet/jtbd/job-stories',
			payload,
			API_OPTIONS
		),

	updateJobStory: (storyId: string, payload: UpdateJobStoryPayload) =>
		api.patch<MarketingJobStory>(
			`/marketing-cabinet/jtbd/job-stories/${storyId}`,
			payload,
			API_OPTIONS
		),

	extractJobStoriesAsync: (payload: ExtractJobStoriesPayload) =>
		api.post<MarketingAiAsyncStartResponse>(
			'/marketing-cabinet/jtbd/extract/async',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			API_OPTIONS
		),

	deleteJobStory: (storyId: string) =>
		api.delete<{ message: string; story_id: string }>(
			`/marketing-cabinet/jtbd/job-stories/${storyId}`,
			API_OPTIONS
		),

	listValuePropositions: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingValueProposition>>(
			'/marketing-cabinet/value-propositions',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	getValueProposition: (valuePropId: string) =>
		api.get<MarketingValueProposition>(
			`/marketing-cabinet/value-propositions/${valuePropId}`,
			API_OPTIONS
		),

	createValueProposition: (payload: CreateValuePropositionPayload) =>
		api.post<MarketingValueProposition>(
			'/marketing-cabinet/value-propositions',
			payload,
			API_OPTIONS
		),

	updateValueProposition: (
		valuePropId: string,
		payload: UpdateValuePropositionPayload
	) =>
		api.patch<MarketingValueProposition>(
			`/marketing-cabinet/value-propositions/${valuePropId}`,
			payload,
			API_OPTIONS
		),

	deleteValueProposition: (valuePropId: string) =>
		api.delete<{ message: string; value_proposition_id: string }>(
			`/marketing-cabinet/value-propositions/${valuePropId}`,
			API_OPTIONS
		),

	listSwot: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingSwot>>(
			'/marketing-cabinet/analysis/swot',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createSwot: (payload: CreateSwotPayload) =>
		api.post<MarketingSwot>(
			'/marketing-cabinet/analysis/swot',
			payload,
			API_OPTIONS
		),

	generateSwotAsync: (payload: GenerateSwotPayload) =>
		api.post<MarketingAiAsyncStartResponse>(
			'/marketing-cabinet/analysis/swot/generate/async',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			API_OPTIONS
		),

	updateSwot: (analysisId: string, payload: UpdateSwotPayload) =>
		api.patch<MarketingSwot>(
			`/marketing-cabinet/analysis/swot/${analysisId}`,
			payload,
			API_OPTIONS
		),

	deleteSwot: (analysisId: string) =>
		api.delete<{ message: string; analysis_id: string }>(
			`/marketing-cabinet/analysis/swot/${analysisId}`,
			API_OPTIONS
		),

	listCompetitors: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingCompetitor>>(
			'/marketing-cabinet/competitors',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createCompetitor: (payload: CreateCompetitorPayload) =>
		api.post<MarketingCompetitor>(
			'/marketing-cabinet/competitors',
			payload,
			API_OPTIONS
		),

	updateCompetitor: (competitorId: string, payload: UpdateCompetitorPayload) =>
		api.patch<MarketingCompetitor>(
			`/marketing-cabinet/competitors/${competitorId}`,
			payload,
			API_OPTIONS
		),

	deleteCompetitor: (competitorId: string) =>
		api.delete<{ message: string; competitor_id: string }>(
			`/marketing-cabinet/competitors/${competitorId}`,
			API_OPTIONS
		),

	listResearchTypes: () =>
		api.get<{ items: MarketingOption[] }>(
			'/marketing-cabinet/researches/types',
			API_OPTIONS
		),

	listResearches: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingResearch>>(
			'/marketing-cabinet/researches',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createResearch: (payload: CreateResearchPayload) =>
		api.post<MarketingResearch>(
			'/marketing-cabinet/researches',
			payload,
			API_OPTIONS
		),

	updateResearch: (researchId: string, payload: UpdateResearchPayload) =>
		api.patch<MarketingResearch>(
			`/marketing-cabinet/researches/${researchId}`,
			payload,
			API_OPTIONS
		),

	runResearchAsync: (
		researchId: string,
		payload: RunResearchPayload = {
			max_tokens: 2500,
			use_web_search: false,
			web_search_quality: 'off',
		}
	) =>
		api.post<MarketingAiAsyncStartResponse>(
			`/marketing-cabinet/researches/${researchId}/run/async`,
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			API_OPTIONS
		),

	deleteResearch: (researchId: string) =>
		api.delete<{ message: string; research_id: string }>(
			`/marketing-cabinet/researches/${researchId}`,
			API_OPTIONS
		),

	listSegments: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingSegment>>(
			'/marketing-cabinet/segments',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createSegment: (payload: CreateSegmentPayload) =>
		api.post<MarketingSegment>(
			'/marketing-cabinet/segments',
			payload,
			API_OPTIONS
		),

	updateSegment: (segmentId: string, payload: UpdateSegmentPayload) =>
		api.patch<MarketingSegment>(
			`/marketing-cabinet/segments/${segmentId}`,
			payload,
			API_OPTIONS
		),

	deleteSegment: (segmentId: string) =>
		api.delete<{ message: string; segment_id: string }>(
			`/marketing-cabinet/segments/${segmentId}`,
			API_OPTIONS
		),

	listCampaigns: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingCampaign>>(
			'/marketing-cabinet/campaigns',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createCampaign: (payload: CreateCampaignPayload) =>
		api.post<MarketingCampaign>(
			'/marketing-cabinet/campaigns',
			payload,
			API_OPTIONS
		),

	updateCampaign: (campaignId: string, payload: UpdateCampaignPayload) =>
		api.patch<MarketingCampaign>(
			`/marketing-cabinet/campaigns/${campaignId}`,
			payload,
			API_OPTIONS
		),

	deleteCampaign: (campaignId: string) =>
		api.delete<{ message: string; campaign_id: string }>(
			`/marketing-cabinet/campaigns/${campaignId}`,
			API_OPTIONS
		),

	listFunnels: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingFunnel>>(
			'/marketing-cabinet/funnels',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createFunnel: (payload: CreateFunnelPayload) =>
		api.post<MarketingFunnel>(
			'/marketing-cabinet/funnels',
			payload,
			API_OPTIONS
		),

	updateFunnel: (funnelId: string, payload: UpdateFunnelPayload) =>
		api.patch<MarketingFunnel>(
			`/marketing-cabinet/funnels/${funnelId}`,
			payload,
			API_OPTIONS
		),

	deleteFunnel: (funnelId: string) =>
		api.delete<{ message: string; funnel_id: string }>(
			`/marketing-cabinet/funnels/${funnelId}`,
			API_OPTIONS
		),

	listTasks: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingTask>>(
			'/marketing-cabinet/operations/tasks',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createTask: (payload: CreateTaskPayload) =>
		api.post<MarketingTask>(
			'/marketing-cabinet/operations/tasks',
			payload,
			API_OPTIONS
		),

	updateTask: (taskId: string, payload: UpdateTaskPayload) =>
		api.patch<MarketingTask>(
			`/marketing-cabinet/operations/tasks/${taskId}`,
			payload,
			API_OPTIONS
		),

	deleteTask: (taskId: string) =>
		api.delete<{ message: string; task_id: string }>(
			`/marketing-cabinet/operations/tasks/${taskId}`,
			API_OPTIONS
		),

	listAlerts: (projectId: string, limit?: number, offset?: number) =>
		api.get<MarketingListResponse<MarketingAlert>>(
			'/marketing-cabinet/operations/alerts',
			{
				...API_OPTIONS,
				params: {
					project_id: projectId,
					...(limit != null ? { limit } : {}),
					...(offset != null ? { offset } : {}),
				},
			}
		),

	createAlert: (payload: CreateAlertPayload) =>
		api.post<MarketingAlert>(
			'/marketing-cabinet/operations/alerts',
			payload,
			API_OPTIONS
		),

	updateAlert: (alertId: string, payload: UpdateAlertPayload) =>
		api.patch<MarketingAlert>(
			`/marketing-cabinet/operations/alerts/${alertId}`,
			payload,
			API_OPTIONS
		),

	deleteAlert: (alertId: string) =>
		api.delete<{ message: string; alert_id: string }>(
			`/marketing-cabinet/operations/alerts/${alertId}`,
			API_OPTIONS
		),

	createRemediationActions: (payload: MarketingRemediationActionPayload) =>
		api.post<MarketingRemediationActionResponse>(
			'/marketing-cabinet/operations/remediation-actions',
			payload,
			API_OPTIONS
		),

	/** `company_id` опционально: если передан, API проверяет, что проект принадлежит компании. */
	listProjectContent: (
		projectId: string,
		limit = 24,
		companyId?: string | null
	) =>
		api.get<{ items: MarketingContentItem[]; total: number }>('/content', {
			...API_OPTIONS,
			params: {
				project_id: projectId,
				limit,
				...(companyId ? { company_id: companyId } : {}),
			},
		}),

	documentAutofill: (payload: MarketingDocumentAutofillPayload) =>
		api.post<MarketingDocumentAutofillResponse>(
			'/marketing-cabinet/autofill',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			LONG_API_OPTIONS
		),

	documentAutofillAsync: (payload: MarketingDocumentAutofillPayload) =>
		api.post<MarketingAiAsyncStartResponse>(
			'/marketing-cabinet/autofill/async',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			API_OPTIONS
		),

	documentAutofillFromProjectAsync: (
		payload: MarketingDocumentProjectGeneratePayload
	) =>
		api.post<MarketingAiAsyncStartResponse>(
			'/marketing-cabinet/autofill/generate-from-project/async',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			API_OPTIONS
		),

	sendChatMessage: (payload: MarketingChatPayload) =>
		api.post<MarketingChatResponse>(
			'/marketing-cabinet/chat/message',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			LONG_API_OPTIONS
		),

	getChatHistory: (params: {
		project_id: string | null;
		company_id: string | null;
	}) => {
		const projectId = params.project_id?.trim();
		if (projectId) {
			return api.get<MarketingChatHistory>('/marketing-cabinet/chat/history', {
				...API_OPTIONS,
				params: { project_id: projectId },
			});
		}
		const companyId = params.company_id?.trim();
		if (companyId) {
			return api.get<MarketingChatHistory>('/marketing-cabinet/chat/history', {
				...API_OPTIONS,
				params: { company_id: companyId },
			});
		}
		return Promise.reject(
			new Error(
				'marketingCabinetApi.getChatHistory: project_id or company_id is required'
			)
		);
	},

	listAiRuns: async (params: {
		project_id?: string | null;
		company_id?: string | null;
		limit?: number;
		/** exact: queued|processing|completed|failed|cancelled или `active` = queued+processing */
		status?: string | null;
		tool_key?: string | null;
	}) => {
		const raw = await api.get<MarketingAiRunListOpenApi>(
			'/marketing-cabinet/ai/runs',
			{
				...API_OPTIONS,
				params,
			}
		);
		return parseMarketingAiRunList(raw);
	},

	getAiRunDetail: async (runId: string) => {
		const raw = await api.get<MarketingAiRunDetailOpenApi>(
			`/marketing-cabinet/ai/runs/${runId}`,
			API_OPTIONS
		);
		return parseMarketingAiRunDetail(raw);
	},

	listAmkaRuns: (projectId: string, limit = 20) =>
		api.get<AmkaRunListResponse>(
			`/marketing-cabinet/amka/project/${projectId}/runs`,
			{
				...API_OPTIONS,
				params: { limit },
			}
		),

	getAmkaRunDetail: (runId: string) =>
		api.get<AmkaRunDetailResponse>(
			`/marketing-cabinet/amka/runs/${runId}`,
			API_OPTIONS
		),

	getAmkaCoreAlignment: async (
		runId: string,
		options?: {
			ifNoneMatch?: string | null;
			onResponseMeta?: (meta: { etag: string | null; status: number }) => void;
		}
	): Promise<AmkaCoreAlignmentResponse | null> => {
		const res = await apiClient.get<AmkaCoreAlignmentResponse>(
			`/marketing-cabinet/amka/runs/${runId}/core-alignment`,
			{
				...API_OPTIONS,
				...(options?.ifNoneMatch
					? { headers: { 'If-None-Match': options.ifNoneMatch } }
					: {}),
				validateStatus: (status) =>
					(status >= 200 && status < 300) || status === 304,
			}
		);
		const rawEtag = res.headers.etag ?? (res.headers as { ETag?: string }).ETag;
		const etag = typeof rawEtag === 'string' && rawEtag ? rawEtag : null;
		options?.onResponseMeta?.({ etag, status: res.status });
		if (res.status === 304) {
			return null;
		}
		return res.data;
	},

	/** Серверный markdown-экспорт (fallback на клиент при ошибке). */
	exportAmkaRunMarkdown: (
		runId: string,
		options?: { includeCoreAlignment?: boolean }
	) =>
		api.get<string>(`/marketing-cabinet/amka/runs/${runId}/export.md`, {
			...API_OPTIONS,
			responseType: 'text',
			...(options?.includeCoreAlignment === true
				? { params: { include_core_alignment: true } }
				: {}),
			transformResponse: (data: unknown) =>
				typeof data === 'string' ? data : String(data ?? ''),
		}),

	createAmkaRun: (payload: {
		project_id: string;
		company_id: string;
		scope_key?: 'all_visible';
		user_instruction?: string | null;
		section_keys?: string[];
		imc_type_key?: string;
		imc_focus?: 'global' | 'rf' | 'mixed';
		imc_max_wait_seconds?: number;
		run_mode?: 'auto' | 'semi_auto';
		auto_cycle_count?: number;
		per_step_execution?: boolean;
		preset_id?: string | null;
	}) =>
		api.post<AmkaAsyncStartResponse>(
			'/marketing-cabinet/amka/runs',
			{
				...payload,
				scope_key: payload.scope_key || 'all_visible',
			},
			API_OPTIONS
		),

	listAmkaPresetTemplates: () =>
		api.get<AmkaPresetTemplateListResponse>(
			'/marketing-cabinet/amka/preset-templates',
			API_OPTIONS
		),

	listAmkaPresets: (projectId: string) =>
		api.get<AmkaPresetListResponse>('/marketing-cabinet/amka/presets', {
			...API_OPTIONS,
			params: { project_id: projectId },
		}),

	getAmkaPreset: (presetId: string) =>
		api.get<AmkaPresetOneResponse>(
			`/marketing-cabinet/amka/presets/${presetId}`,
			API_OPTIONS
		),

	createAmkaPreset: (
		projectId: string,
		body: {
			display_name: string;
			slug?: string | null;
			config?: AmkaPresetConfigV1;
		}
	) =>
		api.post<AmkaPresetOneResponse>(
			'/marketing-cabinet/amka/presets',
			{
				display_name: body.display_name,
				slug: body.slug ?? undefined,
				config: body.config ?? { schema_version: 1, extra_plan_tasks: [] },
			},
			{
				...API_OPTIONS,
				params: { project_id: projectId },
			}
		),

	updateAmkaPreset: (
		presetId: string,
		body: { display_name?: string; config?: AmkaPresetConfigV1 }
	) =>
		api.put<AmkaPresetOneResponse>(
			`/marketing-cabinet/amka/presets/${presetId}`,
			body,
			API_OPTIONS
		),

	deleteAmkaPreset: (presetId: string) =>
		api.delete<void>(
			`/marketing-cabinet/amka/presets/${presetId}`,
			API_OPTIONS
		),

	approveAmkaRun: (
		runId: string,
		body?: {
			skip_section_keys?: string[];
			skip_step_ids?: string[];
			skip_operation_keys?: string[];
		}
	) =>
		api.post<AmkaControlResponse>(
			`/marketing-cabinet/amka/runs/${runId}/approve`,
			{
				skip_section_keys: body?.skip_section_keys ?? [],
				skip_step_ids: body?.skip_step_ids ?? [],
				skip_operation_keys: body?.skip_operation_keys ?? [],
			},
			API_OPTIONS
		),

	resumeAmkaRun: (
		runId: string,
		body?: {
			skip_section_keys?: string[];
			skip_step_ids?: string[];
			skip_operation_keys?: string[];
		}
	) =>
		api.post<AmkaControlResponse>(
			`/marketing-cabinet/amka/runs/${runId}/resume`,
			{
				skip_section_keys: body?.skip_section_keys ?? [],
				skip_step_ids: body?.skip_step_ids ?? [],
				skip_operation_keys: body?.skip_operation_keys ?? [],
			},
			API_OPTIONS
		),

	continueAmkaStep: (runId: string) =>
		api.post<AmkaControlResponse>(
			`/marketing-cabinet/amka/runs/${runId}/continue-step`,
			{},
			API_OPTIONS
		),

	cancelAmkaRun: (runId: string) =>
		api.post<AmkaControlResponse>(
			`/marketing-cabinet/amka/runs/${runId}/cancel`,
			{},
			API_OPTIONS
		),

	getAmkaOperatorConfig: () =>
		api.get<AmkaOperatorConfigBundle>(
			'/marketing-cabinet/amka/operator-config',
			API_OPTIONS
		),

	putAmkaOperatorConfig: (config: AmkaOperatorConfigV1) =>
		api.put<AmkaOperatorConfigBundle>(
			'/marketing-cabinet/amka/operator-config',
			{ config },
			API_OPTIONS
		),

	/** Router (functiongemma) + tools → факты из БД/RAG → финальный текст через UGS */
	runToolAgent: (payload: {
		prompt: string;
		project_id: string;
		router_model?: string;
		idempotency_key?: string;
		chat_context_excerpt?: string | null;
		source?: 'chat' | 'ai_studio';
	}) =>
		api.post<MarketingToolAgentResponse>(
			'/marketing-cabinet/ai/tool-agent',
			{
				...payload,
				idempotency_key: payload.idempotency_key || crypto.randomUUID(),
			},
			LONG_API_OPTIONS
		),

	getClientInteractionContext: (projectId: string) =>
		api.get<ClientInteractionContext>(
			'/marketing-cabinet/client-interaction/context',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	getCustomerFacingSummary: async (projectId: string) => {
		const response = await apiClient.get<unknown>(
			'/marketing-cabinet/client-interaction/customer-facing-summary',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		);
		return unwrapApiData<CustomerFacingSummaryGetResponse>(response.data);
	},

	putCustomerFacingSummary: (
		projectId: string,
		body: CustomerFacingSummaryPayload
	) =>
		api.put<MarketingOkOut>(
			'/marketing-cabinet/client-interaction/customer-facing-summary',
			body,
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	getClientChatBridge: (projectId: string) =>
		api.get<ClientChatBridge>(
			'/marketing-cabinet/client-interaction/chat-bridge',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	listClientDocApprovals: (projectId: string) =>
		api.get<ClientDocApproval[]>(
			'/marketing-cabinet/client-interaction/documents',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	sendClientDocsForApproval: (projectId: string, contentIds: string[]) =>
		api.post<MarketingClientDocCountOut>(
			'/marketing-cabinet/client-interaction/documents',
			{ content_ids: contentIds },
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	approveClientDoc: (projectId: string, approvalId: string) =>
		api.post<MarketingClientApprovalActionOut>(
			`/marketing-cabinet/client-interaction/documents/${approvalId}/approve`,
			{},
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	getClientApprovalFileBlob: (projectId: string, approvalId: string) =>
		api.get<Blob>(
			`/marketing-cabinet/client-interaction/documents/${approvalId}/file`,
			{
				...API_OPTIONS,
				params: { project_id: projectId },
				responseType: 'blob',
			}
		),

	requestClientDocRemoval: (projectId: string, approvalId: string) =>
		api.post<MarketingClientRemovalIdOut>(
			`/marketing-cabinet/client-interaction/documents/${approvalId}/request-removal`,
			{},
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	confirmClientDocRemoval: (projectId: string, removalId: string) =>
		api.post<MarketingOkOut>(
			`/marketing-cabinet/client-interaction/removal-requests/${removalId}/confirm`,
			{},
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	cancelClientDocRemoval: (projectId: string, removalId: string) =>
		api.post<MarketingOkOut>(
			`/marketing-cabinet/client-interaction/removal-requests/${removalId}/cancel`,
			{},
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	listClientEwrpJobs: (projectId: string) =>
		api.get<ClientEwrpJobListItem[]>(
			'/marketing-cabinet/client-interaction/ewrp-jobs',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	shareClientPresentation: (projectId: string, ewrpJobId: string) =>
		api.post<MarketingClientShareIdOut>(
			'/marketing-cabinet/client-interaction/presentations/share',
			{ ewrp_job_id: ewrpJobId },
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	listClientPresShares: (projectId: string) =>
		api.get<ClientPresShare[]>(
			'/marketing-cabinet/client-interaction/presentations',
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	revokeClientPresShare: (projectId: string, shareId: string) =>
		api.delete<MarketingOkOut>(
			`/marketing-cabinet/client-interaction/presentations/${shareId}`,
			{ ...API_OPTIONS, params: { project_id: projectId } }
		),

	getClientPresHtmlBlob: (projectId: string, shareId: string) =>
		api.get<Blob>(
			`/marketing-cabinet/client-interaction/presentations/${shareId}/html`,
			{
				...API_OPTIONS,
				params: { project_id: projectId },
				responseType: 'blob',
			}
		),

	getClientPresPdfBlob: (projectId: string, shareId: string) =>
		api.get<Blob>(
			`/marketing-cabinet/client-interaction/presentations/${shareId}/pdf`,
			{
				...API_OPTIONS,
				params: { project_id: projectId },
				responseType: 'blob',
			}
		),

	getCustomerDiagnosticSettings: (projectId: string) =>
		api.get<CustomerDiagnosticSettings>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/settings`,
			API_OPTIONS
		),

	patchCustomerDiagnosticSettings: (
		projectId: string,
		body: CustomerDiagnosticSettingsPatch
	) =>
		api.patch<CustomerDiagnosticSettings>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/settings`,
			body,
			API_OPTIONS
		),

	getCustomerDiagnosticSession: (projectId: string) =>
		api.get<CustomerDiagnosticSession>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/session`,
			API_OPTIONS
		),

	patchCustomerDiagnosticSession: (
		projectId: string,
		body: CustomerDiagnosticSessionPatch
	) =>
		api.patch<CustomerDiagnosticSession>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/session`,
			body,
			API_OPTIONS
		),

	postCustomerDiagnosticRetakeRequest: (
		projectId: string,
		body: CustomerDiagnosticRetakeRequestBody
	) =>
		api.post<CustomerDiagnosticRetakeRequest>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/retake-request`,
			body,
			API_OPTIONS
		),

	getCustomerDiagnosticHistory: (projectId: string) =>
		api.get<CustomerDiagnosticHistoryResponse>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/history`,
			API_OPTIONS
		),

	getDiagnosticAdminOverview: (projectId: string) =>
		api.get<DiagnosticAdminOverview>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/admin/overview`,
			API_OPTIONS
		),

	resolveDiagnosticRetakeRequest: (
		projectId: string,
		requestId: string,
		body: DiagnosticRetakeResolveBody
	) =>
		api.post<CustomerDiagnosticRetakeRequest>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/retake-requests/${requestId}/resolve`,
			body,
			API_OPTIONS
		),

	postDiagnosticFullReset: (projectId: string) =>
		api.post<{ status: string; active_run_id: string }>(
			`/marketing-cabinet/projects/${projectId}/customer-diagnostic/full-reset`,
			{},
			API_OPTIONS
		),
};

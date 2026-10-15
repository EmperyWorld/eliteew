/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 `queryOptions` / `infiniteQueryOptions` for Marketing Cabinet.
 *
 * Invariants:
 * - Same options for `useQuery` / prefetch helpers (single cache key per entity).
 * - Query keys stay compatible with `constants.ts` helpers where they already exist.
 *
 * Related:
 * - hooks/useMarketingCabinetFoundationQueries.ts
 * - hooks/useMarketingCabinetProjectEntityQueries.ts
 * - hooks/useMarketingCabinetDashboardBundle.ts
 * - marketingCabinetClientInteractionQueryOptions.ts
 * - marketingCabinetModulePrefetch.ts
 */

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { imcClient } from '@/services/api/imcClient';
import { imcQueryKeys } from '@/services/api/imcQueryKeys';
import { marketingProjectRagApi } from '@/services/api/marketingProjectRagApi';
import type { ImcResearchRunSummary } from '@/types/imc';

import { profileService } from '@/services/profileService';

import {
	MARKETING_AI_RUNS_PANEL_LIMIT,
	MARKETING_CAMPAIGNS_LIST_LIMIT,
	MARKETING_CONTENT_LIST_FETCH_LIMIT,
	MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
	MARKETING_LIVE_QUERY_OPTIONS,
	MARKETING_PROJECT_MEMBERS_FETCH_LIMIT,
	MARKETING_SECTION_LIST_FETCH_LIMIT,
	marketingCabinetContentQueryKey,
	marketingCabinetFoundationProjectsQueryKey,
} from './constants';
import { marketingCabinetApi } from './marketingCabinetApi';
import type { MarketingPerformanceDashboardRequest } from './marketingPerformanceDashboard';
import {
	DASHBOARD_LAYOUT_QUERY_KEY,
	DASHBOARD_LAYOUT_TEMPLATES_QUERY_KEY,
	DASHBOARD_PRESETS_QUERY_KEY,
} from './views/overviewInteractiveDashboardConstants';
import { requireDefined } from './utils';

export const MARKETING_QUERY_ROOT = ['marketing'] as const;
export const MARKETING_SELF_PROFILE_STALE_MS = 60_000;
export const MARKETING_FOUNDATION_STUB_STALE_MS = 60_000;
export const MARKETING_FOUNDATION_STUB_GC_MS = 5 * 60_000;

export type MarketingCabinetProjectDashboardQueryParams = {
	projectId: string | null | undefined;
	includeSeries: boolean;
	seriesWindowDays: number;
	layoutId: string | null;
	compactLists: boolean;
};

export function marketingCabinetSelfProfileQueryKey(
	userId: string | null | undefined
) {
	return [...MARKETING_QUERY_ROOT, 'self-profile', userId] as const;
}

export function marketingCabinetSelfProfileQueryOptions(
	userId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetSelfProfileQueryKey(userId),
		queryFn: () => profileService.getProfile(),
		staleTime: MARKETING_SELF_PROFILE_STALE_MS,
	});
}

export function marketingCabinetCompaniesQueryOptions() {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'companies',
			MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listCompanies({
				limit: MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
				skip: 0,
			}),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCompanyStubQueryOptions(
	companyId: string | null | undefined
) {
	return queryOptions({
		queryKey: [...MARKETING_QUERY_ROOT, 'company', companyId] as const,
		queryFn: () =>
			marketingCabinetApi.getCompany(
				requireDefined(companyId, 'selectedCompanyId')
			),
		staleTime: MARKETING_FOUNDATION_STUB_STALE_MS,
		gcTime: MARKETING_FOUNDATION_STUB_GC_MS,
	});
}

export function marketingCabinetFoundationProjectsQueryOptions(
	companyId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetFoundationProjectsQueryKey(companyId),
		queryFn: () =>
			marketingCabinetApi.listProjects(
				requireDefined(companyId, 'selectedCompanyId'),
				MARKETING_FOUNDATION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetProjectStubQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [...MARKETING_QUERY_ROOT, 'project', projectId] as const,
		queryFn: () =>
			marketingCabinetApi.getProject(
				requireDefined(projectId, 'selectedProjectId')
			),
		staleTime: MARKETING_FOUNDATION_STUB_STALE_MS,
		gcTime: MARKETING_FOUNDATION_STUB_GC_MS,
	});
}

export function marketingCabinetProjectMembersInfiniteQueryOptions(
	projectId: string | null | undefined
) {
	return infiniteQueryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'project-members',
			projectId,
			MARKETING_PROJECT_MEMBERS_FETCH_LIMIT,
		] as const,
		queryFn: ({ pageParam }) =>
			marketingCabinetApi.listProjectMembers(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_PROJECT_MEMBERS_FETCH_LIMIT,
				pageParam
			),
		initialPageParam: 0,
		getNextPageParam: (lastPage, allPages) => {
			const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
			if (loaded >= lastPage.total) return undefined;
			return loaded;
		},
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetContentQueryOptions(
	projectId: string | null | undefined,
	companyId?: string | null
) {
	return queryOptions({
		queryKey: marketingCabinetContentQueryKey(projectId, companyId),
		queryFn: () =>
			marketingCabinetApi.listProjectContent(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_CONTENT_LIST_FETCH_LIMIT,
				companyId
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetJobStoriesQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'jtbd',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listJobStories(
				requireDefined(projectId, 'selectedProjectId'),
				undefined,
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetValuePropsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'value-propositions',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listValuePropositions(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetSwotQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'swot',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listSwot(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCompetitorsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'competitors',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listCompetitors(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetResearchTypesQueryOptions() {
	return queryOptions({
		queryKey: [...MARKETING_QUERY_ROOT, 'research-types'] as const,
		queryFn: marketingCabinetApi.listResearchTypes,
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetResearchesQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'researches',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listResearches(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetSegmentsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'segments',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listSegments(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCampaignsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'campaigns',
			projectId,
			MARKETING_CAMPAIGNS_LIST_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listCampaigns(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_CAMPAIGNS_LIST_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetFunnelsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'funnels',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listFunnels(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetTasksQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'tasks',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listTasks(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetAlertsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'alerts',
			projectId,
			MARKETING_SECTION_LIST_FETCH_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listAlerts(
				requireDefined(projectId, 'selectedProjectId'),
				MARKETING_SECTION_LIST_FETCH_LIMIT,
				0
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetAiRunDetailQueryKey(runId: string | null) {
	return [...MARKETING_QUERY_ROOT, 'ai-run-detail', runId] as const;
}

export function marketingCabinetAiRunDetailQueryOptions(runId: string | null) {
	return queryOptions({
		queryKey: marketingCabinetAiRunDetailQueryKey(runId),
		queryFn: () =>
			marketingCabinetApi.getAiRunDetail(requireDefined(runId, 'aiRunId')),
		refetchOnWindowFocus: false,
	});
}

export function marketingCabinetAiRunDetailPollIntervalMs(
	data:
		| Awaited<ReturnType<typeof marketingCabinetApi.getAiRunDetail>>
		| undefined
): number | false {
	const status = data?.run.status;
	if (status && ['completed', 'failed', 'cancelled'].includes(status)) {
		return false;
	}
	return data?.poll_after_ms ?? 2000;
}

export function marketingCabinetProjectLiveJobsSummaryQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'project-live-jobs-summary',
			projectId,
		] as const,
		queryFn: () =>
			marketingCabinetApi.getProjectLiveJobsSummary(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetAiRunsPanelQueryOptions(
	projectId: string | null,
	companyId: string | null
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'ai-runs',
			projectId,
			companyId,
			MARKETING_AI_RUNS_PANEL_LIMIT,
		] as const,
		queryFn: () =>
			marketingCabinetApi.listAiRuns({
				project_id: projectId,
				company_id: projectId ? null : companyId,
				limit: MARKETING_AI_RUNS_PANEL_LIMIT,
			}),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetDashboardLayoutQueryKey(
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		DASHBOARD_LAYOUT_QUERY_KEY,
		projectId,
	] as const;
}

export function marketingCabinetDashboardLayoutQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetDashboardLayoutQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getActiveDashboardLayout(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetDashboardPresetsQueryKey(
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		DASHBOARD_PRESETS_QUERY_KEY,
		projectId,
	] as const;
}

export function marketingCabinetDashboardPresetsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetDashboardPresetsQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.listDashboardPresets(
				requireDefined(projectId, 'projectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetDashboardUsageStatsQueryKey(
	projectId: string | null | undefined
) {
	return [...MARKETING_QUERY_ROOT, 'dashboard-usage-stats', projectId] as const;
}

export function marketingCabinetDashboardUsageStatsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetDashboardUsageStatsQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getDashboardUsageStats(
				requireDefined(projectId, 'projectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetDashboardLayoutTemplatesQueryKey() {
	return [
		...MARKETING_QUERY_ROOT,
		DASHBOARD_LAYOUT_TEMPLATES_QUERY_KEY,
	] as const;
}

export function marketingCabinetDashboardLayoutTemplatesQueryOptions() {
	return queryOptions({
		queryKey: marketingCabinetDashboardLayoutTemplatesQueryKey(),
		queryFn: () => marketingCabinetApi.listDashboardLayoutTemplates(),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetProjectGraphQueryKey(projectId: string) {
	return [...MARKETING_QUERY_ROOT, 'project-graph', projectId] as const;
}

export function marketingCabinetProjectGraphQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: marketingCabinetProjectGraphQueryKey(projectId),
		queryFn: () => marketingCabinetApi.getProjectGraph(projectId),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

/** Compact project dashboard for customer-facing summary autofill panel (hover-gated in UI). */
export function marketingCabinetCustomerSummaryAutofillDashboardQueryKey(
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		'project-dashboard',
		'summary-autofill',
		projectId,
	] as const;
}

export function marketingCabinetCustomerSummaryAutofillDashboardQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey:
			marketingCabinetCustomerSummaryAutofillDashboardQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getProjectDashboard(
				requireDefined(projectId, 'projectId'),
				{ compactLists: true }
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
		/** Autofill hover panel: longer stale than live section lists. */
		staleTime: 60_000,
	});
}

export function marketingCabinetProjectDashboardQueryKey(
	params: MarketingCabinetProjectDashboardQueryParams
) {
	return [
		...MARKETING_QUERY_ROOT,
		'project-dashboard',
		params.projectId,
		params.includeSeries,
		params.seriesWindowDays,
		params.layoutId,
		params.compactLists,
	] as const;
}

export function marketingCabinetProjectDashboardQueryOptions(
	params: MarketingCabinetProjectDashboardQueryParams
) {
	return queryOptions({
		queryKey: marketingCabinetProjectDashboardQueryKey(params),
		queryFn: () =>
			marketingCabinetApi.getProjectDashboard(
				requireDefined(params.projectId, 'selectedProjectId'),
				{
					includeSeries: params.includeSeries,
					...(params.includeSeries
						? { windowDays: params.seriesWindowDays }
						: {}),
					...(params.layoutId ? { layoutId: params.layoutId } : {}),
					...(params.compactLists ? { compactLists: true } : {}),
				}
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

/** Prefix invalidation: all `project-dashboard` variants for a project (series/layout flags). */
export function marketingCabinetProjectDashboardInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return [...MARKETING_QUERY_ROOT, 'project-dashboard', projectId] as const;
}

/** Prefix invalidation: active dashboard layout for a project. */
export function marketingCabinetDashboardLayoutInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return marketingCabinetDashboardLayoutQueryKey(projectId);
}

/** Prefix invalidation: dashboard presets for a project. */
export function marketingCabinetDashboardPresetsInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return marketingCabinetDashboardPresetsQueryKey(projectId);
}

/** Prefix invalidation: dashboard widget usage stats for a project. */
export function marketingCabinetDashboardUsageStatsInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return marketingCabinetDashboardUsageStatsQueryKey(projectId);
}

/** Prefix invalidation: saved dashboard layout templates (global list). */
export function marketingCabinetDashboardLayoutTemplatesInvalidationQueryKey() {
	return marketingCabinetDashboardLayoutTemplatesQueryKey();
}

/** Prefix invalidation: overview project graph for a project. */
export function marketingCabinetProjectGraphInvalidationQueryKey(
	projectId: string
) {
	return marketingCabinetProjectGraphQueryKey(projectId);
}

/** Prefix invalidation: all AI runs panel queries (any project/company/limit suffix). */
export function marketingCabinetAiRunsInvalidationQueryKey() {
	return [...MARKETING_QUERY_ROOT, 'ai-runs'] as const;
}

/** Prefix invalidation: AI runs panel queries scoped to a project (any company/limit suffix). */
export function marketingCabinetAiRunsProjectInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return [...MARKETING_QUERY_ROOT, 'ai-runs', projectId] as const;
}

export function marketingCabinetProjectLiveJobsSummaryInvalidationQueryKey(
	projectId: string
) {
	return [
		...MARKETING_QUERY_ROOT,
		'project-live-jobs-summary',
		projectId,
	] as const;
}

export function marketingCabinetCompanyLiveJobsSummaryQueryOptions(
	companyId: string | null | undefined
) {
	return queryOptions({
		queryKey: [
			...MARKETING_QUERY_ROOT,
			'company-live-jobs-summary',
			companyId,
		] as const,
		queryFn: () =>
			marketingCabinetApi.getCompanyLiveJobsSummary(
				requireDefined(companyId, 'selectedCompanyId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCompanyLiveJobsSummaryInvalidationQueryKey(
	companyId: string
) {
	return [
		...MARKETING_QUERY_ROOT,
		'company-live-jobs-summary',
		companyId,
	] as const;
}

/** Prefix invalidation: entire marketing cabinet cache tree. */
export function marketingCabinetRootInvalidationQueryKey() {
	return MARKETING_QUERY_ROOT;
}

/** Prefix invalidation: IMC queries under `['imc', …]` (outside `['marketing']`). */
export function marketingCabinetImcRootInvalidationQueryKey() {
	return imcQueryKeys.all;
}

/** Prefix invalidation: IMC RAG hints for a project (`useMarketingProjectRag`). */
export function marketingCabinetImcRagHintsInvalidationQueryKey(
	projectId: string
) {
	return imcQueryKeys.ragHints(projectId);
}

/** Project RAG sources list (`marketingProjectRagApi`). */
export function marketingCabinetProjectRagQueryKey(
	projectId: string | undefined
) {
	return [...MARKETING_QUERY_ROOT, 'project-rag', projectId ?? ''] as const;
}

export function marketingCabinetProjectRagQueryOptions(
	projectId: string | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetProjectRagQueryKey(projectId),
		queryFn: () => {
			if (!projectId) {
				return Promise.resolve({ items: [] });
			}
			return marketingProjectRagApi.listProjectSources(projectId);
		},
		staleTime: 15_000,
	});
}

/** Prefix invalidation: IMC queries scoped under marketing root. */
export function marketingCabinetImcInvalidationQueryKey() {
	return imcQueryKeys.marketingCabinetPrefix;
}

/** Prefix invalidation: project members infinite list (limit suffix matched by prefix). */
export function marketingCabinetProjectMembersInvalidationQueryKey(
	projectId: string
) {
	return [...MARKETING_QUERY_ROOT, 'project-members', projectId] as const;
}

export type MarketingCabinetProjectListSection =
	| 'jtbd'
	| 'value-propositions'
	| 'swot'
	| 'competitors'
	| 'researches'
	| 'segments'
	| 'campaigns'
	| 'funnels'
	| 'tasks'
	| 'alerts';

export const MARKETING_CABINET_PROJECT_LIST_SECTIONS = [
	'jtbd',
	'value-propositions',
	'swot',
	'competitors',
	'researches',
	'segments',
	'campaigns',
	'funnels',
	'tasks',
	'alerts',
] as const satisfies readonly MarketingCabinetProjectListSection[];

/** Prefix invalidation: project section list queries (limit/layout suffixes). */
export function marketingCabinetProjectSectionInvalidationQueryKey(
	section: MarketingCabinetProjectListSection,
	projectId: string | null | undefined
) {
	return [...MARKETING_QUERY_ROOT, section, projectId] as const;
}

/** Prefix invalidation: project content list (limit suffix matched by TanStack prefix rules). */
export function marketingCabinetContentInvalidationQueryKey(
	projectId: string | null | undefined,
	companyId?: string | null
) {
	return [
		'content',
		'marketing',
		projectId ?? null,
		companyId ?? null,
	] as const;
}

/** Prefix invalidation: all marketing content queries for a project. */
export function marketingCabinetContentProjectInvalidationQueryKey(
	projectId: string | null | undefined
) {
	return ['content', 'marketing', projectId] as const;
}

/** Prefix invalidation: all marketing content queries. */
export function marketingCabinetContentRootInvalidationQueryKey() {
	return ['content', 'marketing'] as const;
}

export function marketingCabinetChatHistoryQueryKey(
	selectedProjectId: string | null,
	selectedCompanyId: string | null
) {
	return [
		...MARKETING_QUERY_ROOT,
		'chat-history',
		selectedProjectId,
		selectedCompanyId,
	] as const;
}

export function marketingCabinetChatHistoryQueryOptions(
	selectedProjectId: string | null,
	selectedCompanyId: string | null
) {
	return queryOptions({
		queryKey: marketingCabinetChatHistoryQueryKey(
			selectedProjectId,
			selectedCompanyId
		),
		queryFn: () =>
			marketingCabinetApi.getChatHistory({
				project_id: selectedProjectId,
				company_id: selectedProjectId ? null : selectedCompanyId,
			}),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetPerformanceDashboardQueryKey(
	selectedProjectId: string | null | undefined,
	filters: MarketingPerformanceDashboardRequest
) {
	return [
		...MARKETING_QUERY_ROOT,
		'project-performance-dashboard',
		selectedProjectId,
		filters.dateFrom ?? null,
		filters.dateTo ?? null,
		filters.windowDays ?? 30,
		filters.campaignIds?.join(',') ?? '',
		filters.sources?.join(',') ?? '',
		filters.geos?.join(',') ?? '',
	] as const;
}

export function marketingCabinetPerformanceDashboardQueryOptions(
	selectedProjectId: string | null | undefined,
	filters: MarketingPerformanceDashboardRequest
) {
	return queryOptions({
		queryKey: marketingCabinetPerformanceDashboardQueryKey(
			selectedProjectId,
			filters
		),
		queryFn: () =>
			marketingCabinetApi.getProjectPerformanceDashboard(
				requireDefined(selectedProjectId, 'selectedProjectId'),
				filters
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export type MarketingAiJobCenterStatusFilter = 'active' | 'all';

export function marketingCabinetAiJobCenterRunsQueryKey(params: {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	filter: MarketingAiJobCenterStatusFilter;
}) {
	return [
		...MARKETING_QUERY_ROOT,
		'ai-runs',
		params.selectedProjectId,
		params.selectedCompanyId,
		'job-center',
		params.filter,
	] as const;
}

export function marketingCabinetAiJobCenterRunsQueryOptions(params: {
	scopeParams:
		| {
				project_id: string;
				company_id: null;
		  }
		| {
				project_id: null;
				company_id: string;
		  }
		| null;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	filter: MarketingAiJobCenterStatusFilter;
}) {
	return queryOptions({
		queryKey: marketingCabinetAiJobCenterRunsQueryKey({
			selectedProjectId: params.selectedProjectId,
			selectedCompanyId: params.selectedCompanyId,
			filter: params.filter,
		}),
		queryFn: () =>
			marketingCabinetApi.listAiRuns({
				...(params.scopeParams ?? {}),
				limit: params.filter === 'active' ? 40 : 30,
				...(params.filter === 'active' ? { status: 'active' } : {}),
			}),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetImcJobCenterRunsQueryKey(params: {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	filter: MarketingAiJobCenterStatusFilter;
}) {
	return [
		...MARKETING_QUERY_ROOT,
		'imc',
		params.selectedProjectId,
		params.selectedCompanyId,
		'job-center',
		params.filter,
	] as const;
}

export function marketingCabinetImcJobCenterRunsQueryOptions(params: {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	filter: MarketingAiJobCenterStatusFilter;
}) {
	return queryOptions({
		queryKey: marketingCabinetImcJobCenterRunsQueryKey(params),
		queryFn: async () => {
			const opts = {
				active_only: params.filter === 'active',
				limit: params.filter === 'active' ? 40 : 20,
			};
			if (params.selectedProjectId) {
				return imcClient.listForProject(params.selectedProjectId, opts);
			}
			if (params.selectedCompanyId) {
				return imcClient.listForCompany(params.selectedCompanyId, opts);
			}
			return {
				total: 0,
				items: [] as ImcResearchRunSummary[],
			};
		},
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function invalidateMarketingCabinetAfterAmkaRun(
	qc: {
		invalidateQueries: (filters: { queryKey: readonly unknown[] }) => void;
	},
	params: { projectId: string; companyId?: string | null }
) {
	void qc.invalidateQueries({
		queryKey: marketingCabinetProjectDashboardInvalidationQueryKey(
			params.projectId
		),
	});
	void qc.invalidateQueries({
		queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(
			params.projectId
		),
	});
	void qc.invalidateQueries({
		queryKey: marketingCabinetProjectLiveJobsSummaryInvalidationQueryKey(
			params.projectId
		),
	});
	void qc.invalidateQueries({
		queryKey: marketingCabinetContentInvalidationQueryKey(
			params.projectId,
			params.companyId
		),
	});
}

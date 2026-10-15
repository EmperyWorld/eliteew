/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Interactive dashboard HTTP calls under `/marketing-cabinet/projects/:id/...`.
 * `getProjectDashboard` validates pilot OpenAPI shape via Zod before React Query cache;
 * performance-dashboard calls expose marketer-facing financial analytics.
 *
 * Invariants:
 * - Public `marketingCabinetApi` spread from `index.ts` preserves method names.
 * - Performance filters are forwarded as query params and included in React Query keys by callers.
 *
 * Related:
 * - `marketingCabinetApi/marketingCabinetApiZod.ts`
 * - shared/api/schemas/marketing_cabinet/performance.py
 */
import { api } from '../../../services/api/client';

import { API_OPTIONS } from './config';
import {
	parseMarketingProjectDashboard,
	parseMarketingProjectLiveJobsSummary,
	type MarketingProjectDashboardOpenApi,
	type MarketingProjectLiveJobsSummaryParsed,
} from './marketingCabinetApiZod';
import type {
	MarketingDashboardActivateResponse,
	MarketingDashboardCleanupDuplicatesResponse,
	MarketingDashboardCloneResponse,
	MarketingDashboardLayout,
	MarketingDashboardLayoutCreatePayload,
	MarketingDashboardLayoutListResponse,
	MarketingDashboardLayoutUpdatePayload,
	MarketingDashboardPresetListResponse,
	MarketingDashboardUsageStats,
	MarketingDashboardWidget,
	MarketingDashboardWidgetCreatePayload,
	MarketingDashboardWidgetUpdatePayload,
	MarketingProjectGraph,
} from './index';
import type {
	MarketingPerformanceDashboard,
	MarketingPerformanceDashboardRequest,
} from '../marketingPerformanceDashboard';

export const marketingCabinetDashboardApi = {
	getProjectLiveJobsSummary: async (projectId: string) => {
		const raw = await api.get<MarketingProjectLiveJobsSummaryParsed>(
			`/marketing-cabinet/projects/${projectId}/live-jobs-summary`,
			API_OPTIONS
		);
		return parseMarketingProjectLiveJobsSummary(raw);
	},

	getCompanyLiveJobsSummary: async (companyId: string) => {
		const raw = await api.get<MarketingProjectLiveJobsSummaryParsed>(
			`/marketing-cabinet/companies/${companyId}/live-jobs-summary`,
			API_OPTIONS
		);
		return parseMarketingProjectLiveJobsSummary(raw);
	},

	getProjectDashboard: async (
		projectId: string,
		opts?: {
			includeSeries?: boolean;
			windowDays?: number;
			layoutId?: string | null;
			/** Smaller payloads when not on interactive dashboard; skips slices without layout_id. */
			compactLists?: boolean;
		}
	) => {
		const params: Record<string, string> = {};
		if (opts?.includeSeries) {
			params.include = 'series';
		}
		if (opts?.windowDays != null) {
			params.window_days = String(opts.windowDays);
		}
		if (opts?.layoutId) {
			params.layout_id = opts.layoutId;
		}
		if (opts?.compactLists) {
			params.compact_lists = 'true';
		}
		const hasParams = Object.keys(params).length > 0;
		const raw = await api.get<MarketingProjectDashboardOpenApi>(
			`/marketing-cabinet/projects/${projectId}/dashboard`,
			hasParams ? { ...API_OPTIONS, params } : API_OPTIONS
		);
		return parseMarketingProjectDashboard(raw);
	},

	getProjectPerformanceDashboard: (
		projectId: string,
		opts?: MarketingPerformanceDashboardRequest
	) => {
		const params: Record<string, string> = {};
		if (opts?.dateFrom) {
			params.date_from = opts.dateFrom;
		}
		if (opts?.dateTo) {
			params.date_to = opts.dateTo;
		}
		if (opts?.windowDays != null) {
			params.window_days = String(opts.windowDays);
		}
		if (opts?.campaignIds?.length) {
			params.campaign_ids = opts.campaignIds.join(',');
		}
		if (opts?.sources?.length) {
			params.sources = opts.sources.join(',');
		}
		if (opts?.geos?.length) {
			params.geos = opts.geos.join(',');
		}
		const hasParams = Object.keys(params).length > 0;
		return api.get<MarketingPerformanceDashboard>(
			`/marketing-cabinet/projects/${projectId}/performance-dashboard`,
			hasParams ? { ...API_OPTIONS, params } : API_OPTIONS
		);
	},

	/**
	 * @deprecated Обзор маркетингового кабинета использует интерактивный дашборд (layouts/widgets API).
	 * Эндпоинт сохранён для совместимости; новый UI его не вызывает.
	 */
	getProjectGraph: (projectId: string) =>
		api.get<MarketingProjectGraph>(
			`/marketing-cabinet/projects/${projectId}/graph`,
			API_OPTIONS
		),

	listDashboardPresets: (projectId: string) =>
		api.get<MarketingDashboardPresetListResponse>(
			`/marketing-cabinet/projects/${projectId}/dashboard-presets`,
			API_OPTIONS
		),

	listDashboardLayouts: (
		projectId: string,
		params?: { name?: string; page?: number; per_page?: number }
	) =>
		api.get<MarketingDashboardLayoutListResponse>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts`,
			{
				...API_OPTIONS,
				params: {
					...(params?.name != null ? { name: params.name } : {}),
					...(params?.page != null ? { page: params.page } : {}),
					...(params?.per_page != null ? { per_page: params.per_page } : {}),
				},
			}
		),

	getActiveDashboardLayout: (projectId: string) =>
		api.get<MarketingDashboardLayout | null>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/active`,
			API_OPTIONS
		),

	createDashboardLayoutFromPreset: (
		projectId: string,
		body: {
			preset_name: string;
			custom_name?: string | null;
			rebuild_existing?: boolean;
		}
	) =>
		api.post<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/from-preset`,
			body,
			API_OPTIONS
		),

	importDashboardLayoutFromExport: (
		projectId: string,
		body: Record<string, unknown>
	) =>
		api.post<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/import`,
			body,
			API_OPTIONS
		),

	listDashboardLayoutTemplates: (params?: {
		page?: number;
		per_page?: number;
	}) =>
		api.get<MarketingDashboardLayoutListResponse>(
			'/marketing-cabinet/dashboard-layout-templates',
			{
				...API_OPTIONS,
				params: {
					...(params?.page != null ? { page: params.page } : {}),
					...(params?.per_page != null ? { per_page: params.per_page } : {}),
				},
			}
		),

	saveDashboardLayoutAsTemplate: (
		projectId: string,
		body: { name: string; description?: string | null }
	) =>
		api.post<MarketingDashboardLayout>(
			`/marketing-cabinet/dashboard-layout-templates/from-project/${projectId}`,
			body,
			API_OPTIONS
		),

	deleteDashboardLayoutTemplate: (templateId: string) =>
		api.delete<void>(
			`/marketing-cabinet/dashboard-layout-templates/${templateId}`,
			API_OPTIONS
		),

	applyDashboardLayoutTemplate: (
		projectId: string,
		body: { template_layout_id: string }
	) =>
		api.post<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/from-template`,
			body,
			API_OPTIONS
		),

	createDashboardLayout: (
		projectId: string,
		body: MarketingDashboardLayoutCreatePayload
	) =>
		api.post<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts`,
			body,
			API_OPTIONS
		),

	getDashboardLayout: (projectId: string, layoutId: string) =>
		api.get<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/${layoutId}`,
			API_OPTIONS
		),

	updateDashboardLayout: (
		projectId: string,
		layoutId: string,
		body: MarketingDashboardLayoutUpdatePayload
	) => {
		const payload: MarketingDashboardLayoutUpdatePayload =
			body.layout_config !== undefined && body.layout_config_merge === undefined
				? { ...body, layout_config_merge: true }
				: body;
		return api.patch<MarketingDashboardLayout>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/${layoutId}`,
			payload,
			API_OPTIONS
		);
	},

	deleteDashboardLayout: (projectId: string, layoutId: string) =>
		api.delete<void>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/${layoutId}`,
			API_OPTIONS
		),

	activateDashboardLayout: (projectId: string, layoutId: string) =>
		api.post<MarketingDashboardActivateResponse>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/${layoutId}/activate`,
			{},
			API_OPTIONS
		),

	cloneDashboardLayout: (
		projectId: string,
		layoutId: string,
		body: { new_name: string }
	) =>
		api.post<MarketingDashboardCloneResponse>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/${layoutId}/clone`,
			body,
			API_OPTIONS
		),

	addDashboardWidget: (
		projectId: string,
		body: MarketingDashboardWidgetCreatePayload
	) =>
		api.post<MarketingDashboardWidget>(
			`/marketing-cabinet/projects/${projectId}/dashboard-layouts/widgets`,
			body,
			API_OPTIONS
		),

	updateDashboardWidget: (
		projectId: string,
		widgetId: string,
		body: MarketingDashboardWidgetUpdatePayload
	) =>
		api.patch<MarketingDashboardWidget>(
			`/marketing-cabinet/projects/${projectId}/dashboard-widgets/${widgetId}`,
			body,
			API_OPTIONS
		),

	deleteDashboardWidget: (projectId: string, widgetId: string) =>
		api.delete<void>(
			`/marketing-cabinet/projects/${projectId}/dashboard-widgets/${widgetId}`,
			API_OPTIONS
		),

	cleanupDashboardDuplicateWidgets: (projectId: string) =>
		api.post<MarketingDashboardCleanupDuplicatesResponse>(
			`/marketing-cabinet/projects/${projectId}/dashboard-widgets/cleanup-duplicates`,
			{},
			API_OPTIONS
		),

	getDashboardUsageStats: (projectId: string) =>
		api.get<MarketingDashboardUsageStats>(
			`/marketing-cabinet/projects/${projectId}/dashboard-usage-stats`,
			API_OPTIONS
		),
};

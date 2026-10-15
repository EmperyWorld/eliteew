/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for UGS Hub dashboard lists, stats, analytics, provider status, and type catalog.
 *
 * Invariants:
 * - Generated OpenAPI aliases define backend-owned response envelopes.
 * - Fetch helpers normalize nullable/legacy shapes before UI consumers receive them.
 * - `normalizeUgsProvidersSummary` flattens OpenAPI `UGSProvidersStatusResponse` into
 *   Hub `ProvidersSummary` (summary.total → total_providers, etc.).
 *
 * Related:
 * - services/api/ugs/types.ts
 * - services/api/ugs/schemas.ts
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts / Wave 6
 */

import { createAPIClient } from '../../api/client';
import { API_CONFIG } from '../../api/config';
import type {
	UgsAnalyticsSummarySchema,
	UgsGenerationTypeListSchema,
	UgsMetricsSchema,
	UgsProvidersStatusSchema,
	UgsTraySummarySchema,
} from './schemas';
import type {
	GenerationType,
	ProvidersSummary,
	ProviderHealth,
	UGSStats,
	UGSTask,
} from './types';

const ugsClient = createAPIClient({ baseURL: API_CONFIG.ugsBaseURL });

type TaskFilters = {
	status?: string;
	limit?: number;
	offset?: number;
	/** Сильно уменьшает JSON: без input_data и тяжёлых превью (tray, опрос). */
	compact?: boolean;
};

const UGS_TASK_STATUSES = new Set([
	'queued',
	'pending',
	'processing',
	'retrying',
	'completed',
	'failed',
	'cancelled',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeUgsTaskRows(value: unknown): UGSTask[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((row): row is UGSTask => {
		if (!isRecord(row)) {
			return false;
		}
		return (
			typeof row.id === 'string' &&
			typeof row.type_key === 'string' &&
			typeof row.user_id === 'string' &&
			typeof row.priority === 'number' &&
			typeof row.status === 'string' &&
			UGS_TASK_STATUSES.has(row.status)
		);
	});
}

export type UgsTrayTaskSummary = NonNullable<
	UgsTraySummarySchema['active_tasks']
>[number];

export type UgsTraySummaryResponse = UgsTraySummarySchema;

export async function fetchUgsTasks(
	filters: TaskFilters = {}
): Promise<UGSTask[]> {
	const { status, limit, offset, compact } = filters;
	const params: Record<string, string | number | boolean | undefined> = {};

	if (status) {
		params.status = status;
	}
	if (typeof limit === 'number') {
		params.limit = limit;
	}
	if (typeof offset === 'number') {
		params.offset = offset;
	}
	if (compact === true) {
		params.compact = true;
	}

	const { data } = await ugsClient.get<unknown>('/tasks', {
		params,
	});

	return normalizeUgsTaskRows(data);
}

export async function fetchUgsTraySummary(): Promise<UgsTraySummaryResponse> {
	const { data } = await ugsClient.get<Partial<UgsTraySummaryResponse>>(
		'/tasks/tray-summary'
	);
	return {
		active_count:
			typeof data?.active_count === 'number' &&
			Number.isFinite(data.active_count)
				? Math.max(0, Math.floor(data.active_count))
				: 0,
		active_tasks: Array.isArray(data?.active_tasks)
			? (data.active_tasks as UgsTrayTaskSummary[])
			: [],
		recent_transitions: Array.isArray(data?.recent_transitions)
			? (data.recent_transitions as UgsTrayTaskSummary[])
			: [],
		server_time:
			typeof data?.server_time === 'string'
				? data.server_time
				: new Date().toISOString(),
	};
}

/** Server-wide task list (UGS admin only). Same shape as GET /tasks. */
export async function fetchUgsAdminTasks(
	filters: TaskFilters & { user_id?: string } = {}
): Promise<UGSTask[]> {
	const { status, limit, offset, user_id, compact } = filters;
	const params: Record<string, string | number | boolean | undefined> = {};
	if (status) params.status = status;
	if (typeof limit === 'number') params.limit = limit;
	if (typeof offset === 'number') params.offset = offset;
	if (user_id) params.user_id = user_id;
	if (compact === true) params.compact = true;

	const { data } = await ugsClient.get<unknown>('/admin/tasks', {
		params,
	});
	return normalizeUgsTaskRows(data);
}

export async function fetchUgsStats(): Promise<UGSStats | null> {
	const { data } = await ugsClient.get<UGSStats>('/stats');
	return data ?? null;
}

export type UGSMetricsPopularType = NonNullable<
	UgsMetricsSchema['popular_types']
>[number];

export type UGSMetrics = UgsMetricsSchema;

export async function fetchUgsMetrics(): Promise<UGSMetrics | null> {
	const { data } = await ugsClient.get<UGSMetrics>('/metrics');
	return data ?? null;
}

/** Single-call analytics payload (GET /api/v1/ugs/analytics). Last 24h, user-scoped. */
export type UGSAnalyticsSummary = UgsAnalyticsSummarySchema;

export async function fetchUgsAnalytics(): Promise<UGSAnalyticsSummary | null> {
	const { data } = await ugsClient.get<UGSAnalyticsSummary>('/analytics');
	return data ?? null;
}

export async function fetchUgsTypes(): Promise<GenerationType[]> {
	const { data } = await ugsClient.get<UgsGenerationTypeListSchema>('/types');
	if (Array.isArray(data?.types)) {
		return data.types;
	}
	return [];
}

export async function fetchUgsProviders(): Promise<ProvidersSummary> {
	const { data } =
		await ugsClient.get<UgsProvidersStatusSchema>('/providers/status');

	return normalizeUgsProvidersSummary(data);
}

export function normalizeUgsProvidersSummary(
	data: Partial<UgsProvidersStatusSchema> | null | undefined
): ProvidersSummary {
	const summary = data?.summary;
	return {
		providers: Array.isArray(data?.providers)
			? (data.providers as ProviderHealth[])
			: [],
		total_providers: summary?.total ?? data?.providers?.length ?? 0,
		healthy_providers: summary?.healthy ?? 0,
		average_response_time: summary?.average_response_time ?? 0,
	};
}

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TanStack Query v5 `queryOptions` and invalidation helpers for Marketing Cabinet
 * client-interaction (chat bridge, docs, presentations, customer diagnostic).
 *
 * Invariants:
 * - Same options for `useQuery` and prefetch (single cache key per entity).
 * - Invalidation uses prefix helpers; segment keys match `useClientInteractionController`.
 *
 * Related:
 * - views/client-interaction/useClientInteractionController.ts
 * - views/ClientInteractionDiagnosticPanel.tsx
 * - marketingCabinetQueryOptions.ts
 */

import { queryOptions } from '@tanstack/react-query';

import { contentApi } from '@/services/contentApi';

import { MARKETING_LIVE_QUERY_OPTIONS } from './constants';
import { marketingCabinetApi } from './marketingCabinetApi';
import { MARKETING_QUERY_ROOT } from './marketingCabinetQueryOptions';
import { requireDefined } from './utils';

export type MarketingCabinetClientInteractionSegment =
	| 'context'
	| 'bridge'
	| 'docs'
	| 'content'
	| 'ewrp'
	| 'pres';

export function marketingCabinetClientInteractionQueryKey(
	segment: MarketingCabinetClientInteractionSegment,
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		'client-interaction',
		segment,
		projectId,
	] as const;
}

export function marketingCabinetClientInteractionContextQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('context', projectId),
		queryFn: () =>
			marketingCabinetApi.getClientInteractionContext(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetClientInteractionBridgeQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('bridge', projectId),
		queryFn: () =>
			marketingCabinetApi.getClientChatBridge(
				requireDefined(projectId, 'selectedProjectId')
			),
		retry: false,
	});
}

export function marketingCabinetClientInteractionDocsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('docs', projectId),
		queryFn: () =>
			marketingCabinetApi.listClientDocApprovals(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetClientInteractionContentQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('content', projectId),
		queryFn: () =>
			contentApi.listContent({
				project_id: requireDefined(projectId, 'selectedProjectId'),
				limit: 120,
				offset: 0,
				list_profile: 'compact',
			}),
	});
}

export function marketingCabinetClientInteractionEwrpQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('ewrp', projectId),
		queryFn: () =>
			marketingCabinetApi.listClientEwrpJobs(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetClientInteractionPresQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetClientInteractionQueryKey('pres', projectId),
		queryFn: () =>
			marketingCabinetApi.listClientPresShares(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCustomerDiagnosticSettingsQueryKey(
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		'customer-diagnostic',
		'settings',
		projectId,
	] as const;
}

export function marketingCabinetCustomerDiagnosticSettingsQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetCustomerDiagnosticSettingsQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getCustomerDiagnosticSettings(
				requireDefined(projectId, 'selectedProjectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

export function marketingCabinetCustomerDiagnosticAdminOverviewQueryKey(
	projectId: string
) {
	return [
		...MARKETING_QUERY_ROOT,
		'customer-diagnostic',
		'admin-overview',
		projectId,
	] as const;
}

export function marketingCabinetCustomerDiagnosticAdminOverviewQueryOptions(
	projectId: string
) {
	return queryOptions({
		queryKey:
			marketingCabinetCustomerDiagnosticAdminOverviewQueryKey(projectId),
		queryFn: () => marketingCabinetApi.getDiagnosticAdminOverview(projectId),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

/** Prefix invalidation: all customer-diagnostic queries under marketing root. */
export function marketingCabinetCustomerDiagnosticInvalidationQueryKey() {
	return [...MARKETING_QUERY_ROOT, 'customer-diagnostic'] as const;
}

/** Prefix invalidation: customer diagnostic session snapshot. */
export function marketingCabinetCustomerDiagnosticSessionInvalidationQueryKey() {
	return [...MARKETING_QUERY_ROOT, 'customer-diagnostic', 'session'] as const;
}

export function marketingCabinetCustomerDiagnosticSessionQueryKey(
	projectId: string
) {
	return [
		...MARKETING_QUERY_ROOT,
		'customer-diagnostic',
		'session',
		projectId,
	] as const;
}

/** Separate cache from runner session (lead report panel). */
export function marketingCabinetCustomerDiagnosticSessionLeadQueryKey(
	projectId: string
) {
	return [
		...MARKETING_QUERY_ROOT,
		'customer-diagnostic',
		'session',
		projectId,
		'lead',
	] as const;
}

export function marketingCabinetCustomerDiagnosticSessionQueryOptions(
	projectId: string
) {
	return queryOptions({
		queryKey: marketingCabinetCustomerDiagnosticSessionQueryKey(projectId),
		queryFn: () => marketingCabinetApi.getCustomerDiagnosticSession(projectId),
		staleTime: 60_000,
	});
}

export function marketingCabinetCustomerDiagnosticSessionLeadQueryOptions(
	projectId: string
) {
	return queryOptions({
		queryKey: marketingCabinetCustomerDiagnosticSessionLeadQueryKey(projectId),
		queryFn: () => marketingCabinetApi.getCustomerDiagnosticSession(projectId),
		staleTime: 30_000,
	});
}

export function marketingCabinetCustomerFacingSummaryQueryKey(
	projectId: string | null | undefined
) {
	return [
		...MARKETING_QUERY_ROOT,
		'client-interaction',
		'customer-summary',
		projectId,
	] as const;
}

export function marketingCabinetCustomerFacingSummaryQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: marketingCabinetCustomerFacingSummaryQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getCustomerFacingSummary(
				requireDefined(projectId, 'projectId')
			),
		...MARKETING_LIVE_QUERY_OPTIONS,
	});
}

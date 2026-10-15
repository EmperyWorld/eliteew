/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TanStack Query v5 `queryOptions` and query keys for Customer Cabinet (marketing API reads).
 *
 * Invariants:
 * - Root `customer-cabinet` is separate from `marketing` MC cache; cross-invalidate on summary writes.
 * - Workspace signals aggregate doc approvals + presentation shares per project.
 *
 * Related:
 * - CustomerCabinetPage.tsx, CustomerProjectWorkspace.tsx, CustomerFacingSummaryRead.tsx
 * - marketingCabinetClientInteractionQueryOptions.ts
 */

import { queryOptions } from '@tanstack/react-query';

import { marketingCabinetApi } from '@/pages/MarketingCabinet/marketingCabinetApi';
import { requireDefined } from '@/pages/MarketingCabinet/utils';

export const CUSTOMER_CABINET_QUERY_ROOT = ['customer-cabinet'] as const;

export type CustomerCabinetWorkspaceSignalsData = {
	pendingDocs: number;
	approvedDocs: number;
	removalPending: number;
	presentations: number;
};

export function customerCabinetRootInvalidationQueryKey() {
	return CUSTOMER_CABINET_QUERY_ROOT;
}

export function customerCabinetCompaniesQueryKey() {
	return [...CUSTOMER_CABINET_QUERY_ROOT, 'companies'] as const;
}

export function customerCabinetCompaniesQueryOptions() {
	return queryOptions({
		queryKey: customerCabinetCompaniesQueryKey(),
		queryFn: () =>
			marketingCabinetApi.listCompanies({ as_representative: true }),
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}

export function customerCabinetProjectsQueryKey(companyId: string) {
	return [...CUSTOMER_CABINET_QUERY_ROOT, 'projects', companyId] as const;
}

export function customerCabinetProjectsQueryOptions(companyId: string) {
	return queryOptions({
		queryKey: customerCabinetProjectsQueryKey(companyId),
		queryFn: () => marketingCabinetApi.listProjects(companyId),
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}

export function customerCabinetWorkspaceSignalsQueryKey(
	projectId: string | null | undefined
) {
	return [
		...CUSTOMER_CABINET_QUERY_ROOT,
		'workspace-signals',
		projectId,
	] as const;
}

export async function fetchCustomerCabinetWorkspaceSignals(
	projectId: string
): Promise<CustomerCabinetWorkspaceSignalsData> {
	const [docs, shares] = await Promise.all([
		marketingCabinetApi.listClientDocApprovals(projectId),
		marketingCabinetApi.listClientPresShares(projectId),
	]);
	return {
		pendingDocs: docs.filter((d) => d.status === 'pending').length,
		approvedDocs: docs.filter((d) => d.status === 'approved').length,
		removalPending: docs.filter((d) => Boolean(d.pending_removal)).length,
		presentations: shares.length,
	};
}

export function customerCabinetWorkspaceSignalsQueryOptions(projectId: string) {
	return queryOptions({
		queryKey: customerCabinetWorkspaceSignalsQueryKey(projectId),
		queryFn: () => fetchCustomerCabinetWorkspaceSignals(projectId),
		staleTime: 0,
		refetchOnWindowFocus: true,
	});
}

export function customerCabinetCustomerSummaryQueryKey(
	projectId: string | null | undefined
) {
	return [
		...CUSTOMER_CABINET_QUERY_ROOT,
		'customer-summary',
		projectId,
	] as const;
}

export function customerCabinetCustomerSummaryQueryOptions(
	projectId: string | null | undefined
) {
	return queryOptions({
		queryKey: customerCabinetCustomerSummaryQueryKey(projectId),
		queryFn: () =>
			marketingCabinetApi.getCustomerFacingSummary(
				requireDefined(projectId, 'projectId')
			),
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});
}

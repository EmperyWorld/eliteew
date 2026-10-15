/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks for UGS Admin v2 snapshot and bulk operations.
 *
 * Invariants:
 * - Query keys must be separate from legacy UGS Admin hooks to avoid cache coupling.
 * - Bulk apply must be preceded by validate in the UI flow (backend re-checks anyway).
 *
 * Related:
 * - src/services/api/ugsAdminV2.ts
 * - src/features/ugs/admin-v2/UGSAdminV2Panel.tsx
 */

import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from '@tanstack/react-query';

import {
	bulkApplyUgsAdminV2Operations,
	validateUgsAdminV2Operations,
	type UgsAdminV2BulkApplyResultDTO,
	type UgsAdminV2BulkOperation,
	type UgsAdminV2SnapshotDTO,
	type UgsAdminV2ValidationIssueDTO,
} from '@/services/api/ugsAdminV2';
import {
	ugsAdminV2SnapshotQueryKey,
	ugsAdminV2SnapshotQueryOptions,
} from '@/services/api/ugsAdminQueryOptions';

export const useUgsAdminV2Snapshot = (
	enabled = true
): UseQueryResult<UgsAdminV2SnapshotDTO, Error> => {
	return useQuery({
		...ugsAdminV2SnapshotQueryOptions(),
		enabled,
	});
};

export const useValidateUgsAdminV2Operations = (): UseMutationResult<
	UgsAdminV2ValidationIssueDTO[],
	Error,
	{ operations: UgsAdminV2BulkOperation[] },
	unknown
> => {
	return useMutation({
		mutationFn: ({ operations }) => validateUgsAdminV2Operations(operations),
	});
};

export const useBulkApplyUgsAdminV2Operations = (): UseMutationResult<
	UgsAdminV2BulkApplyResultDTO,
	Error,
	Parameters<typeof bulkApplyUgsAdminV2Operations>[0],
	unknown
> => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: bulkApplyUgsAdminV2Operations,
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ugsAdminV2SnapshotQueryKey(),
			});
		},
	});
};

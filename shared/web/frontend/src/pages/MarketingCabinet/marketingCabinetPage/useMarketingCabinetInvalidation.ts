/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query invalidation helpers for MarketingCabinetPage toolbar refresh actions.
 *
 * Invariants:
 * - IMC keys outside ['marketing'] prefix remain explicit (imc + marketing/imc roots).
 *
 * Related:
 * - marketingCabinetQueryOptions.ts, useMarketingCabinetPageCompose.ts
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { cabinetNotify } from '@/pages/MarketingCabinet/cabinetNotify';
import { extractApiErrorMessage } from '@/pages/MarketingCabinet/utils';
import {
	MARKETING_CABINET_PROJECT_LIST_SECTIONS,
	marketingCabinetAiRunsProjectInvalidationQueryKey,
	marketingCabinetContentProjectInvalidationQueryKey,
	marketingCabinetContentRootInvalidationQueryKey,
	marketingCabinetImcInvalidationQueryKey,
	marketingCabinetImcRootInvalidationQueryKey,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectMembersInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
	marketingCabinetRootInvalidationQueryKey,
} from '@/pages/MarketingCabinet/marketingCabinetQueryOptions';

type InvalidationInput = {
	t: TFunction<'marketing'>;
	selectedProjectId: string | null;
	engageToolbarContent: () => void;
	refetchProjectContent: () => Promise<{ isError: boolean; error: unknown }>;
};

export function useMarketingCabinetInvalidation(input: InvalidationInput) {
	const { t, selectedProjectId, engageToolbarContent, refetchProjectContent } =
		input;
	const queryClient = useQueryClient();

	const invalidateMarketingData = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: marketingCabinetRootInvalidationQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetContentRootInvalidationQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetImcRootInvalidationQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetImcInvalidationQueryKey(),
			}),
		]);
	}, [queryClient]);

	const invalidateCurrentProjectMarketing = useCallback(async () => {
		const pid = selectedProjectId;
		if (!pid) {
			await invalidateMarketingData();
			return;
		}
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectDashboardInvalidationQueryKey(pid),
			}),
			...MARKETING_CABINET_PROJECT_LIST_SECTIONS.map((section) =>
				queryClient.invalidateQueries({
					queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
						section,
						pid
					),
				})
			),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetAiRunsProjectInvalidationQueryKey(pid),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetContentProjectInvalidationQueryKey(pid),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectMembersInvalidationQueryKey(pid),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetImcRootInvalidationQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: marketingCabinetImcInvalidationQueryKey(),
			}),
		]);
	}, [queryClient, selectedProjectId, invalidateMarketingData]);

	const handleToolbarRefreshCabinet = useCallback(async () => {
		await invalidateCurrentProjectMarketing();
		cabinetNotify.success(t('toolbar.refreshCabinetDone'));
	}, [invalidateCurrentProjectMarketing, t]);

	const handleToolbarRefreshContent = useCallback(async () => {
		engageToolbarContent();
		const res = await refetchProjectContent();
		if (res.isError) {
			cabinetNotify.error(
				extractApiErrorMessage(res.error, t('toolbar.refreshContentFailed'))
			);
			return;
		}
		cabinetNotify.success(t('toolbar.refreshContentDone'));
	}, [engageToolbarContent, refetchProjectContent, t]);

	return {
		invalidateMarketingData,
		invalidateCurrentProjectMarketing,
		handleToolbarRefreshCabinet,
		handleToolbarRefreshContent,
	};
}

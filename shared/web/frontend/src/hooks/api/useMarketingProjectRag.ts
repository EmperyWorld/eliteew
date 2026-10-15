/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks for marketing project RAG sources (list, patch, IMC ingest).
 *
 * Invariants:
 * - Query keys and `queryOptions` live in `marketingCabinetQueryOptions.ts`.
 *
 * Related:
 * - services/api/marketingProjectRagApi.ts, marketingCabinetQueryOptions.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
	marketingCabinetImcRagHintsInvalidationQueryKey,
	marketingCabinetProjectRagQueryKey,
	marketingCabinetProjectRagQueryOptions,
} from '@/pages/MarketingCabinet/marketingCabinetQueryOptions';

import { marketingProjectRagApi } from '../../services/api/marketingProjectRagApi';
import type {
	PatchMarketingRagSourceBody,
	PostImcRunToProjectRagResponse,
} from '../../services/api/marketingProjectRagApi';

/** @deprecated Use `marketingCabinetProjectRagQueryKey` from `marketingCabinetQueryOptions`. */
export const marketingProjectRagQueryKey = marketingCabinetProjectRagQueryKey;

export function useMarketingProjectRagSources(
	projectId: string | undefined,
	options?: { enabled?: boolean }
) {
	const enabled = options?.enabled ?? true;
	return useQuery({
		...marketingCabinetProjectRagQueryOptions(projectId),
		enabled: Boolean(projectId) && enabled,
	});
}

export function usePatchMarketingRagSource(projectId: string | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			contentId,
			body,
		}: {
			contentId: string;
			body: PatchMarketingRagSourceBody;
		}) => {
			if (!projectId) {
				throw new Error('projectId required');
			}
			return marketingProjectRagApi.patchContentInclusion(
				projectId,
				contentId,
				body
			);
		},
		onSuccess: () => {
			if (projectId) {
				void qc.invalidateQueries({
					queryKey: marketingCabinetProjectRagQueryKey(projectId),
				});
			}
		},
	});
}

export function usePostImcRunToProjectRag(projectId: string | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (
			imcResearchRunId: string
		): Promise<PostImcRunToProjectRagResponse> => {
			if (!projectId) {
				throw new Error('projectId required');
			}
			return marketingProjectRagApi.postFromImcRun(projectId, imcResearchRunId);
		},
		onSuccess: () => {
			if (projectId) {
				void qc.invalidateQueries({
					queryKey: marketingCabinetProjectRagQueryKey(projectId),
				});
				void qc.invalidateQueries({
					queryKey: marketingCabinetImcRagHintsInvalidationQueryKey(projectId),
				});
			}
		},
	});
}

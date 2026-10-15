/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks for IMC runs, lists, and status polling used in Marketing Cabinet.
 *
 * Invariants:
 * - Query config (`queryKey/queryFn/staleTime`) lives in `imcQueryOptions`.
 * - Hooks keep runtime gates (`enabled`) and poll policy wiring.
 *
 * Related:
 * - services/api/imcQueryOptions.ts
 * - services/api/imcQueryKeys.ts
 * - pages/MarketingCabinet/marketingCabinetQueryOptions.ts
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { marketingCabinetProjectDashboardInvalidationQueryKey } from '@/pages/MarketingCabinet/marketingCabinetQueryOptions';
import {
	imcCompanyResearchesQueryOptions,
	imcProjectResearchesQueryOptions,
	imcRagHintsQueryOptions,
	imcResearchDetailQueryOptions,
	imcResearchStatusPollIntervalMs,
	imcResearchStatusQueryOptions,
	imcTypesQueryOptions,
} from '@/services/api/imcQueryOptions';

import { imcClient } from '../../services/api/imcClient';
import { imcQueryKeys } from '../../services/api/imcQueryKeys';

import type {
	ImcResearchStatusPayload,
	ImcRunResearchBody,
	ImcRunResearchResponse,
} from '../../types/imc';

export function useImcTypes(companyId?: string | null) {
	return useQuery(imcTypesQueryOptions(companyId));
}

export function useImcRagHints(
	projectId: string | undefined,
	options?: { enabled?: boolean }
) {
	const enabled = options?.enabled ?? true;
	return useQuery({
		...imcRagHintsQueryOptions(projectId),
		enabled: Boolean(projectId) && enabled,
	});
}

export interface UseImcResearchListParams {
	type_key?: string;
	status?: string;
	active_only?: boolean;
	limit?: number;
	offset?: number;
}

export function useImcCompanyResearches(
	companyId: string | undefined,
	params: UseImcResearchListParams = {}
) {
	const { type_key, status, active_only, limit = 50, offset = 0 } = params;
	const filters = { type_key, status, active_only, limit, offset };
	return useQuery({
		...imcCompanyResearchesQueryOptions(companyId, filters),
		enabled: Boolean(companyId),
	});
}

export function useImcProjectResearches(
	projectId: string | undefined,
	params: UseImcResearchListParams = {}
) {
	const { type_key, status, active_only, limit = 50, offset = 0 } = params;
	const filters = { type_key, status, active_only, limit, offset };
	return useQuery({
		...imcProjectResearchesQueryOptions(projectId, filters),
		enabled: Boolean(projectId),
	});
}

export function useImcResearchDetail(researchId: string | undefined) {
	return useQuery({
		...imcResearchDetailQueryOptions(researchId),
		enabled: Boolean(researchId),
	});
}

export interface UseImcResearchStatusOptions {
	/** Poll every ~4s while not terminal (spec: 3–5s). */
	pollWhileActive?: boolean;
}

export function useImcResearchStatus(
	researchId: string | undefined,
	options: UseImcResearchStatusOptions = {}
) {
	const { pollWhileActive = true } = options;
	return useQuery({
		...imcResearchStatusQueryOptions(researchId),
		enabled: Boolean(researchId),
		refetchInterval: (query) => {
			return imcResearchStatusPollIntervalMs(
				query.state.data as ImcResearchStatusPayload | undefined,
				{
					pollWhileActive,
					researchId,
				}
			);
		},
	});
}

export function useImcRunResearch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: ImcRunResearchBody): Promise<ImcRunResearchResponse> =>
			imcClient.runResearch(body),
		onSuccess: (_data, variables) => {
			void qc.invalidateQueries({ queryKey: imcQueryKeys.all });
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.marketingCabinetPrefix,
			});
			if (variables.project_id) {
				void qc.invalidateQueries({
					queryKey: marketingCabinetProjectDashboardInvalidationQueryKey(
						variables.project_id
					),
				});
			}
		},
	});
}

export function useImcCancelResearch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (researchId: string) => imcClient.cancelResearch(researchId),
		onSuccess: (_data, researchId) => {
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.research(researchId),
			});
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.researchStatus(researchId),
			});
			void qc.invalidateQueries({ queryKey: imcQueryKeys.all });
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.marketingCabinetPrefix,
			});
		},
	});
}

export function useImcRerunResearch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (researchId: string) => imcClient.rerunResearch(researchId),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: imcQueryKeys.all });
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.marketingCabinetPrefix,
			});
		},
	});
}

export function useImcDeleteResearch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (researchId: string) => imcClient.deleteResearch(researchId),
		onSuccess: (_data, researchId) => {
			void qc.removeQueries({
				queryKey: imcQueryKeys.research(researchId),
			});
			void qc.removeQueries({
				queryKey: imcQueryKeys.researchStatus(researchId),
			});
			void qc.invalidateQueries({ queryKey: imcQueryKeys.all });
			void qc.invalidateQueries({
				queryKey: imcQueryKeys.marketingCabinetPrefix,
			});
		},
	});
}

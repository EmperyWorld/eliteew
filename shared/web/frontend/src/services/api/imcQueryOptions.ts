/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 options for IMC queries used by Marketing Cabinet hooks.
 *
 * Invariants:
 * - Query keys are produced only by `imcQueryKeys` to keep one cache key per IMC entity.
 * - Hooks keep `enabled` and polling cadence; options own key/queryFn/staleTime.
 *
 * Related:
 * - hooks/api/useImcResearch.ts
 * - services/api/imcQueryKeys.ts
 * - pages/MarketingCabinet/marketingCabinetQueryOptions.ts
 */

import { queryOptions } from '@tanstack/react-query';

import type {
	ImcRagHintsPayload,
	ImcResearchListResponse,
	ImcResearchRunDetail,
	ImcResearchStatusPayload,
} from '@/types/imc';

import { imcClient } from './imcClient';
import { imcQueryKeys } from './imcQueryKeys';

export const IMC_TYPES_STALE_MS = 60_000;
export const IMC_RAG_HINTS_STALE_MS = 30_000;
export const IMC_RESEARCH_LIST_STALE_MS = 15_000;
export const IMC_RESEARCH_DETAIL_STALE_MS = 5_000;
export const IMC_RESEARCH_STATUS_POLL_MS = 4_000;

const IMC_TERMINAL_STATUSES = new Set([
	'completed',
	'failed',
	'cancelled',
	'partial',
]);

export type ImcResearchListFilters = {
	type_key?: string;
	status?: string;
	active_only?: boolean;
	limit: number;
	offset: number;
};

export function imcTypesQueryOptions(companyId?: string | null) {
	return queryOptions({
		queryKey: imcQueryKeys.types(companyId),
		queryFn: () => imcClient.listTypes(),
		staleTime: IMC_TYPES_STALE_MS,
	});
}

export function imcRagHintsQueryOptions(projectId: string | undefined) {
	return queryOptions({
		queryKey: projectId
			? imcQueryKeys.ragHints(projectId)
			: imcQueryKeys.ragHints(''),
		queryFn: (): Promise<ImcRagHintsPayload> => {
			if (!projectId) {
				throw new Error('projectId required');
			}
			return imcClient.ragHints(projectId);
		},
		staleTime: IMC_RAG_HINTS_STALE_MS,
	});
}

export function imcCompanyResearchesQueryOptions(
	companyId: string | undefined,
	filters: ImcResearchListFilters
) {
	return queryOptions({
		queryKey: companyId
			? imcQueryKeys.listCompany(companyId, filters)
			: imcQueryKeys.listCompany('', filters),
		queryFn: (): Promise<ImcResearchListResponse> => {
			if (!companyId) {
				return Promise.resolve({ total: 0, items: [] });
			}
			return imcClient.listForCompany(companyId, filters);
		},
		staleTime: IMC_RESEARCH_LIST_STALE_MS,
	});
}

export function imcProjectResearchesQueryOptions(
	projectId: string | undefined,
	filters: ImcResearchListFilters
) {
	return queryOptions({
		queryKey: projectId
			? imcQueryKeys.listProject(projectId, filters)
			: imcQueryKeys.listProject('', filters),
		queryFn: (): Promise<ImcResearchListResponse> => {
			if (!projectId) {
				return Promise.resolve({ total: 0, items: [] });
			}
			return imcClient.listForProject(projectId, filters);
		},
		staleTime: IMC_RESEARCH_LIST_STALE_MS,
	});
}

export function imcResearchDetailQueryOptions(researchId: string | undefined) {
	return queryOptions({
		queryKey: researchId
			? imcQueryKeys.research(researchId)
			: imcQueryKeys.research(''),
		queryFn: (): Promise<ImcResearchRunDetail> => {
			if (!researchId) {
				throw new Error('researchId required');
			}
			return imcClient.getResearch(researchId);
		},
		staleTime: IMC_RESEARCH_DETAIL_STALE_MS,
	});
}

export function imcResearchStatusQueryOptions(researchId: string | undefined) {
	return queryOptions({
		queryKey: researchId
			? imcQueryKeys.researchStatus(researchId)
			: imcQueryKeys.researchStatus(''),
		queryFn: (): Promise<ImcResearchStatusPayload> => {
			if (!researchId) {
				throw new Error('researchId required');
			}
			return imcClient.getResearchStatus(researchId);
		},
		staleTime: 0,
	});
}

export function imcResearchStatusPollIntervalMs(
	data: ImcResearchStatusPayload | undefined,
	options: {
		researchId: string | undefined;
		pollWhileActive: boolean;
	}
): number | false {
	if (!options.pollWhileActive || !options.researchId) {
		return false;
	}
	const status = data?.status;
	if (!status || IMC_TERMINAL_STATUSES.has(status)) {
		return false;
	}
	return IMC_RESEARCH_STATUS_POLL_MS;
}

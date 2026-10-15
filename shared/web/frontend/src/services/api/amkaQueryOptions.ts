/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared TanStack Query v5 options for Marketing Cabinet AMKA runs and operator config.
 *
 * Related:
 * - hooks/api/useAmka.ts, services/api/amkaQueryKeys.ts
 */

import { queryOptions, type QueryKey } from '@tanstack/react-query';

import {
	marketingCabinetApi,
	type AmkaCoreAlignmentResponse,
	type AmkaOperatorConfigBundle,
	type AmkaPresetListResponse,
	type AmkaPresetTemplateListResponse,
	type AmkaRunDetailResponse,
	type AmkaRunListResponse,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { amkaQueryKeys } from './amkaQueryKeys';

export const AMKA_RUNS_STALE_MS = 0;
export const AMKA_OPERATOR_CONFIG_STALE_MS = 30_000;
export const AMKA_PRESET_TEMPLATES_STALE_MS = 300_000;
export const AMKA_PRESETS_STALE_MS = 15_000;
export const AMKA_CORE_ALIGNMENT_GC_MS = 10 * 60 * 1000;

export function amkaDisabledProjectQueryKey(
	suffix: readonly string[],
	limit?: number
): QueryKey {
	return limit != null
		? ([...amkaQueryKeys.all, ...suffix, '', limit] as QueryKey)
		: ([...amkaQueryKeys.all, ...suffix, ''] as QueryKey);
}

export function amkaRunsListQueryOptions(
	projectId: string | undefined,
	limit = 20
) {
	return queryOptions({
		queryKey: projectId
			? amkaQueryKeys.listProject(projectId, limit)
			: amkaDisabledProjectQueryKey(['list', 'project'], limit),
		queryFn: (): Promise<AmkaRunListResponse> => {
			if (!projectId) {
				return Promise.resolve({
					items: [],
					total: 0,
					poll_after_ms: 0,
					recent_runs_digest_markdown: '',
				});
			}
			return marketingCabinetApi.listAmkaRuns(projectId, limit);
		},
		staleTime: AMKA_RUNS_STALE_MS,
	});
}

export function amkaRunDetailQueryOptions(runId: string | undefined) {
	return queryOptions({
		queryKey: runId
			? amkaQueryKeys.run(runId)
			: amkaDisabledProjectQueryKey(['run']),
		queryFn: (): Promise<AmkaRunDetailResponse> => {
			if (!runId) {
				throw new Error('runId required');
			}
			return marketingCabinetApi.getAmkaRunDetail(runId);
		},
		staleTime: AMKA_RUNS_STALE_MS,
	});
}

export function amkaCoreAlignmentQueryOptions(
	runId: string | undefined,
	queryFn: () => Promise<AmkaCoreAlignmentResponse>
) {
	return queryOptions({
		queryKey: runId
			? amkaQueryKeys.coreAlignment(runId)
			: amkaDisabledProjectQueryKey(['core-alignment']),
		queryFn,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: AMKA_CORE_ALIGNMENT_GC_MS,
	});
}

export function amkaOperatorConfigQueryOptions() {
	return queryOptions({
		queryKey: amkaQueryKeys.operatorConfig,
		queryFn: (): Promise<AmkaOperatorConfigBundle> =>
			marketingCabinetApi.getAmkaOperatorConfig(),
		staleTime: AMKA_OPERATOR_CONFIG_STALE_MS,
	});
}

export function amkaPresetTemplatesQueryOptions() {
	return queryOptions({
		queryKey: amkaQueryKeys.presetTemplates,
		queryFn: (): Promise<AmkaPresetTemplateListResponse> =>
			marketingCabinetApi.listAmkaPresetTemplates(),
		staleTime: AMKA_PRESET_TEMPLATES_STALE_MS,
	});
}

export function amkaPresetsProjectQueryOptions(projectId: string | undefined) {
	return queryOptions({
		queryKey: projectId
			? amkaQueryKeys.presetsProject(projectId)
			: amkaDisabledProjectQueryKey(['presets', 'project']),
		queryFn: (): Promise<AmkaPresetListResponse> => {
			if (!projectId) {
				return Promise.resolve({ items: [], total: 0 });
			}
			return marketingCabinetApi.listAmkaPresets(projectId);
		},
		staleTime: AMKA_PRESETS_STALE_MS,
	});
}

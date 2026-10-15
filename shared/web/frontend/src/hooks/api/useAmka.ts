/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query hooks and helpers for Marketing Cabinet AMKA (runs, detail, SSE progress, alignment, mutations) and
 * **EWA** desktop orchestration turn (neutral `/api/v1/ewa/desktop-orchestration/turn`).
 *
 * Invariants:
 * - When the run detail SSE stream is live, HTTP polling for that query is disabled (`computeAmkaRunDetailRefetchMs`).
 * - After SSE connect failures (limited retries), polling resumes for active statuses — no manual operator step required.
 * - Approval/resume payloads preserve section, step, and operation skip controls from the UI review flow.
 *
 * Related:
 * - src/services/amka/marketingCabinetAmkaBridge.ts
 * - src/services/ewa/ewaDesktopOrchApi.ts
 * - src/services/api/amkaQueryKeys.ts
 * - documentation/product/marketing/AMKA-REFERENCE.md
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
	postEwaDesktopOrchestrationTurn,
	type EwaDesktopOrchTurnRequestEnvelope,
} from '@/services/ewa/ewaDesktopOrchApi';
import { API_CONFIG } from '@/services/api/config';
import authSession from '@/services/authSession';
import {
	marketingCabinetApi,
	type AmkaAsyncStartResponse,
	type AmkaControlResponse,
	type AmkaCoreAlignmentResponse,
	type AmkaOperatorConfigBundle,
	type AmkaOperatorConfigV1,
	type AmkaPresetConfigV1,
	type AmkaRun,
	type AmkaRunDetailResponse,
	type AmkaRunListResponse,
} from '@/services/amka/marketingCabinetAmkaBridge';
import { amkaQueryKeys } from '@/services/api/amkaQueryKeys';
import {
	amkaCoreAlignmentQueryOptions,
	amkaOperatorConfigQueryOptions,
	amkaPresetTemplatesQueryOptions,
	amkaPresetsProjectQueryOptions,
	amkaRunDetailQueryOptions,
	amkaRunsListQueryOptions,
} from '@/services/api/amkaQueryOptions';
import { invalidateMarketingCabinetAfterAmkaRun } from '@/pages/MarketingCabinet/marketingCabinetQueryOptions';

const ACTIVE = new Set([
	'planning',
	'queued',
	'running',
	'awaiting_approval',
	'awaiting_step_approval',
]);

/** Нижняя граница интервала опроса списка и детали (согласовано с `poll_after_ms` API). */
export const AMKA_POLL_FLOOR_MS = 4000;

const AMKA_SSE_RETRY_MS = 2500;
/** Attempt count for EventSource-style fetch; when exhausted, `progressStreamLive` stays false and polling applies. */
const AMKA_SSE_MAX_CONNECT_ATTEMPTS = 2;

export function computeAmkaRunsListRefetchMs(params: {
	hasActive: boolean;
	pollAfterMs?: number | null;
}): number | false {
	if (!params.hasActive) return false;
	const p = params.pollAfterMs;
	if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
		return Math.max(AMKA_POLL_FLOOR_MS, p);
	}
	return AMKA_POLL_FLOOR_MS;
}

export function computeAmkaRunDetailRefetchMs(params: {
	status: string | undefined | null;
	pollAfterMs?: number | null;
	progressStreamLive: boolean;
}): number | false {
	if (params.progressStreamLive) return false;
	if (!params.status || !ACTIVE.has(params.status)) return false;
	const p = params.pollAfterMs;
	if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
		return Math.max(AMKA_POLL_FLOOR_MS, p);
	}
	return AMKA_POLL_FLOOR_MS;
}

export function useAmkaRuns(projectId: string | undefined, limit = 20) {
	return useQuery({
		...amkaRunsListQueryOptions(projectId, limit),
		enabled: Boolean(projectId),
		refetchInterval: (query) =>
			computeAmkaRunsListRefetchMs({
				hasActive: (query.state.data?.items ?? []).some((item) =>
					ACTIVE.has(item.status)
				),
				pollAfterMs: query.state.data?.poll_after_ms,
			}),
	});
}

export function useAmkaRunDetail(runId: string | undefined) {
	const qc = useQueryClient();
	const [progressStreamLive, setProgressStreamLive] = useState(false);

	const query = useQuery({
		...amkaRunDetailQueryOptions(runId),
		enabled: Boolean(runId),
		refetchInterval: (q) =>
			computeAmkaRunDetailRefetchMs({
				status: q.state.data?.run.status,
				pollAfterMs: q.state.data?.poll_after_ms,
				progressStreamLive,
			}),
	});

	const runStatus = query.data?.run?.status;

	useEffect(() => {
		if (!runId || !runStatus || !ACTIVE.has(runStatus)) {
			setProgressStreamLive(false);
			return;
		}
		const ac = new AbortController();
		let cancelled = false;
		setProgressStreamLive(false);
		const url = `${API_CONFIG.baseURL}/marketing-cabinet/amka/runs/${runId}/events`;

		void (async () => {
			for (
				let attempt = 0;
				attempt < AMKA_SSE_MAX_CONNECT_ATTEMPTS && !cancelled;
				attempt++
			) {
				if (attempt > 0) {
					await new Promise((r) => setTimeout(r, AMKA_SSE_RETRY_MS));
					if (cancelled) break;
				}
				try {
					const token = authSession.token;
					const headers: Record<string, string> = {
						Accept: 'text/event-stream',
					};
					if (token) {
						headers.Authorization = `Bearer ${token}`;
					}
					const res = await fetch(url, {
						method: 'GET',
						headers,
						signal: ac.signal,
						credentials: 'include',
					});
					if (!res.ok || !res.body || cancelled) {
						setProgressStreamLive(false);
						continue;
					}
					setProgressStreamLive(true);
					const reader = res.body.getReader();
					const decoder = new TextDecoder();
					let buffer = '';
					let streamAbort = false;
					try {
						for (;;) {
							const { done, value } = await reader.read();
							if (done) {
								break;
							}
							buffer += decoder.decode(value, { stream: true });
							for (;;) {
								const sep = buffer.indexOf('\n\n');
								if (sep < 0) {
									break;
								}
								const rawEvent = buffer.slice(0, sep);
								buffer = buffer.slice(sep + 2);
								for (const line of rawEvent.split('\n')) {
									if (!line.startsWith('data:')) {
										continue;
									}
									const payload = line.startsWith('data: ')
										? line.slice(6)
										: line.slice(5).trimStart();
									try {
										const msg = JSON.parse(payload) as { error?: string };
										if (msg.error) {
											streamAbort = true;
											break;
										}
									} catch {
										continue;
									}
									void qc.invalidateQueries({
										queryKey: amkaQueryKeys.run(runId),
									});
								}
								if (streamAbort) {
									break;
								}
							}
							if (streamAbort) {
								break;
							}
						}
					} finally {
						if (!cancelled) {
							setProgressStreamLive(false);
						}
					}
				} catch {
					if (!cancelled) {
						setProgressStreamLive(false);
					}
				}
			}
		})();

		return () => {
			cancelled = true;
			setProgressStreamLive(false);
			ac.abort();
		};
	}, [runId, runStatus, qc]);

	return { ...query, progressStreamLive };
}

export function useAmkaCoreAlignment(runId: string | undefined) {
	const qc = useQueryClient();
	const etagRef = useRef<string | null>(null);

	useEffect(() => {
		void runId;
		etagRef.current = null;
	}, [runId]);

	return useQuery({
		...amkaCoreAlignmentQueryOptions(
			runId,
			async (): Promise<AmkaCoreAlignmentResponse> => {
				if (!runId) {
					throw new Error('runId required');
				}
				const key = amkaQueryKeys.coreAlignment(runId);
				const cached = qc.getQueryData<AmkaCoreAlignmentResponse>(key);
				const data = await marketingCabinetApi.getAmkaCoreAlignment(runId, {
					ifNoneMatch: etagRef.current,
					onResponseMeta: (m) => {
						if (m.status === 200 && m.etag) {
							etagRef.current = m.etag;
						}
					},
				});
				if (data === null) {
					if (cached) {
						return cached;
					}
					throw new Error('AMKA core alignment: 304 without cached data');
				}
				return data;
			}
		),
		enabled: Boolean(runId),
	});
}

/** Prepends a freshly created run so history selection can follow before list refetch settles. */
export function prependAmkaRunToProjectListCache(
	qc: ReturnType<typeof useQueryClient>,
	projectId: string,
	run: AmkaRun
) {
	qc.setQueriesData<AmkaRunListResponse>(
		{
			queryKey: [...amkaQueryKeys.all, 'list', 'project', projectId],
		},
		(old) => {
			if (!old) {
				return {
					items: [run],
					total: 1,
					poll_after_ms: 0,
					recent_runs_digest_markdown: '',
				};
			}
			const without = old.items.filter((item) => item.id !== run.id);
			const added = without.length === old.items.length;
			return {
				...old,
				items: [run, ...without],
				total: added ? old.total + 1 : old.total,
			};
		}
	);
}

function seedAmkaRunDetailCache(
	qc: ReturnType<typeof useQueryClient>,
	data: AmkaAsyncStartResponse
) {
	qc.setQueryData<AmkaRunDetailResponse>(amkaQueryKeys.run(data.run.id), {
		run: data.run,
		steps: [],
		poll_after_ms: data.poll_after_ms,
	});
}

function invalidateAmkaQueries(
	qc: ReturnType<typeof useQueryClient>,
	projectId?: string | null,
	runId?: string | null,
	companyId?: string | null
) {
	void qc.invalidateQueries({ queryKey: amkaQueryKeys.all });
	void qc.invalidateQueries({ queryKey: amkaQueryKeys.marketingCabinetPrefix });
	if (projectId) {
		invalidateMarketingCabinetAfterAmkaRun(qc, {
			projectId,
			companyId,
		});
	}
	if (runId) {
		void qc.invalidateQueries({
			queryKey: amkaQueryKeys.run(runId),
		});
		void qc.invalidateQueries({
			queryKey: amkaQueryKeys.coreAlignment(runId),
		});
	}
}

export function useCreateAmkaRun() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (payload: {
			project_id: string;
			company_id: string;
			scope_key?: 'all_visible';
			user_instruction?: string | null;
			section_keys?: string[];
			imc_type_key?: string;
			imc_focus?: 'global' | 'rf' | 'mixed';
			imc_max_wait_seconds?: number;
			run_mode?: 'auto' | 'semi_auto';
			auto_cycle_count?: number;
			per_step_execution?: boolean;
			preset_id?: string | null;
		}): Promise<AmkaAsyncStartResponse> =>
			marketingCabinetApi.createAmkaRun(payload),
		onSuccess: (data, variables) => {
			prependAmkaRunToProjectListCache(qc, variables.project_id, data.run);
			seedAmkaRunDetailCache(qc, data);
			invalidateAmkaQueries(
				qc,
				variables.project_id,
				data.run.id,
				variables.company_id
			);
		},
	});
}

export function useApproveAmkaRun(
	projectId: string | undefined,
	companyId?: string | null
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variables: {
			runId: string;
			skip_section_keys?: string[];
			skip_step_ids?: string[];
			skip_operation_keys?: string[];
		}): Promise<AmkaControlResponse> =>
			marketingCabinetApi.approveAmkaRun(variables.runId, {
				skip_section_keys: variables.skip_section_keys ?? [],
				skip_step_ids: variables.skip_step_ids ?? [],
				skip_operation_keys: variables.skip_operation_keys ?? [],
			}),
		onSuccess: (data, variables) => {
			invalidateAmkaQueries(
				qc,
				projectId,
				data.run.id || variables.runId,
				companyId
			);
		},
	});
}

export function useResumeAmkaRun(
	projectId: string | undefined,
	companyId?: string | null
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variables: {
			runId: string;
			skip_section_keys?: string[];
			skip_step_ids?: string[];
			skip_operation_keys?: string[];
		}): Promise<AmkaControlResponse> =>
			marketingCabinetApi.resumeAmkaRun(variables.runId, {
				skip_section_keys: variables.skip_section_keys ?? [],
				skip_step_ids: variables.skip_step_ids ?? [],
				skip_operation_keys: variables.skip_operation_keys ?? [],
			}),
		onSuccess: (data, variables) => {
			invalidateAmkaQueries(
				qc,
				projectId,
				data.run.id || variables.runId,
				companyId
			);
		},
	});
}

export function useContinueAmkaStep(
	projectId: string | undefined,
	companyId?: string | null
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (runId: string): Promise<AmkaControlResponse> =>
			marketingCabinetApi.continueAmkaStep(runId),
		onSuccess: (data, runId) => {
			invalidateAmkaQueries(qc, projectId, data.run.id || runId, companyId);
		},
	});
}

export function useCancelAmkaRun(
	projectId: string | undefined,
	companyId?: string | null
) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (runId: string): Promise<AmkaControlResponse> =>
			marketingCabinetApi.cancelAmkaRun(runId),
		onSuccess: (data, runId) => {
			invalidateAmkaQueries(qc, projectId, data.run.id || runId, companyId);
		},
	});
}

export function useAmkaOperatorConfig() {
	return useQuery(amkaOperatorConfigQueryOptions());
}

export function useAmkaPresetTemplates() {
	return useQuery(amkaPresetTemplatesQueryOptions());
}

export function useAmkaPresets(projectId: string | undefined) {
	return useQuery({
		...amkaPresetsProjectQueryOptions(projectId),
		enabled: Boolean(projectId),
	});
}

export function useCreateAmkaPreset(projectId: string | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: {
			display_name: string;
			slug?: string | null;
			config?: AmkaPresetConfigV1;
		}) => {
			if (!projectId) {
				throw new Error('projectId required');
			}
			return marketingCabinetApi.createAmkaPreset(projectId, body);
		},
		onSuccess: (_data, _vars) => {
			if (projectId) {
				void qc.invalidateQueries({
					queryKey: amkaQueryKeys.presetsProject(projectId),
				});
			}
		},
	});
}

export function useUpdateAmkaPreset(projectId: string | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (variables: {
			presetId: string;
			body: { display_name?: string; config?: AmkaPresetConfigV1 };
		}) =>
			marketingCabinetApi.updateAmkaPreset(variables.presetId, variables.body),
		onSuccess: () => {
			if (projectId) {
				void qc.invalidateQueries({
					queryKey: amkaQueryKeys.presetsProject(projectId),
				});
			}
		},
	});
}

export function useDeleteAmkaPreset(projectId: string | undefined) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (presetId: string) =>
			marketingCabinetApi.deleteAmkaPreset(presetId),
		onSuccess: () => {
			if (projectId) {
				void qc.invalidateQueries({
					queryKey: amkaQueryKeys.presetsProject(projectId),
				});
			}
		},
	});
}

export function usePutAmkaOperatorConfig() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (
			config: AmkaOperatorConfigV1
		): Promise<AmkaOperatorConfigBundle> =>
			marketingCabinetApi.putAmkaOperatorConfig(config),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: amkaQueryKeys.operatorConfig });
		},
	});
}

/** One-shot POST for EWA desktop orchestration (envelope v1 in/out). */
export function useEwaDesktopOrchestrationTurn() {
	return useMutation({
		mutationFn: (body: EwaDesktopOrchTurnRequestEnvelope) =>
			postEwaDesktopOrchestrationTurn(body),
	});
}

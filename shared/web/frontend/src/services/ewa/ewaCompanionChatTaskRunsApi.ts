/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Companion task-run HTTP client: list, confirm, cancel, and SSE event streams for durable runs.
 *
 * Invariants:
 * - List/confirm HTTP responses validated with Zod at the client boundary before coercion enters UI state.
 * - `coerceTaskRun` normalizes `run_revision` (defaults to 1); confirm POST may send `expect_run_revision`.
 * - Per-run SSE reconnect delivers initial `run_snapshot` before filtered task lifecycle events.
 * - E3: task-events SSE uses `apiFetchWithAuth` (Bearer refresh + session-epoch abort), not raw `fetch`.
 *
 * Related:
 * - ewaCompanionChatCoerce.ts — task-run coercion and revision conflict detection
 * - ewaCompanionChatStreamApi.ts — shared SSE block iteration and task event dispatch
 * - api/ewa_platform/gateways/routers/companion_chat.py
 * - documentation/product/ewa/EWA-ECOSYSTEM-VULNERABILITY-MAP-2026-07-09.md (E3 / V-H4)
 */
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import type { components } from '@/generated/ewa-companion-chat-openapi';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';
import { apiClient, apiFetchWithAuth } from '@/services/api/client';
import { getAuthHeader } from '@/services/authSession';
import {
	type EwaCompanionTaskRun,
	coerceTaskRun,
	coerceTaskRunListRow,
	isCompanionTaskRunRevisionConflictError,
	parseCompanionTaskRunConfirmResponse,
	parseCompanionTaskRunsListResponse,
} from './ewaCompanionChatCoerce';
import {
	type CompanionChatStreamHandlers,
	dispatchCompanionTaskSseBlock,
	iterateSseEventBlocks,
} from './ewaCompanionChatStreamApi';

export { isCompanionTaskRunRevisionConflictError };

type CompanionChatOpenApiSchemas = components['schemas'];
type GeneratedCompanionTaskRunConfirmOut =
	CompanionChatOpenApiSchemas['CompanionTaskRunConfirmOut'];

export const COMPANION_CHAT_TASK_RUNS_PATH =
	'/ewa/companion-chat/task-runs' as const;
export const COMPANION_CHAT_TASK_EVENTS_STREAM_PATH =
	'/ewa/companion-chat/task-events/stream' as const;

export type CompanionTaskRunConfirmResponse = Omit<
	GeneratedCompanionTaskRunConfirmOut,
	'actions' | 'task_run'
> & {
	/** Coerced separately via **`coerceCompanionActions`** when consumed by dispatch. */
	actions?: unknown;
	task_run: EwaCompanionTaskRun;
};

export type CompanionTaskRunCancelResponse = {
	ok: boolean;
	reply: string;
	task_run: EwaCompanionTaskRun;
	ugs_requests_cancelled?: number;
};

export async function confirmEwaCompanionTaskRun(
	runId: string,
	decision: 'confirm' | 'cancel',
	opts?: { expectRunRevision?: number }
): Promise<CompanionTaskRunConfirmResponse> {
	const safeId = runId.trim();
	if (!safeId) {
		throw new Error('companion_task_run_id_required');
	}
	const body: {
		decision: 'confirm' | 'cancel';
		expect_run_revision?: number;
	} = { decision };
	if (opts?.expectRunRevision !== undefined) {
		body.expect_run_revision = opts.expectRunRevision;
	}
	const res = await apiClient.post<unknown>(
		`${COMPANION_CHAT_TASK_RUNS_PATH}/${encodeURIComponent(safeId)}/confirm`,
		body,
		{
			...API_OPTIONS,
			headers: getAuthHeader(),
		}
	);
	const data = parseCompanionTaskRunConfirmResponse(res.data);
	const run = coerceTaskRun(data.task_run);
	if (!run) {
		throw new Error('companion_task_run_confirm_invalid_response');
	}
	return {
		ok: Boolean(data.ok),
		reply: typeof data.reply === 'string' ? data.reply : '',
		actions: data.actions,
		task_run: run,
	};
}

export async function cancelEwaCompanionTaskRun(
	runId: string
): Promise<CompanionTaskRunCancelResponse> {
	const safeId = runId.trim();
	if (!safeId) {
		throw new Error('companion_task_run_id_required');
	}
	const res = await apiClient.post<CompanionTaskRunCancelResponse>(
		`${COMPANION_CHAT_TASK_RUNS_PATH}/${encodeURIComponent(safeId)}/cancel`,
		{},
		{
			...API_OPTIONS,
			headers: getAuthHeader(),
		}
	);
	const data = res.data;
	const run = coerceTaskRun(data.task_run);
	if (!run) {
		throw new Error('companion_task_run_cancel_invalid_response');
	}
	return {
		ok: Boolean(data.ok),
		reply: typeof data.reply === 'string' ? data.reply : '',
		task_run: run,
		ugs_requests_cancelled:
			typeof data.ugs_requests_cancelled === 'number'
				? data.ugs_requests_cancelled
				: undefined,
	};
}

export async function listEwaCompanionTaskRuns(
	limit = 10,
	opts?: {
		cacheBust?: boolean;
		includeSteps?: boolean;
		listProfile?: 'full' | 'summary';
	}
): Promise<EwaCompanionTaskRun[]> {
	const safeLimit = Math.max(
		1,
		Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 10)
	);
	const params: Record<string, string | number | boolean> = {
		limit: safeLimit,
		list_profile: opts?.listProfile ?? 'summary',
	};
	if (opts?.includeSteps) {
		params.include_steps = 1;
	}
	if (opts?.cacheBust) {
		params._ = Date.now();
	}
	const res = await apiClient.get<unknown>(COMPANION_CHAT_TASK_RUNS_PATH, {
		...API_OPTIONS,
		params,
		headers: {
			...getAuthHeader(),
			'Cache-Control': 'no-cache',
			Pragma: 'no-cache',
		},
	});
	const rawRuns = parseCompanionTaskRunsListResponse(res.data);
	const profile = opts?.listProfile ?? 'summary';
	return rawRuns
		.map((row) => coerceTaskRunListRow(row, profile))
		.filter((row): row is EwaCompanionTaskRun => row !== null);
}

export async function streamEwaCompanionTaskEvents(
	handlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
		| 'signal'
	>
): Promise<void> {
	const root = API_OPTIONS.baseURL.replace(/\/$/, '');
	const url = `${root}${COMPANION_CHAT_TASK_EVENTS_STREAM_PATH}`;
	const res = await apiFetchWithAuth(url, {
		method: 'GET',
		headers: {
			Accept: 'text/event-stream',
		},
		signal: handlers.signal,
	});
	if (!res.ok) {
		throw new Error(`Companion task events stream HTTP ${res.status}`);
	}
	for await (const block of iterateSseEventBlocks(res)) {
		dispatchCompanionTaskSseBlock(block, handlers);
	}
}

function companionChatTaskRunEventsUrl(runId: string): string {
	const root = API_OPTIONS.baseURL.replace(/\/$/, '');
	return `${root}${COMPANION_CHAT_TASK_RUNS_PATH}/${encodeURIComponent(runId)}/events`;
}

function dispatchCompanionTaskRunSseBlock(
	block: { event: string; data: string },
	handlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
		| 'onRunSnapshot'
	>
): boolean {
	if (block.event === 'run_snapshot') {
		try {
			const parsed = JSON.parse(block.data) as { run?: unknown };
			const run = coerceTaskRun(parsed.run);
			if (run) handlers.onRunSnapshot?.(run);
		} catch (err) {
			ewaCompanionDegradeDebug(
				'companion_task_run_sse_snapshot',
				'malformed run_snapshot payload',
				err
			);
		}
		return true;
	}
	if (block.event === 'done') {
		return true;
	}
	return dispatchCompanionTaskSseBlock(block, handlers);
}

/**
 * Per-run SSE reconnect (Phase 5.5): filtered Redis bridge + initial ``run_snapshot``.
 * Use when exactly one background operation is active and the chat stream is closed.
 */
export async function streamEwaCompanionTaskRunEvents(
	runId: string,
	handlers: Pick<
		CompanionChatStreamHandlers,
		| 'onTaskAccepted'
		| 'onTaskStep'
		| 'onTaskCompleted'
		| 'onTaskFailed'
		| 'onTaskAwaitingConfirmation'
		| 'onRunSnapshot'
		| 'signal'
	>
): Promise<void> {
	const trimmed = runId.trim();
	if (!trimmed) {
		throw new Error('Companion task run events stream requires runId');
	}
	const url = companionChatTaskRunEventsUrl(trimmed);
	const res = await apiFetchWithAuth(url, {
		method: 'GET',
		headers: {
			Accept: 'text/event-stream',
		},
		signal: handlers.signal,
	});
	if (!res.ok) {
		throw new Error(`Companion task run events stream HTTP ${res.status}`);
	}
	for await (const block of iterateSseEventBlocks(res)) {
		if (dispatchCompanionTaskRunSseBlock(block, handlers)) continue;
	}
}

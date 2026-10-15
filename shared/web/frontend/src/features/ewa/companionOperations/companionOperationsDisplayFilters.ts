/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure filtering, ordering, partitioning, and merge helpers for companion operation runs.
 *
 * Invariants:
 * - Active status normalization and display limits remain the single list-state contract.
 * - Helpers do not depend on mission or progress presentation modules.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 * - src/services/ewa/ewaCompanionChatApi.ts
 */

import { parseAgenticGateFromRun } from '@/features/ewa/agentic/agenticGateUtils';
import type {
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

function isAgenticSessionKind(run: EwaCompanionTaskRun): boolean {
	return (run.intent_kind || '').trim().toLowerCase() === 'agentic_session';
}

export const MUSIC_PIPELINE_STAGE_COUNT = 4;

/** Durable companion music runs (Turbo wizard v2 + XL Base autonomous). */
export const MUSIC_BACKGROUND_INTENT_KINDS = new Set([
	'music_generation_background',
	'music_generation_xl_base_background',
]);

/** Durable companion image runs (UGS background). */
export const IMAGE_BACKGROUND_INTENT_KINDS = new Set([
	'image_generation_background',
	'image_edit_background',
]);

/** Durable companion presentation runs backed by EWRP. */
export const PRESENTATION_BACKGROUND_INTENT_KINDS = new Set([
	'presentation_generation_background',
]);

export const MUSIC_PIPELINE_DB_STEP_KINDS = new Set([
	'music_generation_pipeline_v2',
	'music_generation_pipeline_xl_base',
]);

export function isMusicBackgroundIntent(intentKind: string): boolean {
	return MUSIC_BACKGROUND_INTENT_KINDS.has(
		(intentKind || '').trim().toLowerCase()
	);
}

export function isImageBackgroundIntent(intentKind: string): boolean {
	return IMAGE_BACKGROUND_INTENT_KINDS.has(
		(intentKind || '').trim().toLowerCase()
	);
}

export function isPresentationBackgroundIntent(intentKind: string): boolean {
	return PRESENTATION_BACKGROUND_INTENT_KINDS.has(
		(intentKind || '').trim().toLowerCase()
	);
}

export type CompanionTranscriptProgressItem = {
	runId: string;
	intentKind: string;
	title: string;
	/** Agentic / workflow: current step or session phase (user-facing). */
	subtitle?: string;
	current: number;
	total: number;
	/** T1 / V-H5: ``stale`` = heartbeat or poll degraded — never treat as live Running. */
	status: 'active' | 'stale' | 'completed' | 'failed';
	steps?: EwaCompanionTaskStep[];
};

/** Poll/SSE refresh failure kinds from companionOperationsStore (T1 Zero-Deception). */
export type CompanionOperationsPollDegradedKind =
	| 'auth'
	| 'backend'
	| 'stale'
	| 'no_mission';
export const ACTIVE_OPERATION_STATUSES = new Set([
	'created',
	'queued',
	'pending',
	'started',
	'running',
	'in_progress',
	'processing',
	'awaiting_confirmation',
]);

export type CompanionOperationUiStatus =
	| 'pending'
	| 'running'
	| 'awaiting_confirmation'
	| 'completed'
	| 'failed'
	| 'cancelled';
export function companionRunVisualRevision(run: EwaCompanionTaskRun): string {
	const steps = run.steps ?? [];
	const last = steps.length > 0 ? steps[steps.length - 1] : null;
	return [
		run.id,
		run.run_revision ?? 0,
		run.status ?? '',
		run.updated_at ?? '',
		steps.length,
		last?.status ?? '',
		last?.step_index ?? '',
		JSON.stringify(run.plan_payload ?? {}),
		JSON.stringify(run.confirmation_state ?? {}),
		JSON.stringify(run.result_payload ?? {}),
		run.surface_blocks?.length ?? '',
		run.music_pipeline_progress?.current ?? '',
		run.music_pipeline_progress?.total ?? '',
	].join(':');
}

export function normalizeCompanionOperationStatus(
	statusValue: string
): CompanionOperationUiStatus {
	const st = (statusValue || '').trim().toLowerCase();
	if (st === 'awaiting_confirmation') return 'awaiting_confirmation';
	if (st === 'accepted') return 'pending';
	if (
		st === 'completed' ||
		st === 'done' ||
		st === 'success' ||
		st === 'succeeded'
	) {
		return 'completed';
	}
	if (st === 'failed' || st === 'error' || st === 'errored') return 'failed';
	if (st === 'queued') return 'pending';
	if (st === 'cancelled' || st === 'canceled') return 'cancelled';
	if (st === 'running' || st === 'in_progress' || st === 'processing') {
		return 'running';
	}
	return 'pending';
}
/** Default rows shown in operations panel / mobile sheet (U3.4). */
export const OPERATIONS_DISPLAY_LIMIT_DEFAULT = 8;
/** Expanded history after «Show more» (U3.4). */
export const OPERATIONS_DISPLAY_LIMIT_EXPANDED = 20;
/** @deprecated Use OPERATIONS_DISPLAY_LIMIT_DEFAULT — kept for subtitle i18n `limit`. */
export const OPERATIONS_HISTORY_LIMIT = OPERATIONS_DISPLAY_LIMIT_DEFAULT;
/** Initial poll/refresh fetch size. */
export const OPERATIONS_FETCH_LIMIT_DEFAULT = 12;
/** Fetch size after user expands history. */
export const OPERATIONS_FETCH_LIMIT_EXPANDED = 25;
/** @deprecated Use OPERATIONS_FETCH_LIMIT_DEFAULT. */
export const OPERATIONS_FETCH_LIMIT = OPERATIONS_FETCH_LIMIT_DEFAULT;
/** Max runs kept in client state after merge (active + history). */
export const OPERATIONS_STORE_CAP = 30;

/** Child async tool run spawned from a declarative workflow parent run. */
export function isWorkflowChildRun(run: EwaCompanionTaskRun): boolean {
	const columnParent = (run.parent_run_id || '').trim();
	if (columnParent.length > 0) return true;
	const parent = run.plan_payload?.workflow_parent_run_id;
	return typeof parent === 'string' && parent.trim().length > 0;
}

/** doc_create (etc.) runs opened by an agentic HITL gate — confirm only on the parent agentic card. */
export function collectAgenticNestedCompanionRunIds(
	runs: EwaCompanionTaskRun[]
): Set<string> {
	const nested = new Set<string>();
	for (const run of runs) {
		if (!isAgenticSessionKind(run)) continue;
		const gate = parseAgenticGateFromRun(run);
		const pendingId = gate?.companionPendingTaskRunId?.trim();
		if (pendingId) nested.add(pendingId);
	}
	return nested;
}

export function isAgenticNestedCompanionRun(
	run: EwaCompanionTaskRun,
	nestedIds: ReadonlySet<string>
): boolean {
	const runId = (run.id || '').trim();
	return runId.length > 0 && nestedIds.has(runId);
}

/** User-authored multi-step workflow (not operator pilot like music_full_cycle_v1). */
export function isUserActionWorkflowRun(run: EwaCompanionTaskRun): boolean {
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (kind !== 'action_workflow') return false;
	const plan = run.plan_payload || {};
	if (
		typeof plan.user_workflow_id === 'string' &&
		plan.user_workflow_id.trim()
	) {
		return true;
	}
	const wfId =
		typeof plan.workflow_id === 'string'
			? plan.workflow_id.trim()
			: typeof (run as { workflow_id?: string }).workflow_id === 'string'
				? String((run as { workflow_id?: string }).workflow_id).trim()
				: '';
	return wfId.startsWith('user_');
}

/** Hide nested tool runs — show the parent workflow card with step timeline instead. */
export function dedupeActiveUserWorkflowRuns(
	runs: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	const keptByKey = new Map<string, EwaCompanionTaskRun>();
	const out: EwaCompanionTaskRun[] = [];
	for (const run of sortOperationRuns(runs)) {
		if (!isUserActionWorkflowRun(run)) {
			out.push(run);
			continue;
		}
		const st = (run.status || '').trim().toLowerCase();
		if (!ACTIVE_OPERATION_STATUSES.has(st)) {
			out.push(run);
			continue;
		}
		const plan = run.plan_payload || {};
		const wfId =
			typeof plan.user_workflow_id === 'string'
				? plan.user_workflow_id.trim()
				: typeof plan.workflow_id === 'string'
					? plan.workflow_id.trim()
					: '';
		const msg = (run.user_message || '').trim().toLowerCase();
		const key = `${wfId}::${msg}`;
		const existing = keptByKey.get(key);
		if (!existing) {
			keptByKey.set(key, run);
			out.push(run);
			continue;
		}
		if (runUpdatedAtMs(run) >= runUpdatedAtMs(existing)) {
			keptByKey.set(key, run);
			const idx = out.indexOf(existing);
			if (idx >= 0) out[idx] = run;
		}
	}
	return out;
}

/** Hide nested tool runs — show the parent workflow card with step timeline instead. */
export function filterRunsForOperationsDisplay(
	runs: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	const agenticNestedIds = collectAgenticNestedCompanionRunIds(runs);
	return dedupeActiveUserWorkflowRuns(
		runs.filter((run) => {
			if (isWorkflowChildRun(run)) return false;
			if (isAgenticNestedCompanionRun(run, agenticNestedIds)) return false;
			return true;
		})
	);
}

export function isOperationRunCancellable(run: EwaCompanionTaskRun): boolean {
	const st = (run.status || '').trim().toLowerCase();
	if (!ACTIVE_OPERATION_STATUSES.has(st)) return false;
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (isAgenticSessionKind(run)) return true;
	if (isMusicBackgroundIntent(kind)) return true;
	if (isImageBackgroundIntent(kind)) return true;
	if (isUserActionWorkflowRun(run)) return true;
	return false;
}
function runSortRank(status: string): number {
	return ACTIVE_OPERATION_STATUSES.has(status) ? 0 : 1;
}

export function sortOperationRuns(
	runs: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	return [...runs].sort((a, b) => {
		const rankDiff = runSortRank(a.status) - runSortRank(b.status);
		if (rankDiff !== 0) return rankDiff;
		const aTs = Date.parse(a.updated_at || a.created_at || '') || 0;
		const bTs = Date.parse(b.updated_at || b.created_at || '') || 0;
		return bTs - aTs;
	});
}

function runUpdatedAtMs(run: EwaCompanionTaskRun): number {
	return (
		Date.parse(run.updated_at || '') ||
		Date.parse(run.completed_at || '') ||
		Date.parse(run.created_at || '') ||
		0
	);
}

export function mergeOperationRuns(
	prev: EwaCompanionTaskRun[],
	incoming: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	const byId = new Map<string, EwaCompanionTaskRun>();
	for (const row of [...prev, ...incoming]) {
		const existing = byId.get(row.id);
		if (!existing) {
			byId.set(row.id, row);
			continue;
		}
		byId.set(
			row.id,
			runUpdatedAtMs(row) >= runUpdatedAtMs(existing) ? row : existing
		);
	}
	return sortOperationRuns([...byId.values()]).slice(0, OPERATIONS_STORE_CAP);
}

export function applyServerOperationRuns(
	rows: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	return sortOperationRuns(rows).slice(0, OPERATIONS_STORE_CAP);
}
export function partitionOperationRuns(
	runs: EwaCompanionTaskRun[],
	displayLimit = OPERATIONS_DISPLAY_LIMIT_DEFAULT
): {
	active: EwaCompanionTaskRun[];
	history: EwaCompanionTaskRun[];
} {
	const cap = Math.max(1, displayLimit);
	const sorted = sortOperationRuns(filterRunsForOperationsDisplay(runs)).slice(
		0,
		cap
	);
	const active: EwaCompanionTaskRun[] = [];
	const history: EwaCompanionTaskRun[] = [];
	for (const run of sorted) {
		const st = (run.status || '').trim().toLowerCase();
		if (ACTIVE_OPERATION_STATUSES.has(st)) active.push(run);
		else history.push(run);
	}
	return { active, history };
}

/** Active durable runs for mobile toolbar badge and a11y (U5.6). */
export function countActiveCompanionOperationRuns(
	runs: EwaCompanionTaskRun[]
): number {
	return partitionOperationRuns(runs).active.length;
}

/** Mobile sheet auto-open when user must confirm/cancel (U5.9). */
export function companionRunNeedsMobileConfirmationSheet(
	run: EwaCompanionTaskRun
): boolean {
	return (run.status || '').trim().toLowerCase() === 'awaiting_confirmation';
}

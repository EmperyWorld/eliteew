/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Music wizard / pipeline progress helpers and poll merge that preserves SSE sub-stages.
 *
 * Invariants:
 * - Progress merges never regress newer SSE sub-stage state with stale poll data.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/transcriptProgress.ts
 */

import {
	ACTIVE_OPERATION_STATUSES,
	isMusicBackgroundIntent,
	isUserActionWorkflowRun,
	mergeOperationRuns,
	MUSIC_PIPELINE_DB_STEP_KINDS,
	MUSIC_PIPELINE_STAGE_COUNT,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import type { MusicPipelineProgress } from '@/features/ewa/companionOperations/progressUi/progressUiTypes';
import {
	isUnifiedContentReferenceMissing,
	normalizeUnifiedContentId,
} from '@/services/audio/playerAudioContracts';
import type {
	CompanionChatAction,
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

/** Sub-stages emitted over SSE for music wizard (not separate PG rows). */
export const MUSIC_WIZARD_STEP_KINDS = new Set([
	'lyrics',
	'suggest-production-params',
	'generate-style',
	'generate',
]);

export function workflowStepProgressFromRun(run: EwaCompanionTaskRun): {
	current: number;
	total: number;
	title: string;
} {
	const steps = [...(run.steps ?? [])].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);
	const total = Math.max(steps.length, 1);
	let activeStep: EwaCompanionTaskStep | undefined;
	for (const step of steps) {
		const st = (step.status || '').trim().toLowerCase();
		if (st === 'completed' || st === 'cancelled') continue;
		activeStep = step;
		break;
	}
	if (!activeStep) {
		activeStep = steps[steps.length - 1];
	}
	const current = Math.min(total, Math.max(activeStep?.step_index || total, 1));
	const plan = run.plan_payload || {};
	const workflowTitle =
		typeof plan.workflow_title_ru === 'string'
			? plan.workflow_title_ru.trim()
			: typeof plan.workflow_title_en === 'string'
				? plan.workflow_title_en.trim()
				: '';
	const title =
		(activeStep?.title || '').trim() ||
		(activeStep?.step_kind || '').trim() ||
		workflowTitle ||
		run.user_message?.trim() ||
		'';
	return { current, total, title };
}

export function userWorkflowProgressForRun(
	run: EwaCompanionTaskRun
): MusicPipelineProgress | null {
	if (!isUserActionWorkflowRun(run)) return null;
	const st = (run.status || '').trim().toLowerCase();
	if (
		!ACTIVE_OPERATION_STATUSES.has(st) &&
		st !== 'completed' &&
		st !== 'failed'
	) {
		return null;
	}
	return workflowStepProgressFromRun(run);
}

/** True when run should show music wizard sub-stage progress (4 steps). */
export function runUsesMusicPipelineProgress(
	run: EwaCompanionTaskRun
): boolean {
	const intent = (run.intent_kind || '').trim().toLowerCase();
	if (isMusicBackgroundIntent(intent)) return true;
	if (intent !== 'action_workflow') return false;
	const plan = run.plan_payload || {};
	const workflowId =
		typeof plan.workflow_id === 'string'
			? plan.workflow_id.trim()
			: typeof (run as { workflow_id?: string }).workflow_id === 'string'
				? String((run as { workflow_id?: string }).workflow_id).trim()
				: '';
	if (workflowId === 'music_full_cycle_v1') return true;
	return (run.steps ?? []).some((s) =>
		MUSIC_PIPELINE_DB_STEP_KINDS.has(s.step_kind)
	);
}

export function extractBackgroundPlayAction(
	run: EwaCompanionTaskRun
): CompanionChatAction | null {
	const st = (run.status || '').trim().toLowerCase();
	if (st !== 'completed') return null;
	const payload = run.result_payload || {};
	if (isUnifiedContentReferenceMissing(payload)) return null;
	if (!payload.background_play) return null;
	const unifiedContentId = normalizeUnifiedContentId(payload) ?? '';
	if (!unifiedContentId) return null;
	const trackName =
		typeof payload.track_name === 'string' && payload.track_name.trim()
			? payload.track_name.trim()
			: unifiedContentId;
	return {
		type: 'music_play_track',
		unified_content_id: unifiedContentId,
		track_name: trackName,
	};
}

function isMusicWizardStepKind(kind: string): boolean {
	return MUSIC_WIZARD_STEP_KINDS.has((kind || '').trim());
}

function mergeMusicWizardSteps(
	prevSteps: EwaCompanionTaskStep[] | undefined,
	serverSteps: EwaCompanionTaskStep[] | undefined
): EwaCompanionTaskStep[] | undefined {
	const prevWizard = (prevSteps ?? []).filter((s) =>
		isMusicWizardStepKind(s.step_kind)
	);
	const server = serverSteps ?? [];
	if (prevWizard.length === 0) {
		return server.length > 0 ? server : undefined;
	}
	const byIndex = new Map<number, EwaCompanionTaskStep>();
	for (const s of server) {
		byIndex.set(s.step_index, s);
	}
	for (const s of prevWizard) {
		const existing = byIndex.get(s.step_index);
		if (!existing || isMusicWizardStepKind(s.step_kind)) {
			byIndex.set(s.step_index, s);
		}
	}
	return [...byIndex.values()].sort(
		(a, b) => (a.step_index || 0) - (b.step_index || 0)
	);
}

export function musicProgressFromRun(run: EwaCompanionTaskRun): {
	current: number;
	total: number;
	title: string;
} {
	const client = run.music_pipeline_progress;
	if (
		client &&
		Number.isFinite(client.current) &&
		Number.isFinite(client.total) &&
		client.total > 0
	) {
		return {
			current: Math.max(0, Math.min(client.current, client.total)),
			total: client.total,
			title: client.title || '',
		};
	}
	const total = MUSIC_PIPELINE_STAGE_COUNT;
	const steps = run.steps ?? [];
	let current = 0;
	let title = '';
	for (const step of steps) {
		const st = (step.status || '').trim().toLowerCase();
		const idx = Number.isFinite(step.step_index) ? step.step_index : 0;
		if (st === 'completed' || st === 'failed') {
			current = Math.max(current, idx);
		} else if (st === 'running' || st === 'in_progress' || st === 'pending') {
			current = Math.max(current, idx);
			if (step.title?.trim()) title = step.title.trim();
		}
	}
	if (!title) {
		for (let i = steps.length - 1; i >= 0; i -= 1) {
			const stepTitle = steps[i]?.title?.trim();
			if (stepTitle) {
				title = stepTitle;
				break;
			}
		}
	}
	const plan = run.plan_payload || {};
	const theme =
		typeof plan.theme_preview === 'string' ? plan.theme_preview.trim() : '';
	if (!title && theme) title = theme;
	return { current: Math.max(0, Math.min(current, total)), total, title };
}

/** Merge polled server rows without wiping SSE music sub-stage progress. */
export function mergePolledOperationRuns(
	prev: EwaCompanionTaskRun[],
	incoming: EwaCompanionTaskRun[]
): EwaCompanionTaskRun[] {
	const base = mergeOperationRuns(prev, incoming);
	const prevById = new Map(prev.map((run) => [run.id, run]));
	return base.map((run) => {
		const prevRun = prevById.get(run.id);
		if (!prevRun) return run;
		if (!runUsesMusicPipelineProgress(run)) return run;

		const st = (run.status || '').trim().toLowerCase();
		const mergedSteps = mergeMusicWizardSteps(prevRun.steps, run.steps);
		let music_pipeline_progress = prevRun.music_pipeline_progress;

		if (ACTIVE_OPERATION_STATUSES.has(st) && music_pipeline_progress) {
			const serverProg = musicProgressFromRun({
				...run,
				steps: mergedSteps ?? run.steps,
			});
			if (serverProg.current > music_pipeline_progress.current) {
				music_pipeline_progress = serverProg;
			}
		} else if (st === 'completed' || st === 'failed' || st === 'cancelled') {
			music_pipeline_progress = undefined;
		}

		return {
			...run,
			...(mergedSteps ? { steps: mergedSteps } : {}),
			...(music_pipeline_progress ? { music_pipeline_progress } : {}),
		};
	});
}

export function musicPipelineProgressForRun(
	run: EwaCompanionTaskRun
): MusicPipelineProgress | null {
	if (!runUsesMusicPipelineProgress(run)) return null;
	const st = (run.status || '').trim().toLowerCase();
	if (
		!ACTIVE_OPERATION_STATUSES.has(st) &&
		st !== 'completed' &&
		st !== 'failed'
	) {
		return null;
	}
	return musicProgressFromRun(run);
}

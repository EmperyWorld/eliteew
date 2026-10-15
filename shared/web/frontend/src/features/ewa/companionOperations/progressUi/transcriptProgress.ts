/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-transcript progress derivation for active durable companion operation runs.
 *
 * Invariants:
 * - Transcript progress rows follow operations-panel display filtering and truthful live state.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/musicPipelineProgress.ts
 */

import type { TFunction } from 'i18next';

import { formatAgenticNodeStatus } from '@/features/ewa/agentic/agenticObservabilityUi';
import {
	ACTIVE_OPERATION_STATUSES,
	filterRunsForOperationsDisplay,
	isPresentationBackgroundIntent,
	isUserActionWorkflowRun,
	sortOperationRuns,
	type CompanionOperationsPollDegradedKind,
	type CompanionTranscriptProgressItem,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import {
	agenticSessionDisplaySummary,
	isAgenticSessionRun,
	isOperationTruthfullyLive,
	parseAgenticSessionPlanPayload,
	resolveOperationEffectiveDisplayState,
} from '@/features/ewa/companionOperations/companionOperationsMissionSurface';
import {
	musicProgressFromRun,
	runUsesMusicPipelineProgress,
	workflowStepProgressFromRun,
} from '@/features/ewa/companionOperations/progressUi/musicPipelineProgress';
import { operationPresentationSummary } from '@/features/ewa/companionOperations/progressUi/readyArtifacts';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

/** Step-aware progress for agentic session mirror runs (Operations + transcript banner). */
export function agenticProgressFromRun(
	run: EwaCompanionTaskRun,
	t?: TFunction<'marketing'>
): {
	current: number;
	total: number;
	title: string;
	subtitle: string;
} {
	const display = agenticSessionDisplaySummary(run, t);
	const parsed = parseAgenticSessionPlanPayload(run);
	const steps = run.steps ?? [];
	const total = Math.max(steps.length, 1);
	let completed = 0;
	let activeStepTitle = '';
	for (const step of steps) {
		const st = (step.status || '').trim().toLowerCase();
		if (st === 'completed' || st === 'failed') {
			completed += 1;
		}
		if (st === 'running' || st === 'in_progress' || st === 'pending') {
			if (step.title?.trim()) activeStepTitle = step.title.trim();
		}
	}
	if (!activeStepTitle && steps.length > 0) {
		const last = steps[steps.length - 1];
		if (last?.title?.trim()) activeStepTitle = last.title.trim();
	}
	const sessionStatus = parsed?.sessionStatus || 'running';
	const phaseLabel =
		t != null ? formatAgenticNodeStatus(sessionStatus, t) : sessionStatus;
	const subtitle = activeStepTitle
		? `${phaseLabel} · ${activeStepTitle}`
		: phaseLabel;
	const current =
		completed > 0
			? Math.min(completed, total)
			: sessionStatus === 'replanning' || sessionStatus === 'executing'
				? 1
				: 0;
	return {
		current,
		total,
		title:
			display?.title?.trim() ||
			run.user_message?.trim() ||
			(t != null
				? t('ewaCompanion.operationIntentAgenticSession')
				: sessionStatus),
		subtitle,
	};
}

/** Active durable runs → in-transcript progress rows (source of truth: operations panel data). */
export function deriveTranscriptProgressItems(
	runs: EwaCompanionTaskRun[],
	t?: TFunction<'marketing'>,
	opts?: {
		nowMs?: number;
		pollDegradedKind?: CompanionOperationsPollDegradedKind | null;
	}
): CompanionTranscriptProgressItem[] {
	const out: CompanionTranscriptProgressItem[] = [];
	const nowMs = opts?.nowMs ?? Date.now();
	const pollDegradedKind = opts?.pollDegradedKind ?? null;
	for (const run of sortOperationRuns(filterRunsForOperationsDisplay(runs))) {
		const st = (run.status || '').trim().toLowerCase();
		if (!ACTIVE_OPERATION_STATUSES.has(st)) continue;
		const effective = resolveOperationEffectiveDisplayState(run, {
			nowMs,
			pollDegradedKind,
		});
		const progressStatus: CompanionTranscriptProgressItem['status'] =
			effective === 'stale'
				? 'stale'
				: effective === 'failed'
					? 'failed'
					: isOperationTruthfullyLive(effective)
						? 'active'
						: 'stale';
		const intent = (run.intent_kind || '').trim().toLowerCase();
		if (isUserActionWorkflowRun(run)) {
			const { current, total, title } = workflowStepProgressFromRun(run);
			out.push({
				runId: run.id,
				intentKind: 'user_action_workflow',
				title,
				current,
				total,
				status: progressStatus,
				steps: run.steps ?? [],
			});
			continue;
		}
		if (runUsesMusicPipelineProgress(run)) {
			const { current, total, title } = musicProgressFromRun(run);
			out.push({
				runId: run.id,
				intentKind: intent === 'action_workflow' ? 'action_workflow' : intent,
				title,
				current,
				total,
				status: progressStatus,
			});
			continue;
		}
		if (isPresentationBackgroundIntent(intent)) {
			const summary = operationPresentationSummary(run);
			const current = summary
				? Math.max(1, Math.min(99, Math.round(summary.progress || 1)))
				: 1;
			out.push({
				runId: run.id,
				intentKind: intent,
				title:
					summary?.title?.trim() || run.user_message?.trim() || 'Presentation',
				current,
				total: 100,
				status: progressStatus,
			});
			continue;
		}
		if (isAgenticSessionRun(run)) {
			const prog = agenticProgressFromRun(run, t);
			out.push({
				runId: run.id,
				intentKind: 'agentic_session',
				title: prog.title,
				subtitle: prog.subtitle,
				current: prog.current,
				total: prog.total,
				status: progressStatus,
				steps: run.steps ?? [],
			});
			continue;
		}
		out.push({
			runId: run.id,
			intentKind: intent || 'unknown',
			title: run.user_message?.trim() || '',
			current: 0,
			total: 1,
			status: progressStatus,
		});
	}
	return out;
}

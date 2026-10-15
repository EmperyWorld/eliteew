/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Agentic mission parsing, truthful display state, and center/rail mission surface derivation.
 *
 * Invariants:
 * - Agentic missions without a recent heartbeat never display as Running.
 * - Mission bundles preserve the existing operation and progress contracts.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 * - documentation/product/ewa/EWA-FORENSIC-AUDIT-RECOVERY-PLAN-2026-07-09.md (Gate G4)
 */

import type { TFunction } from 'i18next';

import {
	formatAgenticNodeStatus,
	humanizeAgenticPlanSummary,
	isTechnicalAgenticSummary,
	pickAgenticCardTitle,
	sanitizeAgenticChannelLeakage,
} from '@/features/ewa/agentic/agenticObservabilityUi';
import {
	filterRunsForOperationsDisplay,
	isImageBackgroundIntent,
	isMusicBackgroundIntent,
	isPresentationBackgroundIntent,
	isUserActionWorkflowRun,
	normalizeCompanionOperationStatus,
	sortOperationRuns,
	type CompanionOperationUiStatus,
	type CompanionOperationsPollDegradedKind,
	type CompanionTranscriptProgressItem,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import {
	deriveTranscriptProgressItems,
	deriveTranscriptWorkflowSummaries,
	operationIntentLabel,
	operationReadyImage,
	operationReadyPresentation,
	operationReadyTrack,
	operationStatusLabel,
	type OperationReadyImage,
	type OperationReadyPresentation,
	type OperationReadyTrack,
	type WorkflowCompletionSummaryItem,
} from '@/features/ewa/companionOperations/companionOperationsProgressUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

export type AgenticMissionSummaryItem = {
	runId: string;
	title: string;
	subtitle: string;
	status: 'active' | 'completed';
	documents: AgenticCreatedDocument[];
};

export type MissionSurfaceResponsibility = 'center' | 'rail';

export type MissionSurfaceBundle = {
	runId: string;
	title: string;
	subtitle: string;
	answerSummary: string;
	primaryResult: string;
	recommendedNextAction: string;
	responsibility: MissionSurfaceResponsibility;
	displayState: AgenticMissionDisplayState | CompanionOperationUiStatus;
	run: EwaCompanionTaskRun;
	documents: AgenticCreatedDocument[];
	progress: CompanionTranscriptProgressItem | null;
	workflowSummary: WorkflowCompletionSummaryItem | null;
	readyTrack?: OperationReadyTrack | null;
	readyImage?: OperationReadyImage | null;
	readyPresentation?: OperationReadyPresentation | null;
};
export type AgenticMissionDisplayState =
	| 'pending'
	| 'running'
	| 'awaiting_confirmation'
	| 'replanning'
	| 'paused'
	| 'stale'
	| 'completed'
	| 'failed'
	| 'cancelled';

/** Gate G4: no heartbeat older than this → do not show primary Running. */
export const AGENTIC_MISSION_HEARTBEAT_STALE_MS = 5 * 60 * 1000;
/** Document created during agentic HITL file_create confirm (mirrored in plan_payload). */
export type AgenticCreatedDocument = {
	unifiedContentId: string;
	name: string;
};

export function extractAgenticSessionDocuments(
	run: EwaCompanionTaskRun | null | undefined
): AgenticCreatedDocument[] {
	if (!isAgenticSessionRun(run)) return [];
	const plan = run.plan_payload || {};
	const raw = plan.created_documents;
	if (!Array.isArray(raw)) return [];
	const out: AgenticCreatedDocument[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
		const row = item as Record<string, unknown>;
		const unifiedContentId = String(
			row.unified_content_id || row.unifiedContentId || ''
		).trim();
		if (!unifiedContentId || seen.has(unifiedContentId)) continue;
		seen.add(unifiedContentId);
		const name = String(row.name || unifiedContentId).trim();
		out.push({ unifiedContentId, name });
	}
	return out;
}

/** Normalized agentic session mirror fields from Operations plan_payload (agentic_session_v1). */
export type AgenticSessionPlanPayload = {
	agenticSessionId: string;
	kind: 'agentic_session_v1';
	sessionStatus: string;
	missionDisplayState: AgenticMissionDisplayState;
	planSummary: string;
	answerSummary: string;
	primaryResult: string;
	recommendedNextAction: string;
	goalText: string;
};

export function isAgenticSessionRun(run: EwaCompanionTaskRun): boolean;
export function isAgenticSessionRun(
	run: EwaCompanionTaskRun | null | undefined
): run is EwaCompanionTaskRun;
export function isAgenticSessionRun(
	run: EwaCompanionTaskRun | null | undefined
): boolean {
	if (!run || typeof run !== 'object') return false;
	return (run.intent_kind || '').trim().toLowerCase() === 'agentic_session';
}

export function parseAgenticSessionPlanPayload(
	run: EwaCompanionTaskRun,
	nowMs: number = Date.now()
): AgenticSessionPlanPayload | null {
	if (!isAgenticSessionRun(run)) return null;
	const plan = run.plan_payload || {};
	const kind = typeof plan.kind === 'string' ? plan.kind.trim() : '';
	if (kind && kind !== 'agentic_session_v1') return null;
	const agenticSessionId =
		typeof plan.agentic_session_id === 'string'
			? plan.agentic_session_id.trim()
			: '';
	if (!agenticSessionId) return null;
	const sessionStatus =
		typeof plan.session_status === 'string'
			? plan.session_status.trim()
			: (run.status || '').trim();
	const missionDisplayState = withAgenticMissionStaleDisplay(
		resolveAgenticMissionDisplayState(
			run.status || '',
			sessionStatus,
			typeof plan.mission_display_state === 'string'
				? plan.mission_display_state
				: ''
		),
		run,
		nowMs
	);
	const planSummary = sanitizeAgenticChannelLeakage(
		typeof plan.plan_summary === 'string' ? plan.plan_summary.trim() : ''
	);
	const answerSummary = sanitizeAgenticChannelLeakage(
		typeof plan.mission_answer_summary === 'string'
			? plan.mission_answer_summary.trim()
			: ''
	);
	const primaryResult = sanitizeAgenticChannelLeakage(
		typeof plan.primary_result === 'string' ? plan.primary_result.trim() : ''
	);
	const recommendedNextAction =
		typeof plan.recommended_next_action === 'string'
			? plan.recommended_next_action.trim()
			: '';
	let goalText = '';
	const goal = plan.goal;
	if (goal && typeof goal === 'object' && !Array.isArray(goal)) {
		const g = goal as Record<string, unknown>;
		if (typeof g.text === 'string') goalText = g.text.trim();
		else if (typeof g.user_message === 'string')
			goalText = g.user_message.trim();
	}
	if (!goalText && typeof run.user_message === 'string') {
		goalText = run.user_message.trim();
	}
	return {
		agenticSessionId,
		kind: 'agentic_session_v1',
		sessionStatus,
		missionDisplayState,
		planSummary,
		answerSummary,
		primaryResult,
		recommendedNextAction,
		goalText,
	};
}

export function resolveAgenticMissionDisplayState(
	runStatusValue: string,
	sessionStatusValue: string,
	mirroredStateValue = ''
): AgenticMissionDisplayState {
	const mirrored = (mirroredStateValue || '').trim().toLowerCase();
	if (
		mirrored === 'pending' ||
		mirrored === 'running' ||
		mirrored === 'awaiting_confirmation' ||
		mirrored === 'replanning' ||
		mirrored === 'paused' ||
		mirrored === 'stale' ||
		mirrored === 'completed' ||
		mirrored === 'failed' ||
		mirrored === 'cancelled'
	) {
		return mirrored as AgenticMissionDisplayState;
	}
	const sessionStatus = (sessionStatusValue || '').trim().toLowerCase();
	if (sessionStatus === 'awaiting_human') return 'awaiting_confirmation';
	if (
		sessionStatus === 'init' ||
		sessionStatus === 'planning' ||
		sessionStatus === 'executing'
	) {
		return sessionStatus === 'init' ? 'pending' : 'running';
	}
	if (sessionStatus === 'replanning') return 'replanning';
	if (sessionStatus === 'paused') return 'paused';
	if (sessionStatus === 'completed') return 'completed';
	if (sessionStatus === 'failed') return 'failed';
	if (sessionStatus === 'cancelled' || sessionStatus === 'abandoned') {
		return 'cancelled';
	}
	return normalizeCompanionOperationStatus(runStatusValue || '');
}

/**
 * Gate G4: if the backend still claims running/pending/replanning but the run
 * has no recent ``updated_at`` heartbeat, surface ``stale`` instead of Running.
 */
export function isAgenticMissionHeartbeatStale(
	run: Pick<EwaCompanionTaskRun, 'updated_at' | 'completed_at'>,
	nowMs: number = Date.now(),
	staleMs: number = AGENTIC_MISSION_HEARTBEAT_STALE_MS
): boolean {
	if (run.completed_at) return false;
	const ts = Date.parse(String(run.updated_at || '').trim()) || 0;
	if (!ts) return true;
	return nowMs - ts > staleMs;
}

export function withAgenticMissionStaleDisplay(
	state: AgenticMissionDisplayState,
	run: Pick<EwaCompanionTaskRun, 'updated_at' | 'completed_at'>,
	nowMs: number = Date.now()
): AgenticMissionDisplayState {
	if (
		(state === 'running' || state === 'pending' || state === 'replanning') &&
		isAgenticMissionHeartbeatStale(run, nowMs)
	) {
		return 'stale';
	}
	return state;
}

/**
 * T1 / V-H5: single display truth for rail cards + transcript progress.
 * Combines normalized/agentic state, G4 heartbeat stale, and poll-degraded overlay.
 * Never invents success — only demotes live-looking states to ``stale``.
 */
export function resolveOperationEffectiveDisplayState(
	run: EwaCompanionTaskRun,
	opts?: {
		nowMs?: number;
		pollDegradedKind?: CompanionOperationsPollDegradedKind | null;
	}
): AgenticMissionDisplayState | CompanionOperationUiStatus {
	const nowMs = opts?.nowMs ?? Date.now();
	const pollKind = opts?.pollDegradedKind ?? null;
	let state: AgenticMissionDisplayState | CompanionOperationUiStatus;
	if (isAgenticSessionRun(run)) {
		const parsed = parseAgenticSessionPlanPayload(run, nowMs);
		state =
			parsed?.missionDisplayState ??
			normalizeCompanionOperationStatus(run.status || '');
	} else {
		state = withAgenticMissionStaleDisplay(
			normalizeCompanionOperationStatus(
				run.status || ''
			) as AgenticMissionDisplayState,
			run,
			nowMs
		);
	}
	if (pollKind === 'stale' || pollKind === 'backend' || pollKind === 'auth') {
		if (state === 'running' || state === 'pending' || state === 'replanning') {
			return 'stale';
		}
	}
	return state;
}

/** Live chrome (pulse / live pill / active progress) only when display is truthfully in-flight. */
export function isOperationTruthfullyLive(
	state: AgenticMissionDisplayState | CompanionOperationUiStatus
): boolean {
	return (
		state === 'running' ||
		state === 'pending' ||
		state === 'replanning' ||
		state === 'awaiting_confirmation' ||
		state === 'paused'
	);
}

export function isAgenticMissionActiveState(
	state: AgenticMissionDisplayState
): boolean {
	return (
		state === 'pending' ||
		state === 'running' ||
		state === 'awaiting_confirmation' ||
		state === 'replanning' ||
		state === 'paused' ||
		state === 'stale'
	);
}

export function missionDisplayStatusLabel(
	state: AgenticMissionDisplayState,
	t: TFunction<'marketing'>
): string {
	if (state === 'paused') {
		return t('ewaCompanion.agenticMissionStatePaused', 'Пауза');
	}
	if (state === 'replanning') {
		return t('ewaCompanion.agenticMissionStateReplanning', 'Пересборка плана');
	}
	if (state === 'stale') {
		return t('ewaCompanion.agenticMissionStateStale', 'Нет свежего статуса');
	}
	return operationStatusLabel(
		state === 'awaiting_confirmation' ? 'awaiting_confirmation' : state,
		t
	);
}

/** Rail/transcript status chip for any effective display state (incl. non-agentic stale). */
export function operationEffectiveStatusLabel(
	state: AgenticMissionDisplayState | CompanionOperationUiStatus,
	t: TFunction<'marketing'>
): string {
	if (state === 'stale') {
		return t('ewaCompanion.operationStatusStale', 'Нет свежего статуса');
	}
	if (
		state === 'paused' ||
		state === 'replanning' ||
		state === 'awaiting_confirmation' ||
		state === 'running' ||
		state === 'pending' ||
		state === 'completed' ||
		state === 'failed' ||
		state === 'cancelled'
	) {
		return missionDisplayStatusLabel(state, t);
	}
	return operationStatusLabel(state as CompanionOperationUiStatus, t);
}

export function agenticSessionDisplaySummary(
	run: EwaCompanionTaskRun,
	t?: TFunction<'marketing'>
): { title: string; subtitle: string; sessionStatus: string } | null {
	const parsed = parseAgenticSessionPlanPayload(run);
	if (!parsed) return null;
	const humanSummary =
		t && parsed.planSummary
			? humanizeAgenticPlanSummary(parsed.planSummary, t)
			: parsed.planSummary;
	const title =
		t != null
			? pickAgenticCardTitle(parsed.planSummary, parsed.goalText, t)
			: parsed.planSummary || parsed.goalText || parsed.agenticSessionId;
	const technical = isTechnicalAgenticSummary(parsed.planSummary);
	const subtitle =
		t != null
			? technical
				? formatAgenticNodeStatus(parsed.sessionStatus, t)
				: humanSummary && humanSummary !== title
					? parsed.goalText || humanSummary
					: parsed.goalText || formatAgenticNodeStatus(parsed.sessionStatus, t)
			: parsed.goalText || humanSummary || parsed.sessionStatus;
	return {
		title,
		subtitle,
		sessionStatus: parsed.sessionStatus,
	};
}
export function deriveAgenticMissionSummaryItems(
	runs: EwaCompanionTaskRun[],
	t?: TFunction<'marketing'>
): AgenticMissionSummaryItem[] {
	const out: AgenticMissionSummaryItem[] = [];
	for (const run of sortOperationRuns(filterRunsForOperationsDisplay(runs))) {
		if (!isAgenticSessionRun(run)) continue;
		const documents = extractAgenticSessionDocuments(run);
		if (documents.length === 0) continue;
		const display = agenticSessionDisplaySummary(run, t);
		const parsed = parseAgenticSessionPlanPayload(run);
		const state = parsed?.missionDisplayState ?? 'running';
		const active = isAgenticMissionActiveState(state);
		out.push({
			runId: run.id,
			title:
				display?.title?.trim() ||
				run.user_message?.trim() ||
				(t ? t('ewaCompanion.operationIntentAgenticSession') : 'Mission'),
			subtitle:
				display?.subtitle?.trim() ||
				(t ? missionDisplayStatusLabel(state, t) : state),
			status: active ? 'active' : 'completed',
			documents,
		});
	}
	return out;
}

export function deriveMissionSurfaceBundles(
	runs: EwaCompanionTaskRun[],
	t?: TFunction<'marketing'>
): MissionSurfaceBundle[] {
	const filtered = sortOperationRuns(filterRunsForOperationsDisplay(runs));
	const progressByRunId = new Map(
		deriveTranscriptProgressItems(filtered, t).map((item) => [item.runId, item])
	);
	const workflowSummaryByRunId = new Map(
		deriveTranscriptWorkflowSummaries(filtered).map((item) => [
			item.runId,
			item,
		])
	);
	const out: MissionSurfaceBundle[] = [];
	for (const run of filtered) {
		const runId = (run.id || '').trim();
		if (!runId) continue;
		const documents = extractAgenticSessionDocuments(run);
		const parsed = isAgenticSessionRun(run)
			? parseAgenticSessionPlanPayload(run)
			: null;
		const agenticDisplay = isAgenticSessionRun(run)
			? agenticSessionDisplaySummary(run, t)
			: null;
		const displayState = parsed
			? parsed.missionDisplayState
			: withAgenticMissionStaleDisplay(
					normalizeCompanionOperationStatus(
						run.status || ''
					) as AgenticMissionDisplayState,
					run
				);
		const workflowSummary = workflowSummaryByRunId.get(runId) ?? null;
		const progress = progressByRunId.get(runId) ?? null;
		const kind = (run.intent_kind || '').trim().toLowerCase();
		const readyTrack = operationReadyTrack(run);
		const readyImage = operationReadyImage(run);
		const readyPresentation = operationReadyPresentation(run);
		const mediaMission =
			isMusicBackgroundIntent(kind) ||
			isImageBackgroundIntent(kind) ||
			isPresentationBackgroundIntent(kind);
		const mediaCompleted = Boolean(
			readyTrack || readyImage || readyPresentation
		);
		const mediaPrimaryResult = readyTrack
			? t
				? t('ewaCompanion.centerMissionMusicReady', {
						defaultValue: 'Готов трек: {{name}}',
						name:
							readyTrack.trackName || t('ewaCompanion.operationTrackUntitled'),
					})
				: `Готов трек: ${readyTrack.trackName}`
			: readyImage
				? t
					? t('ewaCompanion.centerMissionImageReady', {
							defaultValue: 'Готово изображение: {{prompt}}',
							prompt: readyImage.promptPreview,
						})
					: `Готово изображение: ${readyImage.promptPreview}`
				: readyPresentation
					? t
						? t('ewaCompanion.centerMissionPresentationReady', {
								defaultValue: 'Готова презентация: {{title}}',
								title:
									readyPresentation.title ||
									t('ewaCompanion.operationPresentationUntitled'),
							})
						: `Готова презентация: ${readyPresentation.title}`
					: '';
		const mediaNextAction = mediaCompleted
			? t
				? t(
						'ewaCompanion.centerMissionMediaNextAction',
						'Откройте результат или продолжите работу с ним прямо из центра.'
					)
				: 'Откройте результат или продолжите работу с ним прямо из центра.'
			: mediaMission
				? t
					? t(
							'ewaCompanion.centerMissionMediaRunningAction',
							'Кора готовит медиа-результат; прогресс и следующий шаг остаются здесь.'
						)
					: 'Кора готовит медиа-результат; прогресс и следующий шаг остаются здесь.'
				: '';
		const answerSummary =
			parsed?.answerSummary?.trim() ||
			(mediaCompleted ? mediaPrimaryResult : '');
		const primaryResult =
			parsed?.primaryResult?.trim() ||
			mediaPrimaryResult ||
			(mediaMission && progress?.title?.trim() ? progress.title.trim() : '');
		const recommendedNextAction =
			parsed?.recommendedNextAction?.trim() || mediaNextAction;
		const responsibility: MissionSurfaceResponsibility =
			isAgenticSessionRun(run) ||
			isUserActionWorkflowRun(run) ||
			mediaMission ||
			documents.length > 0 ||
			workflowSummary != null
				? 'center'
				: 'rail';
		out.push({
			runId,
			title:
				agenticDisplay?.title?.trim() ||
				progress?.title?.trim() ||
				run.user_message?.trim() ||
				(t ? operationIntentLabel(run, t) : runId),
			subtitle:
				agenticDisplay?.subtitle?.trim() ||
				progress?.subtitle?.trim() ||
				(t ? missionDisplayStatusLabel(displayState, t) : String(displayState)),
			answerSummary,
			primaryResult,
			recommendedNextAction,
			responsibility,
			displayState,
			run,
			documents,
			progress,
			workflowSummary,
			readyTrack,
			readyImage,
			readyPresentation,
		});
	}
	return out;
}

export function derivePrimaryCenterMissionSurface(
	runs: EwaCompanionTaskRun[],
	t?: TFunction<'marketing'>,
	preferredRunId?: string | null
): MissionSurfaceBundle | null {
	const centerBundles = deriveMissionSurfaceBundles(runs, t).filter(
		(item) => item.responsibility === 'center'
	);
	if (centerBundles.length === 0) return null;
	const preferredId = (preferredRunId || '').trim();
	if (preferredId) {
		const preferred = centerBundles.find((item) => item.runId === preferredId);
		if (preferred) return preferred;
	}
	return centerBundles[0] ?? null;
}

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * User-facing labels for operation intent, tools, steps, status, errors, and play prompts.
 *
 * Invariants:
 * - Label helpers stay pure (no I/O); copy comes from i18n keys only.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/readyArtifacts.ts
 */

import type { TFunction } from 'i18next';

import {
	compactAgenticPlanSummaryDisplay,
	isTechnicalAgenticSummary,
} from '@/features/ewa/agentic/agenticObservabilityUi';
import {
	isUserActionWorkflowRun,
	normalizeCompanionOperationStatus,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import {
	isAgenticSessionRun,
	parseAgenticSessionPlanPayload,
} from '@/features/ewa/companionOperations/companionOperationsMissionSurface';
import { runUsesMusicPipelineProgress } from '@/features/ewa/companionOperations/progressUi/musicPipelineProgress';
import type { WorkflowStepVisualState } from '@/features/ewa/companionOperations/progressUi/progressUiTypes';
import { operationReadyTrack } from '@/features/ewa/companionOperations/progressUi/readyArtifacts';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import { getDefaultDesktopAppByComponent } from '@/pages/Desktop/utils/desktopAppRegistry';
import type {
	EwaCompanionTaskRun,
	EwaCompanionTaskStep,
} from '@/services/ewa/ewaCompanionChatApi';

export function operationIntentLabel(
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing'>
): string {
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (kind === 'music_generation_xl_base_background')
		return t('ewaCompanion.operationIntentMusicGenerationCompanion');
	if (kind === 'music_generation_background')
		return t('ewaCompanion.operationIntentMusicGeneration');
	if (kind === 'image_edit_background')
		return t('ewaCompanion.operationIntentImageEdit');
	if (kind === 'image_generation_background')
		return t('ewaCompanion.operationIntentImageGeneration');
	if (kind === 'presentation_generation_background')
		return t('ewaCompanion.operationIntentPresentationGeneration');
	if (kind === 'agentic_session')
		return t('ewaCompanion.operationIntentAgenticSession');
	if (kind === 'action_workflow' && isUserActionWorkflowRun(run)) {
		const plan = run.plan_payload || {};
		const titleRu =
			typeof plan.workflow_title_ru === 'string'
				? plan.workflow_title_ru.trim()
				: '';
		const titleEn =
			typeof plan.workflow_title_en === 'string'
				? plan.workflow_title_en.trim()
				: '';
		return titleRu || titleEn || t('ewaCompanion.operationIntentUserWorkflow');
	}
	if (kind === 'action_workflow' && runUsesMusicPipelineProgress(run))
		return t('ewaCompanion.operationIntentMusicGeneration');
	if (kind === 'music_play_after_generation')
		return t('ewaCompanion.operationIntentMusicPlayback');
	if (kind === 'music_studio_open')
		return t('ewaCompanion.operationIntentMusicStudioOpen');
	if (kind === 'app_open') return t('ewaCompanion.operationIntentAppOpen');
	if (kind === 'theme_set') return t('ewaCompanion.operationIntentThemeSet');
	if (kind === 'doc_create') return t('ewaCompanion.operationIntentDocCreate');
	if (kind === 'doc_insert_file_into_editor')
		return t('ewaCompanion.operationIntentDocInsert');
	if (kind === 'file_rename')
		return t('ewaCompanion.operationIntentFileRename');
	if (kind === 'file_delete')
		return t('ewaCompanion.operationIntentFileDelete');
	return t('ewaCompanion.operationIntentGeneric');
}

/** Friendly label for orchestrator tool ids (turn plan, server actions). */
export function companionToolIdLabel(
	t: TFunction<'marketing'>,
	toolId: string | null | undefined
): string {
	const id = (toolId || '').trim();
	if (!id) return t('ewaCompanion.turnPlanToolUnknown');
	if (id === 'music_generation')
		return t('ewaCompanion.operationIntentMusicGeneration');
	if (id === 'music_generation_xl_base')
		return t('ewaCompanion.operationIntentMusicGenerationCompanion');
	if (id === 'operations_status')
		return t(
			'ewaCompanion.operationIntentOperationsStatus',
			'Статус текущих операций'
		);
	if (id === 'operation_cancel')
		return t('ewaCompanion.operationIntentOperationCancel', 'Отмена операции');
	if (id === 'file_open') return t('ewaCompanion.operationIntentFileOpen');
	if (id === 'image_tool') return t('ewaCompanion.operationIntentImageTool');
	if (id === 'image_generation')
		return t('ewaCompanion.operationIntentImageGeneration');
	if (id === 'presentation_generation')
		return t('ewaCompanion.operationIntentPresentationGeneration');
	if (id === 'music_studio_open')
		return t('ewaCompanion.operationIntentMusicStudioOpen');
	if (id === 'app_open') return t('ewaCompanion.operationIntentAppOpen');
	if (id === 'theme_set') return t('ewaCompanion.operationIntentThemeSet');
	if (id === 'file_create') return t('ewaCompanion.operationIntentDocCreate');
	if (id === 'doc_insert') return t('ewaCompanion.operationIntentDocInsert');
	if (id === 'file_rename') return t('ewaCompanion.operationIntentFileRename');
	if (id === 'file_delete') return t('ewaCompanion.operationIntentFileDelete');
	return t('ewaCompanion.operationIntentGeneric');
}

const WORKFLOW_STEP_KIND_LABEL_KEYS: Record<string, string> = {
	image_generation: 'workflowStepImage',
	music_generation: 'workflowStepMusic',
	music_generation_xl_base: 'workflowStepMusic',
	presentation_generation: 'workflowStepPresentation',
	presentation_generation_pipeline: 'workflowStepPresentation',
	file_create: 'workflowStepFileCreate',
	catalog_list: 'workflowStepCatalogList',
	file_delete: 'workflowStepFileDelete',
};

export function workflowStepToolKind(step: EwaCompanionTaskStep): string {
	const inp = step.input_payload;
	if (inp && typeof inp === 'object') {
		const tool = (inp as Record<string, unknown>).tool_name;
		if (typeof tool === 'string' && tool.trim())
			return tool.trim().toLowerCase();
	}
	return (step.step_kind || '').trim().toLowerCase();
}

export function resolveWorkflowStepKindLabel(
	step: EwaCompanionTaskStep,
	t: TFunction<'marketing'>
): string {
	const title = (step.title || '').trim();
	if (title) return title;
	const kind = workflowStepToolKind(step);
	const key = WORKFLOW_STEP_KIND_LABEL_KEYS[kind];
	if (key) return t(`ewaCompanion.${key}`);
	return operationStepDisplayTitle(step, t);
}

export function workflowStepVisualState(
	step: EwaCompanionTaskStep
): WorkflowStepVisualState {
	const st = (step.status || '').trim().toLowerCase();
	if (st === 'completed') return 'completed';
	if (st === 'failed') return 'failed';
	if (st === 'cancelled') return 'cancelled';
	if (
		st === 'running' ||
		st === 'in_progress' ||
		st === 'awaiting_confirmation'
	) {
		return 'running';
	}
	return 'pending';
}

const MUSIC_WIZARD_STEP_LABEL_KEYS: Record<string, string> = {
	lyrics: 'operationStepLyrics',
	'suggest-production-params': 'operationStepSuggestParams',
	'generate-style': 'operationStepGenerateStyle',
	generate: 'operationStepGenerateTrack',
	music_generation_pipeline_v2: 'operationStepMusicPipeline',
	music_generation_pipeline_xl_base: 'operationStepMusicPipeline',
};

export function operationStepDisplayTitle(
	step: EwaCompanionTaskStep,
	t: TFunction<'marketing'>
): string {
	const title = (step.title || '').trim();
	if (title) return title;
	const kind = (step.step_kind || '').trim().toLowerCase();
	const key = MUSIC_WIZARD_STEP_LABEL_KEYS[kind];
	if (key) return t(`ewaCompanion.${key}`);
	return t('ewaCompanion.operationStepGeneric');
}

export function operationStepStatusLabel(
	statusValue: string,
	t: TFunction<'marketing'>
): string | null {
	const st = (statusValue || '').trim().toLowerCase();
	if (!st) return null;
	if (st === 'running' || st === 'in_progress')
		return t('ewaCompanion.operationStepStatusRunning');
	if (st === 'completed') return t('ewaCompanion.operationStepStatusCompleted');
	if (st === 'failed') return t('ewaCompanion.operationStepStatusFailed');
	if (st === 'pending') return t('ewaCompanion.operationStepStatusPending');
	if (st === 'cancelled') return t('ewaCompanion.operationStepStatusCancelled');
	return null;
}

function looksLikeUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value.trim()
	);
}

function sanitizeOperationErrorMessage(raw: string): string {
	const message = (raw || '').trim();
	if (!message) return '';
	if (looksLikeUuid(message)) return '';
	if (
		/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(message) &&
		message.includes('-')
	) {
		return '';
	}
	return message.length > 160 ? `${message.slice(0, 157)}…` : message;
}

export function operationStatusLabel(
	statusValue: string,
	t: TFunction<'marketing'>
): string {
	const st = normalizeCompanionOperationStatus(statusValue);
	if (st === 'running') return t('ewaCompanion.operationStatusRunning');
	if (st === 'awaiting_confirmation')
		return t('ewaCompanion.operationStatusAwaitingConfirmation');
	if (st === 'completed') return t('ewaCompanion.operationStatusCompleted');
	if (st === 'failed') return t('ewaCompanion.operationStatusFailed');
	if (st === 'cancelled') return t('ewaCompanion.operationStatusCancelled');
	return t('ewaCompanion.operationStatusPending');
}

export function operationTimeLabel(
	run: EwaCompanionTaskRun,
	ru: boolean
): string | null {
	const iso = run.completed_at || run.updated_at || run.created_at;
	if (!iso) return null;
	const ms = Date.parse(iso);
	if (!Number.isFinite(ms)) return null;
	try {
		return new Intl.DateTimeFormat(ru ? 'ru-RU' : 'en-US', {
			hour: '2-digit',
			minute: '2-digit',
		}).format(ms);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_operations_time_label',
			'Intl.DateTimeFormat for operation time failed',
			err
		);
		return null;
	}
}

export function appDisplayName(component: string): string {
	const item = getDefaultDesktopAppByComponent(component);
	if (item?.name) return item.name;
	return component;
}

export function operationDetailLabel(
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing'>
): string | null {
	const kind = (run.intent_kind || '').trim().toLowerCase();
	const plan = run.plan_payload || {};
	const result = run.result_payload || {};
	if (kind === 'theme_set') {
		const rawTheme =
			typeof result.theme === 'string'
				? result.theme
				: typeof plan.theme === 'string'
					? plan.theme
					: '';
		const theme = rawTheme.trim();
		if (!theme) return null;
		return t('ewaCompanion.operationDetailTheme', { theme });
	}
	if (kind === 'app_open' || kind === 'music_studio_open') {
		const rawApp =
			typeof result.app_component === 'string'
				? result.app_component
				: typeof plan.app_component === 'string'
					? plan.app_component
					: '';
		const appComponent = rawApp.trim();
		if (!appComponent) return null;
		return t('ewaCompanion.operationDetailApp', {
			app: appDisplayName(appComponent),
		});
	}
	if (
		kind === 'image_generation_background' ||
		kind === 'image_edit_background'
	) {
		const prompt =
			typeof result.prompt_preview === 'string'
				? result.prompt_preview.trim()
				: typeof plan.prompt_preview === 'string'
					? plan.prompt_preview.trim()
					: '';
		if (!prompt) return null;
		return t(
			kind === 'image_edit_background'
				? 'ewaCompanion.operationDetailImageEditPrompt'
				: 'ewaCompanion.operationDetailImagePrompt',
			{ prompt }
		);
	}
	if (kind === 'presentation_generation_background') {
		const title =
			typeof result.title === 'string' && result.title.trim()
				? result.title.trim()
				: typeof plan.title === 'string'
					? plan.title.trim()
					: '';
		const slides =
			typeof result.slides_count === 'number'
				? result.slides_count
				: typeof result.num_slides === 'number'
					? result.num_slides
					: typeof plan.num_slides === 'number'
						? plan.num_slides
						: null;
		if (!title && !slides) return null;
		return t('ewaCompanion.operationDetailPresentation', {
			title: title || t('ewaCompanion.operationPresentationUntitled'),
			count: slides ?? 0,
		});
	}
	return null;
}

export function operationErrorLabel(
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing'>
): string | null {
	const runFailed = (run.status || '').trim().toLowerCase() === 'failed';
	if (!runFailed) {
		return null;
	}
	const ep = run.error_payload || {};
	let message =
		typeof ep.message === 'string' && ep.message.trim()
			? ep.message.trim()
			: typeof ep.stage === 'string' && ep.stage.trim()
				? ep.stage.trim()
				: '';
	if (!message && isAgenticSessionRun(run)) {
		const plan = parseAgenticSessionPlanPayload(run);
		if (plan?.planSummary && isTechnicalAgenticSummary(plan.planSummary)) {
			message = compactAgenticPlanSummaryDisplay(plan.planSummary, t);
		}
	}
	if (
		message &&
		isAgenticSessionRun(run) &&
		isTechnicalAgenticSummary(message)
	) {
		message = compactAgenticPlanSummaryDisplay(message, t);
	}
	const friendly = sanitizeOperationErrorMessage(message);
	if (!friendly) return t('ewaCompanion.operationErrorGeneric');
	return t('ewaCompanion.operationErrorDetail', { message: friendly });
}

export function operationPlayPrompt(
	run: EwaCompanionTaskRun,
	t: TFunction<'marketing'>
): string | null {
	const ready = operationReadyTrack(run);
	if (!ready) return null;
	const name =
		ready.trackName.trim() || t('ewaCompanion.operationTrackUntitled');
	return t('ewaCompanion.operationPlayPrompt', { name });
}

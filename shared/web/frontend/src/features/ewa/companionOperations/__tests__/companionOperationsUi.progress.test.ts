/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for transcript progress derived from durable operation runs.
 *
 * Invariants:
 * - Tests cover pure helper contracts without browser/network side effects.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	agenticProgressFromRun,
	agenticSessionDisplaySummary,
	dedupeActiveUserWorkflowRuns,
	deriveAgenticMissionSummaryItems,
	derivePrimaryCenterMissionSurface,
	deriveTranscriptProgressItems,
	deriveTranscriptWorkflowSummaries,
	extractAgenticSessionDocuments,
	extractWorkflowStepArtifacts,
	filterRunsForOperationsDisplay,
	isAgenticMissionHeartbeatStale,
	isAgenticSessionRun,
	isOperationRunCancellable,
	isWorkflowChildRun,
	mergePolledOperationRuns,
	mergeTaskStepIntoOperationRuns,
	normalizeCompanionOperationStatus,
	operationIntentLabel,
	operationErrorLabel,
	operationPresentationSummary,
	operationReadyImage,
	operationReadyPresentation,
	operationReadyTrack,
	parseAgenticSessionPlanPayload,
	resolveAgenticMissionDisplayState,
	resolveOperationEffectiveDisplayState,
	resolveWorkflowStepKindLabel,
	runUsesMusicPipelineProgress,
	isOperationTruthfullyLive,
	withAgenticMissionStaleDisplay,
	workflowStepVisualState,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

describe('companionOperationsUi transcript progress', () => {
	it('normalizes backend and SSE operation status aliases for UI', () => {
		expect(normalizeCompanionOperationStatus('queued')).toBe('pending');
		expect(normalizeCompanionOperationStatus('in_progress')).toBe('running');
		expect(normalizeCompanionOperationStatus('processing')).toBe('running');
		expect(normalizeCompanionOperationStatus('success')).toBe('completed');
		expect(normalizeCompanionOperationStatus('errored')).toBe('failed');
		expect(normalizeCompanionOperationStatus('canceled')).toBe('cancelled');
	});

	it('derives music progress from active run steps', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-1',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_background',
				user_message: 'сделай песню',
				plan_payload: { theme_preview: 'Лето' },
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
				steps: [
					{
						id: 's1',
						run_id: 'run-1',
						step_index: 2,
						step_kind: 'generate-style',
						status: 'in_progress',
						title: 'Генерация стиля',
						input_payload: {},
						output_payload: {},
						error_payload: {},
						created_at: null,
						updated_at: null,
						completed_at: null,
					},
				],
			},
		];
		const items = deriveTranscriptProgressItems(runs);
		expect(items).toHaveLength(1);
		expect(items[0]?.current).toBe(2);
		expect(items[0]?.total).toBe(4);
		expect(items[0]?.title).toContain('Генерация стиля');
	});

	it('derives music progress for action_workflow music full cycle', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-wf',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'action_workflow',
				user_message: 'сгенерируй песню и включи её',
				plan_payload: { workflow_id: 'music_full_cycle_v1' },
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
				music_pipeline_progress: {
					current: 3,
					total: 4,
					title: 'Генерация стиля',
				},
			},
		];
		const items = deriveTranscriptProgressItems(runs);
		expect(items).toHaveLength(1);
		expect(items[0]?.current).toBe(3);
		expect(items[0]?.total).toBe(4);
		expect(items[0]?.intentKind).toBe('action_workflow');
	});

	it('keeps multiple active runs as separate progress rows', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-m',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_background',
				user_message: 'песня',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
			{
				id: 'run-d',
				principal_id: 'p1',
				status: 'awaiting_confirmation',
				intent_kind: 'doc_create',
				user_message: 'создай док',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		];
		expect(deriveTranscriptProgressItems(runs)).toHaveLength(2);
	});

	it('prefers the focused center mission run over older mission history', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-older',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'agentic_session',
				user_message: 'older mission',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'completed',
					mission_display_state: 'completed',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: '2026-07-07T10:00:00Z',
				updated_at: '2026-07-07T10:00:00Z',
				completed_at: '2026-07-07T10:10:00Z',
			},
			{
				id: 'run-focus',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'agentic_session',
				user_message: 'focused mission',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-2',
					session_status: 'executing',
					mission_display_state: 'running',
					mission_answer_summary: 'Полный ответ миссии.',
					primary_result: 'Главный результат миссии.',
					recommended_next_action: 'Откройте результат.',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: '2026-07-07T11:00:00Z',
				updated_at: '2026-07-07T11:05:00Z',
				completed_at: null,
			},
		];

		const picked = derivePrimaryCenterMissionSurface(
			runs,
			undefined,
			'run-focus'
		);

		expect(picked?.runId).toBe('run-focus');
		expect(picked?.responsibility).toBe('center');
		expect(picked?.title).toBe('focused mission');
		expect(picked?.answerSummary).toBe('Полный ответ миссии.');
		expect(picked?.primaryResult).toBe('Главный результат миссии.');
		expect(picked?.recommendedNextAction).toBe('Откройте результат.');
	});

	it('promotes ready media runs to the center mission surface', () => {
		const picked = derivePrimaryCenterMissionSurface([
			{
				id: 'run-track',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'music_generation_background',
				user_message: 'сделай песню',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {
					unified_content_id: 'track-1',
					track_name: 'Neon Dawn',
				},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: '2026-07-07T11:00:00Z',
				updated_at: '2026-07-07T11:05:00Z',
				completed_at: '2026-07-07T11:05:00Z',
			},
		]);

		expect(picked?.responsibility).toBe('center');
		expect(picked?.primaryResult).toContain('Neon Dawn');
		expect(picked?.readyTrack?.unifiedContentId).toBe('track-1');
		expect(picked?.recommendedNextAction).toContain('Откройте результат');
	});

	it('mergeTaskStepIntoOperationRuns patches matching run', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-1',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_background',
				user_message: '',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		];
		const merged = mergeTaskStepIntoOperationRuns(runs, {
			run_id: 'run-1',
			step_index: 3,
			step_kind: 'generate',
			status: 'in_progress',
			title: 'Генерация трека',
			progress: { current: 3, total: 4 },
		});
		expect(merged[0]?.steps?.[0]?.title).toBe('Генерация трека');
		expect(merged[0]?.music_pipeline_progress).toEqual({
			current: 3,
			total: 4,
			title: 'Генерация трека',
		});
	});

	it('mergePolledOperationRuns preserves SSE music sub-stages when poll returns coarse DB step', () => {
		const prev: EwaCompanionTaskRun[] = [
			{
				id: 'run-m',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_background',
				user_message: 'песня',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
				music_pipeline_progress: {
					current: 3,
					total: 4,
					title: 'Генерация стиля',
				},
				steps: [
					{
						id: 'w3',
						run_id: 'run-m',
						step_index: 3,
						step_kind: 'generate-style',
						status: 'in_progress',
						title: 'Генерация стиля',
						input_payload: {},
						output_payload: {},
						error_payload: {},
						created_at: null,
						updated_at: null,
						completed_at: null,
					},
				],
			},
		];
		const polled: EwaCompanionTaskRun[] = [
			{
				id: 'run-m',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_background',
				user_message: 'песня',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
				steps: [
					{
						id: 'db1',
						run_id: 'run-m',
						step_index: 1,
						step_kind: 'music_generation_pipeline_v2',
						status: 'running',
						title: 'Пайплайн',
						input_payload: {},
						output_payload: {},
						error_payload: {},
						created_at: null,
						updated_at: null,
						completed_at: null,
					},
				],
			},
		];
		const merged = mergePolledOperationRuns(prev, polled);
		expect(merged[0]?.music_pipeline_progress?.current).toBe(3);
		expect(
			merged[0]?.steps?.some((s) => s.step_kind === 'generate-style')
		).toBe(true);
	});

	it('runUsesMusicPipelineProgress includes xl_base background intent', () => {
		expect(
			runUsesMusicPipelineProgress({
				id: 'run-xl',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_xl_base_background',
				user_message: '',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			})
		).toBe(true);
	});

	it('operationReadyImage resolves preview from content_id without image_url', () => {
		const ready = operationReadyImage({
			id: 'run-img-done',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'image_generation_background',
			user_message: 'нарисуй океан',
			plan_payload: { prompt_preview: 'океан' },
			confirmation_state: {},
			result_payload: {
				content_id: '04881699-0d6b-421f-a68d-ed1ad9a7930b',
				prompt_preview: 'картинку океанов',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-24T08:12:49.384241+00:00',
		});
		expect(ready?.previewUrl).toBe(
			'/api/v1/content/04881699-0d6b-421f-a68d-ed1ad9a7930b/download'
		);
		expect(ready?.unifiedContentId).toBe(
			'04881699-0d6b-421f-a68d-ed1ad9a7930b'
		);
		expect(ready?.mode).toBe('generate');
		expect(ready?.sourceUnifiedContentId).toBeNull();
	});

	it('operationReadyImage supports completed image edit runs', () => {
		const ready = operationReadyImage({
			id: 'run-img-edit-done',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'image_edit_background',
			user_message: 'измени изображение',
			plan_payload: { prompt_preview: 'убери фон' },
			confirmation_state: {},
			result_payload: {
				content_id: '14881699-0d6b-421f-a68d-ed1ad9a7930b',
				source_content_id: '24881699-0d6b-421f-a68d-ed1ad9a7930b',
				image_tool_mode: 'edit',
				prompt_preview: 'убери фон',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-24T08:12:49.384241+00:00',
		});
		expect(ready?.mode).toBe('edit');
		expect(ready?.sourceUnifiedContentId).toBe(
			'24881699-0d6b-421f-a68d-ed1ad9a7930b'
		);
		expect(ready?.downloadFilename).toContain('companion-image-edit-');
	});

	it('operationReadyPresentation resolves completed EWRP runs', () => {
		const ready = operationReadyPresentation({
			id: 'run-prs-done',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'presentation_generation_background',
			user_message: 'создай презентацию',
			plan_payload: { title: 'AI strategy', num_slides: 8 },
			confirmation_state: {},
			result_payload: {
				ewrp_job_id: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
				title: 'AI strategy',
				topic: 'AI strategy for sales',
				slides_count: 8,
				presentation_theme: 'aurora',
				pdf_download_token: 'token-1',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-28T00:00:00Z',
		});
		expect(ready?.jobId).toBe('34881699-0d6b-421f-a68d-ed1ad9a7930b');
		expect(ready?.slidesCount).toBe(8);
		expect(ready?.pdfDownloadToken).toBe('token-1');
	});

	it('operationPresentationSummary resolves active EWRP progress from plan and steps', () => {
		const summary = operationPresentationSummary({
			id: 'run-prs-active',
			principal_id: 'p1',
			status: 'running',
			intent_kind: 'presentation_generation_background',
			user_message: 'создай презентацию',
			plan_payload: {
				title: 'AI strategy',
				topic_preview: 'AI strategy for sales',
				num_slides: 8,
				presentation_theme: 'aurora',
			},
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: null,
			steps: [
				{
					id: 'step-prs',
					run_id: 'run-prs-active',
					step_index: 1,
					step_kind: 'presentation_generation_pipeline',
					status: 'running',
					title: 'EWRP',
					input_payload: {},
					output_payload: {
						ewrp_job_id: '44881699-0d6b-421f-a68d-ed1ad9a7930b',
						progress: 41,
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
			],
		});
		expect(summary?.jobId).toBe('44881699-0d6b-421f-a68d-ed1ad9a7930b');
		expect(summary?.ready).toBe(false);
		expect(summary?.progress).toBe(41);
		expect(summary?.presentationTheme).toBe('aurora');
	});

	it('derives transcript progress for active EWRP presentation runs', () => {
		const now = Date.parse('2026-07-09T08:00:00.000Z');
		const items = deriveTranscriptProgressItems(
			[
				{
					id: 'run-prs-active',
					principal_id: 'p1',
					status: 'running',
					intent_kind: 'presentation_generation_background',
					user_message: 'создай презентацию',
					plan_payload: {
						title: 'Sales deck',
						topic_preview: 'Sales deck for Q3',
						num_slides: 6,
					},
					confirmation_state: {},
					result_payload: {},
					error_payload: {},
					execution_mode: 'async',
					run_revision: 1,
					created_at: '2026-07-09T07:59:00.000Z',
					updated_at: '2026-07-09T07:59:30.000Z',
					completed_at: null,
					steps: [
						{
							id: 'step-prs',
							run_id: 'run-prs-active',
							step_index: 1,
							step_kind: 'presentation_generation_pipeline',
							status: 'running',
							title: 'EWRP',
							input_payload: {},
							output_payload: {
								ewrp_job_id: '44881699-0d6b-421f-a68d-ed1ad9a7930b',
								progress: 41,
							},
							error_payload: {},
							created_at: '2026-07-09T07:59:00.000Z',
							updated_at: '2026-07-09T07:59:30.000Z',
							completed_at: null,
						},
					],
				},
			],
			undefined,
			{ nowMs: now }
		);

		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			runId: 'run-prs-active',
			intentKind: 'presentation_generation_background',
			title: 'Sales deck',
			current: 41,
			total: 100,
			status: 'active',
		});
	});

	it('operationReadyTrack returns play metadata for completed xl_base run', () => {
		const ready = operationReadyTrack({
			id: 'run-xl-done',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'music_generation_xl_base_background',
			user_message: 'напиши сама текст',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {
				content_id: 'af89cd61-9f15-49ca-a4b5-4efba9d796c7',
				track_name: 'Про нас с тобой',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-23T11:49:30.589845+00:00',
		});
		expect(ready).toEqual({
			unifiedContentId: 'af89cd61-9f15-49ca-a4b5-4efba9d796c7',
			trackName: 'Про нас с тобой',
			thumbnailUrl: null,
		});
	});

	it('filters child workflow tool runs from transcript progress', () => {
		const parent: EwaCompanionTaskRun = {
			id: 'run-parent',
			principal_id: 'p1',
			status: 'running',
			intent_kind: 'action_workflow',
			user_message: 'делаем дела',
			plan_payload: {
				user_workflow_id: 'uw-1',
				workflow_title_ru: 'делаем дела',
			},
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: null,
			steps: [
				{
					id: 's1',
					run_id: 'run-parent',
					step_index: 1,
					step_kind: 'image_generation',
					status: 'running',
					title: 'Картинка',
					input_payload: {},
					output_payload: {},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
				{
					id: 's2',
					run_id: 'run-parent',
					step_index: 2,
					step_kind: 'music_generation',
					status: 'pending',
					title: 'Песня',
					input_payload: {},
					output_payload: {},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
			],
		};
		const child: EwaCompanionTaskRun = {
			id: 'run-child',
			principal_id: 'p1',
			status: 'running',
			intent_kind: 'music_generation_background',
			user_message: 'делаем дела',
			plan_payload: { workflow_parent_run_id: 'run-parent' },
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: null,
		};
		expect(isWorkflowChildRun(child)).toBe(true);
		expect(filterRunsForOperationsDisplay([parent, child])).toHaveLength(1);
		const items = deriveTranscriptProgressItems([parent, child]);
		expect(items).toHaveLength(1);
		expect(items[0]?.intentKind).toBe('user_action_workflow');
		expect(items[0]?.current).toBe(1);
		expect(items[0]?.total).toBe(2);
		expect(items[0]?.steps).toHaveLength(2);
	});

	it('treats parent_run_id column as workflow child without plan mirror', () => {
		const child: EwaCompanionTaskRun = {
			id: 'run-child-col',
			principal_id: 'p1',
			status: 'running',
			intent_kind: 'music_generation_background',
			user_message: 'child',
			parent_run_id: 'run-parent',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: null,
		};
		expect(isWorkflowChildRun(child)).toBe(true);
	});

	it('hides doc_create child when agentic session gate references companion_pending_task_run_id', () => {
		const agentic: EwaCompanionTaskRun = {
			id: 'run-agentic',
			principal_id: 'p1',
			status: 'awaiting_confirmation',
			intent_kind: 'agentic_session',
			user_message: 'миссия',
			plan_payload: {
				kind: 'agentic_session_v1',
				agentic_session_id: 'sess-1',
			},
			confirmation_state: {
				state: 'confirming',
				gate: {
					kind: 'confirm',
					prompt: 'нужен ответ',
					pending_tool: 'file_create',
					companion_pending_task_run_id: 'doc-run-nested',
				},
			},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 3,
			created_at: null,
			updated_at: null,
			completed_at: null,
		};
		const docCreate: EwaCompanionTaskRun = {
			id: 'doc-run-nested',
			principal_id: 'p1',
			status: 'awaiting_confirmation',
			intent_kind: 'doc_create',
			user_message: 'Создай Дорожную карту',
			plan_payload: { kind: 'doc_create', name: 'roadmap.md' },
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: null,
		};
		const visible = filterRunsForOperationsDisplay([agentic, docCreate]);
		expect(visible).toHaveLength(1);
		expect(visible[0]?.id).toBe('run-agentic');
	});

	it('dedupes active user workflow runs with same trigger', () => {
		const base = {
			principal_id: 'p1',
			status: 'running' as const,
			intent_kind: 'action_workflow',
			user_message: 'делаем дела',
			plan_payload: {
				user_workflow_id: 'uw-1',
				workflow_title_ru: 'делаем дела',
			},
			confirmation_state: {},
			result_payload: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: '2026-05-25T05:58:00.000Z',
			completed_at: null,
		};
		const older: EwaCompanionTaskRun = { ...base, id: 'run-old' };
		const newer: EwaCompanionTaskRun = {
			...base,
			id: 'run-new',
			updated_at: '2026-05-25T05:58:30.000Z',
		};
		expect(dedupeActiveUserWorkflowRuns([older, newer])).toEqual([newer]);
		expect(deriveTranscriptProgressItems([older, newer])).toHaveLength(1);
	});

	it('derives music progress for xl_base active run', () => {
		const runs: EwaCompanionTaskRun[] = [
			{
				id: 'run-xl',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'music_generation_xl_base_background',
				user_message: 'по своему настроению',
				plan_payload: { theme_preview: 'вечер' },
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
				steps: [
					{
						id: 's1',
						run_id: 'run-xl',
						step_index: 2,
						step_kind: 'generate-style',
						status: 'in_progress',
						title: 'Генерация стиля',
						input_payload: {},
						output_payload: {},
						error_payload: {},
						created_at: null,
						updated_at: null,
						completed_at: null,
					},
				],
			},
		];
		const items = deriveTranscriptProgressItems(runs);
		expect(items).toHaveLength(1);
		expect(items[0]?.intentKind).toBe('music_generation_xl_base_background');
		expect(items[0]?.current).toBe(2);
	});

	it('workflowStepVisualState maps running and completed', () => {
		expect(
			workflowStepVisualState({
				id: 's',
				run_id: 'r',
				step_index: 1,
				step_kind: 'image_generation',
				status: 'completed',
				title: '',
				input_payload: {},
				output_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			})
		).toBe('completed');
		expect(
			workflowStepVisualState({
				id: 's2',
				run_id: 'r',
				step_index: 2,
				step_kind: 'music_generation_xl_base',
				status: 'running',
				title: '',
				input_payload: { tool_name: 'music_generation_xl_base' },
				output_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			})
		).toBe('running');
	});

	it('resolveWorkflowStepKindLabel prefers tool_name mapping', () => {
		const t = ((key: string) => {
			const map: Record<string, string> = {
				'ewaCompanion.workflowStepMusic': 'Музыка',
			};
			return map[key] ?? key;
		}) as never;
		expect(
			resolveWorkflowStepKindLabel(
				{
					id: 's',
					run_id: 'r',
					step_index: 2,
					step_kind: 'music_generation_xl_base',
					status: 'running',
					title: '',
					input_payload: { tool_name: 'music_generation_xl_base' },
					output_payload: {},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
				t
			)
		).toBe('Музыка');
	});

	it('extractWorkflowStepArtifacts collects image music and catalog from steps', () => {
		const run: EwaCompanionTaskRun = {
			id: 'wf-1',
			principal_id: 'p',
			status: 'completed',
			intent_kind: 'action_workflow',
			user_message: 'делаем дела',
			plan_payload: {
				user_workflow_id: 'uw-1',
				workflow_title_ru: 'делаем дела',
			},
			result_payload: {},
			error_payload: {},
			confirmation_state: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
			steps: [
				{
					id: 's1',
					run_id: 'wf-1',
					step_index: 1,
					step_kind: 'image_generation',
					status: 'completed',
					title: 'image',
					input_payload: { tool_name: 'image_generation' },
					output_payload: {
						content_id: 'img-1',
						prompt_preview: 'sunset',
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
				{
					id: 's2',
					run_id: 'wf-1',
					step_index: 2,
					step_kind: 'music_generation_xl_base',
					status: 'completed',
					title: 'music',
					input_payload: { tool_name: 'music_generation_xl_base' },
					output_payload: {
						content_id: 'track-1',
						track_name: 'Наш трек',
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
				{
					id: 's5',
					run_id: 'wf-1',
					step_index: 5,
					step_kind: 'catalog_list',
					status: 'completed',
					title: 'catalog',
					input_payload: { tool_name: 'catalog_list' },
					output_payload: {
						row_count: 2,
						catalog_appendix:
							'---\n**Catalog:**\n- notes.md `uc=aaa`\n- plan.md `uc=bbb`',
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
			],
		};
		const artifacts = extractWorkflowStepArtifacts(run);
		expect(artifacts).toHaveLength(3);
		expect(artifacts[0]?.kind).toBe('image');
		expect(artifacts[1]?.kind).toBe('music');
		if (artifacts[1]?.kind === 'music') {
			expect(artifacts[1].trackName).toBe('Наш трек');
		}
		expect(artifacts[2]?.kind).toBe('catalog');
		if (artifacts[2]?.kind === 'catalog') {
			expect(artifacts[2].fileNames).toEqual(['notes.md', 'plan.md']);
		}
		const summaries = deriveTranscriptWorkflowSummaries([run]);
		expect(summaries).toHaveLength(1);
		expect(summaries[0]?.title).toBe('делаем дела');
		expect(summaries[0]?.artifacts).toHaveLength(3);
	});

	it('shows transcript summary for text-only completed workflows', () => {
		const run: EwaCompanionTaskRun = {
			id: 'wf-text',
			principal_id: 'p',
			status: 'completed',
			intent_kind: 'action_workflow',
			user_message: 'смыслы',
			plan_payload: {
				user_workflow_id: 'uw-2',
				workflow_title_ru: 'Смыслы',
			},
			result_payload: {},
			error_payload: {},
			confirmation_state: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			completed_at: new Date().toISOString(),
			steps: [
				{
					id: 's1',
					run_id: 'wf-text',
					step_index: 1,
					step_kind: 'tool_dispatch',
					status: 'completed',
					title: 'Обсуждение',
					input_payload: { tool_name: 'catalog_discuss' },
					output_payload: {
						tool_name: 'catalog_discuss',
						status: 'memory_append',
						reply: 'Краткий разбор файла для сценария.',
						data: {
							memory_section_append: 'Краткий разбор файла для сценария.',
						},
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
				{
					id: 's2',
					run_id: 'wf-text',
					step_index: 2,
					step_kind: 'tool_dispatch',
					status: 'completed',
					title: 'Пост',
					input_payload: { tool_name: 'social_post_compose' },
					output_payload: {
						tool_name: 'social_post_compose',
						status: 'ok',
						reply:
							'**Готовый пост** — можно копировать:\n\nТекст поста для соцсетей.',
						data: { channel: 'generic' },
					},
					error_payload: {},
					created_at: null,
					updated_at: null,
					completed_at: null,
				},
			],
		};
		const artifacts = extractWorkflowStepArtifacts(run);
		expect(artifacts).toHaveLength(2);
		expect(artifacts.every((a) => a.kind === 'text')).toBe(true);
		const summaries = deriveTranscriptWorkflowSummaries([run]);
		expect(summaries).toHaveLength(1);
		expect(summaries[0]?.stepResults).toHaveLength(2);
	});
});

describe('companionOperationsUi agentic_session plan_payload', () => {
	const agenticRun = (
		overrides: Partial<EwaCompanionTaskRun> = {}
	): EwaCompanionTaskRun => ({
		id: 'run-agentic-1',
		principal_id: 'p1',
		status: 'running',
		intent_kind: 'agentic_session',
		user_message: 'Research quantum computing in my catalog',
		plan_payload: {
			agentic_session_id: 'sess-abc-123',
			kind: 'agentic_session_v1',
			session_status: 'executing',
			plan_summary: 'Searching catalog for quantum references.',
			goal: { text: 'Research quantum computing in my catalog' },
		},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 2,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		completed_at: null,
		...overrides,
	});

	it('isAgenticSessionRun identifies agentic_session intent', () => {
		expect(isAgenticSessionRun(agenticRun())).toBe(true);
		expect(
			isAgenticSessionRun({
				...agenticRun(),
				intent_kind: 'music_generation_background',
			})
		).toBe(false);
	});

	it('isOperationRunCancellable includes active agentic_session runs', () => {
		expect(isOperationRunCancellable(agenticRun({ status: 'running' }))).toBe(
			true
		);
		expect(isOperationRunCancellable(agenticRun({ status: 'completed' }))).toBe(
			false
		);
	});

	it('parseAgenticSessionPlanPayload reads agentic_session_v1 contract fields', () => {
		const parsed = parseAgenticSessionPlanPayload(agenticRun());
		expect(parsed).toEqual({
			agenticSessionId: 'sess-abc-123',
			kind: 'agentic_session_v1',
			sessionStatus: 'executing',
			missionDisplayState: 'running',
			planSummary: 'Searching catalog for quantum references.',
			answerSummary: '',
			primaryResult: '',
			recommendedNextAction: '',
			goalText: 'Research quantum computing in my catalog',
		});
	});

	it('resolveAgenticMissionDisplayState keeps paused and replanning explicit', () => {
		expect(resolveAgenticMissionDisplayState('running', 'paused')).toBe(
			'paused'
		);
		expect(resolveAgenticMissionDisplayState('running', 'replanning')).toBe(
			'replanning'
		);
		expect(
			resolveAgenticMissionDisplayState(
				'running',
				'executing',
				'awaiting_confirmation'
			)
		).toBe('awaiting_confirmation');
	});

	it('parseAgenticSessionPlanPayload rejects missing agentic_session_id', () => {
		expect(
			parseAgenticSessionPlanPayload(
				agenticRun({ plan_payload: { kind: 'agentic_session_v1' } })
			)
		).toBeNull();
	});

	it('agenticSessionDisplaySummary uses plan_summary as title when present', () => {
		const t = ((key: string) => key) as never;
		expect(agenticSessionDisplaySummary(agenticRun(), t)).toEqual({
			title: 'Searching catalog for quantum references.',
			subtitle: 'Research quantum computing in my catalog',
			sessionStatus: 'executing',
		});
	});

	it('operationIntentLabel maps agentic_session to i18n key', () => {
		const t = ((key: string) => key) as never;
		expect(operationIntentLabel(agenticRun(), t)).toBe(
			'ewaCompanion.operationIntentAgenticSession'
		);
	});

	it('deriveTranscriptProgressItems includes active agentic session runs', () => {
		const t = ((key: string) => key) as never;
		const items = deriveTranscriptProgressItems([agenticRun()], t);
		expect(items).toHaveLength(1);
		expect(items[0]?.intentKind).toBe('agentic_session');
		expect(items[0]?.title).toContain('Searching catalog');
	});

	it('deriveTranscriptProgressItems uses goal title when agentic plan_summary is technical', () => {
		const t = ((key: string, _opts?: { name?: string; detail?: string }) => {
			if (key === 'ewaCompanion.operationIntentAgenticSession') {
				return 'Агентная сессия';
			}
			if (key === 'ewaCompanion.agenticNodeStatusRunning') return 'выполняется';
			return key;
		}) as never;
		const run = agenticRun({
			user_message: 'Подготовь стратегию для ДВФУ',
			plan_payload: {
				agentic_session_id: 'sess-abc-123',
				kind: 'agentic_session_v1',
				session_status: 'executing',
				plan_summary:
					"[tool_error] tool_act_error:invalid unified_content_id: 'ДВФУ.txt' [think_error] schema_validation_failed:missing",
				goal: { text: 'Подготовь стратегию для ДВФУ' },
			},
		});
		const items = deriveTranscriptProgressItems([run], t);
		expect(items[0]?.title).toBe('Подготовь стратегию для ДВФУ');
		expect(items[0]?.title).not.toContain('[tool_error]');
		expect(items[0]?.subtitle).toBeTruthy();
	});

	it('agenticProgressFromRun exposes phase and step subtitle', () => {
		const t = ((key: string) => key) as never;
		const run = agenticRun({
			plan_payload: {
				agentic_session_id: 'sess-abc-123',
				kind: 'agentic_session_v1',
				session_status: 'replanning',
				goal: { text: 'Подготовь документ' },
			},
			steps: [
				{
					id: 's1',
					run_id: 'run-agentic-1',
					step_index: 1,
					step_kind: 'plan',
					title: 'Сценарий',
					status: 'running',
					input_payload: {},
					output_payload: {},
					error_payload: {},
				},
			],
		});
		const prog = agenticProgressFromRun(run, t);
		expect(prog.subtitle).toContain('Сценарий');
		expect(prog.total).toBeGreaterThanOrEqual(1);
	});

	it('operationErrorLabel stays null while agentic run is still active', () => {
		const t = ((key: string, opts?: { message?: string }) =>
			opts?.message ?? key) as never;
		const run = agenticRun({
			status: 'running',
			plan_payload: {
				agentic_session_id: 'sess-abc-123',
				kind: 'agentic_session_v1',
				session_status: 'replanning',
				plan_summary:
					'Инструмент «catalog_discuss» не вернул результат — шаг пропущен.',
			},
		});
		expect(operationErrorLabel(run, t)).toBeNull();
	});

	it('extractAgenticSessionDocuments reads mirrored created_documents', () => {
		const run = agenticRun({
			plan_payload: {
				agentic_session_id: 'sess-abc-123',
				kind: 'agentic_session_v1',
				session_status: 'completed',
				created_documents: [
					{ unified_content_id: 'uc-1', name: 'правила.txt' },
					{ unified_content_id: 'uc-1', name: 'dup' },
					{ unifiedContentId: 'uc-2', name: 'roadmap.md' },
				],
			},
		});
		expect(extractAgenticSessionDocuments(run)).toEqual([
			{ unifiedContentId: 'uc-1', name: 'правила.txt' },
			{ unifiedContentId: 'uc-2', name: 'roadmap.md' },
		]);
		expect(
			extractAgenticSessionDocuments({ ...run, intent_kind: 'doc_create' })
		).toEqual([]);
		expect(extractAgenticSessionDocuments(undefined)).toEqual([]);
		expect(extractAgenticSessionDocuments(null)).toEqual([]);
	});

	it('deriveAgenticMissionSummaryItems keeps created documents visible in transcript', () => {
		const t = ((key: string) => key) as never;
		const run = agenticRun({
			status: 'completed',
			plan_payload: {
				agentic_session_id: 'sess-abc-123',
				kind: 'agentic_session_v1',
				session_status: 'completed',
				mission_display_state: 'completed',
				plan_summary: 'Готов пакет документов',
				created_documents: [
					{ unified_content_id: 'uc-1', name: 'правила.txt' },
					{ unified_content_id: 'uc-2', name: 'roadmap.md' },
				],
			},
		});
		expect(deriveAgenticMissionSummaryItems([run], t)).toEqual([
			{
				runId: 'run-agentic-1',
				title: 'Готов пакет документов',
				subtitle: 'Research quantum computing in my catalog',
				status: 'completed',
				documents: [
					{ unifiedContentId: 'uc-1', name: 'правила.txt' },
					{ unifiedContentId: 'uc-2', name: 'roadmap.md' },
				],
			},
		]);
	});

	it('Gate G4: stale heartbeat flips running mission display to stale', () => {
		const now = Date.parse('2026-07-09T08:00:00.000Z');
		const staleRun = {
			updated_at: '2026-07-09T07:50:00.000Z',
			completed_at: null as string | null,
		};
		expect(isAgenticMissionHeartbeatStale(staleRun, now)).toBe(true);
		expect(withAgenticMissionStaleDisplay('running', staleRun, now)).toBe(
			'stale'
		);

		const freshRun = {
			updated_at: '2026-07-09T07:58:00.000Z',
			completed_at: null as string | null,
		};
		expect(isAgenticMissionHeartbeatStale(freshRun, now)).toBe(false);
		expect(withAgenticMissionStaleDisplay('running', freshRun, now)).toBe(
			'running'
		);

		const parsed = parseAgenticSessionPlanPayload(
			agenticRun({
				updated_at: '2026-07-09T07:40:00.000Z',
				created_at: '2026-07-09T07:40:00.000Z',
			}),
			now
		);
		expect(parsed?.missionDisplayState).toBe('stale');
		expect(
			resolveAgenticMissionDisplayState('running', 'executing', 'running')
		).toBe('running');
	});

	it('T1/V-H5: music run with stale heartbeat emits transcript status stale not active', () => {
		const now = Date.parse('2026-07-09T08:00:00.000Z');
		const run: EwaCompanionTaskRun = {
			id: 'music-stale-1',
			principal_id: 'p1',
			intent_kind: 'music_generation_background',
			status: 'running',
			created_at: '2026-07-09T07:40:00.000Z',
			updated_at: '2026-07-09T07:50:00.000Z',
			completed_at: null,
			user_message: 'make a song',
			plan_payload: {},
			result_payload: {},
			confirmation_state: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			steps: [],
		};
		const items = deriveTranscriptProgressItems([run], undefined, {
			nowMs: now,
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe('stale');
		expect(resolveOperationEffectiveDisplayState(run, { nowMs: now })).toBe(
			'stale'
		);
		expect(
			isOperationTruthfullyLive(
				resolveOperationEffectiveDisplayState(run, { nowMs: now })
			)
		).toBe(false);
	});

	it('T1/V-H5: poll degraded kind forces effective display stale while backend says running', () => {
		const now = Date.parse('2026-07-09T08:00:00.000Z');
		const run: EwaCompanionTaskRun = {
			id: 'img-fresh-poll-fail',
			principal_id: 'p1',
			intent_kind: 'image_generation_background',
			status: 'running',
			created_at: '2026-07-09T07:59:00.000Z',
			updated_at: '2026-07-09T07:59:30.000Z',
			completed_at: null,
			user_message: 'draw a cat',
			plan_payload: {},
			result_payload: {},
			confirmation_state: {},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			steps: [],
		};
		expect(resolveOperationEffectiveDisplayState(run, { nowMs: now })).toBe(
			'running'
		);
		expect(
			resolveOperationEffectiveDisplayState(run, {
				nowMs: now,
				pollDegradedKind: 'stale',
			})
		).toBe('stale');
		const items = deriveTranscriptProgressItems([run], undefined, {
			nowMs: now,
			pollDegradedKind: 'backend',
		});
		expect(items[0]?.status).toBe('stale');
	});
});

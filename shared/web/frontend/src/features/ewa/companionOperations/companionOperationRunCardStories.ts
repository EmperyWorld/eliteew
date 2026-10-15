/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Named fixture catalog for CompanionOperationRunCard UI states (U8.2 stories / master-plan §8.5).
 *
 * Invariants:
 * - Pure data builders; no network or React.
 * - Story ids are stable for Vitest and smoke references.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 * - documentation/product/ewa/EWA-COMPANION-BACKGROUND-ORCHESTRATION-MASTER-PLAN.md §8.5
 */

import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

import { makeCompanionTaskStep } from '@/features/ewa/companionOperations/companionTaskRunFixtures';

export type CompanionOperationRunCardStoryId =
	| 'pending_music'
	| 'in_progress_music'
	| 'awaiting_confirmation'
	| 'completed_music'
	| 'failed_music'
	| 'cancelled_generic';

export type CompanionOperationRunCardStory = {
	id: CompanionOperationRunCardStoryId;
	label: string;
	run: EwaCompanionTaskRun;
};

function baseRun(
	overrides: Partial<EwaCompanionTaskRun> &
		Pick<EwaCompanionTaskRun, 'id' | 'status'>
): EwaCompanionTaskRun {
	return {
		principal_id: 'principal-story',
		intent_kind: 'music_generation_background',
		user_message: 'Сочини песню про рассвет',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: '2026-06-22T10:00:00Z',
		updated_at: '2026-06-22T10:00:05Z',
		completed_at: null,
		...overrides,
	};
}

export const COMPANION_OPERATION_RUN_CARD_STORIES: Record<
	CompanionOperationRunCardStoryId,
	CompanionOperationRunCardStory
> = {
	pending_music: {
		id: 'pending_music',
		label: 'pending — music pipeline queued',
		run: baseRun({
			id: 'story-pending-music',
			status: 'pending',
		}),
	},
	in_progress_music: {
		id: 'in_progress_music',
		label: 'in_progress — step timeline + progress bar',
		run: baseRun({
			id: 'story-in-progress-music',
			status: 'running',
			music_pipeline_progress: {
				current: 2,
				total: 4,
				title: 'Стиль',
			},
			steps: [
				makeCompanionTaskStep({
					id: 'story-step-style',
					run_id: 'story-in-progress-music',
					step_index: 1,
					step_kind: 'music_style',
					status: 'completed',
					title: 'Стиль',
				}),
				makeCompanionTaskStep({
					id: 'story-step-generate',
					run_id: 'story-in-progress-music',
					step_index: 2,
					step_kind: 'music_generation',
					status: 'running',
					title: 'Генерация',
				}),
			],
		}),
	},
	awaiting_confirmation: {
		id: 'awaiting_confirmation',
		label: 'awaiting_confirmation — confirm bar',
		run: baseRun({
			id: 'story-awaiting-confirmation',
			status: 'awaiting_confirmation',
			intent_kind: 'image_generation_background',
			user_message: 'Нарисуй закат',
			confirmation_state: { prompt: 'Отправить в генерацию?' },
		}),
	},
	completed_music: {
		id: 'completed_music',
		label: 'completed — music result card',
		run: baseRun({
			id: 'story-completed-music',
			status: 'completed',
			completed_at: '2026-06-22T10:05:00Z',
			result_payload: {
				unified_content_id: '04881699-0d6b-421f-a68d-ed1ad9a7930b',
				track_name: 'Neon Sunrise',
				thumbnail_url: 'https://example.com/cover.png',
			},
		}),
	},
	failed_music: {
		id: 'failed_music',
		label: 'failed — error alert + retry',
		run: baseRun({
			id: 'story-failed-music',
			status: 'failed',
			completed_at: '2026-06-22T10:03:00Z',
			error_payload: { message: 'GPU queue timeout' },
		}),
	},
	cancelled_generic: {
		id: 'cancelled_generic',
		label: 'cancelled — muted terminal state',
		run: baseRun({
			id: 'story-cancelled',
			status: 'cancelled',
			intent_kind: 'app_open',
			user_message: 'Открой музыкальную студию',
			completed_at: '2026-06-22T10:01:00Z',
		}),
	},
};

export function companionOperationRunCardStory(
	id: CompanionOperationRunCardStoryId
): CompanionOperationRunCardStory {
	return COMPANION_OPERATION_RUN_CARD_STORIES[id];
}

export function listCompanionOperationRunCardStories(): CompanionOperationRunCardStory[] {
	return Object.values(COMPANION_OPERATION_RUN_CARD_STORIES);
}

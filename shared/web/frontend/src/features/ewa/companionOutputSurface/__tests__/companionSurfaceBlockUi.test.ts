/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for server surface block helpers (U4.9).
 *
 * Invariants:
 * - Confirm actions are filtered when ConfirmBar is visible.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/companionSurfaceBlockUi.ts
 */

import { describe, expect, it, vi } from 'vitest';

import {
	companionSurfaceBlockActionLabel,
	companionSurfaceBlockCardTitle,
	dispatchCompanionSurfaceBlockAction,
	filterCompanionSurfaceBlockActions,
	primaryCompanionSurfaceBlock,
} from '@/features/ewa/companionOutputSurface/companionSurfaceBlockUi';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

function runWithBlock(
	status: string,
	actions: EwaCompanionTaskRun['surface_blocks']
): EwaCompanionTaskRun {
	return {
		id: 'run-1',
		principal_id: 'p1',
		status,
		intent_kind: 'action_workflow',
		user_message: 'Plan a deck',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: null,
		updated_at: null,
		completed_at: null,
		surface_blocks: actions,
	};
}

describe('companionSurfaceBlockUi', () => {
	it('returns first surface block with id', () => {
		const run = runWithBlock('running', [
			{
				id: 'task_run:run-1:workflow_timeline',
				kind: 'workflow_timeline',
				title: 'Deck plan',
				payload: {},
				actions: [],
			},
		]);
		expect(primaryCompanionSurfaceBlock(run)?.kind).toBe('workflow_timeline');
	});

	it('prefers server block title for card heading', () => {
		const run = runWithBlock('running', [
			{
				id: 'task_run:run-1:workflow_timeline',
				kind: 'workflow_timeline',
				title: 'Deck plan',
				payload: {},
				actions: [],
			},
		]);
		expect(companionSurfaceBlockCardTitle(run, 'Fallback')).toBe('Deck plan');
	});

	it('hides duplicate confirm actions while awaiting confirmation', () => {
		const block = {
			id: 'task_run:run-1:confirm',
			kind: 'confirm' as const,
			title: 'Confirm',
			payload: {},
			actions: [
				{
					type: 'task_run_confirm',
					label_ru: 'Подтвердить',
					label_en: 'Confirm',
					payload: { run_id: 'run-1', decision: 'confirm' },
				},
				{
					type: 'chat_follow_up',
					label_ru: 'Разобрать',
					label_en: 'Discuss',
					payload: { run_id: 'run-1' },
				},
			],
		};
		const filtered = filterCompanionSurfaceBlockActions(
			block,
			'awaiting_confirmation'
		);
		expect(filtered.map((row) => row.type)).toEqual(['chat_follow_up']);
	});

	it('dispatches confirm and discuss actions', () => {
		const onConfirmRun = vi.fn();
		const onDraftPlayPrompt = vi.fn();
		const run = runWithBlock('completed', []);
		const t = ((key: string) => key) as never;

		dispatchCompanionSurfaceBlockAction(
			{
				type: 'task_run_confirm',
				payload: { run_id: 'run-1', decision: 'cancel' },
			},
			run,
			{ onConfirmRun, onDraftPlayPrompt },
			t
		);
		expect(onConfirmRun).toHaveBeenCalledWith('run-1', 'cancel');

		dispatchCompanionSurfaceBlockAction(
			{
				type: 'chat_follow_up',
				payload: { run_id: 'run-1' },
			},
			run,
			{ onConfirmRun, onDraftPlayPrompt },
			t
		);
		expect(onDraftPlayPrompt).toHaveBeenCalledWith(
			'ewaCompanion.surfaceDiscussPrompt'
		);
	});

	it('uses localized action labels', () => {
		expect(
			companionSurfaceBlockActionLabel(
				{ type: 'chat_follow_up', label_ru: 'Разобрать', label_en: 'Discuss' },
				true
			)
		).toBe('Разобрать');
	});
});

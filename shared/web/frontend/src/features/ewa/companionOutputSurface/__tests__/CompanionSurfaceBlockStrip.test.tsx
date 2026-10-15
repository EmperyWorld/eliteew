/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render tests for CompanionSurfaceBlockStrip (U4.9).
 *
 * Invariants:
 * - Strip is absent when run has no surface_blocks.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionSurfaceBlockStrip.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionSurfaceBlockStrip } from '@/features/ewa/companionOutputSurface/CompanionSurfaceBlockStrip';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === 'ewaCompanion.surfaceBlockKindConfirm') return 'Confirmation';
			if (key === 'ewaCompanion.operationStatusAwaitingConfirmation')
				return 'Awaiting confirmation';
			return key;
		},
	}),
}));

function confirmRun(): EwaCompanionTaskRun {
	return {
		id: 'run-1',
		principal_id: 'p1',
		status: 'awaiting_confirmation',
		intent_kind: 'action_workflow',
		user_message: 'Plan deck',
		plan_payload: {},
		confirmation_state: {},
		result_payload: {},
		error_payload: {},
		execution_mode: 'async',
		run_revision: 1,
		created_at: null,
		updated_at: null,
		completed_at: null,
		surface_blocks: [
			{
				id: 'task_run:run-1:confirm',
				kind: 'confirm',
				title: 'Plan deck',
				status: 'awaiting_confirmation',
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
						label_ru: 'Разобрать с EWA',
						label_en: 'Discuss with EWA',
						payload: { run_id: 'run-1' },
					},
				],
			},
		],
	};
}

describe('CompanionSurfaceBlockStrip', () => {
	it('renders kind badge and discuss action without duplicate confirm buttons', () => {
		const onDraftPlayPrompt = vi.fn();
		render(
			<CompanionSurfaceBlockStrip
				run={confirmRun()}
				ru={false}
				onConfirmRun={vi.fn()}
				onDraftPlayPrompt={onDraftPlayPrompt}
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-surface-block-strip')
		).toHaveAttribute('data-surface-block-kind', 'confirm');
		expect(screen.getByText('Confirmation')).toBeInTheDocument();
		expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
		expect(screen.getByText('Discuss with EWA')).toBeInTheDocument();

		fireEvent.click(screen.getByText('Discuss with EWA'));
		expect(onDraftPlayPrompt).toHaveBeenCalledTimes(1);
	});

	it('returns null without surface blocks', () => {
		const { container } = render(
			<CompanionSurfaceBlockStrip
				run={{
					...confirmRun(),
					surface_blocks: undefined,
				}}
				ru={false}
				onConfirmRun={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});

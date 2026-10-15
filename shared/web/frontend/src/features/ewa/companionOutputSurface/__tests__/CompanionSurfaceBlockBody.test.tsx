/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Render tests for CompanionSurfaceBlockBody (U4.10–U4.13).
 *
 * Invariants:
 * - History CTA requires a parent handler; retired builder CTA stays hidden.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionSurfaceBlockBody.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionSurfaceBlockBody } from '@/features/ewa/companionOutputSurface/CompanionSurfaceBlockBody';
import type { CompanionSurfaceBlock } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			if (key === 'ewaCompanion.surfaceBlockOpenHistoryRun') {
				return `History: ${params?.label ?? ''}`;
			}
			if (key === 'ewaCompanion.surfaceBlockStepsSummary') {
				return `Steps ${params?.completed}/${params?.total}`;
			}
			return key;
		},
	}),
}));

function bodyBlock(
	kind: CompanionSurfaceBlock['kind'],
	payload: Record<string, unknown>
): CompanionSurfaceBlock {
	return {
		id: 'b1',
		kind,
		title: 'Title',
		payload,
		actions: [],
	};
}

describe('CompanionSurfaceBlockBody', () => {
	it('renders choice chips and drafts prompt on click', () => {
		const onDraftPlayPrompt = vi.fn();
		render(
			<CompanionSurfaceBlockBody
				block={bodyBlock('choice', {
					choices: [{ id: 'a', label_en: 'Option A', prompt: 'pick A' }],
				})}
				ru={false}
				onDraftPlayPrompt={onDraftPlayPrompt}
			/>
		);
		fireEvent.click(screen.getByText('Option A'));
		expect(onDraftPlayPrompt).toHaveBeenCalledWith('pick A');
	});

	it('hides retired workflow builder CTA even when handler is provided', () => {
		render(
			<CompanionSurfaceBlockBody
				block={bodyBlock('builder', { workflow_id: 'wf-9' })}
				ru={false}
				onDraftPlayPrompt={vi.fn()}
			/>
		);
		expect(
			screen.queryByTestId('ewa-companion-surface-block-builder')
		).not.toBeInTheDocument();
	});

	it('focuses referenced run from history_ref block', () => {
		const onFocusRun = vi.fn();
		render(
			<CompanionSurfaceBlockBody
				block={bodyBlock('history_ref', {
					ref_run_id: 'run-42',
					label_en: 'Deck run',
				})}
				ru={false}
				onDraftPlayPrompt={vi.fn()}
				onFocusRun={onFocusRun}
			/>
		);
		fireEvent.click(screen.getByText('History: Deck run'));
		expect(onFocusRun).toHaveBeenCalledWith('run-42');
	});

	it('shows workflow step summary for timeline blocks', () => {
		render(
			<CompanionSurfaceBlockBody
				block={bodyBlock('workflow_timeline', {
					steps: [{ status: 'completed' }, { status: 'pending' }],
				})}
				ru={false}
				onDraftPlayPrompt={vi.fn()}
			/>
		);
		expect(screen.getByText('Steps 1/2')).toBeInTheDocument();
	});
});

/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for Universal Output Surface controls that should speak through the active companion persona.
 *
 * Invariants:
 * - Surface lifecycle controls remain view-only; discussion CTA copy must use the active companion display name.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/UniversalOutputSurface.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { UniversalOutputSurface } from '@/features/ewa/companionOutputSurface/UniversalOutputSurface';
import { loadCompanionSurfaceLifecycleState } from '@/features/ewa/companionOutputSurface/companionSurfaceLifecycle';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, number | string>) => {
			if (key === 'ewaCompanion.surfaceDiscussWithName') {
				return `Discuss result with ${params?.name ?? 'EWA'}`;
			}
			if (key === 'ewaCompanion.surfaceDiscussPrompt') {
				return `Review ${params?.label ?? 'run'} ${params?.runId ?? ''}`;
			}
			if (key === 'ewaCompanion.surfaceDiscuss') return 'Discuss';
			if (key === 'ewaCompanion.surfacePin') return 'Pin';
			if (key === 'ewaCompanion.surfacePinShort') return 'Pin';
			if (key === 'ewaCompanion.surfaceClose') return 'Close';
			if (key === 'ewaCompanion.surfaceCloseShort') return 'Close';
			if (key === 'ewaCompanion.surfaceActiveSection') {
				return `Active ${params?.count ?? 0}`;
			}
			return key;
		},
	}),
}));

vi.mock('@/components/shared/VirtualList', () => ({
	VirtualVariableList: <T,>({
		items,
		renderItem,
	}: {
		items: T[];
		renderItem: (item: T, index: number) => ReactNode;
	}) => (
		<div data-testid="virtual-list-mock">
			{items.map((item, index) => (
				// Test mock only — order is stable for these fixtures.
				// biome-ignore lint/suspicious/noArrayIndexKey: virtual-list test stub
				<div key={index}>{renderItem(item, index)}</div>
			))}
		</div>
	),
}));

vi.mock('@/features/ewa/companionOperations/CompanionOperationRunCard', () => ({
	CompanionOperationRunCard: ({
		surfaceControls,
	}: {
		surfaceControls?: ReactNode;
	}) => <li data-testid="mock-operation-run-card">{surfaceControls}</li>,
}));

const run: EwaCompanionTaskRun = makeCompanionTaskRun({
	id: 'run-1',
	principal_id: 'p1',
	status: 'running',
	intent_kind: 'image_generation_background',
	user_message: 'make image',
});

describe('UniversalOutputSurface', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('uses the active companion display name for discuss controls', () => {
		const onDraftPlayPrompt = vi.fn();

		render(
			<UniversalOutputSurface
				principalId="p1"
				runs={[run]}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={onDraftPlayPrompt}
				onOpenPresentationInEwrp={vi.fn()}
				companionDisplayName="Tala"
			/>
		);

		const discuss = screen.getByRole('button', {
			name: 'Discuss result with Tala',
		});
		expect(
			screen.queryByRole('button', { name: 'Discuss result with EWA' })
		).not.toBeInTheDocument();

		fireEvent.click(discuss);
		expect(onDraftPlayPrompt).toHaveBeenCalledWith('Review make image run-1');
	});

	it('persists close across remount without wiping localStorage on first paint', () => {
		const { unmount } = render(
			<UniversalOutputSurface
				principalId="p1"
				runs={[run]}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				companionDisplayName="Tala"
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(
			screen.queryByTestId('mock-operation-run-card')
		).not.toBeInTheDocument();
		// Sync persist on click — must be durable before React effect flush / remount.
		expect(loadCompanionSurfaceLifecycleState('p1').dismissedIds).toContain(
			'run:run-1'
		);

		unmount();

		render(
			<UniversalOutputSurface
				principalId="p1"
				runs={[run]}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				companionDisplayName="Tala"
			/>
		);

		expect(
			screen.queryByTestId('mock-operation-run-card')
		).not.toBeInTheDocument();
		expect(loadCompanionSurfaceLifecycleState('p1').dismissedIds).toContain(
			'run:run-1'
		);
	});

	it('keeps in-memory dismiss when principalId arrives after empty bootstrap', () => {
		const { rerender } = render(
			<UniversalOutputSurface
				principalId=""
				runs={[run]}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				companionDisplayName="Tala"
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(
			screen.queryByTestId('mock-operation-run-card')
		).not.toBeInTheDocument();

		rerender(
			<UniversalOutputSurface
				principalId="p1"
				runs={[run]}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				companionDisplayName="Tala"
			/>
		);

		expect(
			screen.queryByTestId('mock-operation-run-card')
		).not.toBeInTheDocument();
		expect(loadCompanionSurfaceLifecycleState('p1').dismissedIds).toContain(
			'run:run-1'
		);
	});
});

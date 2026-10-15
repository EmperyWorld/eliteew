/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for companion operations panel shell and premium status chrome.
 *
 * Invariants:
 * - Panel shell controls only refresh/toggle local view state; run execution stays in backend task APIs.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationsPanel.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionOperationsPanel } from '@/features/ewa/companionOperations/CompanionOperationsPanel';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, number | string>) => {
			if (key === 'ewaCompanion.operationsPanelEyebrow')
				return 'Background tasks';
			if (key === 'ewaCompanion.operationsPanelTitle')
				return 'Current operations';
			if (key === 'ewaCompanion.operationsPanelLive') return 'live';
			if (key === 'ewaCompanion.operationsPanelSubtitle')
				return `Active: ${params?.active ?? 0} · history: ${params?.history ?? 0}`;
			if (key === 'ewaCompanion.operationsPanelIdle')
				return `No active tasks for ${params?.name ?? 'EWA'}`;
			if (key === 'ewaCompanion.operationsPanelCollapsedHint')
				return `Collapsed: ${params?.active ?? 0} active, ${params?.ready ?? 0} ready.`;
			if (key === 'ewaCompanion.operationsMetricActive')
				return `Active ${params?.count ?? 0}`;
			if (key === 'ewaCompanion.operationsMetricReady')
				return `Ready ${params?.count ?? 0}`;
			if (key === 'ewaCompanion.operationsMetricHistory')
				return `History ${params?.count ?? 0}`;
			if (key === 'ewaCompanion.operationsRefreshAria') return 'Refresh';
			if (key === 'ewaCompanion.operationsHistoryShowMore')
				return 'Show more history';
			if (key === 'ewaCompanion.operationsHistoryLoadingMore')
				return 'Loading more…';
			if (key === 'ewaCompanion.operationsEmptyTitle')
				return 'No background operations yet';
			if (key === 'ewaCompanion.operationsEmptyBody')
				return 'Cards will appear here.';
			if (key === 'ewaCompanion.operationsNoActive')
				return 'No active background operations right now.';
			return key;
		},
	}),
}));

vi.mock('@/features/ewa/companionOutputSurface/UniversalOutputSurface', () => ({
	UniversalOutputSurface: ({
		runs,
		companionDisplayName,
		virtualListHeight,
		secondaryRailMode,
	}: {
		runs: EwaCompanionTaskRun[];
		companionDisplayName: string;
		virtualListHeight?: number;
		secondaryRailMode?: boolean;
	}) => (
		<div
			data-testid="mock-output-surface"
			data-virtual-list-height={virtualListHeight ?? ''}
			data-secondary-rail-mode={secondaryRailMode ? 'yes' : 'no'}
		>
			{runs.length} runs for {companionDisplayName}
		</div>
	),
}));

function renderPanel(
	props: Partial<ComponentProps<typeof CompanionOperationsPanel>> = {}
) {
	return render(
		<CompanionOperationsPanel
			principalId="p1"
			operationRuns={[]}
			operationsExpanded
			onToggleExpanded={vi.fn()}
			operationsRefreshing={false}
			onRefresh={vi.fn()}
			confirmBusyRunId={null}
			onConfirmRun={vi.fn()}
			onPlayTrack={vi.fn()}
			onDraftPlayPrompt={vi.fn()}
			onOpenPresentationInEwrp={vi.fn()}
			companionDisplayName="Mela"
			ru={false}
			{...props}
		/>
	);
}

describe('CompanionOperationsPanel shell', () => {
	it('keeps the empty state compact and keeps refresh available', () => {
		const onRefresh = vi.fn();
		renderPanel({ onRefresh });

		expect(screen.getByText('Background tasks')).toBeInTheDocument();
		expect(screen.getByText('No active tasks for Mela')).toBeInTheDocument();
		expect(
			screen.queryByText('No background operations yet')
		).not.toBeInTheDocument();
		expect(
			screen.queryByText('Cards will appear here.')
		).not.toBeInTheDocument();
		expect(screen.queryByText('Active 0')).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
		expect(onRefresh).toHaveBeenCalledTimes(1);
	});

	it('renders active, ready and collapsed summary metrics', () => {
		const operationRuns: EwaCompanionTaskRun[] = [
			makeCompanionTaskRun({
				id: 'run-active',
				status: 'running',
				intent_kind: 'presentation_generation_background',
				user_message: 'deck',
			}),
			makeCompanionTaskRun({
				id: 'run-ready',
				status: 'completed',
				intent_kind: 'image_generation_background',
				user_message: 'image',
				completed_at: '2026-05-28T00:00:00Z',
			}),
		];

		renderPanel({ operationRuns, operationsExpanded: false });

		expect(screen.getByText('live')).toBeInTheDocument();
		expect(screen.getByText('Active 1')).toBeInTheDocument();
		expect(screen.getByText('Ready 1')).toBeInTheDocument();
		expect(screen.getByText('History 1')).toBeInTheDocument();
		expect(
			screen.getByText('Collapsed: 1 active, 1 ready.')
		).toBeInTheDocument();
		expect(screen.queryByTestId('mock-output-surface')).not.toBeInTheDocument();
	});

	it('passes the active companion display name into output surface controls', () => {
		const operationRuns: EwaCompanionTaskRun[] = [
			makeCompanionTaskRun({
				id: 'run-active',
				status: 'running',
				intent_kind: 'image_generation_background',
				user_message: 'image',
			}),
		];

		renderPanel({
			operationRuns,
			operationsExpanded: true,
			companionDisplayName: 'Tala',
		});

		expect(screen.getByTestId('mock-output-surface')).toHaveTextContent(
			'1 runs for Tala'
		);
	});

	it('passes a fill viewport height to the virtual output surface', () => {
		const operationRuns: EwaCompanionTaskRun[] = [
			makeCompanionTaskRun({
				id: 'run-active',
				status: 'running',
				intent_kind: 'image_generation_background',
				user_message: 'image',
			}),
		];

		renderPanel({
			operationRuns,
			operationsExpanded: true,
			fillViewport: true,
		});

		expect(
			screen.getByTestId('ewa-companion-operations-fill-viewport')
		).toHaveClass('flex-1');
		expect(screen.getByTestId('mock-output-surface')).toHaveAttribute(
			'data-virtual-list-height',
			'360'
		);
	});

	it('marks desktop rail output as secondary when requested', () => {
		const operationRuns: EwaCompanionTaskRun[] = [
			makeCompanionTaskRun({
				id: 'run-active',
				status: 'running',
				intent_kind: 'image_generation_background',
				user_message: 'image',
			}),
		];

		renderPanel({
			operationRuns,
			operationsExpanded: true,
			secondaryRailMode: true,
		});

		expect(screen.getByTestId('mock-output-surface')).toHaveAttribute(
			'data-secondary-rail-mode',
			'yes'
		);
	});

	it('shows load more history when canLoadMoreHistory', () => {
		const onLoadMoreHistory = vi.fn();
		const operationRuns: EwaCompanionTaskRun[] = Array.from(
			{ length: 8 },
			(_, i) =>
				makeCompanionTaskRun({
					id: `run-${i}`,
					status: 'completed',
					intent_kind: 'image_generation_background',
					user_message: `img-${i}`,
					completed_at: '2026-05-28T00:00:00Z',
				})
		);

		renderPanel({
			operationRuns,
			operationsExpanded: true,
			canLoadMoreHistory: true,
			onLoadMoreHistory,
		});

		fireEvent.click(screen.getByRole('button', { name: 'Show more history' }));
		expect(onLoadMoreHistory).toHaveBeenCalledTimes(1);
	});
});

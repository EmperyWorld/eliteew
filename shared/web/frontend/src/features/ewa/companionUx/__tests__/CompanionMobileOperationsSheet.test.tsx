/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile operations sheet delegates to UniversalOutputSurface (U4.8 parity).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionMobileOperationsSheet } from '@/features/ewa/companionUx/CompanionMobileOperationsSheet';
import { makeCompanionTaskRun } from '@/features/ewa/companionOperations/companionTaskRunFixtures';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === 'ewaCompanion.operationsSheetTitle') return 'Operations';
			if (key === 'ewaCompanion.sheetBackdropClose') return 'Close panel';
			if (key === 'ewaCompanion.sheetClose') return 'Close';
			if (key === 'ewaCompanion.operationsEmpty') return 'No operations';
			return key;
		},
	}),
}));

vi.mock('@/features/ewa/companionOutputSurface/UniversalOutputSurface', () => ({
	UniversalOutputSurface: ({
		principalId,
		secondaryRailMode,
	}: {
		principalId: string;
		secondaryRailMode?: boolean;
	}) => (
		<div
			data-testid="mock-universal-output-surface"
			data-secondary-rail-mode={secondaryRailMode ? 'yes' : 'no'}
		>
			{principalId}
		</div>
	),
}));

const baseProps = {
	open: true,
	onClose: vi.fn(),
	principalId: 'principal-42',
	operationRuns: [
		makeCompanionTaskRun({
			id: 'run-1',
			principal_id: 'principal-42',
			status: 'running',
			intent_kind: 'music_generation_background',
			user_message: 'song',
		}),
	],
	ru: true,
	confirmBusyRunId: null,
	onConfirmRun: vi.fn(),
	onPlayTrack: vi.fn(),
	onDraftPlayPrompt: vi.fn(),
	onOpenPresentationInEwrp: vi.fn(),
	companionDisplayName: 'EWA',
};

describe('CompanionMobileOperationsSheet', () => {
	it('renders UniversalOutputSurface when runs exist', () => {
		render(<CompanionMobileOperationsSheet {...baseProps} />);
		expect(
			screen.getByTestId('mock-universal-output-surface')
		).toHaveTextContent('principal-42');
		expect(screen.getByTestId('mock-universal-output-surface')).toHaveAttribute(
			'data-secondary-rail-mode',
			'no'
		);
	});

	it('shows empty state without UniversalOutputSurface', () => {
		render(
			<CompanionMobileOperationsSheet {...baseProps} operationRuns={[]} />
		);
		expect(screen.getByText('No operations')).toBeTruthy();
		expect(screen.queryByTestId('mock-universal-output-surface')).toBeNull();
	});
});

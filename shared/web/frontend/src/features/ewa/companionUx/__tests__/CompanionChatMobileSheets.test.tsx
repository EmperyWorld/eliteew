/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionChatMobileSheets (U8.3 slice 18).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionChatMobileSheets } from '@/features/ewa/companionUx/CompanionChatMobileSheets';

vi.mock('@/features/ewa/companionUx/CompanionMobileOperationsSheet', () => ({
	CompanionMobileOperationsSheet: () => (
		<div data-testid="mobile-operations-sheet" />
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionMobileMemorySheet', () => ({
	CompanionMobileMemorySheet: () => <div data-testid="mobile-memory-sheet" />,
}));

describe('CompanionChatMobileSheets', () => {
	it('shows memory sheet when enabled', () => {
		render(
			<CompanionChatMobileSheets
				showMemorySheet={true}
				operationsSheetProps={{ open: false, onClose: vi.fn() } as never}
				memorySheetProps={{ open: false, onClose: vi.fn(), rows: [] }}
			/>
		);
		expect(screen.getByTestId('mobile-operations-sheet')).toBeInTheDocument();
		expect(screen.getByTestId('mobile-memory-sheet')).toBeInTheDocument();
	});

	it('hides memory sheet when disabled', () => {
		render(
			<CompanionChatMobileSheets
				showMemorySheet={false}
				operationsSheetProps={{ open: false, onClose: vi.fn() } as never}
				memorySheetProps={{ open: false, onClose: vi.fn(), rows: [] }}
			/>
		);
		expect(screen.queryByTestId('mobile-memory-sheet')).not.toBeInTheDocument();
	});
});

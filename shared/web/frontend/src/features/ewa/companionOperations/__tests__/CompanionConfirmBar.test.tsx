/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest smoke for CompanionConfirmBar (Phase 3 confirm gate).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionConfirmBar } from '@/features/ewa/companionOperations/CompanionConfirmBar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) =>
			key === 'ewaCompanion.operationConfirm'
				? 'Confirm'
				: key === 'ewaCompanion.operationCancel'
					? 'Cancel'
					: key,
	}),
}));

describe('CompanionConfirmBar', () => {
	it('calls onConfirm with run id and decision', () => {
		const onConfirm = vi.fn();
		render(
			<CompanionConfirmBar runId="run-abc" onConfirm={onConfirm} busy={false} />
		);

		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onConfirm).toHaveBeenCalledWith('run-abc', 'confirm');

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onConfirm).toHaveBeenCalledWith('run-abc', 'cancel');
	});
});

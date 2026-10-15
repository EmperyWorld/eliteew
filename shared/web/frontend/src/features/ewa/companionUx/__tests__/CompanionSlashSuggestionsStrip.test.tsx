/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionSlashSuggestionsStrip (U8.3 slice 13).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionSlashSuggestionsStrip } from '@/features/ewa/companionUx/CompanionSlashSuggestionsStrip';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionSlashSuggestionsStrip', () => {
	it('inserts slash prompt on chip click', () => {
		const onSelectPrompt = vi.fn();
		render(
			<CompanionSlashSuggestionsStrip
				suggestions={[
					{
						command: '/help',
						labelKey: 'ewaCompanion.slashHelp',
						promptKey: 'ewaCompanion.slashHelpPrompt',
					},
				]}
				onSelectPrompt={onSelectPrompt}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: '/help · ewaCompanion.slashHelp' })
		);
		expect(onSelectPrompt).toHaveBeenCalledWith('ewaCompanion.slashHelpPrompt');
	});

	it('returns null when suggestions are empty', () => {
		const { container } = render(
			<CompanionSlashSuggestionsStrip
				suggestions={[]}
				onSelectPrompt={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});

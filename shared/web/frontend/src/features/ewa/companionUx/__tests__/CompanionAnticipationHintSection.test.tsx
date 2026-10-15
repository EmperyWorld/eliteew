/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionAnticipationHintSection (U8.3 slice 11).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionAnticipationHintSection } from '@/features/ewa/companionUx/CompanionAnticipationHintSection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionAnticipationHintSection', () => {
	it('renders hint card when hint is present', () => {
		render(
			<CompanionAnticipationHintSection
				hint={{
					kind: 'anticipation',
					hint_text: 'You paused music',
					related_episodes: [],
					suggested_action: null,
				}}
				onSuggestedPrompt={vi.fn()}
				onDismiss={vi.fn()}
			/>
		);
		expect(screen.getByText('You paused music')).toBeInTheDocument();
	});

	it('returns null when hint is absent', () => {
		const { container } = render(
			<CompanionAnticipationHintSection
				hint={null}
				onSuggestedPrompt={vi.fn()}
				onDismiss={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});

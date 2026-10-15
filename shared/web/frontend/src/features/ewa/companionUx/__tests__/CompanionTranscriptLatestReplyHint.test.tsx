/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for latest-reply transcript hint (plan 15 R01).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTranscriptLatestReplyHint } from '@/features/ewa/companionUx/CompanionTranscriptLatestReplyHint';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('CompanionTranscriptLatestReplyHint', () => {
	it('renders hint and dismisses on click', () => {
		render(<CompanionTranscriptLatestReplyHint principalId="test-principal" />);
		expect(
			screen.getByTestId('ewa-companion-transcript-latest-reply-hint')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByText('ewaCompanion.chatTranscriptLatestReplyHintDismiss')
		);
		expect(
			screen.queryByTestId('ewa-companion-transcript-latest-reply-hint')
		).not.toBeInTheDocument();
	});
});

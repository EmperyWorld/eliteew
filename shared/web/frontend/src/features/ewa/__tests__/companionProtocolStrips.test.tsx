/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionExecutionReportStrip } from '@/features/ewa/CompanionExecutionReportStrip';
import { CompanionProactiveSuggestionStrip } from '@/features/ewa/CompanionProactiveSuggestionStrip';

describe('CompanionExecutionReportStrip', () => {
	it('renders failed report message', () => {
		render(
			<CompanionExecutionReportStrip
				reports={[
					{
						scope: 'tool',
						outcome: 'failed',
						reason_message_en: 'Could not complete.',
					},
				]}
			/>
		);
		expect(screen.getByText('Could not complete.')).toBeTruthy();
	});
});

describe('CompanionProactiveSuggestionStrip', () => {
	it('inserts quick reply via callback', () => {
		const onQuickReply = vi.fn();
		render(
			<CompanionProactiveSuggestionStrip
				suggestion={{
					question_en: 'Continue queued step?',
					quick_replies: ['continue'],
				}}
				onQuickReply={onQuickReply}
				onDismiss={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByText('continue'));
		expect(onQuickReply).toHaveBeenCalledWith('continue');
	});
});

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionProtocolStrips bundle (U8.3 slice 9).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en' },
	}),
}));
vi.mock('@/features/ewa/CompanionExecutionReportStrip', () => ({
	CompanionExecutionReportStrip: () => null,
}));
vi.mock('@/features/ewa/CompanionToolTraceStrip', () => ({
	CompanionToolTraceStrip: () => null,
}));

import { CompanionProtocolStrips } from '@/features/ewa/companionUx/CompanionProtocolStrips';

describe('CompanionProtocolStrips', () => {
	it('renders proactive quick reply when not snoozed', () => {
		const onQuickReply = vi.fn();
		render(
			<CompanionProtocolStrips
				toolTrace={[]}
				protocolReports={[]}
				orchestrationOutcome={null}
				proactiveSuggestion={{
					question_en: 'Continue queued step?',
					quick_replies: ['continue'],
				}}
				principalId="principal-test-1"
				onQuickReply={onQuickReply}
				onDismissProactive={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByText('continue'));
		expect(onQuickReply).toHaveBeenCalledWith('continue');
	});
});

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component regression for proactive suggestion quick-reply chips.
 *
 * Invariants:
 * - Chip click forwards exact quick_reply text to parent handler.
 *
 * Related:
 * - src/features/ewa/CompanionProactiveSuggestionStrip.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionProactiveSuggestionStrip } from '@/features/ewa/CompanionProactiveSuggestionStrip';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'ru' },
	}),
}));

describe('CompanionProactiveSuggestionStrip', () => {
	it('inserts quick reply text on chip click', () => {
		const onQuickReply = vi.fn();
		render(
			<CompanionProactiveSuggestionStrip
				suggestion={{
					kind: 'next_step',
					question_ru: 'Продолжить генерацию?',
					question_en: 'Continue generation?',
					quick_replies: ['продолжай'],
					source: 'turn_plan',
					confidence: 0.8,
				}}
				onQuickReply={onQuickReply}
				onDismiss={vi.fn()}
			/>
		);
		fireEvent.click(screen.getByRole('button', { name: 'продолжай' }));
		expect(onQuickReply).toHaveBeenCalledWith('продолжай');
	});
});

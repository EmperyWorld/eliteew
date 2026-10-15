/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component regression for anticipation hint suggested_action chips (Phase 5.3).
 *
 * Related:
 * - src/features/ewa/CompanionAnticipationHintCard.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionAnticipationHintCard } from '@/features/ewa/CompanionAnticipationHintCard';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { text?: string; defaultValue?: string }) => {
			if (
				key === 'ewaCompanion.anticipationSuggestedActionAria' &&
				opts?.text
			) {
				return `Send: ${opts.text}`;
			}
			return opts?.defaultValue ?? key;
		},
	}),
}));

describe('CompanionAnticipationHintCard', () => {
	it('submits suggested prompt on chip click', () => {
		const onSuggestedPrompt = vi.fn();
		render(
			<CompanionAnticipationHintCard
				hint={{
					kind: 'anticipation',
					hint_text: 'Заметила: ты открыла документ.',
					related_episodes: [],
					suggested_action: {
						type: 'suggest_chat_prompt',
						prompt_text: 'Отметь выполненным: зарядка',
					},
				}}
				onSuggestedPrompt={onSuggestedPrompt}
				onDismiss={vi.fn()}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Send: Отметь выполненным: зарядка' })
		);
		expect(onSuggestedPrompt).toHaveBeenCalledWith(
			'Отметь выполненным: зарядка'
		);
	});
});

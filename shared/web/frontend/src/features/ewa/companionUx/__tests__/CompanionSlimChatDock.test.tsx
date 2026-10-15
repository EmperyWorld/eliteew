/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionSlimChatDock premium chrome (back control + send).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionSlimChatDock } from '@/features/ewa/companionUx/CompanionSlimChatDock';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionSlimChatDock', () => {
	it('keeps back-to-chat and send clickable with draft text', () => {
		const onBackToChat = vi.fn();
		const onSubmit = vi.fn();
		const onDraftChange = vi.fn();
		render(
			<CompanionSlimChatDock
				draft="hello"
				pending={false}
				inputRef={createRef<HTMLTextAreaElement>()}
				onDraftChange={onDraftChange}
				onSubmit={onSubmit}
				onBackToChat={onBackToChat}
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-slim-chat-dock')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.slimChatDockBackToChat',
			})
		);
		expect(onBackToChat).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole('button', { name: 'ewaCompanion.send' }));
		expect(onSubmit).toHaveBeenCalledOnce();
	});
});

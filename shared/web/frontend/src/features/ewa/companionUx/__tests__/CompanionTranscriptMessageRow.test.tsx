/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTranscriptMessageRow (U8.3 slice 15).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTranscriptMessageRow } from '@/features/ewa/companionUx/CompanionTranscriptMessageRow';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('@/features/ewa/EwaCompanionChatMarkdown', () => ({
	EwaCompanionChatMarkdown: ({ markdown }: { markdown: string }) => (
		<div data-testid="markdown">{markdown}</div>
	),
}));

describe('CompanionTranscriptMessageRow', () => {
	it('copies assistant reply from footer button', () => {
		const onCopyAssistantReply = vi.fn();
		render(
			<CompanionTranscriptMessageRow
				row={{
					key: 'k1',
					message: { role: 'assistant', content: 'Hello **world**' },
				}}
				index={0}
				displayName="EWA"
				mobileEmbeddedLayout={false}
				reducedMotion={true}
				streamGrowingAssistant={false}
				copiedMessageKey={null}
				onCopyAssistantReply={onCopyAssistantReply}
			/>
		);
		fireEvent.click(screen.getByTestId('ewa-companion-copy-reply'));
		expect(onCopyAssistantReply).toHaveBeenCalledWith('Hello **world**', 'k1');
	});

	it('does not render copy footer for user messages', () => {
		render(
			<CompanionTranscriptMessageRow
				row={{
					key: 'k2',
					message: { role: 'user', content: 'Hi' },
				}}
				index={0}
				displayName="EWA"
				mobileEmbeddedLayout={false}
				reducedMotion={true}
				streamGrowingAssistant={false}
				copiedMessageKey={null}
				onCopyAssistantReply={vi.fn()}
			/>
		);
		expect(
			screen.queryByTestId('ewa-companion-copy-reply')
		).not.toBeInTheDocument();
	});
});

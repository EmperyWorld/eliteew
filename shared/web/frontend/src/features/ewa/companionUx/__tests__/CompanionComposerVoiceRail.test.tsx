/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionComposerVoiceRail (U8.3 slice 14).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionComposerVoiceRail } from '@/features/ewa/companionUx/CompanionComposerVoiceRail';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

const baseProps = {
	companionVoiceEnabled: true,
	pending: false,
	draftTrimmed: true,
	voiceSessionActive: false,
	voiceInputBusy: false,
	voiceInputState: 'idle' as const,
	voiceOutputState: 'idle' as const,
	voiceOutEnabled: false,
	onEnterVoiceSession: vi.fn(),
	onVoiceSpeakerClick: vi.fn(),
	onVoiceMicClick: vi.fn(),
	onSend: vi.fn(),
};

describe('CompanionComposerVoiceRail', () => {
	it('fires send when draft is non-empty', () => {
		const onSend = vi.fn();
		render(
			<CompanionComposerVoiceRail
				density="desktop"
				{...baseProps}
				onSend={onSend}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'ewaCompanion.chatSendAria' })
		);
		expect(onSend).toHaveBeenCalledOnce();
	});

	it('disables send when draft is empty', () => {
		render(
			<CompanionComposerVoiceRail
				density="mobile"
				{...baseProps}
				draftTrimmed={false}
			/>
		);
		expect(
			screen.getByRole('button', { name: 'ewaCompanion.chatSendAria' })
		).toBeDisabled();
	});

	it('enters voice session from phone control', () => {
		const onEnterVoiceSession = vi.fn();
		render(
			<CompanionComposerVoiceRail
				density="desktop"
				{...baseProps}
				onEnterVoiceSession={onEnterVoiceSession}
			/>
		);
		fireEvent.click(screen.getByTestId('ewa-companion-voice-session-enter'));
		expect(onEnterVoiceSession).toHaveBeenCalledOnce();
	});
});

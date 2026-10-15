/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionMobileComposerToolbar (U8.3 slice 14).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionMobileComposerToolbar } from '@/features/ewa/companionUx/CompanionMobileComposerToolbar';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('@/features/ewa/ewaIcons/EwaIcon', () => ({
	EwaIcon: () => <span data-testid="ewa-icon-mock" />,
}));

const baseProps = {
	buttonClassName: 'btn',
	pending: false,
	draftTrimmed: true,
	hideMemoryStrip: false,
	mobileActiveOperationCount: 2,
	memoryStripCount: 1,
	canRestoreLastMessage: true,
	companionVoiceEnabled: true,
	voiceSessionActive: false,
	voiceInputBusy: false,
	voiceInputState: 'idle' as const,
	voiceOutputState: 'idle' as const,
	voiceOutEnabled: false,
	onAttachImage: vi.fn(),
	onOpenOperations: vi.fn(),
	onOpenMemory: vi.fn(),
	onRestoreLastMessage: vi.fn(),
	onEnterVoiceSession: vi.fn(),
	onVoiceSpeakerClick: vi.fn(),
	onVoiceMicClick: vi.fn(),
	onSend: vi.fn(),
};

describe('CompanionMobileComposerToolbar', () => {
	it('opens operations sheet from sparkles control', () => {
		const onOpenOperations = vi.fn();
		render(
			<CompanionMobileComposerToolbar
				{...baseProps}
				onOpenOperations={onOpenOperations}
			/>
		);
		fireEvent.click(screen.getByTestId('ewa-companion-mobile-operations-open'));
		expect(onOpenOperations).toHaveBeenCalledOnce();
	});

	it('opens memory sheet when memory strip is visible', () => {
		const onOpenMemory = vi.fn();
		render(
			<CompanionMobileComposerToolbar
				{...baseProps}
				onOpenMemory={onOpenMemory}
			/>
		);
		fireEvent.click(screen.getByTestId('ewa-companion-mobile-memory-open'));
		expect(onOpenMemory).toHaveBeenCalledOnce();
	});

	it('toggles web search for the next companion turn', () => {
		const onWebSearchChange = vi.fn();
		render(
			<CompanionMobileComposerToolbar
				{...baseProps}
				webSearchLabel="Web"
				onWebSearchChange={onWebSearchChange}
			/>
		);

		fireEvent.click(screen.getByLabelText('Web'));

		expect(onWebSearchChange).toHaveBeenCalledWith(true);
	});
});

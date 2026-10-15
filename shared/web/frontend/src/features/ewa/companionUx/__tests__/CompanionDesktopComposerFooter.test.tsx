/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionDesktopComposerFooter viewport launcher placement.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionDesktopComposerFooter } from '@/features/ewa/companionUx/CompanionDesktopComposerFooter';

vi.mock('@/hooks/useMediaQuery', () => ({
	useMediaQuery: vi.fn(),
}));

vi.mock('@/features/ewa/EwaCompanionQuickPresetsStrip', () => ({
	EwaCompanionQuickPresetsStrip: ({
		launcherPlacement,
	}: {
		launcherPlacement?: 'inline' | 'external';
	}) => (
		<div
			data-testid="quick-presets"
			data-launcher-placement={launcherPlacement}
		/>
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionComposerAttachButtons', () => ({
	CompanionComposerAttachButtons: () => null,
}));

vi.mock('@/features/ewa/companionUx/CompanionComposerVoiceRail', () => ({
	CompanionComposerVoiceRail: () => null,
}));

const baseProps = {
	pending: false,
	draftTrimmed: false,
	canRestoreLastMessage: false,
	onRestoreLastMessage: vi.fn(),
	quickPresetsProps: {
		principalId: 'parent',
		presets: [],
		draft: '',
		pending: false,
		voiceInputBusy: false,
		savingQuickPreset: false,
		deletingQuickPresetId: null,
		renamingQuickPresetId: null,
		onApplyPreset: vi.fn(),
		onSaveDraft: vi.fn(),
		onDeletePreset: vi.fn(),
		onRenamePreset: vi.fn(),
		onOpenToolsCatalog: vi.fn(),
		companionDisplayName: 'Kora',
	},
	companionVoiceEnabled: false,
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

describe('CompanionDesktopComposerFooter', () => {
	it('uses inline launchers below lg viewport', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		vi.mocked(useMediaQuery).mockReturnValue(false);

		render(<CompanionDesktopComposerFooter {...baseProps} />);

		expect(screen.getByTestId('quick-presets')).toHaveAttribute(
			'data-launcher-placement',
			'inline'
		);
	});

	it('uses external launchers at lg+ viewport', async () => {
		const { useMediaQuery } = await import('@/hooks/useMediaQuery');
		vi.mocked(useMediaQuery).mockReturnValue(true);

		render(<CompanionDesktopComposerFooter {...baseProps} />);

		expect(screen.getByTestId('quick-presets')).toHaveAttribute(
			'data-launcher-placement',
			'external'
		);
	});
});

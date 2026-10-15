/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionComposerDraftStack (U8.3 slice 16).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionComposerDraftStack } from '@/features/ewa/companionUx/CompanionComposerDraftStack';

vi.mock('@/features/ewa/companionUx/CompanionComposerTextarea', () => ({
	CompanionComposerTextarea: () => <textarea data-testid="composer-textarea" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionSlashSuggestionsStrip', () => ({
	CompanionSlashSuggestionsStrip: () => (
		<div data-testid="slash-strip">slash</div>
	),
}));

vi.mock('@/features/ewa/EwaCompanionVoiceSessionBar', () => ({
	EwaCompanionVoiceSessionBar: () => (
		<div data-testid="voice-session-bar">voice</div>
	),
}));

describe('CompanionComposerDraftStack', () => {
	it('shows voice session bar when session is active', () => {
		render(
			<CompanionComposerDraftStack
				density="desktop"
				inputRef={{ current: null }}
				draft=""
				pending={false}
				composerExpanded={false}
				onComposerExpandedChange={vi.fn()}
				onDraftChange={vi.fn()}
				onSend={vi.fn()}
				slashSuggestions={[]}
				voiceSessionActive={true}
				voiceSessionPhase="listening"
				sessionMicDisabled={false}
				voiceInputState="idle"
				onSessionMicClick={vi.fn()}
				onExitVoiceSession={vi.fn()}
			/>
		);
		expect(screen.getByTestId('composer-textarea')).toBeInTheDocument();
		expect(screen.getByTestId('voice-session-bar')).toBeInTheDocument();
	});
});

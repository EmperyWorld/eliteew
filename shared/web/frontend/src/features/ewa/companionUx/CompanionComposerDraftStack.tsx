/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared draft stack: textarea, slash suggestions, optional voice session bar (U8.3 slice 16).
 *
 * Invariants:
 * - Mobile vs desktop differs only in textarea density styling.
 * - Expand/collapse state is owned by the composer bundle (collapse on send).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionComposerTextarea.tsx
 * - src/features/ewa/EwaCompanionVoiceSessionBar.tsx
 */

import type { RefObject } from 'react';

import type { CompanionSlashCommand } from '@/features/ewa/companionUx/companionSlashCommands';
import { CompanionComposerTextarea } from '@/features/ewa/companionUx/CompanionComposerTextarea';
import { CompanionSlashSuggestionsStrip } from '@/features/ewa/companionUx/CompanionSlashSuggestionsStrip';
import { EwaCompanionVoiceSessionBar } from '@/features/ewa/EwaCompanionVoiceSessionBar';
import type { EwaCompanionVoiceInputState } from '@/features/ewa/useEwaCompanionVoiceInput';
import type { EwaCompanionVoiceSessionPhase } from '@/features/ewa/useEwaCompanionVoiceSession';

export type CompanionComposerDraftStackDensity = 'mobile' | 'desktop';

export type CompanionComposerDraftStackProps = {
	density: CompanionComposerDraftStackDensity;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	draft: string;
	pending: boolean;
	composerExpanded: boolean;
	onComposerExpandedChange: (expanded: boolean) => void;
	onDraftChange: (value: string) => void;
	onSend: () => void;
	slashSuggestions: readonly CompanionSlashCommand[];
	voiceSessionActive: boolean;
	voiceSessionPhase: EwaCompanionVoiceSessionPhase | null;
	sessionMicDisabled: boolean;
	voiceInputState: EwaCompanionVoiceInputState;
	onSessionMicClick: () => void;
	onExitVoiceSession: () => void;
};

export type CompanionComposerDraftStackCoreProps = Omit<
	CompanionComposerDraftStackProps,
	'density'
>;

export function CompanionComposerDraftStack({
	density,
	inputRef,
	draft,
	pending,
	composerExpanded,
	onComposerExpandedChange,
	onDraftChange,
	onSend,
	slashSuggestions,
	voiceSessionActive,
	voiceSessionPhase,
	sessionMicDisabled,
	voiceInputState,
	onSessionMicClick,
	onExitVoiceSession,
}: CompanionComposerDraftStackProps) {
	return (
		<>
			<CompanionComposerTextarea
				density={density}
				inputRef={inputRef}
				draft={draft}
				pending={pending}
				expanded={composerExpanded}
				onExpandedChange={onComposerExpandedChange}
				onDraftChange={onDraftChange}
				onSend={onSend}
			/>
			<CompanionSlashSuggestionsStrip
				suggestions={slashSuggestions}
				onSelectPrompt={onDraftChange}
			/>
			{voiceSessionActive && voiceSessionPhase ? (
				<EwaCompanionVoiceSessionBar
					phase={voiceSessionPhase}
					micDisabled={sessionMicDisabled}
					isRecording={voiceInputState === 'recording'}
					onMicClick={() => void onSessionMicClick()}
					onHangUp={onExitVoiceSession}
				/>
			) : null}
		</>
	);
}

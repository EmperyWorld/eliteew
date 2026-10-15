/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop composer footer: preset chips row + restore/voice/send actions.
 *
 * Invariants:
 * - Used only in non-mobile-embedded composer layout inside the panel shell.
 * - Launchers live in the left rail at lg+; below lg they stay inline in the preset strip.
 *
 * Related:
 * - src/features/ewa/EwaCompanionQuickPresetsStrip.tsx
 * - src/features/ewa/companionUx/CompanionLeftRailComposerToolsSection.tsx
 * - src/features/ewa/companionUx/CompanionComposerVoiceRail.tsx
 */

import { CompanionComposerAttachButtons } from '@/features/ewa/companionUx/CompanionComposerAttachButtons';
import { CompanionComposerVoiceRail } from '@/features/ewa/companionUx/CompanionComposerVoiceRail';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
	EwaCompanionQuickPresetsStrip,
	type EwaCompanionQuickPresetsStripProps,
} from '@/features/ewa/EwaCompanionQuickPresetsStrip';
import type { EwaCompanionVoiceInputState } from '@/features/ewa/useEwaCompanionVoiceInput';
import type { EwaCompanionVoiceOutputState } from '@/features/ewa/useEwaCompanionVoiceOutput';

export type CompanionDesktopComposerFooterProps = {
	pending: boolean;
	draftTrimmed: boolean;
	canRestoreLastMessage: boolean;
	onRestoreLastMessage: () => void;
	quickPresetsProps: EwaCompanionQuickPresetsStripProps;
	companionVoiceEnabled: boolean;
	voiceSessionActive: boolean;
	voiceInputBusy: boolean;
	voiceInputState: EwaCompanionVoiceInputState;
	voiceOutputState: EwaCompanionVoiceOutputState;
	voiceOutEnabled: boolean;
	onEnterVoiceSession: () => void;
	onVoiceSpeakerClick: () => void;
	onVoiceMicClick: () => void;
	onSend: () => void;
};

export function CompanionDesktopComposerFooter({
	pending,
	draftTrimmed,
	canRestoreLastMessage,
	onRestoreLastMessage,
	quickPresetsProps,
	companionVoiceEnabled,
	voiceSessionActive,
	voiceInputBusy,
	voiceInputState,
	voiceOutputState,
	voiceOutEnabled,
	onEnterVoiceSession,
	onVoiceSpeakerClick,
	onVoiceMicClick,
	onSend,
}: CompanionDesktopComposerFooterProps) {
	const desktopWide = useMediaQuery('(min-width: 1024px)');
	const stripProps: EwaCompanionQuickPresetsStripProps = {
		...quickPresetsProps,
		variant: 'inline',
		launcherPlacement: desktopWide ? 'external' : 'inline',
	};

	return (
		<div className="flex w-full min-w-0 flex-col gap-1.5">
			<div className="min-w-0 overflow-hidden">
				<EwaCompanionQuickPresetsStrip {...stripProps} />
			</div>
			<div className="flex w-full min-w-0 items-center justify-end gap-1">
				<CompanionComposerAttachButtons
					density="desktop"
					pending={pending}
					canRestoreLastMessage={canRestoreLastMessage}
					includeAttach={false}
					includeRestore={true}
					onAttachImage={() => {}}
					onRestoreLastMessage={onRestoreLastMessage}
				/>
				<CompanionComposerVoiceRail
					density="desktop"
					companionVoiceEnabled={companionVoiceEnabled}
					pending={pending}
					draftTrimmed={draftTrimmed}
					voiceSessionActive={voiceSessionActive}
					voiceInputBusy={voiceInputBusy}
					voiceInputState={voiceInputState}
					voiceOutputState={voiceOutputState}
					voiceOutEnabled={voiceOutEnabled}
					onEnterVoiceSession={onEnterVoiceSession}
					onVoiceSpeakerClick={onVoiceSpeakerClick}
					onVoiceMicClick={onVoiceMicClick}
					onSend={onSend}
				/>
			</div>
		</div>
	);
}

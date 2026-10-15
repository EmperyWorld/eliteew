/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Voice session / speaker / mic / send controls shared by mobile and desktop composer layouts (U8.3 slice 14).
 *
 * Invariants:
 * - Does not start voice capture or SSE — parent owns handlers and feature flags.
 *
 * Related:
 * - src/features/ewa/useEwaCompanionVoiceInput.ts
 * - src/features/ewa/useEwaCompanionVoiceOutput.ts
 */

import {
	ArrowPathIcon,
	MicrophoneIcon,
	PaperAirplaneIcon,
	PhoneIcon,
	SpeakerWaveIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import type { EwaCompanionVoiceInputState } from '@/features/ewa/useEwaCompanionVoiceInput';
import type { EwaCompanionVoiceOutputState } from '@/features/ewa/useEwaCompanionVoiceOutput';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionComposerVoiceRailDensity = 'mobile' | 'desktop';

export type CompanionComposerVoiceRailProps = {
	density: CompanionComposerVoiceRailDensity;
	buttonClassName?: string;
	companionVoiceEnabled: boolean;
	pending: boolean;
	draftTrimmed: boolean;
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

export function CompanionComposerVoiceRail({
	density,
	buttonClassName,
	companionVoiceEnabled,
	pending,
	draftTrimmed,
	voiceSessionActive,
	voiceInputBusy,
	voiceInputState,
	voiceOutputState,
	voiceOutEnabled,
	onEnterVoiceSession,
	onVoiceSpeakerClick,
	onVoiceMicClick,
	onSend,
}: CompanionComposerVoiceRailProps) {
	const { t } = useTranslation('marketing');
	const iconClass = density === 'mobile' ? 'size-3.5' : 'size-4';
	const sessionRingClass =
		density === 'mobile'
			? 'ring-1 ring-emerald-400/60 ring-offset-0'
			: 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent';
	const auraRingClass =
		density === 'mobile'
			? 'ring-1 ring-(--companion-aura) ring-offset-0'
			: 'ring-2 ring-(--companion-aura) ring-offset-1 ring-offset-transparent';
	const playingRingClass =
		density === 'mobile'
			? 'ring-1 ring-emerald-400/60 ring-offset-0'
			: 'ring-2 ring-emerald-400/60 ring-offset-1 ring-offset-transparent';
	const recordingRingClass =
		density === 'mobile'
			? 'ring-1 ring-rose-400/70 ring-offset-0'
			: 'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-transparent';

	if (voiceSessionActive) {
		return (
			<DesktopAppButton
				type="button"
				variant="accent"
				size="sm"
				className={buttonClassName}
				disabled={pending || !draftTrimmed}
				onClick={onSend}
				aria-label={t('ewaCompanion.chatSendAria')}
				title={t('ewaCompanion.chatSend')}
				data-testid="ewa-companion-send"
			>
				<PaperAirplaneIcon className={iconClass} aria-hidden />
				{density === 'mobile' ? null : (
					<span className="sr-only">{t('ewaCompanion.chatSend')}</span>
				)}
			</DesktopAppButton>
		);
	}

	return (
		<>
			<DesktopAppButton
				type="button"
				variant={voiceSessionActive ? 'accent' : 'neutral'}
				size="sm"
				className={cn(
					buttonClassName,
					voiceSessionActive && sessionRingClass,
					!companionVoiceEnabled && 'opacity-45'
				)}
				disabled={
					!companionVoiceEnabled ||
					pending ||
					voiceSessionActive ||
					voiceInputBusy
				}
				onClick={onEnterVoiceSession}
				aria-label={t('ewaCompanion.voiceSessionEnterAria')}
				aria-pressed={voiceSessionActive}
				title={
					companionVoiceEnabled
						? t('ewaCompanion.voiceSessionEnterLabel')
						: t('ewaCompanion.voiceFeatureDisabled')
				}
				data-testid="ewa-companion-voice-session-enter"
			>
				<PhoneIcon className={iconClass} aria-hidden />
				{density === 'mobile' ? null : (
					<span className="sr-only">
						{t('ewaCompanion.voiceSessionEnterLabel')}
					</span>
				)}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant={voiceOutEnabled ? 'accent' : 'neutral'}
				size="sm"
				className={cn(
					buttonClassName,
					voiceOutEnabled && voiceOutputState === 'idle' && auraRingClass,
					voiceOutputState === 'playing' && playingRingClass,
					!companionVoiceEnabled && 'opacity-45'
				)}
				disabled={!companionVoiceEnabled || voiceOutputState === 'synthesizing'}
				onClick={onVoiceSpeakerClick}
				aria-label={
					voiceOutputState !== 'idle'
						? t('ewaCompanion.voiceOutStopAria')
						: t('ewaCompanion.voiceOutToggleAria')
				}
				aria-pressed={voiceOutEnabled}
				aria-disabled={!companionVoiceEnabled}
				title={
					companionVoiceEnabled
						? t('ewaCompanion.voiceOutLabel')
						: t('ewaCompanion.voiceFeatureDisabled')
				}
			>
				{voiceOutputState === 'synthesizing' ? (
					<ArrowPathIcon
						className={cn(
							iconClass,
							'motion-safe:animate-spin motion-reduce:animate-none'
						)}
						aria-hidden
					/>
				) : voiceOutputState === 'playing' ? (
					<StopIcon className={iconClass} aria-hidden />
				) : (
					<SpeakerWaveIcon className={iconClass} aria-hidden />
				)}
				{density === 'mobile' ? null : (
					<span className="sr-only">{t('ewaCompanion.voiceOutLabel')}</span>
				)}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant={voiceInputState === 'recording' ? 'accent' : 'neutral'}
				size="sm"
				className={cn(
					buttonClassName,
					voiceInputState === 'recording' && recordingRingClass,
					!companionVoiceEnabled && 'opacity-45'
				)}
				disabled={
					!companionVoiceEnabled ||
					voiceSessionActive ||
					pending ||
					voiceInputState === 'transcribing'
				}
				onClick={() => void onVoiceMicClick()}
				aria-label={
					voiceInputState === 'recording'
						? t('ewaCompanion.voiceInputStopAria')
						: t('ewaCompanion.voiceInputStartAria')
				}
				aria-pressed={voiceInputState === 'recording'}
				aria-disabled={!companionVoiceEnabled}
				title={
					companionVoiceEnabled
						? t('ewaCompanion.voiceInputStartAria')
						: t('ewaCompanion.voiceFeatureDisabled')
				}
			>
				{voiceInputState === 'transcribing' ? (
					<ArrowPathIcon
						className={cn(
							iconClass,
							'motion-safe:animate-spin motion-reduce:animate-none'
						)}
						aria-hidden
					/>
				) : (
					<MicrophoneIcon className={iconClass} aria-hidden />
				)}
			</DesktopAppButton>
			<DesktopAppButton
				type="button"
				variant="accent"
				size="sm"
				className={cn(buttonClassName, density === 'desktop' && 'gap-2')}
				disabled={pending || !draftTrimmed}
				onClick={() => void onSend()}
				aria-label={t('ewaCompanion.chatSendAria')}
				title={density === 'mobile' ? t('ewaCompanion.chatSend') : undefined}
			>
				{pending ? (
					<ArrowPathIcon
						className={cn(
							iconClass,
							'motion-safe:animate-spin motion-reduce:animate-none'
						)}
						aria-hidden
					/>
				) : (
					<PaperAirplaneIcon className={iconClass} aria-hidden />
				)}
				{density === 'desktop' ? (
					<span className="sr-only">{t('ewaCompanion.chatSend')}</span>
				) : null}
			</DesktopAppButton>
		</>
	);
}

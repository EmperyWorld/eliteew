/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UI полоски «голосового сеанса» в companion chat: статус, кнопка микрофона (toggle), завершение сеанса.
 *
 * Invariants:
 * - Только presentation; логика сеанса — в useEwaCompanionVoiceSession.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { EwaCompanionVoiceSessionPhase } from '@/features/ewa/useEwaCompanionVoiceSession';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	MicrophoneIcon,
	PhoneXMarkIcon,
	StopIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export function EwaCompanionVoiceSessionBar({
	phase,
	micDisabled,
	isRecording,
	onMicClick,
	onHangUp,
}: {
	phase: EwaCompanionVoiceSessionPhase;
	micDisabled: boolean;
	isRecording: boolean;
	onMicClick: () => void;
	onHangUp: () => void;
}) {
	const { t } = useTranslation('marketing');

	const phaseKey = `ewaCompanion.voiceSession.phase.${phase}` as const;

	return (
		<section
			className={cn(
				'flex flex-col gap-3 rounded-xl border border-emerald-400/25',
				'bg-emerald-950/35 px-3 py-3 shadow-[0_0_24px_rgba(16,185,129,0.12)]',
				'ring-1 ring-emerald-400/15'
			)}
			aria-label={t('ewaCompanion.voiceSession.regionAria')}
			data-testid="ewa-companion-voice-session-bar"
		>
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300/90">
						{t('ewaCompanion.voiceSession.title')}
					</p>
					<p className="truncate text-[13px] text-(--desktop-text-primary)">
						{t(phaseKey)}
					</p>
				</div>
				<span
					className={cn(
						'size-2.5 shrink-0 rounded-full',
						isRecording && 'animate-pulse bg-rose-400',
						!isRecording && phase === 'speaking' && 'bg-emerald-400',
						!isRecording && phase === 'thinking' && 'bg-amber-300',
						!isRecording &&
							(phase === 'ready' || phase === 'recognizing') &&
							'bg-emerald-500/80'
					)}
					aria-hidden
				/>
			</div>
			<div className="flex items-center justify-center gap-3">
				<DesktopAppButton
					type="button"
					variant={isRecording ? 'accent' : 'neutral'}
					size="md"
					className={cn(
						'!min-h-12 !min-w-12 !rounded-full',
						isRecording &&
							'ring-2 ring-rose-400/70 ring-offset-1 ring-offset-transparent'
					)}
					disabled={micDisabled}
					onClick={onMicClick}
					aria-label={
						isRecording
							? t('ewaCompanion.voiceSession.micStopAria')
							: t('ewaCompanion.voiceSession.micStartAria')
					}
					aria-pressed={isRecording}
					data-testid="ewa-companion-voice-session-mic"
				>
					{phase === 'recognizing' ? (
						<ArrowPathIcon
							className="size-6 motion-safe:animate-spin motion-reduce:animate-none"
							aria-hidden
						/>
					) : isRecording ? (
						<StopIcon className="size-6" aria-hidden />
					) : (
						<MicrophoneIcon className="size-6" aria-hidden />
					)}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={onHangUp}
					aria-label={t('ewaCompanion.voiceSession.hangUpAria')}
					data-testid="ewa-companion-voice-session-hangup"
				>
					<PhoneXMarkIcon className="size-5" aria-hidden />
					<span className="hidden sm:inline">
						{t('ewaCompanion.voiceSession.hangUp')}
					</span>
				</DesktopAppButton>
			</div>
			<p className="text-center text-[11px] text-(--companion-text-soft)">
				{t('ewaCompanion.voiceSession.hint')}
			</p>
		</section>
	);
}

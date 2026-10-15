/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact/regular local audio controls used in widget previews and authenticated mini-player surfaces.
 *
 * Invariants:
 * - Retry action never bubbles to parent clickable containers.
 * - Transport button semantics are delegated to shared AudioTransportControls.
 * - Stall hint uses shared NowPlayingLoadHint; user strings come from desktopUi i18n.
 * - `compact` layout never uses viewport `min-[380px]` breakpoints (narrow widget shell).
 *
 * Related:
 * - src/components/Audio/AudioTransportControls.tsx
 * - src/components/Audio/NowPlayingLoadHint.tsx
 * - src/components/Audio/AuthenticatedAudioPreview.tsx
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { AudioTransportControls } from './AudioTransportControls';
import { NowPlayingLoadHint } from './NowPlayingLoadHint';
import { TrackProgressBar } from './TrackProgressBar';
import { VolumeControl } from './VolumeControl';

/** Matches MusicPlayerPage primary / icon tool focus treatment. */
const interactiveFocusVisible =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-inset';

const skipHitArea =
	'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-(--desktop-text-muted)';

interface MiniAudioControlsProps {
	playing: boolean;
	isLoading?: boolean;
	isLoadingStalled?: boolean;
	hasPrev?: boolean;
	hasNext?: boolean;
	onTogglePlayPause: () => void;
	onPrev?: () => void;
	onNext?: () => void;
	currentTime: number;
	duration: number;
	bufferedRanges?: Array<{ start: number; end: number }>;
	onSeek?: (time: number) => void;
	volume: number;
	onVolumeChange: (value: number) => void;
	/** Сообщение об ошибке воспроизведения (компактная строка над транспортом). */
	playbackError?: string | null;
	/** Повторить загрузку/воспроизведение; клик не всплывает к родителю виджета. */
	onRetryPlayback?: () => void;
	/**
	 * Компактный режим – для десктопного виджета.
	 */
	compact?: boolean;
	className?: string;
}

export const MiniAudioControls: React.FC<MiniAudioControlsProps> = ({
	playing,
	isLoading = false,
	isLoadingStalled = false,
	hasPrev = false,
	hasNext = false,
	onTogglePlayPause,
	onPrev,
	onNext,
	currentTime,
	duration,
	bufferedRanges,
	onSeek,
	volume,
	onVolumeChange,
	playbackError = null,
	onRetryPlayback,
	compact = false,
	className,
}) => {
	const { t } = useTranslation('desktopUi');
	const showPlaybackError = Boolean(playbackError?.trim());

	const stopRetryEventBubble = (e: React.PointerEvent | React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
	};

	return (
		<div
			className={cn(
				'flex flex-col gap-1.5 text-(--desktop-text-primary)',
				compact ? 'w-full' : 'w-auto',
				className
			)}
		>
			<NowPlayingLoadHint
				compact
				isLoadingStalled={isLoadingStalled}
				error={playbackError}
				onRetry={onRetryPlayback}
				retryButtonClassName={cn(
					'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
					interactiveFocusVisible
				)}
			/>
			{showPlaybackError && (
				<div className="flex min-w-0 items-center gap-2">
					<p
						className="min-w-0 flex-1 truncate text-[11px] leading-snug text-rose-200/95"
						title={playbackError ?? undefined}
					>
						{playbackError}
					</p>
					{onRetryPlayback ? (
						<button
							type="button"
							onPointerDown={stopRetryEventBubble}
							onClick={(e) => {
								stopRetryEventBubble(e);
								onRetryPlayback();
							}}
							className={cn(
								'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
								interactiveFocusVisible
							)}
						>
							{t('musicPlayer.nowPlayingBar.retry')}
						</button>
					) : null}
				</div>
			)}
			{compact ? (
				<div className="flex min-w-0 flex-col gap-2">
					<div className="flex min-w-0 items-center justify-between gap-1">
						<AudioTransportControls
							playing={playing}
							isLoading={isLoading}
							hasPrev={hasPrev}
							hasNext={hasNext}
							onTogglePlayPause={onTogglePlayPause}
							onPrev={onPrev}
							onNext={onNext}
							containerClassName="min-w-0 shrink items-center justify-center"
							iconButtonClassName={cn(
								skipHitArea,
								'text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
								interactiveFocusVisible,
								'disabled:focus-visible:ring-0',
								'min-h-9 min-w-9'
							)}
							playButtonClassName={cn(
								'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full transition',
								'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100',
								interactiveFocusVisible,
								'disabled:focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.25)]',
								'border border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:border-[rgb(var(--desktop-accent-rgb)/0.5)] hover:bg-[rgb(var(--desktop-accent-rgb)/0.22)] active:bg-[rgb(var(--desktop-accent-rgb)/0.18)]'
							)}
							prevIconClassName="h-3.5 w-3.5"
							nextIconClassName="h-3.5 w-3.5"
							loadingIconClassName="h-4 w-4 animate-spin"
							pauseIconClassName="h-4 w-4"
							playIconClassName="ml-0 h-4 w-4"
						/>
						<VolumeControl
							volume={volume}
							onChange={onVolumeChange}
							compact
							showSlider={false}
							className="shrink-0"
							title={t('musicPlayer.nowPlayingBar.volumeTitle')}
						/>
					</div>
					<div className="min-h-0 min-w-0 w-full">
						<TrackProgressBar
							currentTime={currentTime}
							duration={duration}
							bufferedRanges={bufferedRanges}
							onSeek={onSeek}
							compact
						/>
					</div>
				</div>
			) : (
				<div className="flex min-w-0 flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-2">
					<AudioTransportControls
						playing={playing}
						isLoading={isLoading}
						hasPrev={hasPrev}
						hasNext={hasNext}
						onTogglePlayPause={onTogglePlayPause}
						onPrev={onPrev}
						onNext={onNext}
						containerClassName="shrink-0 items-center justify-center min-[380px]:justify-start"
						iconButtonClassName={cn(
							skipHitArea,
							'text-(--desktop-text-muted) transition hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)',
							interactiveFocusVisible,
							'disabled:focus-visible:ring-0',
							'max-[379px]:min-h-11 max-[379px]:min-w-11'
						)}
						playButtonClassName={cn(
							'inline-flex min-h-10 min-w-10 items-center justify-center rounded-full transition',
							'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100',
							interactiveFocusVisible,
							'disabled:focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.25)]',
							'bg-[rgb(var(--desktop-accent-rgb))] text-white hover:brightness-110 active:brightness-95'
						)}
						prevIconClassName="h-4 w-4"
						nextIconClassName="h-4 w-4"
						loadingIconClassName="h-5 w-5 animate-spin"
						pauseIconClassName="h-5 w-5"
						playIconClassName="ml-0.5 h-5 w-5"
					/>

					<div className="min-h-0 min-w-0 w-full flex-1 min-[380px]:min-w-24">
						<TrackProgressBar
							currentTime={currentTime}
							duration={duration}
							bufferedRanges={bufferedRanges}
							onSeek={onSeek}
							compact={compact}
						/>
					</div>

					<VolumeControl
						volume={volume}
						onChange={onVolumeChange}
						compact={compact}
						showSlider={!compact}
						className={cn(
							'w-full max-w-xs shrink-0 min-[380px]:ml-2 min-[380px]:w-32',
							'justify-center min-[380px]:justify-start'
						)}
						title={t('musicPlayer.nowPlayingBar.volumeTitle')}
					/>
				</div>
			)}
		</div>
	);
};

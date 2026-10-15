/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared previous/play-next transport controls for desktop audio surfaces.
 *
 * Invariants:
 * - Loading state disables only primary play button and shows spinner icon.
 * - Prev/next are disabled when unavailable but keep stable layout footprint.
 *
 * Related:
 * - src/components/Audio/MiniAudioControls.tsx
 * - src/pages/MusicPlayer/MusicPlayerNowPlayingBar.tsx
 */

import {
	ArrowPathIcon,
	BackwardIcon,
	ForwardIcon,
	PauseIcon,
	PlayIcon,
} from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

type AudioTransportLabels = {
	prev: string;
	next: string;
	play: string;
	pause: string;
	loading: string;
};

const DEFAULT_LABELS: AudioTransportLabels = {
	prev: 'Предыдущий трек',
	next: 'Следующий трек',
	play: 'Воспроизведение',
	pause: 'Пауза',
	loading: 'Загрузка трека',
};

export interface AudioTransportControlsProps {
	playing: boolean;
	isLoading?: boolean;
	hasPrev?: boolean;
	hasNext?: boolean;
	onTogglePlayPause: () => void;
	onPrev?: () => void;
	onNext?: () => void;
	containerClassName?: string;
	iconButtonClassName?: string;
	playButtonClassName?: string;
	prevIconClassName?: string;
	nextIconClassName?: string;
	playIconClassName?: string;
	pauseIconClassName?: string;
	loadingIconClassName?: string;
	strokeWidth?: number;
	labels?: Partial<AudioTransportLabels>;
}

export function AudioTransportControls({
	playing,
	isLoading = false,
	hasPrev = false,
	hasNext = false,
	onTogglePlayPause,
	onPrev,
	onNext,
	containerClassName,
	iconButtonClassName,
	playButtonClassName,
	prevIconClassName,
	nextIconClassName,
	playIconClassName,
	pauseIconClassName,
	loadingIconClassName,
	strokeWidth,
	labels,
}: AudioTransportControlsProps): JSX.Element {
	const focusVisibleClass =
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)';
	const finalLabels = {
		...DEFAULT_LABELS,
		...labels,
	};
	const prevDisabled = !hasPrev || !onPrev;
	const nextDisabled = !hasNext || !onNext;
	return (
		<div className={cn('flex items-center gap-0.5', containerClassName)}>
			<button
				type="button"
				onClick={onPrev}
				disabled={prevDisabled}
				className={cn(focusVisibleClass, iconButtonClassName)}
				aria-label={finalLabels.prev}
				aria-disabled={prevDisabled}
			>
				<BackwardIcon className={prevIconClassName} strokeWidth={strokeWidth} />
			</button>
			{isLoading ? (
				<button
					type="button"
					disabled
					className={cn(focusVisibleClass, playButtonClassName)}
					aria-label={finalLabels.loading}
					aria-busy="true"
				>
					<ArrowPathIcon
						className={loadingIconClassName}
						strokeWidth={strokeWidth}
					/>
				</button>
			) : (
				<button
					type="button"
					onClick={onTogglePlayPause}
					className={cn(focusVisibleClass, playButtonClassName)}
					aria-label={playing ? finalLabels.pause : finalLabels.play}
				>
					{playing ? (
						<PauseIcon
							className={pauseIconClassName}
							strokeWidth={strokeWidth}
						/>
					) : (
						<PlayIcon className={playIconClassName} strokeWidth={strokeWidth} />
					)}
				</button>
			)}
			<button
				type="button"
				onClick={onNext}
				disabled={nextDisabled}
				className={cn(focusVisibleClass, iconButtonClassName)}
				aria-label={finalLabels.next}
				aria-disabled={nextDisabled}
			>
				<ForwardIcon className={nextIconClassName} strokeWidth={strokeWidth} />
			</button>
		</div>
	);
}

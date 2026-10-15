/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared streaming prep stall hint with optional retry for all now-playing surfaces.
 *
 * Invariants:
 * - Renders only when `isLoadingStalled` is true and no hard playback error is set.
 * - Copy uses `desktopUi.musicPlayer.nowPlayingBar.*` keys on every surface.
 *
 * Related:
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/MusicPlayer/MusicPlayerNowPlayingBar.tsx
 */

import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface NowPlayingLoadHintProps {
	isLoadingStalled: boolean;
	error?: string | null;
	onRetry?: () => void;
	/** Compact layout for widget strip, widgets panel, and taskbar popover. */
	compact?: boolean;
	className?: string;
	retryButtonClassName?: string;
}

export function NowPlayingLoadHint({
	isLoadingStalled,
	error = null,
	onRetry,
	compact = false,
	className,
	retryButtonClassName,
}: NowPlayingLoadHintProps) {
	const { t } = useTranslation('desktopUi');

	if (!isLoadingStalled || error?.trim()) {
		return null;
	}

	const retryClassName =
		retryButtonClassName ??
		'inline-flex h-7 shrink-0 items-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0 text-xs text-(--desktop-text-primary) transition hover:bg-(--desktop-surface-soft-hover)';

	return (
		<div
			className={cn(
				compact
					? 'flex min-w-0 items-center gap-2 text-[11px] leading-snug text-amber-200/95'
					: 'mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-amber-200/95',
				className
			)}
			role="status"
			aria-live="polite"
		>
			<span className={compact ? 'min-w-0 flex-1 truncate' : undefined}>
				{t('musicPlayer.nowPlayingBar.loadingStalled')}
			</span>
			{!compact ? (
				<span className="text-(--desktop-text-muted)">
					{t('musicPlayer.nowPlayingBar.loadingStalledHint')}
				</span>
			) : null}
			{onRetry ? (
				<button type="button" onClick={onRetry} className={retryClassName}>
					{t('musicPlayer.nowPlayingBar.retry')}
				</button>
			) : null}
		</div>
	);
}

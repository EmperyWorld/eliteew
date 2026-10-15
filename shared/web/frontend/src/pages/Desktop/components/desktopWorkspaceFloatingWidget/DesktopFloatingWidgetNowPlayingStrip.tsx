/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Isolated now-playing strip for the floating widget — transport/time subscription only.
 *
 * Invariants:
 * - Reads NowPlayingContext transport; does not create parallel audio state.
 *
 * Related:
 * - context/NowPlayingContext.tsx
 * - MusicPlayerNowPlayingBar.tsx
 */

import { AudioTrackMeta } from '../../../../components/Audio/AudioTrackMeta';
import { MiniAudioControls } from '../../../../components/Audio/MiniAudioControls';
import { cn } from '@/utils/cn';
import { formatDuration } from '../../../../utils/formatDuration';
import { m } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { useMusicPlaybackDomain } from '../../context/MusicPlaybackDomainContext';
import {
	useNowPlayingTime,
	useNowPlayingTransport,
} from '../../context/NowPlayingContext';
import {
	ArrowPathIcon,
	ArrowPathRoundedSquareIcon,
	ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	FLOATING_WIDGET_NOW_PLAYING_CONTROLS_CLASS,
	FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS,
	FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS,
} from './widgetChromeStyles';

export const DesktopFloatingWidgetNowPlayingStrip = React.memo(
	function DesktopFloatingWidgetNowPlayingStrip() {
		const { t } = useTranslation('desktopUi');
		const np = useNowPlayingTransport();
		const currentTime = useNowPlayingTime();
		const { hasPrev, hasNext, shuffle, repeat } = useMusicPlaybackDomain();
		if (!np.track) return null;

		return (
			<m.div className={FLOATING_WIDGET_NOW_PLAYING_STRIP_CLASS}>
				<DesktopChromeTooltip
					content={t('floatingWidgetCtx.openMusicPlayer')}
					placement="top"
					offsetExtra={6}
				>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							window.dispatchEvent(
								new CustomEvent('desktop-open-app', {
									detail: { appComponent: 'MusicPlayer' },
								})
							);
						}}
						className="relative flex items-start gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-[rgb(var(--desktop-fg-primary-rgb)/0.05)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]"
					>
						<AudioTrackMeta
							contentId={np.track.id}
							title={np.track.name}
							titleLabel={t('floatingWidgetCtx.nowPlayingLabel')}
							className="relative min-w-0 w-full flex-1"
							thumbnailClassName="h-10 w-10 rounded-[0.85rem] bg-[color-mix(in_srgb,var(--glass-bg-strong)_88%,rgb(var(--desktop-bg-primary-rgb))_12%)] shadow-(--desktop-shadow-soft)"
							thumbnailFallbackIconClassName="h-5 w-5 text-(--desktop-text-muted)"
							titleLabelClassName={FLOATING_WIDGET_NOW_PLAYING_EYEBROW_CLASS}
							titleClassName={cn(DESKTOP_TYPOGRAPHY.widgetTrackTitle, 'mt-1')}
							textBlockClassName="relative min-w-0 flex-1"
							titleTooltip="desktop-styled"
						>
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-0.5 flex items-center justify-between gap-2'
								)}
							>
								<div className="flex min-w-0 items-center gap-2">
									<span className="inline-flex min-w-0 items-center gap-1">
										{np.playing && (
											<span
												className="mr-1 flex items-end gap-0.5 text-[rgb(var(--desktop-accent-rgb)/0.95)]"
												aria-hidden="true"
											>
												<span className="h-2 w-0.5 rounded-full motion-safe:animate-pulse motion-reduce:animate-none bg-[rgb(var(--desktop-accent-rgb))] [animation-delay:0ms]" />
												<span className="h-3 w-0.5 rounded-full motion-safe:animate-pulse motion-reduce:animate-none bg-[rgb(var(--desktop-accent-rgb)/0.75)] [animation-delay:120ms]" />
												<span className="h-1.5 w-0.5 rounded-full motion-safe:animate-pulse motion-reduce:animate-none bg-[rgb(var(--desktop-accent-rgb)/0.55)] [animation-delay:240ms]" />
											</span>
										)}
										<span className="truncate">
											{np.playing
												? t('musicPlayer.nowPlayingBar.transportPlay')
												: t('musicPlayer.nowPlayingBar.transportPause')}
										</span>
									</span>
									<span className="inline-flex items-center gap-1 text-(--desktop-text-dim)">
										{shuffle && <ArrowsRightLeftIcon className="h-3 w-3" />}
										{repeat === 'all' && <ArrowPathIcon className="h-3 w-3" />}
										{repeat === 'one' && (
											<ArrowPathRoundedSquareIcon className="h-3 w-3" />
										)}
									</span>
								</div>
								{np.duration > 0 && (
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'text-(--desktop-text-dim) tabular-nums'
										)}
									>
										{formatDuration(currentTime)} /{' '}
										{formatDuration(np.duration)}
									</span>
								)}
							</div>
						</AudioTrackMeta>
					</button>
				</DesktopChromeTooltip>
				<div
					className={FLOATING_WIDGET_NOW_PLAYING_CONTROLS_CLASS}
					onPointerDown={(e) => {
						e.stopPropagation();
					}}
				>
					<MiniAudioControls
						compact
						className="w-full"
						playing={np.playing}
						isLoading={np.isLoading}
						isLoadingStalled={np.isLoadingStalled}
						hasPrev={hasPrev}
						hasNext={hasNext}
						onTogglePlayPause={np.togglePlayPause}
						onPrev={np.prev}
						onNext={np.next}
						currentTime={currentTime}
						duration={np.duration}
						bufferedRanges={np.bufferedRanges}
						onSeek={np.seek}
						volume={np.volume}
						onVolumeChange={np.setVolume}
						playbackError={
							np.error ??
							(np.errorTrackId
								? t('settingsPanel.widgetsPanel.playbackError')
								: null)
						}
						onRetryPlayback={() => {
							void np.retryCurrentTrack();
						}}
					/>
				</div>
			</m.div>
		);
	}
);

DesktopFloatingWidgetNowPlayingStrip.displayName =
	'DesktopFloatingWidgetNowPlayingStrip';

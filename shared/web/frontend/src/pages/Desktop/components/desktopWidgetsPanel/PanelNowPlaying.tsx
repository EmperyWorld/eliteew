/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Now-playing widget slot body with compact preview and optional mini transport.
 *
 * Invariants:
 * - Reads NowPlayingContext; opens full player via callback only.
 *
 * Related:
 * - NowPlayingContext.tsx
 * - DesktopWidgetsPanel.tsx
 */

import { MiniAudioControls } from '../../../../components/Audio/MiniAudioControls';
import { NowPlayingLoadHint } from '../../../../components/Audio/NowPlayingLoadHint';
import { ContentThumbnail } from '../../../../components/UnifiedContent/components/ContentThumbnail';
import { cn } from '@/utils/cn';
import { formatDuration } from '../../../../utils/formatDuration';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { useMusicPlaybackDomain } from '../../context/MusicPlaybackDomainContext';
import {
	useNowPlayingTime,
	useNowPlayingTransport,
} from '../../context/NowPlayingContext';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export const PanelNowPlaying = React.memo(function PanelNowPlaying({
	compact,
	onOpenMusicPlayer,
}: {
	compact: boolean;
	onOpenMusicPlayer: () => void;
}) {
	const { t } = useTranslation('desktopUi');
	const np = useNowPlayingTransport();
	const currentTime = useNowPlayingTime();
	const { hasPrev, hasNext } = useMusicPlaybackDomain();

	if (!np.track) {
		return (
			<p
				className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-(--desktop-text-dim)')}
			>
				{t('settingsPanel.widgetsPanel.nowPlayingEmpty')}
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<DesktopChromeTooltip
				content={`${t('settingsPanel.widgetsPanel.openApp')}: ${np.track.name}`}
				placement="top"
				offsetExtra={4}
			>
				<button
					type="button"
					onClick={onOpenMusicPlayer}
					className={cn(
						'flex w-full min-w-0 items-start gap-2 rounded-xl p-1.5 text-left transition-colors',
						'hover:bg-(--desktop-surface-soft) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
					)}
				>
					<div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-(--desktop-border-subtle)">
						<ContentThumbnail
							contentId={np.track.id}
							className="h-full w-full object-cover"
							skipThumbnail
						>
							<div className="flex h-full w-full items-center justify-center bg-transparent">
								<MusicalNoteIcon className="h-4 w-4 text-(--desktop-text-muted)" />
							</div>
						</ContentThumbnail>
					</div>
					<div className="min-w-0 flex-1">
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.caption,
								'text-(--desktop-text-dim)'
							)}
						>
							{t('settingsPanel.widgetSlot.now-playing')}
						</p>
						<p className={DESKTOP_TYPOGRAPHY.widgetTrackTitle}>
							{np.track.name}
						</p>
						{!compact && np.duration > 0 && (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.caption,
									'text-(--desktop-text-dim) tabular-nums'
								)}
							>
								{formatDuration(currentTime)} / {formatDuration(np.duration)}
							</p>
						)}
						<NowPlayingLoadHint
							compact
							className="mt-1"
							isLoadingStalled={np.isLoadingStalled}
							error={
								np.error ??
								(np.errorTrackId
									? t('settingsPanel.widgetsPanel.playbackError')
									: null)
							}
							onRetry={() => {
								void np.retryCurrentTrack();
							}}
						/>
					</div>
				</button>
			</DesktopChromeTooltip>
			{!compact && (
				<div
					className="rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-1.5"
					onPointerDown={(e) => e.stopPropagation()}
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
			)}
		</div>
	);
});

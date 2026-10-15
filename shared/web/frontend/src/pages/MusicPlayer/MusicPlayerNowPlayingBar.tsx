/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Music Player now-playing footer with metadata, transport, progress, queue mode toggles and utility controls.
 *
 * Invariants:
 * - Transport control semantics are shared with other surfaces via AudioTransportControls.
 * - Playback state shown here is transport-authoritative from NowPlayingContext.
 * - Eyebrow / utility chips stay sentence-case (musicPlayerChrome tokens).
 *
 * Related:
 * - src/components/Audio/AudioTransportControls.tsx
 * - src/components/Audio/NowPlayingLoadHint.tsx
 * - src/pages/Desktop/context/NowPlayingContext.tsx
 * - src/pages/MusicPlayer/musicPlayerChrome.ts
 */

import { cn } from '@/lib/utils';
import {
	MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS,
	MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS,
	MUSIC_PLAYER_NOW_PLAYING_PAD_CLASS,
	MUSIC_PLAYER_NOW_PLAYING_PLAY_BTN_CLASS,
	MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS,
	musicPlayerFooterStripClass,
	musicPlayerUtilityChipClass,
} from './musicPlayerChrome';
import { memo, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioTrackMeta } from '../../components/Audio/AudioTrackMeta';
import { AudioTransportControls } from '../../components/Audio/AudioTransportControls';
import { NowPlayingLoadHint } from '../../components/Audio/NowPlayingLoadHint';
import { PlaybackStatusAnnouncer } from '../../components/Audio/PlaybackStatusAnnouncer';
import { TrackProgressBar } from '../../components/Audio/TrackProgressBar';
import { VolumeControl } from '../../components/Audio/VolumeControl';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';
import {
	type NowPlayingTransportValue,
	useNowPlayingTime,
} from '../Desktop/context/NowPlayingContext';
import type { RepeatMode } from './musicPlayerTypes';
import {
	ArrowPathIcon,
	ArrowPathRoundedSquareIcon,
	ArrowsRightLeftIcon,
	BackwardIcon,
	ForwardIcon,
	MusicalNoteIcon,
} from '@heroicons/react/24/outline';

export interface MusicPlayerNowPlayingBarProps {
	contentPanelClass: string;
	nowPlaying: NowPlayingTransportValue;
	shuffle: boolean;
	setShuffle: Dispatch<SetStateAction<boolean>>;
	repeat: RepeatMode;
	setRepeat: Dispatch<SetStateAction<RepeatMode>>;
	hasPrev: boolean;
	hasNext: boolean;
	goPrev: () => void;
	goNext: () => void;
	loopStart: number | null;
	loopEnd: number | null;
	setLoopStart: Dispatch<SetStateAction<number | null>>;
	setLoopEnd: Dispatch<SetStateAction<number | null>>;
	seekStepSeconds: 5 | 10 | 30;
	setSeekStepSeconds: Dispatch<SetStateAction<5 | 10 | 30>>;
	onSeekRelative: (deltaSeconds: number) => void;
	loading: boolean;
	filteredTrackCount: number;
	strokeWidth: number;
}

type NowPlayingTransportWithTrack = NowPlayingTransportValue & {
	track: NonNullable<NowPlayingTransportValue['track']>;
};

type NowPlayingBarActiveProps = Omit<
	MusicPlayerNowPlayingBarProps,
	'loading' | 'filteredTrackCount' | 'contentPanelClass'
> & {
	currentTime: number;
	nowPlaying: NowPlayingTransportWithTrack;
};

const NowPlayingBarActiveView = memo(function NowPlayingBarActiveView({
	nowPlaying,
	shuffle,
	setShuffle,
	repeat,
	setRepeat,
	hasPrev,
	hasNext,
	goPrev,
	goNext,
	loopStart,
	loopEnd,
	setLoopStart,
	setLoopEnd,
	seekStepSeconds,
	setSeekStepSeconds,
	onSeekRelative,
	currentTime,
	strokeWidth: sw,
}: NowPlayingBarActiveProps) {
	const { t } = useTranslation('desktopUi');
	const playbackRateLabel = (nowPlaying.playbackRate || 1)
		.toFixed(2)
		.replace(/\.00$/, '');

	const playbackStatusHint =
		nowPlaying.isLoadingStalled && !nowPlaying.error
			? t('musicPlayer.nowPlayingBar.loadingStalled')
			: null;

	return (
		<div
			className={cn(
				MUSIC_PLAYER_NOW_PLAYING_PAD_CLASS,
				musicPlayerFooterStripClass
			)}
		>
			<PlaybackStatusAnnouncer
				playing={nowPlaying.playing}
				isLoading={nowPlaying.isLoading}
				error={nowPlaying.error ?? playbackStatusHint}
				trackName={nowPlaying.track.name}
				messages={{
					loading: t('musicPlayer.nowPlayingBar.transportLoading'),
					playing: t('musicPlayer.nowPlayingBar.transportPlay'),
					paused: t('musicPlayer.nowPlayingBar.transportPause'),
					errorPrefix: t('musicPlayer.nowPlayingBar.playbackError'),
				}}
			/>
			<div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3">
				<div className="flex min-w-0 w-full flex-1 items-stretch">
					<AudioTrackMeta
						contentId={nowPlaying.track.id}
						title={nowPlaying.track.name}
						titleLabel={t('musicPlayer.nowPlayingBar.nowPlayingLabel')}
						className="w-full"
						textBlockClassName="w-full"
						titleLabelClassName={MUSIC_PLAYER_NOW_PLAYING_EYEBROW_CLASS}
						titleClassName={MUSIC_PLAYER_NOW_PLAYING_TITLE_CLASS}
						thumbnailClassName="h-10 w-10 shadow-none"
						error={
							nowPlaying.error ??
							(nowPlaying.errorTrackId
								? t('musicPlayer.nowPlayingBar.playbackError')
								: null)
						}
						errorClassName="text-[11px] leading-snug text-red-200/95"
						onRetryError={() => {
							void nowPlaying.retryCurrentTrack();
						}}
						retryButtonClassName="inline-flex h-7 items-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0 text-xs text-(--desktop-text-primary) transition hover:bg-(--desktop-surface-soft-hover)"
						retryLabel={t('musicPlayer.nowPlayingBar.retry')}
						thumbnailFallbackIconClassName="h-5 w-5 text-(--desktop-text-dim)"
					>
						<NowPlayingLoadHint
							isLoadingStalled={nowPlaying.isLoadingStalled}
							error={nowPlaying.error}
							onRetry={() => {
								void nowPlaying.retryCurrentTrack();
							}}
						/>
						<TrackProgressBar
							currentTime={currentTime}
							duration={nowPlaying.duration}
							bufferedRanges={nowPlaying.bufferedRanges}
							onSeek={nowPlaying.seek}
							className="mt-1 w-full"
						/>
					</AudioTrackMeta>
				</div>

				<div className="flex min-w-0 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 sm:flex-nowrap lg:shrink-0 lg:justify-end">
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => setShuffle((s) => !s)}
							className={cn(
								MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS,
								shuffle && 'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
							)}
							aria-label={
								shuffle
									? t('musicPlayer.nowPlayingBar.shuffleOnAria')
									: t('musicPlayer.nowPlayingBar.shuffleOffAria')
							}
							title={
								shuffle
									? t('musicPlayer.nowPlayingBar.shuffleOnTitle')
									: t('musicPlayer.nowPlayingBar.shuffleOffTitle')
							}
						>
							<ArrowsRightLeftIcon className="h-3.5 w-3.5" strokeWidth={sw} />
						</button>
						<button
							type="button"
							onClick={() =>
								setRepeat((r) =>
									r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'
								)
							}
							className={cn(
								MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS,
								repeat !== 'none' &&
									'text-[rgb(var(--desktop-accent-rgb)/0.95)]'
							)}
							aria-label={
								repeat === 'one'
									? t('musicPlayer.nowPlayingBar.repeatAriaOne')
									: repeat === 'all'
										? t('musicPlayer.nowPlayingBar.repeatAriaAll')
										: t('musicPlayer.nowPlayingBar.repeatAriaNone')
							}
							title={
								repeat === 'one'
									? t('musicPlayer.nowPlayingBar.repeatTitleOne')
									: repeat === 'all'
										? t('musicPlayer.nowPlayingBar.repeatTitleAll')
										: t('musicPlayer.nowPlayingBar.repeatTitleNone')
							}
						>
							{repeat === 'one' ? (
								<ArrowPathRoundedSquareIcon
									className="h-3.5 w-3.5"
									strokeWidth={sw}
								/>
							) : (
								<ArrowPathIcon className="h-3.5 w-3.5" strokeWidth={sw} />
							)}
						</button>
					</div>

					<AudioTransportControls
						playing={nowPlaying.playing}
						isLoading={nowPlaying.isLoading}
						hasPrev={hasPrev}
						hasNext={hasNext}
						onTogglePlayPause={nowPlaying.togglePlayPause}
						onPrev={goPrev}
						onNext={goNext}
						containerClassName="mx-0.5 sm:mx-1"
						iconButtonClassName={MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS}
						playButtonClassName={MUSIC_PLAYER_NOW_PLAYING_PLAY_BTN_CLASS}
						prevIconClassName="h-4 w-4"
						nextIconClassName="h-4 w-4"
						loadingIconClassName="h-4 w-4 animate-spin"
						pauseIconClassName="h-4 w-4"
						playIconClassName="ml-0.5 h-4 w-4"
						strokeWidth={sw}
						labels={{
							prev: t('musicPlayer.nowPlayingBar.transportPrev'),
							next: t('musicPlayer.nowPlayingBar.transportNext'),
							play: t('musicPlayer.nowPlayingBar.transportPlay'),
							pause: t('musicPlayer.nowPlayingBar.transportPause'),
							loading: t('musicPlayer.nowPlayingBar.transportLoading'),
						}}
					/>
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							onClick={() => onSeekRelative(-seekStepSeconds)}
							className={MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS}
							aria-label={t('musicPlayer.nowPlayingBar.seekBackAria', {
								seconds: seekStepSeconds,
							})}
							title={t('musicPlayer.nowPlayingBar.seekBackTitle', {
								seconds: seekStepSeconds,
							})}
						>
							<BackwardIcon className="h-3.5 w-3.5" strokeWidth={sw} />
						</button>
						<button
							type="button"
							onClick={() => onSeekRelative(seekStepSeconds)}
							className={MUSIC_PLAYER_NOW_PLAYING_ICON_BTN_CLASS}
							aria-label={t('musicPlayer.nowPlayingBar.seekForwardAria', {
								seconds: seekStepSeconds,
							})}
							title={t('musicPlayer.nowPlayingBar.seekForwardTitle', {
								seconds: seekStepSeconds,
							})}
						>
							<ForwardIcon className="h-3.5 w-3.5" strokeWidth={sw} />
						</button>
					</div>

					<div className="flex min-w-28 max-w-40 flex-1 items-center sm:min-w-26 sm:max-w-32 sm:flex-none">
						<VolumeControl
							volume={nowPlaying.volume}
							onChange={nowPlaying.setVolume}
							title={t('musicPlayer.nowPlayingBar.volumeTitle')}
							className="w-full"
						/>
					</div>

					<div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 text-(--desktop-text-muted) min-[1100px]:w-auto">
						<button
							type="button"
							onClick={() =>
								setSeekStepSeconds((current) =>
									current === 5 ? 10 : current === 10 ? 30 : 5
								)
							}
							className={musicPlayerUtilityChipClass()}
							aria-label={t('musicPlayer.nowPlayingBar.seekStepChipAria', {
								seconds: seekStepSeconds,
							})}
							title={t('musicPlayer.nowPlayingBar.seekStepChipTitle')}
						>
							{t('musicPlayer.nowPlayingBar.seekStepChipLabel', {
								seconds: seekStepSeconds,
							})}
						</button>
						<button
							type="button"
							onClick={() => {
								const speeds = [0.75, 1, 1.25, 1.5, 2];
								const currentIndex = speeds.findIndex(
									(v) => Math.abs(v - (nowPlaying.playbackRate || 1)) < 0.01
								);
								const next = speeds[(currentIndex + 1) % speeds.length];
								nowPlaying.setPlaybackRate(next);
							}}
							className={musicPlayerUtilityChipClass(
								Math.abs((nowPlaying.playbackRate || 1) - 1) > 0.01
							)}
							aria-label={t('musicPlayer.nowPlayingBar.rateChipAria', {
								rate: playbackRateLabel,
							})}
							title={t('musicPlayer.nowPlayingBar.rateChipTitle')}
						>
							{`${playbackRateLabel}x`}
						</button>
						<div className="flex items-center gap-0.5">
							<button
								type="button"
								onClick={() => {
									setLoopStart(currentTime || 0);
									if (loopEnd != null && loopEnd <= currentTime) {
										setLoopEnd(null);
									}
								}}
								className={musicPlayerUtilityChipClass(loopStart != null)}
								aria-label={t('musicPlayer.nowPlayingBar.loopPointAAria')}
								title={t('musicPlayer.nowPlayingBar.loopPointATitle')}
							>
								A
							</button>
							<button
								type="button"
								onClick={() => {
									if (loopStart == null) {
										setLoopStart(currentTime || 0);
									} else if (loopEnd == null) {
										setLoopEnd(Math.max(currentTime || 0, loopStart + 0.5));
									} else {
										setLoopStart(null);
										setLoopEnd(null);
									}
								}}
								className={musicPlayerUtilityChipClass(
									loopStart != null && loopEnd != null
								)}
								aria-label={
									loopStart != null && loopEnd != null
										? t('musicPlayer.nowPlayingBar.loopPointBAriaReset')
										: t('musicPlayer.nowPlayingBar.loopPointBAriaSet')
								}
								title={
									loopStart != null && loopEnd != null
										? t('musicPlayer.nowPlayingBar.loopPointBTitleReset')
										: t('musicPlayer.nowPlayingBar.loopPointBTitleSet')
								}
							>
								B
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
});

type NowPlayingBarEmptyProps = Pick<
	MusicPlayerNowPlayingBarProps,
	'contentPanelClass' | 'strokeWidth'
>;

const NowPlayingBarEmptyPrompt = memo(function NowPlayingBarEmptyPrompt({
	contentPanelClass,
	strokeWidth: sw,
}: NowPlayingBarEmptyProps) {
	const { t } = useTranslation('desktopUi');

	return (
		<div
			className={cn(
				'flex items-center gap-2.5',
				MUSIC_PLAYER_NOW_PLAYING_PAD_CLASS,
				musicPlayerFooterStripClass
			)}
			role="status"
			aria-live="polite"
		>
			<div
				className={cn(
					contentPanelClass,
					'flex h-11 w-11 shrink-0 items-center justify-center p-0'
				)}
			>
				<MusicalNoteIcon
					className="h-5 w-5 text-(--desktop-text-dim)"
					strokeWidth={sw}
				/>
			</div>
			<div className="min-w-0">
				<p className="text-sm font-medium text-(--desktop-text-primary)">
					{t('musicPlayer.nowPlayingBar.noTrack')}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'text-(--desktop-text-muted)'
					)}
				>
					{t('musicPlayer.nowPlayingBar.selectHint')}
				</p>
			</div>
		</div>
	);
});

export const MusicPlayerNowPlayingBar = memo(function MusicPlayerNowPlayingBar({
	contentPanelClass,
	nowPlaying,
	shuffle,
	setShuffle,
	repeat,
	setRepeat,
	hasPrev,
	hasNext,
	goPrev,
	goNext,
	loopStart,
	loopEnd,
	setLoopStart,
	setLoopEnd,
	seekStepSeconds,
	setSeekStepSeconds,
	onSeekRelative,
	loading,
	filteredTrackCount,
	strokeWidth,
}: MusicPlayerNowPlayingBarProps) {
	const currentTime = useNowPlayingTime();

	if (nowPlaying.track) {
		return (
			<NowPlayingBarActiveView
				nowPlaying={nowPlaying as NowPlayingTransportWithTrack}
				shuffle={shuffle}
				setShuffle={setShuffle}
				repeat={repeat}
				setRepeat={setRepeat}
				hasPrev={hasPrev}
				hasNext={hasNext}
				goPrev={goPrev}
				goNext={goNext}
				loopStart={loopStart}
				loopEnd={loopEnd}
				setLoopStart={setLoopStart}
				setLoopEnd={setLoopEnd}
				seekStepSeconds={seekStepSeconds}
				setSeekStepSeconds={setSeekStepSeconds}
				onSeekRelative={onSeekRelative}
				currentTime={currentTime}
				strokeWidth={strokeWidth}
			/>
		);
	}

	if (!loading && filteredTrackCount > 0) {
		return (
			<NowPlayingBarEmptyPrompt
				contentPanelClass={contentPanelClass}
				strokeWidth={strokeWidth}
			/>
		);
	}

	return null;
});

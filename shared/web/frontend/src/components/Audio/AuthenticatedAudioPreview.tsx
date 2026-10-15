/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared authenticated audio preview primitive for UGS/Content Manager surfaces.
 *
 * Invariants:
 * - Audio blobs are fetched with authenticated `/content/{id}/download` and aborted on unmount/switch.
 * - Object URLs are revoked before replacing source and during cleanup.
 * - Preview playback stays local; global queue handoff is an explicit user action.
 * - Captions `<track>` only when `captionsSrc` is provided (no hardcoded RU aria/loading copy).
 *
 * Related:
 * - src/components/UGS/hub/results/UgsHubUnifiedContentPreviews.tsx
 * - src/pages/ContentManager/components/ContentManagerPreviews.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthenticatedAudioBlob } from '@/hooks/audio/useAuthenticatedAudioBlob';
import { useObjectUrlLifecycle } from '@/hooks/audio/useObjectUrlLifecycle';
import {
	foflineNowPlaying,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '@/services/audio/foflineDecodedPlayback';
import { requestPlayAndOpenMusicPlayer } from '@/pages/Desktop/utils/desktopDeepLink';
import type { AudioSourceSurface } from '@/services/audio/playerAudioContracts';
import {
	type PlaybackErrorCategory,
	mapPlaybackErrorInfo,
} from '@/services/audio/playbackErrors';
import { normalizeAudioBlob } from '@/services/audio/normalizeAudioBlob';
import { cn } from '@/utils/cn';

import { MiniAudioControls } from './MiniAudioControls';
import { PlaybackStatusAnnouncer } from './PlaybackStatusAnnouncer';

function readBufferedRanges(
	audio: HTMLAudioElement
): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	for (let index = 0; index < audio.buffered.length; index += 1) {
		try {
			const start = audio.buffered.start(index);
			const end = audio.buffered.end(index);
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
				continue;
			}
			ranges.push({ start, end });
		} catch {
			// ignore malformed range row
		}
	}
	return ranges;
}

export interface AuthenticatedAudioPreviewProps {
	contentId: string;
	contentVersion?: string | null;
	mimeType?: string | null;
	trackName?: string | null;
	thumbnailUrl?: string | null;
	sourceSurface?: AudioSourceSurface;
	/** Fallback timeline length until browser metadata is ready (e.g. run.duration_seconds). */
	durationHintSeconds?: number | null;
	/** Optional WebVTT URL/data URL; when set, renders captions track (e.g. UGS Hub placeholder). */
	captionsSrc?: string | null;
	captionsSrcLang?: string;
	captionsLabel?: string;
	className?: string;
	compact?: boolean;
	showPlayInMusicPlayer?: boolean;
}

export const AuthenticatedAudioPreview: React.FC<
	AuthenticatedAudioPreviewProps
> = ({
	contentId,
	contentVersion = null,
	mimeType = null,
	trackName = null,
	thumbnailUrl = null,
	sourceSurface = 'unknown',
	durationHintSeconds = null,
	captionsSrc = null,
	captionsSrcLang,
	captionsLabel,
	className,
	compact = false,
	showPlayInMusicPlayer = false,
}) => {
	const { t, i18n } = useTranslation('desktopUi');
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const trimmedCaptionsSrc = (captionsSrc ?? '').trim();
	const resolvedCaptionsLang =
		(captionsSrcLang ?? i18n.language ?? 'en').split('-')[0] || 'en';
	const resolvedCaptionsLabel =
		captionsLabel?.trim() || t('inlineAudio.captionsLabel');
	const [retryNonce, setRetryNonce] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [bufferedRanges, setBufferedRanges] = useState<
		Array<{ start: number; end: number }>
	>([]);
	const [volume, setVolume] = useState(1);
	const [playbackError, setPlaybackError] = useState<string | null>(null);
	const [errorCategory, setErrorCategory] =
		useState<PlaybackErrorCategory | null>(null);
	const [decodedReady, setDecodedReady] = useState(false);
	const { objectUrl, setBlob, revoke } = useObjectUrlLifecycle();
	const { fetchAudioBlob, abortInFlightFetch } = useAuthenticatedAudioBlob();
	const resolvedMimeType = mimeType || 'audio/mpeg';
	const durationHint =
		typeof durationHintSeconds === 'number' &&
		Number.isFinite(durationHintSeconds) &&
		durationHintSeconds > 0
			? durationHintSeconds
			: 0;
	const displayDuration = duration > 0 ? duration : durationHint;

	useEffect(() => {
		void retryNonce;
		if (!contentId.trim()) {
			setPlaybackError(t('nowPlaying.error404'));
			setIsLoading(false);
			return;
		}
		let cancelled = false;
		setIsLoading(true);
		setPlaybackError(null);
		setErrorCategory(null);
		setPlaying(false);
		setCurrentTime(0);
		setDuration(0);
		setBufferedRanges([]);
		setDecodedReady(false);
		revoke();
		void (async () => {
			try {
				const blob = await fetchAudioBlob({
					unifiedContentId: contentId,
					version: contentVersion,
					maxAttempts: 5,
					initialDelayMs: 400,
				});
				if (cancelled) return;
				if (!blob || blob.size <= 0) {
					throw new Error('EMPTY_AUDIO_BLOB');
				}
				if (isFoflineSpaWebAudioHost()) {
					releaseHtmlMediaElement(audioRef.current);
					const bytes = await blob.arrayBuffer();
					if (cancelled) return;
					const durationSeconds = await foflineNowPlaying.loadBytes(bytes, 0);
					if (cancelled) {
						foflineNowPlaying.stop();
						return;
					}
					foflineNowPlaying.loadedTrackId = contentId;
					foflineNowPlaying.onTick = (snapshot) => {
						if (cancelled) return;
						setCurrentTime(snapshot.currentTime);
						setDuration(snapshot.duration || durationSeconds);
						setPlaying(snapshot.playing);
					};
					setDuration(durationSeconds);
					setBufferedRanges([{ start: 0, end: durationSeconds }]);
					setDecodedReady(true);
					return;
				}
				setBlob(normalizeAudioBlob(blob, resolvedMimeType, trackName));
			} catch (error: unknown) {
				if (cancelled) return;
				const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
				if (info.category !== 'aborted') {
					setPlaybackError(info.message);
					setErrorCategory(info.category);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
			abortInFlightFetch();
			if (isFoflineSpaWebAudioHost()) {
				releaseHtmlMediaElement(audioRef.current);
			}
		};
	}, [
		abortInFlightFetch,
		contentId,
		contentVersion,
		fetchAudioBlob,
		resolvedMimeType,
		retryNonce,
		revoke,
		setBlob,
		t,
		trackName,
	]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || !objectUrl || isFoflineSpaWebAudioHost()) return;

		audio.pause();
		audio.currentTime = 0;
		setPlaying(false);
		setCurrentTime(0);
		setDuration(0);
		setBufferedRanges([]);
		setPlaybackError(null);
		setErrorCategory(null);

		const onTimeUpdate = () => setCurrentTime(audio.currentTime);
		const onLoadedMetadata = () => {
			setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
			setBufferedRanges(readBufferedRanges(audio));
		};
		const onDurationChange = () => {
			if (Number.isFinite(audio.duration) && audio.duration > 0) {
				setDuration(audio.duration);
			}
		};
		const onProgress = () => {
			setBufferedRanges(readBufferedRanges(audio));
		};
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);
		const onError = () => {
			const info = mapPlaybackErrorInfo(new Error('AUDIO_DECODE_ERROR'), t);
			setPlaybackError(info.message);
			setErrorCategory(info.category);
			setPlaying(false);
		};

		audio.addEventListener('timeupdate', onTimeUpdate);
		audio.addEventListener('loadedmetadata', onLoadedMetadata);
		audio.addEventListener('durationchange', onDurationChange);
		audio.addEventListener('progress', onProgress);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('error', onError);

		audio.src = objectUrl;
		audio.load();

		return () => {
			audio.removeEventListener('timeupdate', onTimeUpdate);
			audio.removeEventListener('loadedmetadata', onLoadedMetadata);
			audio.removeEventListener('durationchange', onDurationChange);
			audio.removeEventListener('progress', onProgress);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('error', onError);
		};
	}, [objectUrl, t]);

	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = volume;
		}
	}, [volume]);

	const togglePlayPause = useCallback(() => {
		if (isFoflineSpaWebAudioHost() && decodedReady) {
			releaseHtmlMediaElement(audioRef.current);
			if (foflineNowPlaying.isPlaying) {
				foflineNowPlaying.pause();
				setPlaying(false);
				return;
			}
			void foflineNowPlaying.play().catch((error: unknown) => {
				const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
				setPlaybackError(info.message);
				setErrorCategory(info.category);
				setPlaying(false);
			});
			setPlaying(true);
			return;
		}
		const audio = audioRef.current;
		if (!audio || !objectUrl) return;
		if (audio.paused) {
			void audio.play().catch((error: unknown) => {
				const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
				setPlaybackError(info.message);
				setErrorCategory(info.category);
				setPlaying(false);
			});
		} else {
			audio.pause();
		}
	}, [decodedReady, objectUrl, t]);

	const seek = useCallback(
		(time: number) => {
			if (isFoflineSpaWebAudioHost() && decodedReady) {
				foflineNowPlaying.seek(time, foflineNowPlaying.isPlaying);
				setCurrentTime(time);
				return;
			}
			const audio = audioRef.current;
			if (!audio || !Number.isFinite(time)) return;
			audio.currentTime = time;
			setCurrentTime(time);
		},
		[decodedReady]
	);

	const handleRetry = useCallback(() => {
		setRetryNonce((v) => v + 1);
	}, []);

	const handlePlayInMusicPlayer = useCallback(() => {
		requestPlayAndOpenMusicPlayer({
			id: contentId,
			name: (trackName || '').trim() || contentId,
			thumbnail_url: thumbnailUrl,
			version: contentVersion,
			mime_type: resolvedMimeType,
			source_surface: sourceSurface,
		});
	}, [
		contentId,
		contentVersion,
		resolvedMimeType,
		sourceSurface,
		thumbnailUrl,
		trackName,
	]);

	if (isLoading) {
		return (
			<div
				className={cn(
					'flex items-center justify-center gap-2 text-(--desktop-text-dim)',
					className
				)}
				aria-busy="true"
			>
				<PlaybackStatusAnnouncer
					playing={false}
					isLoading
					error={null}
					trackName={trackName}
				/>
				<ArrowPathIcon className="h-4 w-4 animate-spin" />
				<span className="text-xs">{t('inlineAudio.loading')}</span>
			</div>
		);
	}

	if (!objectUrl && !decodedReady) {
		return (
			<div className={cn('text-xs text-rose-200', className)}>
				<PlaybackStatusAnnouncer
					playing={false}
					isLoading={false}
					error={playbackError}
					trackName={trackName}
				/>
				{playbackError ?? t('nowPlaying.errorLoadFallback')}
			</div>
		);
	}

	return (
		<div className={cn('space-y-2', className)}>
			<PlaybackStatusAnnouncer
				playing={playing}
				isLoading={isLoading}
				error={playbackError}
				trackName={trackName}
			/>
			{/* biome-ignore lint/a11y/useMediaCaption: captions track only when captionsSrc provided */}
			<audio
				ref={audioRef}
				preload="metadata"
				aria-label={(trackName || '').trim() || t('inlineAudio.previewAria')}
			>
				{trimmedCaptionsSrc ? (
					<track
						kind="captions"
						src={trimmedCaptionsSrc}
						srcLang={resolvedCaptionsLang}
						label={resolvedCaptionsLabel}
						default
					/>
				) : null}
			</audio>
			<MiniAudioControls
				compact={compact}
				playing={playing}
				isLoading={isLoading}
				onTogglePlayPause={togglePlayPause}
				currentTime={currentTime}
				duration={displayDuration}
				bufferedRanges={bufferedRanges}
				onSeek={seek}
				volume={volume}
				onVolumeChange={setVolume}
				playbackError={playbackError}
				onRetryPlayback={
					errorCategory === 'permission' ? undefined : handleRetry
				}
			/>
			{showPlayInMusicPlayer ? (
				<button
					type="button"
					className="inline-flex rounded-md border border-(--desktop-border-subtle) px-2 py-1 text-xs text-(--desktop-text-primary) transition hover:bg-(--desktop-surface-soft-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-app)"
					onClick={handlePlayInMusicPlayer}
				>
					{t('inlineAudio.openInMusicPlayer')}
				</button>
			) : null}
		</div>
	);
};

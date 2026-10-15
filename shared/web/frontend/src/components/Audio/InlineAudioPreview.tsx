/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared inline audio preview for already-resolved `src` URLs using EliteEW transport/progress controls.
 *
 * Invariants:
 * - Keeps playback local and isolated from the global Music Player queue.
 * - Provides the same seek/volume/error UX as other shared audio preview surfaces.
 * - Captions `<track>` only when `captionsSrc` is provided (no hardcoded RU label/srcLang).
 *
 * Related:
 * - src/components/Audio/MiniAudioControls.tsx
 * - src/components/UGS/hub/results/UgsHubResultContent.tsx
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	type PlaybackErrorCategory,
	mapPlaybackErrorInfo,
} from '@/services/audio/playbackErrors';
import {
	foflineNowPlaying,
	isForbiddenFoflineMediaSrc,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '@/services/audio/foflineDecodedPlayback';
import { cn } from '@/utils/cn';
import { MiniAudioControls } from './MiniAudioControls';

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

export interface InlineAudioPreviewProps {
	src: string;
	mimeType?: string | null;
	trackName?: string | null;
	ariaLabel?: string;
	/** WebVTT URL or data: URL for a11y captions; omit track when empty. */
	captionsSrc?: string | null;
	captionsSrcLang?: string;
	captionsLabel?: string;
	className?: string;
	compact?: boolean;
}

export function InlineAudioPreview({
	src,
	mimeType = null,
	trackName = null,
	ariaLabel,
	captionsSrc = null,
	captionsSrcLang,
	captionsLabel,
	className,
	compact = false,
}: InlineAudioPreviewProps): React.JSX.Element {
	const { t, i18n } = useTranslation('desktopUi');
	const trimmedCaptionsSrc = (captionsSrc ?? '').trim();
	const resolvedCaptionsLang =
		(captionsSrcLang ?? i18n.language ?? 'en').split('-')[0] || 'en';
	const resolvedCaptionsLabel =
		captionsLabel?.trim() || t('inlineAudio.captionsLabel');
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [reloadNonce, setReloadNonce] = useState(0);
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

	const trimmedSrc = src.trim();
	const memoryPlayback =
		isFoflineSpaWebAudioHost() && isForbiddenFoflineMediaSrc(trimmedSrc);

	useEffect(() => {
		void reloadNonce;
		setPlaying(false);
		setCurrentTime(0);
		setDuration(0);
		setBufferedRanges([]);
		setPlaybackError(null);
		setErrorCategory(null);
		setIsLoading(Boolean(trimmedSrc));
	}, [trimmedSrc, reloadNonce]);

	useEffect(() => {
		void reloadNonce;
		if (!memoryPlayback || !trimmedSrc) return;
		let cancelled = false;
		releaseHtmlMediaElement(audioRef.current);
		void (async () => {
			try {
				const response = await fetch(trimmedSrc, { credentials: 'include' });
				if (!response.ok) throw new Error('AUDIO_DECODE_ERROR');
				const bytes = await response.arrayBuffer();
				if (cancelled) return;
				if (bytes.byteLength === 0) throw new Error('EMPTY_AUDIO_BLOB');
				const durationSeconds = await foflineNowPlaying.loadBytes(bytes, 0);
				if (cancelled) return;
				setDuration(durationSeconds);
				setBufferedRanges([{ start: 0, end: durationSeconds }]);
				setIsLoading(false);
			} catch (error: unknown) {
				if (cancelled) return;
				const info = mapPlaybackErrorInfo(
					error instanceof Error ? error : new Error('AUDIO_DECODE_ERROR'),
					t
				);
				setPlaybackError(info.message);
				setErrorCategory(info.category);
				setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
			releaseHtmlMediaElement(audioRef.current);
		};
	}, [memoryPlayback, reloadNonce, t, trimmedSrc]);

	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const onTimeUpdate = () => setCurrentTime(audio.currentTime);
		const onLoadedMetadata = () => {
			setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
			setBufferedRanges(readBufferedRanges(audio));
			setIsLoading(false);
		};
		const onProgress = () => {
			setBufferedRanges(readBufferedRanges(audio));
		};
		const onCanPlay = () => setIsLoading(false);
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);
		const onError = () => {
			const info = mapPlaybackErrorInfo(new Error('AUDIO_DECODE_ERROR'), t);
			setPlaybackError(info.message);
			setErrorCategory(info.category);
			setPlaying(false);
			setIsLoading(false);
		};

		audio.addEventListener('timeupdate', onTimeUpdate);
		audio.addEventListener('loadedmetadata', onLoadedMetadata);
		audio.addEventListener('progress', onProgress);
		audio.addEventListener('canplay', onCanPlay);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('error', onError);

		return () => {
			audio.removeEventListener('timeupdate', onTimeUpdate);
			audio.removeEventListener('loadedmetadata', onLoadedMetadata);
			audio.removeEventListener('progress', onProgress);
			audio.removeEventListener('canplay', onCanPlay);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('error', onError);
		};
	}, [t]);

	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = volume;
		}
	}, [volume]);

	const togglePlayPause = useCallback(() => {
		if (memoryPlayback) {
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
		if (!audio || !trimmedSrc) return;
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
	}, [memoryPlayback, t, trimmedSrc]);

	const seek = useCallback((time: number) => {
		const audio = audioRef.current;
		if (!audio || !Number.isFinite(time)) return;
		audio.currentTime = time;
		setCurrentTime(time);
	}, []);

	const handleRetry = useCallback(() => {
		setReloadNonce((value) => value + 1);
	}, []);

	if (!trimmedSrc) {
		return (
			<div className={cn('text-xs text-rose-200', className)}>
				{t('nowPlaying.errorLoadFallback')}
			</div>
		);
	}

	return (
		<div className={cn('space-y-2', className)}>
			{/* biome-ignore lint/a11y/useMediaCaption: captions track only when captionsSrc provided */}
			<audio
				key={`${trimmedSrc}-${reloadNonce}`}
				ref={audioRef}
				preload="metadata"
				aria-label={
					ariaLabel ?? trackName ?? t('inlineAudio.previewAria') ?? undefined
				}
			>
				{memoryPlayback ? null : (
					<source src={trimmedSrc} type={mimeType || 'audio/mpeg'} />
				)}
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
				duration={duration}
				bufferedRanges={bufferedRanges}
				onSeek={seek}
				volume={volume}
				onVolumeChange={setVolume}
				playbackError={playbackError}
				onRetryPlayback={
					errorCategory === 'permission' ? undefined : handleRetry
				}
			/>
		</div>
	);
}

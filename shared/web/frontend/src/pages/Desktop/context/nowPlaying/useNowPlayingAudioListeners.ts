/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTMLAudioElement event listeners for timeupdate, metadata, progress, ended, play/pause, error.
 *
 * Invariants:
 * - Position session checkpoints are debounced; pagehide flushes immediately.
 * - Hard media errors clear loadedTrackId and must not leave loadingStage=playing.
 * - MEDIA_ERR_ABORTED stays soft (seek on progressive streams).
 *
 * Related:
 * - src/pages/Desktop/utils/nowPlayingPositionSession.ts
 * - src/services/audio/playbackErrors.ts
 */

import type { TFunction } from 'i18next';
import {
	useEffect,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
} from 'react';
import {
	isHtmlMediaAbortedError,
	mapPlaybackErrorInfo,
} from '../../../../services/audio/playbackErrors';
import { isFoflineSpaWebAudioHost } from '../../../../services/audio/foflineDecodedPlayback';
import { emitPlaybackStageMetric } from '../../utils/musicPlaybackTelemetry';
import { clearNowPlayingPositionSession } from '../../utils/nowPlayingPositionSession';
import { withTrackError } from '../nowPlayingStateTransitions';
import {
	isNowPlayingMediaHardError,
	readBufferedRangesFromAudio,
	sameBufferedRanges,
} from './audioHelpers';
import type { NowPlayingState } from './types';

interface UseNowPlayingAudioListenersParams {
	audioRef: React.RefObject<HTMLAudioElement | null>;
	stateRef: MutableRefObject<NowPlayingState>;
	setState: Dispatch<SetStateAction<NowPlayingState>>;
	initialSeekRef: MutableRefObject<number | null>;
	positionSessionTimerRef: MutableRefObject<ReturnType<
		typeof setTimeout
	> | null>;
	onTrackEndedRef: MutableRefObject<(() => void) | null>;
	loadedTrackIdRef: MutableRefObject<string | null>;
	mediaRecoveryCountRef: MutableRefObject<number>;
	recoverFromHardMediaErrorRef: MutableRefObject<(() => void) | null>;
	t: TFunction<'desktopUi'>;
	schedulePositionSessionCheckpoint: (
		trackId: string | null | undefined,
		currentTime: number
	) => void;
	checkpointPositionSession: (
		trackId: string | null | undefined,
		currentTime: number
	) => void;
}

export function useNowPlayingAudioListeners({
	audioRef,
	stateRef,
	setState,
	initialSeekRef,
	positionSessionTimerRef,
	onTrackEndedRef,
	loadedTrackIdRef,
	mediaRecoveryCountRef,
	recoverFromHardMediaErrorRef,
	t,
	schedulePositionSessionCheckpoint,
	checkpointPositionSession,
}: UseNowPlayingAudioListenersParams): void {
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || isFoflineSpaWebAudioHost()) return;

		const onTimeUpdate = () => {
			const tPos = audio.currentTime;
			const bufferedRanges = readBufferedRangesFromAudio(audio);
			setState((s) => ({
				...s,
				currentTime: tPos,
				bufferedRanges: sameBufferedRanges(s.bufferedRanges, bufferedRanges)
					? s.bufferedRanges
					: bufferedRanges,
			}));
			schedulePositionSessionCheckpoint(stateRef.current.track?.id, tPos);
		};
		const onLoadedMetadata = () => {
			const bufferedRanges = readBufferedRangesFromAudio(audio);
			setState((s) => ({
				...s,
				duration: audio.duration,
				bufferedRanges: sameBufferedRanges(s.bufferedRanges, bufferedRanges)
					? s.bufferedRanges
					: bufferedRanges,
			}));
			if (initialSeekRef.current != null) {
				audio.currentTime = initialSeekRef.current;
				initialSeekRef.current = null;
			}
		};
		const onProgress = () => {
			const bufferedRanges = readBufferedRangesFromAudio(audio);
			setState((s) =>
				sameBufferedRanges(s.bufferedRanges, bufferedRanges)
					? s
					: { ...s, bufferedRanges }
			);
		};
		const onEnded = () => {
			emitPlaybackStageMetric(stateRef.current.track?.id ?? 'unknown', 'ended');
			clearNowPlayingPositionSession();
			setState((s) => ({
				...s,
				playing: false,
				currentTime: 0,
				diagnostics: {
					...s.diagnostics,
					loadingStage: 'idle',
				},
			}));
			onTrackEndedRef.current?.();
		};
		const onPlay = () => {
			if (!isNowPlayingMediaHardError(audio)) {
				mediaRecoveryCountRef.current = 0;
			}
			setState((s) => ({
				...s,
				playing: true,
				diagnostics: {
					...s.diagnostics,
					loadingStage: 'playing',
					errorCategory: isNowPlayingMediaHardError(audio)
						? s.diagnostics.errorCategory
						: null,
				},
			}));
		};
		const onPause = () =>
			setState((s) => ({
				...s,
				playing: false,
				diagnostics: {
					...s.diagnostics,
					loadingStage: s.error ? 'error' : 'idle',
				},
			}));
		const onError = () => {
			if (isHtmlMediaAbortedError(audio)) {
				setState((s) => {
					if (s.diagnostics.errorCategory !== 'aborted' && !s.error) {
						return s;
					}
					return {
						...s,
						error: null,
						errorTrackId: null,
						diagnostics: {
							...s.diagnostics,
							errorCategory: null,
							loadingStage: s.playing
								? 'playing'
								: s.diagnostics.loadingStage === 'error'
									? 'idle'
									: s.diagnostics.loadingStage,
						},
					};
				});
				return;
			}
			if (!isNowPlayingMediaHardError(audio)) {
				return;
			}
			loadedTrackIdRef.current = null;
			const synthetic = new Error(
				audio.error?.message || 'HTMLMediaElement.error'
			);
			const info = mapPlaybackErrorInfo(synthetic, t, 'nowPlaying');
			emitPlaybackStageMetric(
				stateRef.current.track?.id ?? 'unknown',
				'play-rejection',
				{ category: info.category }
			);
			setState((s) =>
				withTrackError(s, {
					trackId: s.track?.id ?? null,
					message: info.message,
					category: info.category,
				})
			);
			if (mediaRecoveryCountRef.current < 1) {
				mediaRecoveryCountRef.current += 1;
				recoverFromHardMediaErrorRef.current?.();
			}
		};

		audio.addEventListener('timeupdate', onTimeUpdate);
		audio.addEventListener('loadedmetadata', onLoadedMetadata);
		audio.addEventListener('progress', onProgress);
		audio.addEventListener('ended', onEnded);
		audio.addEventListener('play', onPlay);
		audio.addEventListener('pause', onPause);
		audio.addEventListener('error', onError);
		return () => {
			if (positionSessionTimerRef.current) {
				clearTimeout(positionSessionTimerRef.current);
				positionSessionTimerRef.current = null;
			}
			audio.removeEventListener('timeupdate', onTimeUpdate);
			audio.removeEventListener('loadedmetadata', onLoadedMetadata);
			audio.removeEventListener('progress', onProgress);
			audio.removeEventListener('ended', onEnded);
			audio.removeEventListener('play', onPlay);
			audio.removeEventListener('pause', onPause);
			audio.removeEventListener('error', onError);
		};
	}, [
		audioRef,
		stateRef,
		setState,
		initialSeekRef,
		positionSessionTimerRef,
		onTrackEndedRef,
		loadedTrackIdRef,
		mediaRecoveryCountRef,
		recoverFromHardMediaErrorRef,
		t,
		schedulePositionSessionCheckpoint,
	]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onPageHide = () => {
			checkpointPositionSession(
				stateRef.current.track?.id,
				stateRef.current.currentTime
			);
		};
		window.addEventListener('pagehide', onPageHide);
		return () => {
			window.removeEventListener('pagehide', onPageHide);
		};
	}, [checkpointPositionSession, stateRef]);
}

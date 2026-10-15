/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Attach resolved blob/stream source to the shared audio element and wire canplay/error handlers.
 *
 * Invariants:
 * - Stale request IDs are ignored; secure stream remint is attempted once on ticket URLs.
 * - After stream media error (post-remint), fall back to authenticated typed blob (Content Manager path).
 * - loadedTrackIdRef is set only after blob attach or canplay — never on bare stream src assign.
 *
 * Related:
 * - src/pages/MusicPlayer/nowPlayingTrackAudioSource.ts
 * - src/services/audio/normalizeAudioBlob.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import type { TFunction } from 'i18next';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { notify } from '../../../../notifications';
import { normalizeAudioBlob } from '../../../../services/audio/normalizeAudioBlob';
import {
	type PlaybackErrorCategory,
	classifyHtmlMediaElementError,
	isHtmlMediaAbortedError,
	isPlaybackAbortError,
	mapPlaybackErrorInfo,
} from '../../../../services/audio/playbackErrors';
import {
	buildSecureMediaTicketRemintContext,
	isContentTicketStreamUrl,
	secureRemintContentInlineStreamUrl,
} from '../../../../services/auth/secureMediaTicketRemint';
import {
	emitPlaybackErrorMetric,
	emitPlaybackStageMetric,
	markTrackLoadReady,
} from '../../utils/musicPlaybackTelemetry';
import {
	withDiagnosticsPatch,
	withTrackError,
} from '../nowPlayingStateTransitions';
import type { NowPlayingState, NowPlayingTrack } from './types';

type LoadedAudioSource =
	| {
			mode: 'blob';
			blob: Blob;
			cacheSource: 'idb-cache' | 'network';
	  }
	| {
			mode: 'stream';
			streamUrl: string;
			cacheSource: 'inline-stream';
	  };

export interface AttachLoadedAudioSourceParams {
	audio: HTMLAudioElement;
	loaded: LoadedAudioSource;
	track: NowPlayingTrack;
	requestId: number;
	startMark: string;
	playbackRequestIdRef: MutableRefObject<number>;
	loadedTrackIdRef: MutableRefObject<string | null>;
	stateRef: MutableRefObject<NowPlayingState>;
	lastNowPlayingToastRef: MutableRefObject<{
		trackId: string;
		at: number;
	} | null>;
	setPlaybackBlobObjectUrl: (blob: Blob) => string | null;
	/** Authenticated blob fetch used when ticket stream fails in WebView/Tauri. */
	loadBlobFallback?: () => Promise<Blob>;
	setState: Dispatch<SetStateAction<NowPlayingState>>;
	t: TFunction;
}

export function attachLoadedAudioSource({
	audio,
	loaded,
	track,
	requestId,
	startMark,
	playbackRequestIdRef,
	loadedTrackIdRef,
	stateRef,
	lastNowPlayingToastRef,
	setPlaybackBlobObjectUrl,
	loadBlobFallback,
	setState,
	t,
}: AttachLoadedAudioSourceParams): void {
	let activeSource: LoadedAudioSource['cacheSource'] = loaded.cacheSource;
	let streamRemintAttempted = false;
	let streamBlobFallbackAttempted = false;

	const applyTerminalPlaybackError = (
		category: PlaybackErrorCategory,
		message: string
	): void => {
		setState((s) =>
			withTrackError(s, {
				trackId: track.id,
				message,
				category,
				cacheSource: activeSource,
			})
		);
		emitPlaybackErrorMetric(track.id, message, category);
	};

	const wireSourceListeners = (): void => {
		audio.addEventListener('canplay', onCanPlay, { once: true });
		audio.addEventListener('error', onError, { once: true });
		audio.load();
	};

	const attachTypedBlob = (
		blob: Blob,
		cacheSource: 'idb-cache' | 'network'
	): boolean => {
		const typed = normalizeAudioBlob(blob, track.mime_type, track.name);
		const url = setPlaybackBlobObjectUrl(typed);
		if (!url) {
			return false;
		}
		activeSource = cacheSource;
		loadedTrackIdRef.current = track.id;
		audio.src = url;
		setState((s) =>
			withDiagnosticsPatch(s, {
				cacheSource,
				loadingStage: 'blob-ready',
				errorCategory: null,
			})
		);
		wireSourceListeners();
		return true;
	};

	const onCanPlay = async () => {
		audio.removeEventListener('error', onError);
		if (requestId !== playbackRequestIdRef.current) {
			return;
		}
		loadedTrackIdRef.current = track.id;
		emitPlaybackStageMetric(track.id, 'canplay');
		setState((s) =>
			withDiagnosticsPatch(s, {
				cacheSource: activeSource,
				loadingStage: 'canplay',
				errorCategory: null,
			})
		);
		try {
			await audio.play();
			setState((s) => ({
				...withDiagnosticsPatch(s, {
					cacheSource: activeSource,
					loadingStage: 'playing',
					errorCategory: null,
				}),
				playing: true,
				isLoading: false,
				isLoadingStalled: false,
			}));
			const now = Date.now();
			const lastToast = lastNowPlayingToastRef.current;
			const shouldShowNowPlayingToast =
				!lastToast ||
				lastToast.trackId !== track.id ||
				now - lastToast.at > 15_000;
			if (shouldShowNowPlayingToast) {
				lastNowPlayingToastRef.current = { trackId: track.id, at: now };
				const telemetrySource =
					activeSource === 'idb-cache' ? 'idb-cache' : 'network';
				notify.nowPlaying(
					{
						trackId: track.id,
						trackName: track.name,
						durationSeconds:
							Number.isFinite(audio.duration) && audio.duration > 0
								? audio.duration
								: stateRef.current.duration,
						currentTimeSeconds:
							Number.isFinite(audio.currentTime) && audio.currentTime >= 0
								? audio.currentTime
								: stateRef.current.currentTime,
						volume: stateRef.current.volume,
						playbackRate: stateRef.current.playbackRate,
						source: telemetrySource,
					},
					{ addToCenter: false }
				);
			}
		} catch (playError: unknown) {
			const info = mapPlaybackErrorInfo(playError, t, 'nowPlaying');
			emitPlaybackStageMetric(track.id, 'play-rejection', {
				category: info.category,
			});
			if (isPlaybackAbortError(playError)) {
				setState((s) => ({
					...withDiagnosticsPatch(s, {
						cacheSource: activeSource,
						loadingStage: 'canplay',
						errorCategory: null,
					}),
					playing: false,
					isLoading: false,
					isLoadingStalled: false,
					error: null,
					errorTrackId: null,
				}));
				try {
					await audio.play();
					setState((s) => ({
						...withDiagnosticsPatch(s, {
							cacheSource: activeSource,
							loadingStage: 'playing',
							errorCategory: null,
						}),
						playing: true,
						isLoading: false,
						isLoadingStalled: false,
					}));
				} catch {
					/* stay paused without hard error */
				}
				const telemetrySource =
					activeSource === 'idb-cache' ? 'idb-cache' : 'network';
				markTrackLoadReady(track.id, startMark, telemetrySource);
				return;
			}
			setState((s) =>
				withTrackError(s, {
					trackId: track.id,
					message: info.message,
					category: info.category,
					cacheSource: activeSource,
				})
			);
			const title = t('nowPlaying.playbackErrorTitle');
			notify.error(title, info.message, { duration: 5000 });
		}
		const telemetrySource =
			activeSource === 'idb-cache' ? 'idb-cache' : 'network';
		markTrackLoadReady(track.id, startMark, telemetrySource);
	};
	const onError = () => {
		void handlePlaybackElementError();
	};

	const handlePlaybackElementError = async (): Promise<void> => {
		audio.removeEventListener('canplay', onCanPlay);
		if (requestId !== playbackRequestIdRef.current) {
			return;
		}

		if (isHtmlMediaAbortedError(audio)) {
			audio.addEventListener('canplay', onCanPlay, { once: true });
			audio.addEventListener('error', onError, { once: true });
			return;
		}

		if (
			loaded.mode === 'stream' &&
			!streamRemintAttempted &&
			isContentTicketStreamUrl(
				(loaded as Extract<LoadedAudioSource, { mode: 'stream' }>).streamUrl
			)
		) {
			const streamUrl = (
				loaded as Extract<LoadedAudioSource, { mode: 'stream' }>
			).streamUrl;
			const remintCtx = buildSecureMediaTicketRemintContext(
				streamUrl,
				track.id
			);
			if (remintCtx) {
				streamRemintAttempted = true;
				const remint = await secureRemintContentInlineStreamUrl(remintCtx);
				if (requestId !== playbackRequestIdRef.current) {
					return;
				}
				if (remint.ok) {
					audio.src = remint.streamUrl;
					wireSourceListeners();
					return;
				}
				if (
					remint.reason === 'access_denied' ||
					remint.reason === 'auth_lost' ||
					remint.reason === 'identity_mismatch'
				) {
					const info = mapPlaybackErrorInfo(
						Object.assign(new Error('MEDIA_ACCESS_DENIED'), {
							response: { status: remint.statusCode ?? 403 },
						}),
						t,
						'nowPlaying'
					);
					applyTerminalPlaybackError(info.category, info.message);
					const title = t('nowPlaying.playbackErrorTitle');
					notify.error(title, info.message, { duration: 5000 });
					return;
				}
			}
		}

		// Tauri/WebView often rejects ticket streams (MIME/Range) while blob preview works.
		// Also recover from poisoned IDB cache (JSON/HTML labeled audio/mpeg → MEDIA_ERR_DECODE).
		if (
			!streamBlobFallbackAttempted &&
			typeof loadBlobFallback === 'function' &&
			(loaded.mode === 'stream' ||
				(loaded.mode === 'blob' && loaded.cacheSource === 'idb-cache'))
		) {
			streamBlobFallbackAttempted = true;
			emitPlaybackStageMetric(track.id, 'network-fetch', {
				category:
					loaded.mode === 'blob'
						? 'idb-decode-blob-fallback'
						: 'stream-blob-fallback',
			});
			try {
				const blob = await loadBlobFallback();
				if (requestId !== playbackRequestIdRef.current) {
					return;
				}
				if (
					blob instanceof Blob &&
					blob.size > 0 &&
					attachTypedBlob(blob, 'network')
				) {
					return;
				}
			} catch (fallbackError: unknown) {
				if (requestId !== playbackRequestIdRef.current) {
					return;
				}
				const info = mapPlaybackErrorInfo(fallbackError, t, 'nowPlaying');
				applyTerminalPlaybackError(info.category, info.message);
				const title = t('nowPlaying.playbackErrorTitle');
				notify.error(title, info.message, { duration: 5000 });
				return;
			}
		}

		const category = classifyHtmlMediaElementError(audio);
		const synthetic =
			category === 'decode'
				? new Error('AUDIO_DECODE_ERROR')
				: new Error('AUDIO_LOAD_ERROR');
		const info = mapPlaybackErrorInfo(synthetic, t, 'nowPlaying');
		const finalCategory = category === 'unknown' ? info.category : category;
		applyTerminalPlaybackError(finalCategory, info.message);
		const title = t('nowPlaying.playbackErrorTitle');
		notify.error(title, info.message, { duration: 5000 });
	};

	if (loaded.mode === 'stream') {
		loadedTrackIdRef.current = track.id;
		audio.src = loaded.streamUrl;
		setState((s) =>
			withDiagnosticsPatch(s, {
				cacheSource: activeSource,
				loadingStage: 'stream-ready',
				errorCategory: null,
			})
		);
		wireSourceListeners();
		return;
	}

	if (!attachTypedBlob(loaded.blob, loaded.cacheSource)) {
		setState((s) => ({
			...withDiagnosticsPatch(s, {
				cacheSource: activeSource,
				loadingStage: 'error',
				errorCategory: 'unknown',
			}),
			isLoading: false,
			isLoadingStalled: false,
		}));
	}
}

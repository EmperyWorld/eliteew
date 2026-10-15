/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Core now-playing state, transport actions, shell persist, and stall detection.
 *
 * Invariants:
 * - One active playback request; newer requests cancel previous stream/blob load.
 * - Same healthy track id → pause/resume/restart in place (no ticket remint).
 * - Hard MEDIA_ERR_* → honest error + one preferBlob recovery; Abort stays soft.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/NowPlayingProvider.tsx
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthenticatedAudioBlob } from '@/hooks/audio/useAuthenticatedAudioBlob';
import { useObjectUrlLifecycle } from '@/hooks/audio/useObjectUrlLifecycle';
import { resolveNowPlayingTrackAudioSource } from '@/pages/MusicPlayer/nowPlayingTrackAudioSource';
import { notify } from '../../../../notifications';
import {
	mapPlaybackErrorInfo,
	isPlaybackAbortError,
} from '../../../../services/audio/playbackErrors';
import {
	foflineNowPlaying,
	isFoflineSpaWebAudioHost,
	releaseHtmlMediaElement,
} from '../../../../services/audio/foflineDecodedPlayback';
import {
	getCachedAudioBlob,
	putCachedAudioBlob,
	deleteCachedAudioBlob,
} from '../../utils/musicAudioBlobCache';
import {
	emitPlaybackErrorMetric,
	emitPlaybackStageMetric,
	emitShellPersistMetric,
	markTrackLoadStart,
} from '../../utils/musicPlaybackTelemetry';
import { captureNowPlayingUserActivation } from '../../utils/nowPlayingAudioUnlock';
import {
	clearNowPlayingPositionSession,
	writeNowPlayingPositionSession,
} from '../../utils/nowPlayingPositionSession';
import {
	scheduleShellStateMutation,
	waitForShellStatePipelineFlush,
} from '../../utils/desktopShellStateMutationPipeline';
import { useMediaSessionMusic } from '../../utils/mediaSessionMusic';
import {
	withDiagnosticsPatch,
	withTrackError,
	withTrackLoadStart,
	withTrackReset,
} from '../nowPlayingStateTransitions';
import { attachLoadedAudioSource } from './attachLoadedAudioSource';
import {
	isNowPlayingMediaHardError,
	resolveSameTrackPlayAction,
} from './audioHelpers';
import {
	DUCK_VOLUME,
	NOW_PLAYING_LOAD_STALL_MS,
	NOW_PLAYING_SHELL_DEBOUNCE_MS,
	POSITION_SESSION_DEBOUNCE_MS,
} from './constants';
import {
	buildNowPlayingShellPatch,
	loadLegacyLocalStorage,
	resolveHydratedCurrentTime,
} from './persistHelpers';
import type {
	NowPlayingDiagnostics,
	NowPlayingState,
	NowPlayingTrack,
	NowPlayingTransportValue,
} from './types';
import { defaultState } from './types';
import { useNowPlayingAudioListeners } from './useNowPlayingAudioListeners';
import { useNowPlayingMicDucking } from './useNowPlayingMicDucking';
import { useNowPlayingShellHydration } from './useNowPlayingShellHydration';

export type PlayTrackOptions = {
	/** Skip ticket stream; use authenticated blob (recovery / Tauri path). */
	preferBlob?: boolean;
	/** Skip same-track in-place pause/resume (retry / media recovery). */
	forceReload?: boolean;
};

export function useNowPlayingController(
	audioRef: RefObject<HTMLAudioElement | null>
): {
	state: NowPlayingState;
	transportValue: NowPlayingTransportValue;
} {
	const loadedTrackIdRef = useRef<string | null>(null);
	const playbackRequestIdRef = useRef(0);
	const mediaRecoveryCountRef = useRef(0);
	const recoverFromHardMediaErrorRef = useRef<(() => void) | null>(null);
	const lastNowPlayingToastRef = useRef<{ trackId: string; at: number } | null>(
		null
	);
	const onTrackEndedRef = useRef<(() => void) | null>(null);
	const nextRef = useRef<(() => void) | null>(null);
	const prevRef = useRef<(() => void) | null>(null);
	const initialSeekRef = useRef<number | null>(null);
	const positionSessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	);
	const shellHydratedRef = useRef(false);
	const lastShellPersistFingerprintRef = useRef<string | null>(null);
	const stateRef = useRef<NowPlayingState>(defaultState);
	const {
		setBlob: setPlaybackBlobObjectUrl,
		revoke: revokePlaybackBlobObjectUrl,
	} = useObjectUrlLifecycle();
	const { fetchAudioBlob, abortInFlightFetch } = useAuthenticatedAudioBlob();
	const { t } = useTranslation('desktopUi');

	const [state, setState] = useState<NowPlayingState>(() => {
		const persisted = loadLegacyLocalStorage();
		if (!persisted?.track) return defaultState;
		const currentTime = resolveHydratedCurrentTime(
			persisted.track,
			persisted.currentTime
		);
		return {
			track: persisted.track,
			playing: false,
			currentTime,
			duration: 0,
			volume: persisted.volume,
			playbackRate: 1,
			isLoading: false,
			isLoadingStalled: false,
			error: null,
			errorTrackId: null,
			diagnostics: {
				trackId: persisted.track.id,
				sourceSurface: persisted.track.source_surface ?? 'unknown',
				cacheSource: null,
				loadingStage: 'idle',
				errorCategory: null,
			},
		} as NowPlayingState;
	});

	const { micDucking, lastVolumeTargetRef } = useNowPlayingMicDucking(
		audioRef,
		state.volume
	);

	const scheduleShellPersist = useCallback(
		(track: NowPlayingTrack | null, volume: number) => {
			if (!shellHydratedRef.current) return;
			const patch = buildNowPlayingShellPatch(track, volume);
			const fingerprint = JSON.stringify(patch);
			if (lastShellPersistFingerprintRef.current === fingerprint) {
				return;
			}
			lastShellPersistFingerprintRef.current = fingerprint;
			scheduleShellStateMutation({
				source: 'nowPlaying',
				merge: () => patch as Record<string, unknown>,
				debounceMs: NOW_PLAYING_SHELL_DEBOUNCE_MS,
			});
			void waitForShellStatePipelineFlush().catch(() => {});
			emitShellPersistMetric();
		},
		[]
	);

	const checkpointPositionSession = useCallback(
		(trackId: string | null | undefined, currentTime: number) => {
			if (!trackId || currentTime <= 0) return;
			writeNowPlayingPositionSession(trackId, currentTime);
		},
		[]
	);

	const schedulePositionSessionCheckpoint = useCallback(
		(trackId: string | null | undefined, currentTime: number) => {
			if (!trackId || currentTime <= 0) return;
			if (positionSessionTimerRef.current) return;
			positionSessionTimerRef.current = setTimeout(() => {
				positionSessionTimerRef.current = null;
				const activeTrackId = stateRef.current.track?.id;
				if (!activeTrackId || activeTrackId !== trackId) return;
				writeNowPlayingPositionSession(trackId, stateRef.current.currentTime);
			}, POSITION_SESSION_DEBOUNCE_MS);
		},
		[]
	);

	useNowPlayingShellHydration(setState, shellHydratedRef);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		(
			window as typeof window & {
				__ELITEEW_NOW_PLAYING_DIAGNOSTICS__?: Readonly<NowPlayingDiagnostics>;
			}
		).__ELITEEW_NOW_PLAYING_DIAGNOSTICS__ = Object.freeze({
			...state.diagnostics,
		});
		return () => {
			delete (
				window as typeof window & {
					__ELITEEW_NOW_PLAYING_DIAGNOSTICS__?: Readonly<NowPlayingDiagnostics>;
				}
			).__ELITEEW_NOW_PLAYING_DIAGNOSTICS__;
		};
	}, [state.diagnostics]);

	useEffect(() => {
		if (isFoflineSpaWebAudioHost()) {
			foflineNowPlaying.setRate(state.playbackRate || 1);
			return;
		}
		if (audioRef.current) {
			audioRef.current.playbackRate = state.playbackRate || 1;
		}
	}, [audioRef, state.playbackRate]);

	const revokeCurrentObjectUrl = useCallback(() => {
		revokePlaybackBlobObjectUrl();
		loadedTrackIdRef.current = null;
	}, [revokePlaybackBlobObjectUrl]);

	const setTrack = useCallback(
		(track: NowPlayingTrack | null) => {
			checkpointPositionSession(
				stateRef.current.track?.id,
				stateRef.current.currentTime
			);
			playbackRequestIdRef.current += 1;
			abortInFlightFetch();
			revokeCurrentObjectUrl();
			if (!track) {
				clearNowPlayingPositionSession();
			}
			if (isFoflineSpaWebAudioHost()) {
				foflineNowPlaying.stop();
			}
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.removeAttribute('src');
				audioRef.current.load();
			}
			setState((s) => withTrackReset(s, track));
		},
		[
			abortInFlightFetch,
			audioRef,
			checkpointPositionSession,
			revokeCurrentObjectUrl,
		]
	);

	const pause = useCallback(() => {
		if (isFoflineSpaWebAudioHost()) {
			foflineNowPlaying.pause();
			releaseHtmlMediaElement(audioRef.current);
		} else if (audioRef.current) {
			audioRef.current.pause();
		}
		checkpointPositionSession(
			stateRef.current.track?.id,
			stateRef.current.currentTime
		);
		setState((s) => ({ ...s, playing: false }));
	}, [audioRef, checkpointPositionSession]);

	const loadTrackAudioSource = useCallback(
		async (track: NowPlayingTrack, preferBlob?: boolean) => {
			return resolveNowPlayingTrackAudioSource(
				track,
				{
					getCachedBlob: getCachedAudioBlob,
					putCachedBlob: putCachedAudioBlob,
					fetchAudioBlob,
					onCacheHit: (trackId) =>
						emitPlaybackStageMetric(trackId, 'blob-cache-hit'),
					onStreamResolved: (trackId) =>
						emitPlaybackStageMetric(trackId, 'network-fetch'),
					onBlobFetch: (trackId) =>
						emitPlaybackStageMetric(trackId, 'network-fetch'),
					onStreamFallback: (trackId) =>
						emitPlaybackStageMetric(trackId, 'network-fetch'),
				},
				preferBlob === true ? { preferBlob: true } : undefined
			);
		},
		[fetchAudioBlob]
	);

	const playInPlace = useCallback(
		async (
			audio: HTMLAudioElement,
			track: NowPlayingTrack,
			restart: boolean
		) => {
			if (restart) {
				try {
					audio.currentTime = 0;
				} catch {
					/* InvalidStateError when metadata is not ready yet */
				}
			}
			setState((s) => ({
				...s,
				track: { ...(s.track ?? track), ...track },
				currentTime: restart ? 0 : s.currentTime,
				error: null,
				errorTrackId: null,
				isLoading: false,
				isLoadingStalled: false,
				diagnostics: {
					...s.diagnostics,
					trackId: track.id,
					sourceSurface: track.source_surface ?? s.diagnostics.sourceSurface,
					errorCategory: null,
					loadingStage: 'playing',
				},
			}));
			// Sync in-place play stays inside the user gesture — do not run muted
			// unlock play→pause (same src would pause audible resume a tick later).
			try {
				await audio.play();
				setState((s) => ({
					...s,
					playing: true,
					diagnostics: {
						...s.diagnostics,
						loadingStage: 'playing',
						errorCategory: null,
					},
				}));
			} catch (error: unknown) {
				const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
				if (isPlaybackAbortError(error)) {
					setState((s) => ({ ...s, playing: false }));
					return;
				}
				if (isNowPlayingMediaHardError(audio)) {
					loadedTrackIdRef.current = null;
					void playTrackCbRef.current?.(track, {
						preferBlob: true,
						forceReload: true,
					});
					return;
				}
				emitPlaybackStageMetric(track.id, 'play-rejection', {
					category: info.category,
				});
				setState((s) =>
					withTrackError(s, {
						trackId: track.id,
						message: info.message,
						category: info.category,
					})
				);
			}
		},
		[t]
	);

	const playTrackCbRef = useRef<
		| ((track: NowPlayingTrack, options?: PlayTrackOptions) => Promise<void>)
		| null
	>(null);

	const playTrackCb = useCallback(
		async (track: NowPlayingTrack, options?: PlayTrackOptions) => {
			const audio = audioRef.current;
			const fofline = isFoflineSpaWebAudioHost();
			const sameAction = resolveSameTrackPlayAction({
				loadedTrackId: fofline
					? foflineNowPlaying.loadedTrackId
					: loadedTrackIdRef.current,
				trackId: track.id,
				forceReload: options?.forceReload === true,
				mediaHardError: fofline ? false : isNowPlayingMediaHardError(audio),
				paused: fofline
					? !foflineNowPlaying.isPlaying
					: (audio?.paused ?? true),
				playing: stateRef.current.playing,
				ended: fofline ? foflineNowPlaying.hasEnded : Boolean(audio?.ended),
			});

			if (sameAction === 'pause' && (audio || fofline)) {
				if (fofline) {
					foflineNowPlaying.pause();
					releaseHtmlMediaElement(audio);
				} else if (audio) {
					audio.pause();
				}
				checkpointPositionSession(
					stateRef.current.track?.id,
					stateRef.current.currentTime
				);
				setState((s) => ({
					...s,
					track: { ...(s.track ?? track), ...track },
					playing: false,
					diagnostics: {
						...s.diagnostics,
						trackId: track.id,
						loadingStage: 'idle',
					},
				}));
				return;
			}
			if (
				(sameAction === 'resume' || sameAction === 'restart') &&
				(audio || fofline)
			) {
				if (fofline) {
					if (sameAction === 'restart') {
						foflineNowPlaying.seek(0, true);
					} else {
						void foflineNowPlaying.play();
					}
					setState((s) => ({
						...s,
						playing: true,
						currentTime: sameAction === 'restart' ? 0 : s.currentTime,
						isLoading: false,
						error: null,
						errorTrackId: null,
						diagnostics: {
							...s.diagnostics,
							loadingStage: 'playing',
							errorCategory: null,
						},
					}));
					return;
				}
				if (audio) {
					await playInPlace(audio, track, sameAction === 'restart');
				}
				return;
			}

			const preferBlob =
				fofline ||
				options?.preferBlob === true ||
				isNowPlayingMediaHardError(audio);
			const requestId = ++playbackRequestIdRef.current;
			abortInFlightFetch();
			emitPlaybackStageMetric(track.id, 'play-request');
			const startMark = markTrackLoadStart(track.id);
			if (audioRef.current) {
				captureNowPlayingUserActivation(audioRef.current);
			}
			revokeCurrentObjectUrl();
			loadedTrackIdRef.current = null;
			const seekOnLoad =
				stateRef.current.track?.id === track.id
					? stateRef.current.currentTime
					: null;
			if (seekOnLoad != null && seekOnLoad > 0) {
				initialSeekRef.current = seekOnLoad;
			}
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.removeAttribute('src');
				audioRef.current.load();
			}
			setState((s) => withTrackLoadStart(s, track, seekOnLoad ?? 0));

			try {
				const loaded = await loadTrackAudioSource(track, preferBlob);
				if (requestId !== playbackRequestIdRef.current) {
					return;
				}
				if (isFoflineSpaWebAudioHost()) {
					releaseHtmlMediaElement(audioRef.current);
					if (loaded.mode !== 'blob' || loaded.blob.size === 0) {
						throw new Error('EMPTY_AUDIO_BLOB');
					}
					const bytes = await loaded.blob.arrayBuffer();
					if (requestId !== playbackRequestIdRef.current) {
						return;
					}
					const startAt = initialSeekRef.current ?? seekOnLoad ?? 0;
					initialSeekRef.current = null;
					const duration = await foflineNowPlaying.loadBytes(bytes, startAt);
					if (requestId !== playbackRequestIdRef.current) {
						foflineNowPlaying.stop();
						return;
					}
					foflineNowPlaying.loadedTrackId = track.id;
					loadedTrackIdRef.current = track.id;
					foflineNowPlaying.setVolume(stateRef.current.volume);
					foflineNowPlaying.setRate(stateRef.current.playbackRate || 1);
					foflineNowPlaying.onTick = (snapshot) => {
						if (requestId !== playbackRequestIdRef.current) return;
						setState((s) => ({
							...s,
							currentTime: snapshot.currentTime,
							duration: snapshot.duration || duration,
							playing: snapshot.playing,
							bufferedRanges:
								snapshot.duration > 0
									? [{ start: 0, end: snapshot.duration }]
									: s.bufferedRanges,
						}));
					};
					foflineNowPlaying.onNaturalEnd = () => {
						if (requestId !== playbackRequestIdRef.current) return;
						setState((s) => ({
							...s,
							playing: false,
							diagnostics: { ...s.diagnostics, loadingStage: 'idle' },
						}));
						onTrackEndedRef.current?.();
					};
					await foflineNowPlaying.play();
					setState((s) => ({
						...s,
						playing: true,
						isLoading: false,
						isLoadingStalled: false,
						currentTime: startAt,
						duration,
						error: null,
						errorTrackId: null,
						bufferedRanges: duration > 0 ? [{ start: 0, end: duration }] : [],
						diagnostics: {
							...s.diagnostics,
							trackId: track.id,
							cacheSource:
								loaded.cacheSource === 'idb-cache' ? 'idb-cache' : 'network',
							loadingStage: 'playing',
							errorCategory: null,
						},
					}));
					return;
				}
				if (!audioRef.current) {
					setState((s) => ({
						...withDiagnosticsPatch(s, {
							cacheSource: loaded.cacheSource,
							loadingStage: 'error',
							errorCategory: 'unknown',
						}),
						isLoading: false,
						isLoadingStalled: false,
					}));
					return;
				}
				attachLoadedAudioSource({
					audio: audioRef.current,
					loaded,
					track,
					requestId,
					startMark,
					playbackRequestIdRef,
					loadedTrackIdRef,
					stateRef,
					lastNowPlayingToastRef,
					setPlaybackBlobObjectUrl,
					loadBlobFallback: async () => {
						emitPlaybackStageMetric(track.id, 'network-fetch');
						const version =
							typeof track.version === 'string' &&
							track.version.trim().length > 0
								? track.version.trim()
								: 'unversioned';
						const cacheKey = `${track.id}:${version}`;
						await deleteCachedAudioBlob(cacheKey);
						const blob = await fetchAudioBlob({
							unifiedContentId: track.id,
							version: track.version ?? null,
						});
						if (blob instanceof Blob && blob.size > 0) {
							void putCachedAudioBlob(cacheKey, blob);
						}
						return blob;
					},
					setState,
					t,
				});
			} catch (err: unknown) {
				if (requestId !== playbackRequestIdRef.current) {
					return;
				}
				loadedTrackIdRef.current = null;
				const info = mapPlaybackErrorInfo(err, t, 'nowPlaying');
				if (info.category === 'aborted') {
					return;
				}
				setState((s) =>
					withTrackError(s, {
						trackId: track.id,
						message: info.message,
						category: info.category,
					})
				);
				emitPlaybackStageMetric(track.id, 'play-rejection', {
					category: info.category,
				});
				emitPlaybackErrorMetric(track.id, info.message, info.category);
				scheduleShellPersist(null, stateRef.current.volume);
				const title = t('nowPlaying.playbackErrorTitle');
				notify.error(title, info.message, { duration: 5000 });
			}
		},
		[
			abortInFlightFetch,
			audioRef,
			checkpointPositionSession,
			fetchAudioBlob,
			loadTrackAudioSource,
			playInPlace,
			revokeCurrentObjectUrl,
			scheduleShellPersist,
			setPlaybackBlobObjectUrl,
			t,
		]
	);

	playTrackCbRef.current = playTrackCb;

	useEffect(() => {
		recoverFromHardMediaErrorRef.current = () => {
			const track = stateRef.current.track;
			if (!track) return;
			const resumeAt = stateRef.current.currentTime;
			if (resumeAt > 0) {
				initialSeekRef.current = resumeAt;
			}
			void playTrackCb(track, { preferBlob: true, forceReload: true });
		};
		return () => {
			recoverFromHardMediaErrorRef.current = null;
		};
	}, [playTrackCb]);

	const play = useCallback(() => {
		const track = stateRef.current.track;
		if (!track) return;
		if (isFoflineSpaWebAudioHost()) {
			releaseHtmlMediaElement(audioRef.current);
			if (foflineNowPlaying.loadedTrackId !== track.id) {
				void playTrackCb(track, { preferBlob: true });
				return;
			}
			void foflineNowPlaying
				.play()
				.then(() => {
					setState((s) => ({
						...s,
						playing: true,
						isLoading: false,
						diagnostics: {
							...s.diagnostics,
							loadingStage: 'playing',
							errorCategory: null,
						},
					}));
				})
				.catch((error: unknown) => {
					const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
					setState((s) =>
						withTrackError(s, {
							trackId: track.id,
							message: info.message,
							category: info.category,
						})
					);
				});
			return;
		}
		const audio = audioRef.current;
		if (!track || !audio) return;
		const hard = isNowPlayingMediaHardError(audio);
		if (loadedTrackIdRef.current !== track.id || hard) {
			void playTrackCb(track, {
				preferBlob: hard,
				forceReload: hard,
			});
			return;
		}
		// Already-loaded resume: play() in the click stack — no unlock dance.
		void audio
			.play()
			.then(() => {
				setState((s) => ({
					...s,
					playing: true,
					diagnostics: {
						...s.diagnostics,
						loadingStage: 'playing',
						errorCategory: null,
					},
				}));
			})
			.catch((error: unknown) => {
				const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
				if (isPlaybackAbortError(error)) {
					setState((s) => ({
						...s,
						playing: false,
					}));
					return;
				}
				if (isNowPlayingMediaHardError(audioRef.current)) {
					loadedTrackIdRef.current = null;
					void playTrackCb(track, {
						preferBlob: true,
						forceReload: true,
					});
					return;
				}
				emitPlaybackStageMetric(track.id ?? 'unknown', 'play-rejection', {
					category: info.category,
				});
				setState((s) =>
					withTrackError(s, {
						trackId: s.track?.id ?? null,
						message: info.message,
						category: info.category,
					})
				);
			});
	}, [audioRef, playTrackCb, t]);

	const playTrack = playTrackCb;

	const retryCurrentTrack = useCallback(async () => {
		const track = stateRef.current.track;
		if (!track) return;
		await playTrackCb(track, { preferBlob: true, forceReload: true });
	}, [playTrackCb]);

	const togglePlayPause = useCallback(() => {
		if (state.playing) {
			pause();
		} else {
			play();
		}
	}, [state.playing, pause, play]);

	const seek = useCallback(
		(time: number) => {
			const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
			if (isFoflineSpaWebAudioHost() && foflineNowPlaying.loadedTrackId) {
				const shouldResume =
					stateRef.current.playing || foflineNowPlaying.isPlaying;
				foflineNowPlaying.seek(safeTime, shouldResume);
				releaseHtmlMediaElement(audioRef.current);
				setState((s) => ({
					...s,
					currentTime: safeTime,
					playing: shouldResume,
				}));
				checkpointPositionSession(stateRef.current.track?.id, safeTime);
				return;
			}
			const audio = audioRef.current;
			const track = stateRef.current.track;
			if (track && isNowPlayingMediaHardError(audio)) {
				setState((s) => ({ ...s, currentTime: safeTime }));
				initialSeekRef.current = safeTime;
				checkpointPositionSession(track.id, safeTime);
				void playTrackCb(track, { preferBlob: true, forceReload: true });
				return;
			}
			const shouldResume =
				Boolean(audio) &&
				(stateRef.current.playing || (audio ? !audio.paused : false));
			if (audio) {
				try {
					audio.currentTime = safeTime;
				} catch {
					/* InvalidStateError when metadata is not ready yet */
				}
				if (isNowPlayingMediaHardError(audio) && track) {
					setState((s) => ({ ...s, currentTime: safeTime }));
					initialSeekRef.current = safeTime;
					checkpointPositionSession(track.id, safeTime);
					void playTrackCb(track, { preferBlob: true, forceReload: true });
					return;
				}
			}
			setState((s) => {
				const clearAborted = s.diagnostics.errorCategory === 'aborted';
				return {
					...s,
					currentTime: safeTime,
					...(clearAborted
						? {
								error: null,
								errorTrackId: null,
								diagnostics: {
									...s.diagnostics,
									errorCategory: null,
									loadingStage:
										s.diagnostics.loadingStage === 'error'
											? 'idle'
											: s.diagnostics.loadingStage,
								},
							}
						: {}),
				};
			});
			if (audio && shouldResume) {
				// Seek resume is sync in the pointer/key gesture — no unlock pause.
				void audio
					.play()
					.then(() => {
						setState((s) => ({
							...s,
							playing: true,
							diagnostics: {
								...s.diagnostics,
								loadingStage: 'playing',
								errorCategory:
									s.diagnostics.errorCategory === 'aborted'
										? null
										: s.diagnostics.errorCategory,
							},
						}));
					})
					.catch((error: unknown) => {
						const info = mapPlaybackErrorInfo(error, t, 'nowPlaying');
						if (isPlaybackAbortError(error)) {
							return;
						}
						if (isNowPlayingMediaHardError(audio) && track) {
							loadedTrackIdRef.current = null;
							initialSeekRef.current = safeTime;
							void playTrackCb(track, {
								preferBlob: true,
								forceReload: true,
							});
							return;
						}
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
					});
			}
			checkpointPositionSession(stateRef.current.track?.id, safeTime);
		},
		[audioRef, checkpointPositionSession, playTrackCb, t]
	);

	const setVolume = useCallback(
		(value: number) => {
			const v = Math.max(0, Math.min(1, value));
			setState((s) => ({ ...s, volume: v }));
			lastVolumeTargetRef.current = v * (micDucking ? DUCK_VOLUME : 1);
			if (isFoflineSpaWebAudioHost()) {
				foflineNowPlaying.setVolume(lastVolumeTargetRef.current);
			}
			if (audioRef.current) {
				audioRef.current.volume = lastVolumeTargetRef.current;
			}
		},
		[audioRef, lastVolumeTargetRef, micDucking]
	);

	const setPlaybackRate = useCallback(
		(value: number) => {
			const rate = Math.max(0.5, Math.min(2, value));
			setState((s) => ({ ...s, playbackRate: rate }));
			if (isFoflineSpaWebAudioHost()) {
				foflineNowPlaying.setRate(rate);
			}
			if (audioRef.current) {
				audioRef.current.playbackRate = rate;
			}
		},
		[audioRef]
	);

	const registerOnTrackEnded = useCallback((callback: (() => void) | null) => {
		onTrackEndedRef.current = callback;
	}, []);

	const registerNext = useCallback((callback: (() => void) | null) => {
		nextRef.current = callback;
	}, []);

	const registerPrev = useCallback((callback: (() => void) | null) => {
		prevRef.current = callback;
	}, []);

	const next = useCallback(() => {
		nextRef.current?.();
	}, []);

	const prev = useCallback(() => {
		prevRef.current?.();
	}, []);

	const clearError = useCallback(() => {
		setState((s) => ({
			...s,
			error: null,
			errorTrackId: null,
			isLoadingStalled: false,
			diagnostics: {
				...s.diagnostics,
				errorCategory: null,
				loadingStage: s.playing ? 'playing' : 'idle',
			},
		}));
	}, []);

	useEffect(() => {
		if (!state.isLoading) {
			return;
		}
		const trackId = state.track?.id ?? null;
		const timer = window.setTimeout(() => {
			setState((s) => {
				if (
					!s.isLoading ||
					s.track?.id !== trackId ||
					s.error ||
					s.isLoadingStalled
				) {
					return s;
				}
				return { ...s, isLoadingStalled: true };
			});
		}, NOW_PLAYING_LOAD_STALL_MS);
		return () => {
			window.clearTimeout(timer);
		};
	}, [state.isLoading, state.track?.id]);

	useMediaSessionMusic({
		track: state.track,
		playing: state.playing,
		isLoading: state.isLoading,
		currentTime: state.currentTime,
		duration: state.duration,
		playbackRate: state.playbackRate,
		play,
		pause,
		next,
		prev,
		seek,
	});

	useEffect(() => {
		if (!state.track) {
			scheduleShellPersist(null, state.volume);
			return;
		}
		scheduleShellPersist(state.track, state.volume);
	}, [state.track, state.volume, scheduleShellPersist]);

	useNowPlayingAudioListeners({
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
	});

	useEffect(() => {
		return () => {
			abortInFlightFetch();
			revokeCurrentObjectUrl();
		};
	}, [abortInFlightFetch, revokeCurrentObjectUrl]);

	const getCurrentTime = useCallback(() => stateRef.current.currentTime, []);

	const transportValue = useMemo(
		(): NowPlayingTransportValue => ({
			track: state.track,
			playing: state.playing,
			duration: state.duration,
			bufferedRanges: state.bufferedRanges,
			volume: state.volume,
			playbackRate: state.playbackRate,
			isLoading: state.isLoading,
			isLoadingStalled: state.isLoadingStalled,
			error: state.error,
			errorTrackId: state.errorTrackId,
			diagnostics: state.diagnostics,
			getCurrentTime,
			setTrack,
			play,
			pause,
			togglePlayPause,
			seek,
			setVolume,
			setPlaybackRate,
			registerOnTrackEnded,
			registerNext,
			registerPrev,
			next,
			prev,
			playTrack,
			retryCurrentTrack,
			clearError,
		}),
		[
			state.track,
			state.playing,
			state.duration,
			state.bufferedRanges,
			state.volume,
			state.playbackRate,
			state.isLoading,
			state.isLoadingStalled,
			state.error,
			state.errorTrackId,
			state.diagnostics,
			getCurrentTime,
			setTrack,
			play,
			pause,
			togglePlayPause,
			seek,
			setVolume,
			setPlaybackRate,
			registerOnTrackEnded,
			registerNext,
			registerPrev,
			next,
			prev,
			playTrack,
			retryCurrentTrack,
			clearError,
		]
	);

	return { state, transportValue };
}

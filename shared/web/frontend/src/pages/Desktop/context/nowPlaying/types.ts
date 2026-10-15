/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public and internal TypeScript contracts for now-playing context state.
 *
 * Invariants:
 * - Shell-state persists track identity + volume only; position is tab-scoped.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlayingStateTransitions.ts
 */

import type { AudioSourceSurface } from '../../../../services/audio/playerAudioContracts';
import type { PlaybackErrorCategory } from '../../../../services/audio/playbackErrors';

export interface NowPlayingTrack {
	id: string;
	name: string;
	thumbnail_url?: string | null;
	version?: string | null;
	mime_type?: string | null;
	source_surface?: AudioSourceSurface;
}

export interface NowPlayingDiagnostics {
	trackId: string | null;
	sourceSurface: AudioSourceSurface | null;
	cacheSource: 'network' | 'idb-cache' | 'inline-stream' | null;
	loadingStage:
		| 'idle'
		| 'play-requested'
		| 'loading-blob'
		| 'blob-ready'
		| 'stream-ready'
		| 'canplay'
		| 'playing'
		| 'error';
	errorCategory: PlaybackErrorCategory | null;
}

export interface NowPlayingState {
	track: NowPlayingTrack | null;
	playing: boolean;
	currentTime: number;
	duration: number;
	bufferedRanges: Array<{ start: number; end: number }>;
	volume: number;
	playbackRate: number;
	/** True while loading blob and starting playback */
	isLoading: boolean;
	/** True when loading exceeded {@link import('./constants').NOW_PLAYING_LOAD_STALL_MS} without progress. */
	isLoadingStalled: boolean;
	/** Last playback error message (if any). Not persisted. */
	error: string | null;
	/** Track for which the last error occurred (if any). */
	errorTrackId: string | null;
	/** Read-only diagnostics for development overlays and telemetry inspection. */
	diagnostics: NowPlayingDiagnostics;
}

export interface NowPlayingContextValue extends NowPlayingState {
	setTrack: (track: NowPlayingTrack | null) => void;
	play: () => void;
	pause: () => void;
	togglePlayPause: () => void;
	seek: (time: number) => void;
	setVolume: (value: number) => void;
	setPlaybackRate: (value: number) => void;
	/** Called when current track ends (e.g. to play next). Register from MusicPlayer. */
	registerOnTrackEnded: (callback: (() => void) | null) => void;
	/** Register handlers for transport controls (next/prev) from MusicPlayer. */
	registerNext: (callback: (() => void) | null) => void;
	registerPrev: (callback: (() => void) | null) => void;
	/** Invoke registered next/prev handlers (used by desktop widget). */
	next: () => void;
	prev: () => void;
	/** Set track and start playing (fetches blob and sets audio source). */
	playTrack: (track: NowPlayingTrack) => Promise<void>;
	/** Reload current track like a fresh play (clears error first). No-op if no track. */
	retryCurrentTrack: () => Promise<void>;
	/** Clear last playback error */
	clearError: () => void;
}

/** Всё из {@link NowPlayingContextValue}, кроме `currentTime`, плюс императивное чтение позиции без подписки на тики. */
export type NowPlayingTransportValue = Omit<
	NowPlayingContextValue,
	'currentTime'
> & {
	getCurrentTime: () => number;
};

export interface PersistedState {
	track: NowPlayingTrack | null;
	currentTime: number;
	volume: number;
}

export const defaultState: NowPlayingState = {
	track: null,
	playing: false,
	currentTime: 0,
	duration: 0,
	bufferedRanges: [],
	volume: 1,
	playbackRate: 1,
	isLoading: false,
	isLoadingStalled: false,
	error: null,
	errorTrackId: null,
	diagnostics: {
		trackId: null,
		sourceSurface: null,
		cacheSource: null,
		loadingStage: 'idle',
		errorCategory: null,
	},
};

export const defaultTransportValue: NowPlayingTransportValue = {
	track: defaultState.track,
	playing: defaultState.playing,
	duration: defaultState.duration,
	bufferedRanges: defaultState.bufferedRanges,
	volume: defaultState.volume,
	playbackRate: defaultState.playbackRate,
	isLoading: defaultState.isLoading,
	isLoadingStalled: defaultState.isLoadingStalled,
	error: defaultState.error,
	errorTrackId: defaultState.errorTrackId,
	diagnostics: defaultState.diagnostics,
	getCurrentTime: () => 0,
	setTrack: () => {},
	play: () => {},
	pause: () => {},
	togglePlayPause: () => {},
	seek: () => {},
	setVolume: () => {},
	setPlaybackRate: () => {},
	registerOnTrackEnded: () => {},
	registerNext: () => {},
	registerPrev: () => {},
	next: () => {},
	prev: () => {},
	playTrack: async () => {},
	retryCurrentTrack: async () => {},
	clearError: () => {},
};

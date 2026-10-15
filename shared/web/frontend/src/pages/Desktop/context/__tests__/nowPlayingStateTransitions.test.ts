/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for isolated now-playing state transition helpers.
 *
 * Invariants:
 * - Helpers preserve unrelated fields while normalizing playback transition branches.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlayingStateTransitions.ts
 */

import { describe, expect, it } from 'vitest';
import type { NowPlayingTrack } from '@/pages/Desktop/context/NowPlayingContext';

import {
	withDiagnosticsPatch,
	withTrackError,
	withTrackLoadStart,
	withTrackReset,
} from '@/pages/Desktop/context/nowPlayingStateTransitions';

const baseState = {
	track: null as NowPlayingTrack | null,
	playing: true,
	currentTime: 42,
	duration: 180,
	bufferedRanges: [{ start: 0, end: 60 }],
	isLoading: false,
	isLoadingStalled: false,
	error: null,
	errorTrackId: 'old-track',
	diagnostics: {
		trackId: 'old-track',
		sourceSurface: null,
		cacheSource: 'network' as const,
		loadingStage: 'playing' as const,
		errorCategory: null,
	},
};

describe('nowPlayingStateTransitions', () => {
	it('resets transport state for track replacement', () => {
		const next = withTrackReset(baseState, {
			id: 'track-1',
			name: 'Track One',
			source_surface: 'music-player',
		});
		expect(next.track?.id).toBe('track-1');
		expect(next.playing).toBe(false);
		expect(next.currentTime).toBe(0);
		expect(next.duration).toBe(0);
		expect(next.bufferedRanges).toEqual([]);
		expect(next.isLoading).toBe(false);
		expect(next.isLoadingStalled).toBe(false);
		expect(next.error).toBeNull();
		expect(next.errorTrackId).toBeNull();
		expect(next.diagnostics).toMatchObject({
			trackId: 'track-1',
			sourceSurface: 'music-player',
			cacheSource: null,
			loadingStage: 'idle',
			errorCategory: null,
		});
	});

	it('marks loading branch with normalized diagnostics', () => {
		const next = withTrackLoadStart(
			baseState,
			{
				id: 'track-2',
				name: 'Track Two',
				source_surface: 'content-manager',
			},
			12
		);
		expect(next.track?.id).toBe('track-2');
		expect(next.currentTime).toBe(12);
		expect(next.isLoading).toBe(true);
		expect(next.bufferedRanges).toEqual([]);
		expect(next.error).toBeNull();
		expect(next.errorTrackId).toBeNull();
		expect(next.diagnostics).toMatchObject({
			trackId: 'track-2',
			sourceSurface: 'content-manager',
			cacheSource: null,
			loadingStage: 'loading-blob',
			errorCategory: null,
		});
	});

	it('applies error branch without mutating unrelated fields', () => {
		const next = withTrackError(baseState, {
			trackId: 'track-3',
			message: 'Cannot decode',
			category: 'decode',
			cacheSource: 'idb-cache',
		});
		expect(next.playing).toBe(false);
		expect(next.isLoading).toBe(false);
		expect(next.error).toBe('Cannot decode');
		expect(next.errorTrackId).toBe('track-3');
		expect(next.diagnostics).toMatchObject({
			cacheSource: 'idb-cache',
			loadingStage: 'error',
			errorCategory: 'decode',
		});
	});

	it('patches diagnostics without touching transport fields', () => {
		const next = withDiagnosticsPatch(baseState, {
			loadingStage: 'canplay',
			cacheSource: 'network',
		});
		expect(next.playing).toBe(baseState.playing);
		expect(next.currentTime).toBe(baseState.currentTime);
		expect(next.diagnostics).toMatchObject({
			loadingStage: 'canplay',
			cacheSource: 'network',
		});
	});
});

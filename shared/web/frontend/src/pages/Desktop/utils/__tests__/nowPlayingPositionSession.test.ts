/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for tab-scoped NowPlaying position sessionStorage helpers.
 *
 * Related:
 * - src/pages/Desktop/utils/nowPlayingPositionSession.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	clearNowPlayingPositionSession,
	readNowPlayingPositionSession,
	writeNowPlayingPositionSession,
} from '../nowPlayingPositionSession';

const STORAGE_KEY = 'eliteew-nowplaying-position';

describe('nowPlayingPositionSession', () => {
	afterEach(() => {
		sessionStorage.clear();
	});

	it('writes and reads position for the same track id', () => {
		writeNowPlayingPositionSession('track-a', 42.5);
		expect(readNowPlayingPositionSession('track-a')).toBe(42.5);
	});

	it('returns null when track id does not match stored snapshot', () => {
		writeNowPlayingPositionSession('track-a', 10);
		expect(readNowPlayingPositionSession('track-b')).toBeNull();
	});

	it('clears stored position', () => {
		writeNowPlayingPositionSession('track-a', 12);
		clearNowPlayingPositionSession();
		expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(readNowPlayingPositionSession('track-a')).toBeNull();
	});

	it('ignores non-positive and non-finite values on write', () => {
		writeNowPlayingPositionSession('track-a', -5);
		expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
		writeNowPlayingPositionSession('track-a', 0);
		expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
		writeNowPlayingPositionSession('track-a', Number.NaN);
		expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});

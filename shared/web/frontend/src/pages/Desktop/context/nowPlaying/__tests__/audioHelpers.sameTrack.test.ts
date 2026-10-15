/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layer C lock for same-track in-place actions and hard media-error detection.
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/audioHelpers.ts
 */

import { describe, expect, it } from 'vitest';
import {
	HTML_MEDIA_ERR_ABORTED,
	HTML_MEDIA_ERR_NETWORK,
} from '../../../../../services/audio/playbackErrors';
import {
	isNowPlayingMediaHardError,
	resolveSameTrackPlayAction,
} from '../audioHelpers';

describe('isNowPlayingMediaHardError', () => {
	it('treats null / no error as healthy', () => {
		expect(isNowPlayingMediaHardError(null)).toBe(false);
		expect(isNowPlayingMediaHardError({ error: null })).toBe(false);
	});

	it('ignores MEDIA_ERR_ABORTED', () => {
		expect(
			isNowPlayingMediaHardError({
				error: { code: HTML_MEDIA_ERR_ABORTED } as MediaError,
			})
		).toBe(false);
	});

	it('flags MEDIA_ERR_NETWORK as hard', () => {
		expect(
			isNowPlayingMediaHardError({
				error: { code: HTML_MEDIA_ERR_NETWORK } as MediaError,
			})
		).toBe(true);
	});
});

describe('resolveSameTrackPlayAction', () => {
	const base = {
		loadedTrackId: 't1',
		trackId: 't1',
		mediaHardError: false,
		paused: false,
		playing: true,
		ended: false,
	};

	it('pauses when same healthy track is already playing', () => {
		expect(resolveSameTrackPlayAction(base)).toBe('pause');
	});

	it('resumes when same healthy track is paused mid-track', () => {
		expect(
			resolveSameTrackPlayAction({
				...base,
				paused: true,
				playing: false,
			})
		).toBe('resume');
	});

	it('restarts when ended (repeat-one / replay)', () => {
		expect(
			resolveSameTrackPlayAction({
				...base,
				paused: true,
				playing: false,
				ended: true,
			})
		).toBe('restart');
	});

	it('reloads on hard media error or forceReload or id mismatch', () => {
		expect(resolveSameTrackPlayAction({ ...base, mediaHardError: true })).toBe(
			'reload'
		);
		expect(resolveSameTrackPlayAction({ ...base, forceReload: true })).toBe(
			'reload'
		);
		expect(
			resolveSameTrackPlayAction({ ...base, loadedTrackId: 'other' })
		).toBe('reload');
	});
});

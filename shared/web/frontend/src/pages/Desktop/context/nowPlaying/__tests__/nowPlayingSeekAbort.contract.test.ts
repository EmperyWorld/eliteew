/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock seek/play abort handling: AbortError and MEDIA_ERR_ABORTED must not
 * sticky-error the now-playing bar after scrubbing a stream.
 *
 * Related:
 * - attachLoadedAudioSource.ts, useNowPlayingController.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Now-playing seek abort handling', () => {
	it('ignores AbortError sticky path and MEDIA_ERR_ABORTED in attachLoadedAudioSource', () => {
		const src = stripComments(readSrc('../attachLoadedAudioSource.ts'));
		expect(src).toContain('isPlaybackAbortError');
		expect(src).toContain('isHtmlMediaAbortedError');
		expect(src).toMatch(/if \(isPlaybackAbortError\(playError\)\)/);
		expect(src).toMatch(/if \(isHtmlMediaAbortedError\(audio\)\)/);
	});

	it('resumes play after seek and ignores abort on play()/seek()', () => {
		const src = stripComments(readSrc('../useNowPlayingController.ts'));
		expect(src).toContain('isPlaybackAbortError');
		expect(src).toContain('shouldResume');
		// Unlock only bridges async load — not sync seek/resume (same-src pause race).
		expect(src).toContain('captureNowPlayingUserActivation(audioRef.current)');
		expect(src).not.toMatch(
			/shouldResume[\s\S]{0,200}captureNowPlayingUserActivation/
		);
		expect(src).toMatch(/if \(isPlaybackAbortError\(error\)\)/);
	});

	it('does not unlock before sync resume or in-place play', () => {
		const src = stripComments(readSrc('../useNowPlayingController.ts'));
		const unlockCount = (src.match(/captureNowPlayingUserActivation\(/g) ?? [])
			.length;
		expect(unlockCount).toBe(1);
		expect(src).toContain('captureNowPlayingUserActivation(audioRef.current)');
	});

	it('same healthy track pauses/resumes in place; hard error prefers blob reload', () => {
		const src = stripComments(readSrc('../useNowPlayingController.ts'));
		expect(src).toContain('resolveSameTrackPlayAction');
		expect(src).toContain('isNowPlayingMediaHardError');
		expect(src).toContain('preferBlob: true');
		expect(src).toContain('forceReload: true');
		const helpers = stripComments(readSrc('../audioHelpers.ts'));
		expect(helpers).toContain('SameTrackPlayAction');
		expect(helpers).toContain("return 'pause'");
	});

	it('audio error listener clears loadedTrackId and recovers once via preferBlob', () => {
		const src = stripComments(readSrc('../useNowPlayingAudioListeners.ts'));
		expect(src).toContain("addEventListener('error', onError)");
		expect(src).toContain('isNowPlayingMediaHardError');
		expect(src).toContain('loadedTrackIdRef.current = null');
		expect(src).toContain('recoverFromHardMediaErrorRef.current');
	});
});

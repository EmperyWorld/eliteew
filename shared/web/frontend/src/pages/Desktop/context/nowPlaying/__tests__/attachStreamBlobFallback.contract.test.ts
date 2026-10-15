/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock stream→typed-blob fallback after ticket media error (Tauri/WebView decode false-positive).
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/attachLoadedAudioSource.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
	join(
		dirname(fileURLToPath(import.meta.url)),
		'../attachLoadedAudioSource.ts'
	),
	'utf8'
);

describe('attachLoadedAudioSource stream→blob fallback contract', () => {
	it('offers loadBlobFallback after stream remint path', () => {
		expect(src).toContain('loadBlobFallback');
		expect(src).toContain('streamBlobFallbackAttempted');
		expect(src).toContain('normalizeAudioBlob');
		expect(src).toContain('classifyHtmlMediaElementError');
	});

	it('does not terminal-decode solely from invented AUDIO_DECODE_ERROR before fallback', () => {
		const fallbackIdx = src.indexOf('streamBlobFallbackAttempted');
		const terminalDecodeIdx = src.lastIndexOf(
			"new Error('AUDIO_DECODE_ERROR')"
		);
		expect(fallbackIdx).toBeGreaterThan(0);
		expect(terminalDecodeIdx).toBeGreaterThan(fallbackIdx);
	});

	it('sets loadedTrackIdRef on stream attach (parity with typed blob) and on canplay', () => {
		const streamAssignBlock = src.slice(
			src.indexOf("if (loaded.mode === 'stream')"),
			src.indexOf('if (!attachTypedBlob')
		);
		expect(streamAssignBlock).toContain('audio.src = loaded.streamUrl');
		expect(streamAssignBlock).toContain('loadedTrackIdRef.current = track.id');
		expect(src).toContain('loadedTrackIdRef.current = track.id');
		const canplayIdx = src.indexOf('const onCanPlay');
		const setOnCanplay = src.indexOf(
			'loadedTrackIdRef.current = track.id',
			canplayIdx
		);
		expect(setOnCanplay).toBeGreaterThan(canplayIdx);
	});

	it('recovers from poisoned idb-cache via the same blob fallback', () => {
		expect(src).toContain('idb-decode-blob-fallback');
		expect(src).toContain("loaded.cacheSource === 'idb-cache'");
	});
});

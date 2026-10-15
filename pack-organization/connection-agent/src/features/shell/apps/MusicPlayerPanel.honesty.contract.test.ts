/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock client-edition offline MusicPlayer honesty — native local playback, no fake cloud library,
 * no HTML5 <audio> fallback.
 *
 * Invariants:
 * - Panel copy states cloud library is unavailable offline.
 * - Panel does not claim remote catalog / shell playlists sync while offline.
 * - Playback goes through native_audio_* (rodio), not createObjectURL / <audio>.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md
 * - documentation/platform/ELITEEW-CLIENT-OFFLINE-AI-PACK.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const panelPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'MusicPlayerPanel.tsx'
);
const source = readFileSync(panelPath, 'utf8');

describe('MusicPlayerPanel offline honesty', () => {
	it('states local-file playback and unavailable cloud library', () => {
		expect(source).toMatch(/локального файла/i);
		expect(source).toMatch(/Облачная библиотека недоступна/i);
		expect(source).toMatch(/офлайн/i);
		expect(source).toMatch(/нативн/i);
	});

	it('does not pretend to load remote catalog or playlists offline', () => {
		expect(source).not.toMatch(/GET\s+\/api\/v1\/content/i);
		expect(source).not.toMatch(/music_playlists/i);
		expect(source).not.toMatch(/shell-state/i);
		expect(source).toMatch(/fileGrantPick/);
		expect(source).not.toMatch(/type="file"/);
	});

	it('uses native audio bridge without HTML5 audio fallback', () => {
		expect(source).not.toMatch(/nativeAudioPlayBytes/);
		expect(source).toMatch(/nativeAudioPlayFromGrant/);
		expect(source).toMatch(/nativeAudioPause/);
		expect(source).toMatch(/NATIVE_AUDIO_PROGRESS_EVENT/);
		expect(source).not.toMatch(/createObjectURL/);
		expect(source).not.toMatch(/<audio\b/);
		expect(source).not.toMatch(/URL\.revokeObjectURL/);
	});

	it('guards transport toggle with single-flight and playingRef', () => {
		expect(source).toMatch(/transportInFlightRef/);
		expect(source).toMatch(/playingRef/);
		expect(source).toMatch(/if \(transportInFlightRef\.current\)/);
		expect(source).toMatch(/playingRef\.current/);
	});
});

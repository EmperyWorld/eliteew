/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock native audio bridge exports for offline MusicPlayer (no silent HTML5 path).
 *
 * Related:
 * - src/lib/tauri-bridge/commands.ts
 * - documentation/product/desktop/DESKTOP-MUSIC-PLAYER.md §Client edition
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const commandsPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'commands.ts'
);
const source = readFileSync(commandsPath, 'utf8');

describe('native audio tauri bridge', () => {
	it('exports play/pause/seek/stop and progress event names', () => {
		expect(source).not.toMatch(/native_audio_play_bytes/);
		expect(source).toMatch(/native_audio_play_from_grant/);
		expect(source).toMatch(/nativeAudioPlayFromGrant/);
		expect(source).toMatch(/file_grant_pick/);
		expect(source).toMatch(/native_audio_pause/);
		expect(source).toMatch(/native_audio_resume/);
		expect(source).toMatch(/native_audio_stop/);
		expect(source).toMatch(/native_audio_seek/);
		expect(source).toMatch(
			/export const NATIVE_AUDIO_PROGRESS_EVENT = [\"']native-audio-progress[\"']/
		);
		expect(source).toMatch(
			/export const NATIVE_AUDIO_ENDED_EVENT = [\"']native-audio-ended[\"']/
		);
	});

	it('documents no HTML5 fallback on codec failure', () => {
		expect(source).toMatch(/no HTML5 fallback/i);
	});
});

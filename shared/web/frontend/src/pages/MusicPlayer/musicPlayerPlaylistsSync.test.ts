/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for playlist shell-state export/import helpers.
 *
 * Invariants:
 * - Export payload keeps shell-state-compatible `music_playlists` shape.
 * - Import accepts envelope and raw array forms.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerPlaylistsSync.ts
 */

import { describe, expect, it } from 'vitest';

import {
	buildMusicPlaylistsExportEnvelope,
	parseMusicPlaylistsImportPayload,
} from './musicPlayerPlaylistsSync';
import { FAVORITES_PLAYLIST_ID, type SavedPlaylist } from './musicPlayerTypes';

describe('musicPlayerPlaylistsSync export/import', () => {
	it('builds shell-compatible export envelope', () => {
		const playlists: SavedPlaylist[] = [
			{
				id: 'mix-1',
				name: 'Focus Mix',
				trackIds: ['track-a', 'track-b'],
			},
		];
		const envelope = buildMusicPlaylistsExportEnvelope(
			playlists,
			'2026-05-31T00:00:00.000Z'
		);
		expect(envelope.schema).toBe('eliteew.music_playlists.v1');
		expect(envelope.exported_at).toBe('2026-05-31T00:00:00.000Z');
		expect(envelope.music_playlists).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'mix-1',
					name: 'Focus Mix',
					track_ids: ['track-a', 'track-b'],
				}),
			])
		);
	});

	it('parses envelope and restores favorites normalization', () => {
		const raw = JSON.stringify({
			schema: 'eliteew.music_playlists.v1',
			music_playlists: [
				{ id: 'mix-2', name: 'Deep Mix', track_ids: ['track-x'] },
			],
		});
		const imported = parseMusicPlaylistsImportPayload(raw);
		expect(imported).not.toBeNull();
		expect(
			imported?.some((playlist) => playlist.id === FAVORITES_PLAYLIST_ID)
		).toBe(true);
		expect(imported?.some((playlist) => playlist.id === 'mix-2')).toBe(true);
	});

	it('returns null for invalid json payload', () => {
		expect(parseMusicPlaylistsImportPayload('not-json')).toBeNull();
	});
});

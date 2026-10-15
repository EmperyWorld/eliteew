/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify companion `music_play_track` action dispatches desktop global playback event.
 *
 * Invariants:
 * - Blocked/failed outcomes never emit playback side effects.
 *
 * Related:
 * - src/features/ewa/companionActionDispatch.ts
 * - src/pages/Desktop/utils/desktopDeepLink.ts
 */

import { describe, expect, it, vi } from 'vitest';

import { dispatchCompanionMusicPlayTrackAction } from '@/features/ewa/companionActionDispatch';
import { DESKTOP_MUSIC_PLAY_TRACK_EVENT } from '@/pages/Desktop/utils/desktopDeepLink';
import { requestContentManagerLibraryRefresh } from '@/services/unifiedContentEvents';
import type { CompanionChatActionMusicPlayTrack } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('@/services/unifiedContentEvents', () => ({
	requestContentManagerLibraryRefresh: vi.fn(),
}));

describe('dispatchCompanionMusicPlayTrackAction', () => {
	it('emits desktop music play event for allowed action', async () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
		const action: CompanionChatActionMusicPlayTrack = {
			type: 'music_play_track',
			unified_content_id: 'track-1',
			track_name: 'Summer',
			thumbnail_url: 'https://example.com/cover.png',
		};
		expect(dispatchCompanionMusicPlayTrackAction(action)).toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
		const ev = spy.mock.calls[0][0] as CustomEvent;
		expect(ev.detail).toEqual({
			id: 'track-1',
			name: 'Summer',
			thumbnail_url: 'https://example.com/cover.png',
			version: null,
			mime_type: null,
			source_surface: 'ewa-companion',
		});
		await vi.waitFor(() =>
			expect(requestContentManagerLibraryRefresh).toHaveBeenCalledTimes(1)
		);
		window.removeEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
	});

	it('skips dispatch for blocked outcome', () => {
		const spy = vi.fn();
		window.addEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
		const action: CompanionChatActionMusicPlayTrack = {
			type: 'music_play_track',
			unified_content_id: 'track-2',
			track_name: 'Blocked',
			outcome: 'blocked',
		};
		expect(dispatchCompanionMusicPlayTrackAction(action)).toBe(false);
		expect(spy).not.toHaveBeenCalled();
		window.removeEventListener(DESKTOP_MUSIC_PLAY_TRACK_EVENT, spy);
	});
});

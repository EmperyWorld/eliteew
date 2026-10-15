/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small companion-action dispatch helpers shared by chat panel and tests.
 *
 * Invariants:
 * - `music_play_track` is routed to global desktop playback event.
 * - Blocked/failed outcomes never dispatch playback side effects.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionActionDispatch.ts
 * - src/pages/Desktop/utils/desktopDeepLink.ts
 */

import { requestPlayInMusicPlayer } from '@/pages/Desktop/utils/desktopDeepLink';
import { requestContentManagerLibraryRefresh } from '@/services/unifiedContentEvents';
import type { CompanionChatActionMusicPlayTrack } from '@/services/ewa/ewaCompanionChatApi';

export function dispatchCompanionMusicPlayTrackAction(
	action: CompanionChatActionMusicPlayTrack
): boolean {
	const trackId = action.unified_content_id?.trim();
	if (!trackId) return false;
	const outcome = action.outcome;
	if (outcome === 'blocked' || outcome === 'failed') {
		return false;
	}
	requestPlayInMusicPlayer({
		id: trackId,
		name: action.track_name?.trim() || trackId,
		thumbnail_url: action.thumbnail_url ?? null,
		source_surface: 'ewa-companion',
	});
	queueMicrotask(() => requestContentManagerLibraryRefresh());
	return true;
}

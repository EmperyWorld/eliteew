/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Buffered-range helpers and same-track / media-health decisions for now-playing.
 *
 * Invariants:
 * - Malformed TimeRanges rows are skipped without throwing.
 * - MEDIA_ERR_ABORTED is not a hard error (seek on progressive streams).
 *
 * Related:
 * - src/pages/Desktop/context/nowPlaying/useNowPlayingAudioListeners.ts
 * - src/pages/Desktop/context/nowPlaying/useNowPlayingController.ts
 * - src/services/audio/playbackErrors.ts
 */

import { HTML_MEDIA_ERR_ABORTED } from '../../../../services/audio/playbackErrors';

/** Hard media failure that requires source re-resolve (not seek abort). */
export function isNowPlayingMediaHardError(
	media: Pick<HTMLMediaElement, 'error'> | null | undefined
): boolean {
	const code = media?.error?.code;
	if (code == null) return false;
	return code !== HTML_MEDIA_ERR_ABORTED;
}

export type SameTrackPlayAction = 'pause' | 'resume' | 'restart' | 'reload';

/**
 * Decide in-place vs full teardown for playTrack(same id).
 * Same-track click must not remint ticket streams while the element is healthy.
 */
export function resolveSameTrackPlayAction(args: {
	loadedTrackId: string | null;
	trackId: string;
	forceReload?: boolean;
	mediaHardError: boolean;
	paused: boolean;
	playing: boolean;
	ended: boolean;
}): SameTrackPlayAction {
	if (
		args.forceReload ||
		args.loadedTrackId !== args.trackId ||
		args.mediaHardError
	) {
		return 'reload';
	}
	if (args.ended) return 'restart';
	if (!args.paused && args.playing) return 'pause';
	return 'resume';
}

export function readBufferedRangesFromAudio(
	audio: HTMLAudioElement
): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	const { buffered } = audio;
	if (!buffered || buffered.length === 0) return ranges;
	for (let index = 0; index < buffered.length; index += 1) {
		try {
			const start = buffered.start(index);
			const end = buffered.end(index);
			if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
				continue;
			}
			ranges.push({ start, end });
		} catch {
			// ignore malformed TimeRanges rows
		}
	}
	return ranges;
}

export function sameBufferedRanges(
	left: Array<{ start: number; end: number }>,
	right: Array<{ start: number; end: number }>
): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (
			Math.abs(left[index].start - right[index].start) > 0.01 ||
			Math.abs(left[index].end - right[index].end) > 0.01
		) {
			return false;
		}
	}
	return true;
}

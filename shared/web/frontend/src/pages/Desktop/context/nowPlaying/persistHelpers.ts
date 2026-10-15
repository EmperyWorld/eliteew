/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy localStorage and shell-state hydrate/persist helpers for now-playing.
 *
 * Invariants:
 * - Shell patch carries track identity + volume only (no position).
 *
 * Related:
 * - src/pages/Desktop/utils/nowPlayingPositionSession.ts
 */

import {
	readNowPlayingPositionSession,
	writeNowPlayingPositionSession,
} from '../../utils/nowPlayingPositionSession';
import type { DesktopNowPlayingShellState } from '../../services/desktopApi';
import { LEGACY_LOCAL_STORAGE_KEY } from './constants';
import type { NowPlayingTrack, PersistedState } from './types';

export function loadLegacyLocalStorage(): PersistedState | null {
	try {
		const raw =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY)
				: null;
		if (!raw) return null;
		const data = JSON.parse(raw) as PersistedState;
		if (
			!data ||
			typeof data.currentTime !== 'number' ||
			typeof data.volume !== 'number'
		)
			return null;
		return {
			track: data.track?.id && data.track.name ? data.track : null,
			currentTime: Math.max(0, data.currentTime),
			volume: Math.max(0, Math.min(1, data.volume)),
		};
	} catch {
		return null;
	}
}

export function parseShellNowPlaying(
	raw: DesktopNowPlayingShellState
):
	| (Omit<PersistedState, 'currentTime'> & { legacyCurrentTime?: number })
	| null {
	const volRaw = raw.volume;
	const volume =
		typeof volRaw === 'number' && !Number.isNaN(volRaw)
			? volRaw
			: Number(volRaw);
	if (Number.isNaN(volume)) return null;
	const tr = raw.track;
	const legacyCtRaw = raw.current_time;
	const legacyCurrentTime =
		typeof legacyCtRaw === 'number' && !Number.isNaN(legacyCtRaw)
			? legacyCtRaw
			: Number(legacyCtRaw);
	const normalizedLegacyTime =
		Number.isNaN(legacyCurrentTime) || legacyCurrentTime <= 0
			? undefined
			: Math.max(0, legacyCurrentTime);
	if (tr === null) {
		return {
			track: null,
			volume: Math.max(0, Math.min(1, volume)),
			legacyCurrentTime: normalizedLegacyTime,
		};
	}
	if (
		tr &&
		typeof tr === 'object' &&
		typeof tr.id === 'string' &&
		typeof tr.name === 'string' &&
		tr.id &&
		tr.name
	) {
		return {
			track: {
				id: tr.id,
				name: tr.name,
				thumbnail_url: tr.thumbnail_url ?? null,
				version:
					typeof tr.version === 'string' && tr.version.trim().length > 0
						? tr.version
						: null,
			},
			volume: Math.max(0, Math.min(1, volume)),
			legacyCurrentTime: normalizedLegacyTime,
		};
	}
	return null;
}

export function resolveHydratedCurrentTime(
	track: NowPlayingTrack | null,
	legacyCurrentTime?: number
): number {
	if (!track) return 0;
	const fromSession = readNowPlayingPositionSession(track.id);
	if (fromSession != null && fromSession > 0) {
		return fromSession;
	}
	if (legacyCurrentTime != null && legacyCurrentTime > 0) {
		writeNowPlayingPositionSession(track.id, legacyCurrentTime);
		return legacyCurrentTime;
	}
	return 0;
}

export function buildNowPlayingShellPatch(
	track: NowPlayingTrack | null,
	volume: number
): {
	now_playing: {
		track: {
			id: string;
			name: string;
			thumbnail_url: string | null;
			version: string | null;
		} | null;
		volume: number;
	};
} {
	return {
		now_playing: {
			track: track
				? {
						id: track.id,
						name: track.name,
						thumbnail_url: track.thumbnail_url ?? null,
						version: track.version ?? null,
					}
				: null,
			volume,
		},
	};
}

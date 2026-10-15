/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns Music Player page-level presentation constants and persisted list preference helpers.
 *
 * Invariants:
 * - Storage failures fall back to stable defaults without blocking the player.
 * - Shell classes continue to use Desktop design tokens.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 * - src/pages/MusicPlayer/MusicPlayerLoadingSkeleton.tsx
 */

import { cn } from '@/lib/utils';
import { DESKTOP_LUCIDE } from '../Desktop/constants';
import type { TrackOriginFilter } from './musicPlayerTypes';

export type TrackListDensity = 'compact' | 'dense';
export type TrackListViewMode = 'list' | 'grid';

export const TRACK_LIST_DENSITY_STORAGE_KEY =
	'eliteew.music-player.list-density.v1';
export const TRACK_LIST_VIEW_MODE_STORAGE_KEY =
	'eliteew.music-player.view-mode.v1';
export const TRACK_ORIGIN_FILTER_STORAGE_KEY =
	'eliteew.music-player.origin-filter.v1';
/** Wide stage dock (queue + now-playing) open preference; default open. */
export const STAGE_DOCK_OPEN_STORAGE_KEY = 'eliteew.music-player.stage-dock.v1';

export const MUSIC_GRID_SKELETON_KEYS = [
	'grid-1',
	'grid-2',
	'grid-3',
	'grid-4',
	'grid-5',
	'grid-6',
	'grid-7',
	'grid-8',
] as const;

export const MUSIC_ROW_SKELETON_KEYS = [
	'row-1',
	'row-2',
	'row-3',
	'row-4',
	'row-5',
	'row-6',
	'row-7',
	'row-8',
	'row-9',
] as const;

export const sw = DESKTOP_LUCIDE.stroke;

const shellClassBase =
	'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-(--desktop-text-primary) antialiased';
export const shellClassStandalone = `${shellClassBase} bg-(--desktop-surface-app)`;
export const shellClassEmbedded = `${shellClassBase} bg-transparent`;

export const searchInputClass =
	'w-full bg-transparent text-xs text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) focus:outline-none md:w-48';

export function segmentBtn(active: boolean): string {
	return cn(
		'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors duration-200',
		active
			? 'bg-(--desktop-surface-accent-strong) text-(--desktop-text-primary) shadow-(--desktop-shadow-soft)'
			: 'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-secondary)'
	);
}

function readMusicPlayerPreference(key: string): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		// Browser privacy settings may deny storage; the caller uses a stable default.
		return null;
	}
}

export function readTrackListDensity(): TrackListDensity {
	return readMusicPlayerPreference(TRACK_LIST_DENSITY_STORAGE_KEY) === 'dense'
		? 'dense'
		: 'compact';
}

export function readTrackListViewMode(): TrackListViewMode {
	return readMusicPlayerPreference(TRACK_LIST_VIEW_MODE_STORAGE_KEY) === 'grid'
		? 'grid'
		: 'list';
}

export function readTrackOriginFilter(): TrackOriginFilter {
	const raw = readMusicPlayerPreference(TRACK_ORIGIN_FILTER_STORAGE_KEY);
	return raw === 'generated' || raw === 'uploaded' ? raw : 'all';
}

/** Default true — ultrawide stage dock visible until user collapses it. */
export function readStageDockOpen(): boolean {
	return readMusicPlayerPreference(STAGE_DOCK_OPEN_STORAGE_KEY) !== '0';
}

export function persistMusicPlayerPreference(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Preferences are best effort; runtime state remains authoritative.
	}
}

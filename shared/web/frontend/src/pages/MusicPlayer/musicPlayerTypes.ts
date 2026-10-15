import type { Content } from '../../components/UnifiedContent/types';

export type FilterMode = 'all' | 'music';
export type RepeatMode = 'none' | 'all' | 'one';
export type TrackSortField = 'name' | 'date' | 'updated' | 'duration';
export type TrackSortOrder = 'asc' | 'desc';
export type TrackOriginFilter = 'all' | 'generated' | 'uploaded';

/** Default track list sort: newest created audio first. */
export const DEFAULT_TRACK_SORT_FIELD: TrackSortField = 'date';
export const DEFAULT_TRACK_SORT_ORDER: TrackSortOrder = 'desc';

export interface SavedPlaylist {
	id: string;
	name: string;
	trackIds: string[];
}

/** Встроенный плейлист «Любимые» — один на профиль браузера, нельзя удалить (только очистить). */
export const FAVORITES_PLAYLIST_ID = 'eliteew-music-favorites';

/** Canonical persisted display name for favorites playlist rows in shell-state / localStorage. */
export const FAVORITES_PLAYLIST_CANONICAL_NAME = 'Любимые';

function dedupePlaylistsById(playlists: SavedPlaylist[]): SavedPlaylist[] {
	const byId = new Map<string, SavedPlaylist>();
	for (const p of playlists) {
		const ids = [...(p.trackIds ?? [])];
		const cur = byId.get(p.id);
		if (!cur) {
			byId.set(p.id, { ...p, trackIds: ids });
		} else {
			byId.set(p.id, {
				...cur,
				name: p.name || cur.name,
				trackIds: Array.from(new Set([...cur.trackIds, ...ids])),
			});
		}
	}
	return Array.from(byId.values());
}

/**
 * Гарантирует наличие «Любимые» первым в списке и корректное имя (миграция со старых данных).
 * Сливает дубликаты одного и того же `id` (в т.ч. двойной «Любимые» в localStorage).
 */
export function normalizePlaylistsWithFavorites(
	playlists: SavedPlaylist[] | null | undefined
): SavedPlaylist[] {
	const raw: SavedPlaylist[] = Array.isArray(playlists)
		? playlists.map((p) => ({ ...p, trackIds: [...(p.trackIds ?? [])] }))
		: [];
	const list = dedupePlaylistsById(raw);
	let favIdx = list.findIndex((p) => p.id === FAVORITES_PLAYLIST_ID);
	if (favIdx === -1) {
		list.unshift({
			id: FAVORITES_PLAYLIST_ID,
			name: FAVORITES_PLAYLIST_CANONICAL_NAME,
			trackIds: [],
		});
		favIdx = 0;
	} else if (favIdx > 0) {
		const [fav] = list.splice(favIdx, 1);
		list.unshift(fav);
	}
	if (list[0]?.id === FAVORITES_PLAYLIST_ID) {
		list[0] = {
			...list[0],
			name: FAVORITES_PLAYLIST_CANONICAL_NAME,
			trackIds: Array.from(new Set(list[0].trackIds)),
		};
	}
	return list;
}

export interface ContentListResponse {
	items: Content[];
	total: number;
}

export const PLAYLIST_STORAGE_KEY = 'eliteew-music-playlists';
/** Unified Content list page size for audio library sync — smaller rows = smaller JSON per request (paginated). */
export const PAGE_SIZE = 50;

/** Use virtualizer when at or above this count (large lists: fewer DOM nodes). */
export const MUSIC_LIST_VIRTUAL_THRESHOLD = 80;

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Default state and activity helpers for EWDesk list filters and feed query mapping.
 *
 * Invariants:
 * - Default sort is newest-first; inactive state means no server-side filter flags.
 *
 * Related:
 * - EWDeskApp.tsx, services/productDesktopApi.ts
 */

import type { EwDeskNewsFeedFilters } from '../../services/productDesktopApi';

export type EwDeskListFilterState = {
	searchQuery: string;
	sortOrder: 'newest' | 'oldest';
	pinnedOnly: boolean;
	unreadOnly: boolean;
	starredOnly: boolean;
};

export const DEFAULT_EWDESK_LIST_FILTER_STATE: EwDeskListFilterState = {
	searchQuery: '',
	sortOrder: 'newest',
	pinnedOnly: false,
	unreadOnly: false,
	starredOnly: false,
};

export function isEwDeskListFiltersActive(
	state: EwDeskListFilterState
): boolean {
	return (
		state.searchQuery.trim().length > 0 ||
		state.pinnedOnly ||
		state.unreadOnly ||
		state.starredOnly ||
		state.sortOrder !== DEFAULT_EWDESK_LIST_FILTER_STATE.sortOrder
	);
}

export function buildEwDeskFeedFiltersFromListState(
	state: EwDeskListFilterState,
	deferredSearchNormalized = state.searchQuery.trim().toLowerCase()
): EwDeskNewsFeedFilters {
	return {
		...(deferredSearchNormalized ? { q: deferredSearchNormalized } : {}),
		...(state.pinnedOnly ? { pinnedOnly: true } : {}),
		...(state.unreadOnly ? { unreadOnly: true } : {}),
		...(state.starredOnly ? { starredOnly: true } : {}),
		sort: state.sortOrder,
	};
}

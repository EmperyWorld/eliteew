/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Structured active filter parts for EWDesk list toolbar summary (i18n in UI layer).
 *
 * Related:
 * - ewDeskListFilterState.ts, EWDeskApp.tsx
 */

import {
	DEFAULT_EWDESK_LIST_FILTER_STATE,
	type EwDeskListFilterState,
	isEwDeskListFiltersActive,
} from './ewDeskListFilterState';

export type EwDeskActiveFilterPart =
	| { kind: 'search'; query: string }
	| { kind: 'pinned' }
	| { kind: 'unread' }
	| { kind: 'starred' }
	| { kind: 'sortOldest' };

export function getEwDeskActiveFilterParts(
	state: EwDeskListFilterState
): EwDeskActiveFilterPart[] {
	if (!isEwDeskListFiltersActive(state)) return [];
	const parts: EwDeskActiveFilterPart[] = [];
	const query = state.searchQuery.trim();
	if (query) parts.push({ kind: 'search', query });
	if (state.pinnedOnly) parts.push({ kind: 'pinned' });
	if (state.unreadOnly) parts.push({ kind: 'unread' });
	if (state.starredOnly) parts.push({ kind: 'starred' });
	if (state.sortOrder !== DEFAULT_EWDESK_LIST_FILTER_STATE.sortOrder) {
		parts.push({ kind: 'sortOldest' });
	}
	return parts;
}

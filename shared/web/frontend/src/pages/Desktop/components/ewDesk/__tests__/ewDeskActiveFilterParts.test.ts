/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk active filter part extraction.
 */

import { describe, expect, it } from 'vitest';
import { getEwDeskActiveFilterParts } from '../ewDeskActiveFilterParts';
import { DEFAULT_EWDESK_LIST_FILTER_STATE } from '../ewDeskListFilterState';

describe('getEwDeskActiveFilterParts', () => {
	it('returns empty array when filters are default', () => {
		expect(
			getEwDeskActiveFilterParts(DEFAULT_EWDESK_LIST_FILTER_STATE)
		).toEqual([]);
	});

	it('returns ordered parts for combined filters', () => {
		expect(
			getEwDeskActiveFilterParts({
				...DEFAULT_EWDESK_LIST_FILTER_STATE,
				searchQuery: 'release',
				unreadOnly: true,
				sortOrder: 'oldest',
			})
		).toEqual([
			{ kind: 'search', query: 'release' },
			{ kind: 'unread' },
			{ kind: 'sortOldest' },
		]);
	});
});

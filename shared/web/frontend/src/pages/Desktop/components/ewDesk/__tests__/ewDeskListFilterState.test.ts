/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for EWDesk list filter default state and feed query mapping.
 */

import { describe, expect, it } from 'vitest';
import {
	buildEwDeskFeedFiltersFromListState,
	DEFAULT_EWDESK_LIST_FILTER_STATE,
	isEwDeskListFiltersActive,
} from '../ewDeskListFilterState';

describe('ewDeskListFilterState', () => {
	it('detects active filters against defaults', () => {
		expect(isEwDeskListFiltersActive(DEFAULT_EWDESK_LIST_FILTER_STATE)).toBe(
			false
		);
		expect(
			isEwDeskListFiltersActive({
				...DEFAULT_EWDESK_LIST_FILTER_STATE,
				searchQuery: 'release',
			})
		).toBe(true);
		expect(
			isEwDeskListFiltersActive({
				...DEFAULT_EWDESK_LIST_FILTER_STATE,
				unreadOnly: true,
			})
		).toBe(true);
		expect(
			isEwDeskListFiltersActive({
				...DEFAULT_EWDESK_LIST_FILTER_STATE,
				sortOrder: 'oldest',
			})
		).toBe(true);
	});

	it('maps list state to server feed filters', () => {
		expect(
			buildEwDeskFeedFiltersFromListState(DEFAULT_EWDESK_LIST_FILTER_STATE)
		).toEqual({ sort: 'newest' });
		expect(
			buildEwDeskFeedFiltersFromListState(
				{
					...DEFAULT_EWDESK_LIST_FILTER_STATE,
					searchQuery: '  Desk  ',
					unreadOnly: true,
				},
				'desk'
			)
		).toEqual({
			q: 'desk',
			unreadOnly: true,
			sort: 'newest',
		});
	});
});

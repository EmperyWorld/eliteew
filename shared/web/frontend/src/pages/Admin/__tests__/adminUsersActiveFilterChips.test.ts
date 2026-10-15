/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for admin Users active filter chips builder.
 */

import { describe, expect, it } from 'vitest';
import { ADMIN_DIRECTORY_SORT_I18N } from '../adminDirectorySort';
import {
	buildAdminUsersFilterChipDefs,
	clearAdminUsersFilterChip,
} from '../adminUsersActiveFilterChips';
import { DEFAULT_ADMIN_USERS_FILTERS } from '../adminUsersFilterPresets';

describe('adminUsersActiveFilterChips', () => {
	it('builds chips for non-default snapshot', () => {
		const chips = buildAdminUsersFilterChipDefs({
			...DEFAULT_ADMIN_USERS_FILTERS,
			mismatchOnly: true,
			search: 'poet',
		});
		expect(chips.some((c) => c.id === 'mismatch')).toBe(true);
		expect(chips.some((c) => c.id === 'search')).toBe(true);
	});

	it('sort chip uses i18n key not Russian label', () => {
		const chips = buildAdminUsersFilterChipDefs({
			...DEFAULT_ADMIN_USERS_FILTERS,
			sortValue: 'email:asc',
		});
		const sort = chips.find((c) => c.id === 'sort');
		expect(sort?.labelParams?.value).toBe(
			ADMIN_DIRECTORY_SORT_I18N['email:asc']
		);
	});

	it('clears chip by id', () => {
		const next = clearAdminUsersFilterChip('mismatch', {
			...DEFAULT_ADMIN_USERS_FILTERS,
			mismatchOnly: true,
		});
		expect(next.mismatchOnly).toBe(false);
	});
});

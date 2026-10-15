/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for directory column sort toggle.
 *
 * Related:
 * - `pages/Admin/adminDirectorySort.ts`
 */

import { describe, expect, it } from 'vitest';
import { toggleDirectoryColumnSort } from '../adminDirectorySort';

describe('toggleDirectoryColumnSort', () => {
	it('flips direction on same column', () => {
		expect(
			toggleDirectoryColumnSort('ew_balance', {
				sort_by: 'ew_balance',
				sort_dir: 'desc',
			})
		).toBe('ew_balance:asc');
	});

	it('defaults to desc on new column', () => {
		expect(
			toggleDirectoryColumnSort('username', {
				sort_by: 'created_at',
				sort_dir: 'desc',
			})
		).toBe('username:desc');
	});
});
